import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    landingPage: {
      type: Type.OBJECT,
      properties: {
        hero: { type: Type.STRING },
        subHero: { type: Type.STRING },
        valueProps: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['hero', 'subHero', 'valueProps'],
    },
    interviewScript: { type: Type.ARRAY, items: { type: Type.STRING } },
    smokeTest: { type: Type.STRING },
    successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['landingPage', 'interviewScript', 'smokeTest', 'successMetrics'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idea, uid, tier } = req.body;
  const featureType = 'validation';
  const cacheKey = idea?.id ? `validation_${idea.id}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: await buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily validation limit reached. Upgrade for more toolkits.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Generate validation toolkit for: ${idea.headline}`, schema);
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Validation toolkit failed.', details: err.message });
  }
}
