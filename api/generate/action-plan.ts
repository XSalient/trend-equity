import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    roadmap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          step: { type: Type.STRING },
          details: { type: Type.STRING },
          milestone: { type: Type.STRING },
        },
        required: ['id', 'step', 'details', 'milestone'],
      },
    },
    tools: { type: Type.ARRAY, items: { type: Type.STRING } },
    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
    timeline: { type: Type.STRING },
  },
  required: ['roadmap', 'tools', 'risks', 'timeline'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idea, uid, tier } = req.body;
  const featureType = 'action-plan';
  const cacheKey = idea?.id ? `action-plan_${idea.id}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: await buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily action plan limit reached. Upgrade for more plans.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Generate roadmap for: ${idea.headline}`, schema);
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Action plan failed.', details: err.message });
  }
}
