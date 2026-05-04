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
 */
class GoogleProvider implements AIProvider {
  readonly name = 'google';
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing from environment.');
    return this.client || (this.client = new GoogleGenAI({ apiKey }));
  }

  async generate(options: GenerationOptions): Promise<AIResponse> {
    const client = this.getClient();
    const modelId = options.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    console.log(`[GoogleProvider] Calling ${modelId}...`);

    const params: any = {
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      system_instruction: options.systemInstruction,
      config: {
        response_mime_type: options.schema ? 'application/json' : 'text/plain',
        response_schema: options.schema,
      },
    };

    const resp = await client.models.generateContent(params);

    if (!resp.text) {
      throw new Error('Google AI returned an empty response.');
    }

    const result: AIResponse = { text: resp.text };
    if (options.schema) {
      try {
        const cleaned = cleanJSON(resp.text);
        result.parsed = JSON.parse(cleaned);
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
 */
function cleanJSON(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

// 3. FACTORY
export function getAIProvider(): AIProvider {
  return new GoogleProvider();
}

/**
 * Central AI generation entry point.
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
 * Standardizes array fields and ensures string fields are actually strings.
 */
export function normalizeAIResponse<T extends object>(
  data: any,
  wrapperKeys: (keyof T)[],
  fallback: T
): T {
  if (!data || typeof data !== 'object') return fallback;

  // Handle Case: AI ignored the schema and returned a plain array
  if (Array.isArray(data)) {
    console.warn(`[AI Normalizer] Wrapping naked array into ${String(wrapperKeys[0])}`);
    const wrapped: any = { ...fallback };
    wrapped[wrapperKeys[0]] = data;
    return wrapped as T;
  }

  // Handle Case: AI returned an object but might be missing expected array fields or have corrupted string fields
  const result: any = { ...fallback };
  
  const findKey = (target: string, obj: any) => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj[target] !== undefined) return obj[target];
    const lowerTarget = target.toLowerCase();
    const snakeTarget = target.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    for (const k in obj) {
      const lowerK = k.toLowerCase();
      if (lowerK === lowerTarget) return obj[k];
      if (lowerK === snakeTarget) return obj[k];
      if (lowerK === target.toLowerCase().replace(/_/g, '')) return obj[k];
    }
    return undefined;
  };

  for (const key in fallback) {
    const val = findKey(key, data);
    const fallbackVal = (fallback as any)[key];

    if (val === undefined || val === null) {
      result[key] = fallbackVal;
      continue;
    }

    if (Array.isArray(fallbackVal)) {
      if (!Array.isArray(val)) {
        result[key] = [];
      } else {
        // If the first item in fallback is a string, ensure all items in val are strings
        if (typeof fallbackVal[0] === 'string') {
          result[key] = val.map(item => typeof item === 'string' ? item : JSON.stringify(item));
        } else {
          result[key] = val;
        }
      }
    } else if (typeof fallbackVal === 'object' && fallbackVal !== null) {
      // Recursive call for nested objects
      result[key] = normalizeAIResponse(val, Object.keys(fallbackVal), fallbackVal);
    } else if (typeof fallbackVal === 'string') {
      result[key] = typeof val === 'string' ? val : JSON.stringify(val);
    } else if (typeof fallbackVal === 'number') {
      result[key] = typeof val === 'number' ? val : Number(val) || fallbackVal;
    } else {
      result[key] = val;
    }
  }

  return result as T;
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
    marketSize: { type: Type.STRING },
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
    'marketSize',
    'competitorLandscape',
    'regulatoryFlags',
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
  normalizeAIResponse,
  DEFAULT_SYSTEM_PROMPT,
};
