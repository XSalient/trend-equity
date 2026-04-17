import { GoogleGenAI } from '@google/genai';

export const DEFAULT_SYSTEM_PROMPT = `You are Trend-Equity's principal venture scout — a seasoned analyst with deep expertise in early-stage VC, product strategy, and emerging markets. Your mission: surface business ideas that serious founders and investors would act on today.

QUALITY STANDARDS — every idea must pass all three tests:
1. SIGNAL-GROUNDED: Cite a specific, verifiable market event, data point, or regulatory shift from 2025–2026 in trendSources. Generic trends ("AI is growing") are not acceptable.
2. NON-OBVIOUS: Target second or third-order opportunities created by the trend — not the obvious direct play. If everyone sees the trend, find the problem it creates that nobody is solving yet.
3. STRUCTURAL EDGE: The unfairAdvantage field must describe a real, defensible moat — proprietary data, regulatory position, distribution lock-in, or network effects. "Better UX" and "first mover advantage" are not moats.

OUTPUT FORMAT: Respond with valid JSON matching the provided schema exactly. No markdown, no commentary outside the JSON.`;

// 1. DATA TYPES
export const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
} as const;

export interface AIResponse {
  text: string;
  parsed?: any;
}

export interface GenerationOptions {
  prompt: string;
  schema?: any;
  systemInstruction?: string;
  model?: string;
}

export interface AIProvider {
  readonly name: string;
  generate(options: GenerationOptions): Promise<AIResponse>;
}

// 2. PROVIDERS

/**
 * Google AI Implementation using @google/genai SDK.
 * Note: Uses apiVersion: 'v1' and snake_case for payload properties to ensure
 * compatibility with the stable REST endpoint.
 */
class GoogleProvider implements AIProvider {
  readonly name = 'google';
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing from environment.');
    // Explicitly using 'v1' for stability as our probe showed v1beta was returning 404 for 1.5-flash
    return this.client || (this.client = new GoogleGenAI({ apiKey }));
  }

  async generate(options: GenerationOptions): Promise<AIResponse> {
    const client = this.getClient();
    const modelId = options.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    console.log(`[GoogleProvider] Calling ${modelId}...`);

    // Using generic object for params to avoid TS strictness with snake_case vs camelCase
    // in the preview SDK, while ensuring the underlying API gets what it expects.
    const params: any = {
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      system_instruction: options.systemInstruction, // Snake case for v1
      config: {
        response_mime_type: options.schema ? 'application/json' : 'text/plain',
        response_schema: options.schema, // Snake case for v1
      },
    };

    const resp = await client.models.generateContent(params);

    if (!resp.text) {
      throw new Error('Google AI returned an empty response.');
    }

    const result: AIResponse = { text: resp.text };
    if (options.schema) {
      try {
        result.parsed = JSON.parse(resp.text);
      } catch (e) {
        console.error('[GoogleProvider] JSON Parse Error:', resp.text.slice(0, 100));
        throw new Error('AI returned invalid JSON structure.');
      }
    }
    return result;
  }
}

/**
 * Strip markdown code fences that some models wrap JSON responses in.
 * E.g. ```json\n{...}\n``` → {...}
 */
function cleanJSON(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/**
 * OpenRouter Implementation via Fetch.
 */
class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';

  async generate(options: GenerationOptions): Promise<AIResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY missing from environment.');

    // Use a model that reliably honours json_object format. Override via AI_MODEL env var.
    const modelId = options.model || process.env.AI_MODEL || 'google/gemini-2.5-flash';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Trend-Equity',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: options.systemInstruction || 'VC Analyst' },
          { role: 'user', content: options.prompt },
        ],
        response_format: options.schema ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter Error: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error('OpenRouter returned an empty response.');
    }

    const text = cleanJSON(rawText);
    const result: AIResponse = { text };
    if (options.schema) {
      try {
        result.parsed = JSON.parse(text);
      } catch (e) {
        console.error(
          '[OpenRouterProvider] JSON Parse Error. Raw (first 300 chars):',
          rawText.slice(0, 300)
        );
        throw new Error('AI returned invalid JSON structure.');
      }
    }
    return result;
  }
}

// 3. FACTORY
export function getAIProvider(): AIProvider {
  // Priority: OpenRouter -> Google
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenRouterProvider();
  }
  return new GoogleProvider();
}

/**
 * Central AI generation entry point.
 * FIX: Injects a strict JSON-only instruction suffix to every schema-based prompt
 * to reduce the chance of markdown or conversational filler.
 */
export async function generateWithAI(
  prompt: string,
  schema?: any,
  systemInstruction?: string
): Promise<any> {
  const provider = getAIProvider();

  // Inject strict JSON instruction if schema is provided
  const finalPrompt = schema
    ? `${prompt}\n\nIMPORTANT: Return ONLY a raw JSON object matching the requested schema. No markdown code fences, no preamble, no conversational text. Start with { and end with }.`
    : prompt;

  console.log(`[AI] Using provider: ${provider.name} for prompt: ${prompt.slice(0, 50)}...`);

  try {
    const resp = await provider.generate({
      prompt: finalPrompt,
      schema,
      systemInstruction: systemInstruction || DEFAULT_SYSTEM_PROMPT,
    });
    console.log(`[AI] ${provider.name} status: SUCCESS`);
    return schema ? resp.parsed : resp.text;
  } catch (err: any) {
    console.error(`[AI] ${provider.name} status: FAILED - ${err.message}`);
    throw err;
  }
}

/**
 * Normalizes an AI response to ensure it matches the expected object structure.
 * If the AI returns an array but an object was expected, it wraps the array
 * into the first provided 'wrapperKey'. If fields are missing, it merges with 'fallback'.
 */
export function normalizeAIResponse<T extends object>(
  data: any,
  wrapperKeys: (keyof T)[],
  fallback: T
): T {
  if (!data) return fallback;

  // Handle Case: AI ignored the schema and returned a plain array
  if (Array.isArray(data)) {
    console.warn(`[AI Normalizer] Wrapping naked array into ${String(wrapperKeys[0])}`);
    const wrapped: any = { ...fallback };
    wrapped[wrapperKeys[0]] = data;
    return wrapped as T;
  }

  // Handle Case: AI returned an object but might be missing expected array fields
  const result = { ...fallback, ...data };
  for (const key of wrapperKeys) {
    if (!Array.isArray(result[key])) {
      console.warn(`[AI Normalizer] Field ${String(key)} missing or not an array. Recovering...`);
      result[key] = (fallback as any)[key] || [];
    }
  }

  return result;
}

// 5. SCHEMAS
export const ideaSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    headline: { type: Type.STRING },
    pitch: { type: Type.STRING },
    vcJustification: { type: Type.STRING },
    categoryTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    costEffort: { type: Type.STRING },
    revenuePotentialScore: { type: Type.NUMBER },
    revenueSkeleton: { type: Type.STRING },
    unfairAdvantage: { type: Type.STRING },
    potentialExit: { type: Type.STRING },
    trendSources: { type: Type.ARRAY, items: { type: Type.STRING } },
    saturationLabel: { type: Type.STRING },
    heatBadge: { type: Type.STRING },
    nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
    competitorLandscape: { type: Type.STRING },
    regulatoryFlags: { type: Type.STRING },
  },
  required: [
    'headline',
    'pitch',
    'vcJustification',
    'categoryTags',
    'costEffort',
    'revenuePotentialScore',
    'revenueSkeleton',
    'unfairAdvantage',
    'potentialExit',
    'trendSources',
    'saturationLabel',
    'heatBadge',
    'nextSteps',
  ],
};

export const dailyResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intro: { type: Type.STRING },
    ideas: { type: Type.ARRAY, items: ideaSchema },
    disclaimer: { type: Type.STRING },
  },
  required: ['intro', 'ideas', 'disclaimer'],
};

export const radarSchema = {
  type: Type.OBJECT,
  properties: {
    week: { type: Type.STRING },
    marketShift: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ['title', 'description'],
    },
    topTrends: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          impact: { type: Type.STRING },
          sector: { type: Type.STRING },
        },
        required: ['title', 'description', 'impact', 'sector'],
      },
    },
    opportunityAreas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['week', 'marketShift', 'topTrends', 'opportunityAreas'],
};

export function getToday() {
  return new Date().toISOString().split('T')[0];
}

// 6. DEFAULT EXPORT
export default {
  generateWithAI,
  generateWithGemini: generateWithAI,
  Type,
  ideaSchema,
  radarSchema,
  dailyResponseSchema,
  getAIProvider,
  getToday,
  DEFAULT_SYSTEM_PROMPT,
};
