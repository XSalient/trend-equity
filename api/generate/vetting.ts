import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    verdict: { type: Type.STRING, enum: ['High Conviction', 'Moderate', 'Pass'] },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    pivotSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    comparableExits: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['score', 'verdict', 'strengths', 'weaknesses', 'pivotSuggestions', 'comparableExits'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idea, uid, tier } = req.body;
  const featureType = 'vetting';
  const cacheKey = idea?.id ? `vetting_${idea.id}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: await buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily vetting limit reached. Upgrade for more expert analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Perform expert vetting for: ${idea.headline}`, schema);
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Vetting failed.', details: err.message });
  }
}
