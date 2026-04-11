import { GoogleGenAI, Type } from '@google/genai';

export { Type };

export const DEFAULT_SYSTEM_PROMPT = `You are Trend-Equity's principal venture scout — a seasoned analyst with deep expertise in early-stage VC, product strategy, and emerging markets. Your mission: surface business ideas that serious founders and investors would act on today.

QUALITY STANDARDS — every idea must pass all three tests:
1. SIGNAL-GROUNDED: Cite a specific, verifiable market event, data point, or regulatory shift from 2025–2026 in trendSources. Generic trends ("AI is growing") are not acceptable.
2. NON-OBVIOUS: Target second or third-order opportunities created by the trend — not the obvious direct play. If everyone sees the trend, find the problem it creates that nobody is solving yet.
3. STRUCTURAL EDGE: The unfairAdvantage field must describe a real, defensible moat — proprietary data, regulatory position, distribution lock-in, or network effects. "Better UX" and "first mover advantage" are not moats.

OUTPUT FORMAT: Respond with valid JSON matching the provided schema exactly. No markdown, no commentary outside the JSON.`;

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;

export async function generateWithGemini(
  prompt: string,
  schema?: any,
  systemInstruction?: string
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing from environment.');

  const ai = new GoogleGenAI({ apiKey });
  const modelToUse = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const response = await ai.models.generateContent({
    model: modelToUse,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction || SYSTEM_PROMPT,
      responseMimeType: schema ? 'application/json' : 'text/plain',
      responseSchema: schema,
    },
  });

  if (schema) {
    try {
      return JSON.parse(response.text);
    } catch {
      console.error('JSON Parse Error:', response.text);
      throw new Error('AI returned invalid JSON structure.');
    }
  }
  return { text: response.text };
}

// --- Shared Schemas ---

export const ideaSchema = {
  type: Type.OBJECT,
  properties: {
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
    marketSize: { type: Type.STRING },
    competitorLandscape: { type: Type.STRING },
    regulatoryFlags: { type: Type.STRING },
  },
  required: [
    'headline', 'pitch', 'vcJustification', 'categoryTags', 'costEffort',
    'revenuePotentialScore', 'revenueSkeleton', 'unfairAdvantage',
    'potentialExit', 'trendSources', 'saturationLabel', 'heatBadge', 'nextSteps',
    'marketSize', 'competitorLandscape', 'regulatoryFlags',
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
    marketShift: { type: Type.STRING },
    opportunityAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['week', 'topTrends', 'marketShift', 'opportunityAreas'],
};

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
