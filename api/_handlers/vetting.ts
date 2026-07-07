import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithAI, Type, normalizeAIResponse } from '../_lib/ai-provider';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    verdict: { type: Type.STRING, enum: ['High Conviction', 'Moderate', 'Pass'] },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    riskMitigation: { type: Type.ARRAY, items: { type: Type.STRING } },
    pivotSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    comparableExits: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'score',
    'verdict',
    'strengths',
    'weaknesses',
    'riskMitigation',
    'pivotSuggestions',
    'comparableExits',
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const { idea, refresh } = req.body;

  // FIX (B-9, D-1): Validate required input
  if (!idea || typeof idea !== 'object') {
    return res.status(400).json({ error: 'Missing required field: idea' });
  }
  if (!idea.headline || typeof idea.headline !== 'string') {
    return res.status(400).json({ error: 'Missing required field: idea.headline' });
  }

  const safeHeadline = idea.headline
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, 200);

  const featureType = 'vetting';
  const cacheKey = idea?.id ? `vetting_${String(idea.id).slice(0, 100)}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached && !refresh) {
      return res.json({
        ...cached,
        _cached: true,
        _usage: await buildUsageResponse(uid, tier, featureType),
      });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier, featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily vetting limit reached. Upgrade for more expert analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const rawData = await generateWithAI(
      `Perform expert VC-grade vetting for this startup idea: ${safeHeadline}
      
      PITCH: ${idea.pitch || ''}
      JUSTIFICATION: ${idea.vcJustification || ''}
      
      TASK:
      1. Score 1-100 and provide a verdict.
      2. List 3-5 core strengths.
      3. List 3-5 critical weaknesses/risks.
      4. For EACH weakness, provide a specific risk mitigation strategy.
      5. Provide 3 pivot suggestions if needed.
      6. List 3 comparable startup exits.
      
      IMPORTANT: Return riskMitigation as an array of strings corresponding to the weaknesses.`,
      schema
    );

    const data = normalizeAIResponse(
      rawData,
      ['strengths', 'weaknesses', 'riskMitigation', 'pivotSuggestions', 'comparableExits'],
      {
        score: 50,
        verdict: 'Moderate',
        strengths: [],
        weaknesses: [],
        riskMitigation: [],
        pivotSuggestions: [],
        comparableExits: [],
        generatedAt: new Date().toISOString(),
      }
    );

    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[vetting] Generation error:', err);
    return res.status(500).json({ error: 'Vetting analysis failed. Please try again.' });
  }
}
