import { getAIProvider, generateWithAI, normalizeAIResponse, Type } from './ai-provider';

/**
 * Evidence layer — grounds an idea in real, verifiable market data via Google
 * Search grounding. Two-step because grounding tools are incompatible with
 * JSON schema mode: (1) grounded free-text research, (2) cheap structuring
 * pass. Source URLs come from the grounding metadata (real search results),
 * never from model-written text alone.
 */

const RESEARCH_SYSTEM_PROMPT = `You are a market research analyst doing diligence for a seed-stage VC. Research the given startup idea using current web search results. Report only what the search results support — if you cannot find evidence for a claim, say so. Cover: (1) direct competitors currently operating, (2) cited market size figures with their source, (3) recent (2025-2026) evidence for or against the timing of this idea.`;

export interface IdeaEvidence {
  competitors: { name: string; oneLiner: string }[];
  marketSizeCited: string;
  whyNowEvidence: string;
  sources: { title: string; url: string }[];
  evidenceScore: number;
  generatedAt?: string;
}

export const evidenceSchema = {
  type: Type.OBJECT,
  properties: {
    competitors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          oneLiner: { type: Type.STRING },
        },
        required: ['name', 'oneLiner'],
      },
    },
    marketSizeCited: { type: Type.STRING },
    whyNowEvidence: { type: Type.STRING },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
        },
        required: ['title', 'url'],
      },
    },
    evidenceScore: { type: Type.NUMBER },
  },
  required: ['competitors', 'marketSizeCited', 'whyNowEvidence', 'sources', 'evidenceScore'],
};

function getEvidenceModel(): string {
  // Grounding requires Gemini 2.x models
  return process.env.GEMINI_EVIDENCE_MODEL || 'gemini-2.5-flash';
}

export async function gatherEvidence(idea: {
  headline: string;
  pitch?: string;
}): Promise<IdeaEvidence> {
  // Step 1: grounded free-text research (no schema — incompatible with tools)
  const provider = getAIProvider();
  const researchResp = await provider.generate({
    prompt: `Research the market for this startup idea:\n\nIDEA: ${idea.headline}\nPITCH: ${idea.pitch || ''}\n\nFind: current direct competitors, cited market size figures, and recent (2025-2026) evidence for or against the timing ("why now"). Cite specific data points.`,
    systemInstruction: RESEARCH_SYSTEM_PROMPT,
    model: getEvidenceModel(),
    tools: [{ googleSearch: {} }],
  });

  const groundedSources = (researchResp.groundingChunks || []).map((c) => ({
    title: c.title || c.uri || 'Source',
    url: c.uri || '',
  }));

  // Step 2: structure the grounded findings with a cheap schema call
  const structurePrompt = `Convert the following market research findings into the requested JSON structure.

RESEARCH FINDINGS:
"""
${researchResp.text}
"""

RULES:
- competitors: up to 5 direct competitors actually named in the findings ({name, oneLiner}).
- marketSizeCited: the market size figure WITH its cited source, or "No reliable figure found" if the findings lack one.
- whyNowEvidence: 1-2 sentences on the strongest recent evidence for/against timing.
- sources: leave as an empty array (real source URLs are attached separately).
- evidenceScore: 1-10 — how strongly the findings support this idea's premise (10 = strong demand signals + clear gap; 1 = findings contradict the premise or nothing found).`;

  const rawData = await generateWithAI(structurePrompt, evidenceSchema);
  const data = normalizeAIResponse(rawData, ['competitors', 'sources'], {
    competitors: [] as { name: string; oneLiner: string }[],
    marketSizeCited: 'No reliable figure found',
    whyNowEvidence: '',
    sources: [] as { title: string; url: string }[],
    evidenceScore: 5,
  });

  return {
    ...data,
    // Only real grounding URLs — never trust model-written links
    sources: groundedSources,
    generatedAt: new Date().toISOString(),
  };
}
