import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const schema = {
  type: Type.OBJECT,
  properties: {
    promptPack: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          prompt: { type: Type.STRING },
        },
        required: ['title', 'prompt'],
      },
    },
    repoStructure: { type: Type.STRING },
    first24Hours: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['promptPack', 'repoStructure', 'first24Hours'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idea, uid, tier } = req.body;
  const featureType = 'build-me';
  const cacheKey = idea?.id ? `build-me_${idea.id}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: await buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily build-me limit reached. Upgrade for more blueprints.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Generate Build-me pack for: ${idea.headline}`, schema);
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Build-me failed.', details: err.message });
  }
}
