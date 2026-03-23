import { GoogleGenAI, Type } from '@google/genai';

export { Type };

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || '';

export async function generateWithGemini(
  prompt: string,
  schema?: any,
  systemInstruction?: string
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing from environment.');

  const ai = new GoogleGenAI({ apiKey });
  const modelToUse = 'gemini-2.0-flash';

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
  },
  required: [
    'headline', 'pitch', 'vcJustification', 'categoryTags', 'costEffort',
    'revenuePotentialScore', 'revenueSkeleton', 'unfairAdvantage',
    'potentialExit', 'trendSources', 'saturationLabel', 'heatBadge', 'nextSteps',
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
