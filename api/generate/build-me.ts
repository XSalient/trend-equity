import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
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

  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const { idea } = req.body;

  // FIX (B-9, D-1): Validate required input
  if (!idea || typeof idea !== 'object') {
    return res.status(400).json({ error: 'Missing required field: idea' });
  }
  if (!idea.headline || typeof idea.headline !== 'string') {
    return res.status(400).json({ error: 'Missing required field: idea.headline' });
  }

  const safeHeadline = idea.headline.replace(/[<>"`]/g, '').trim().slice(0, 200);

  const featureType = 'build-me';
  const cacheKey = idea?.id ? `build-me_${String(idea.id).slice(0, 100)}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _usage: await buildUsageResponse(uid, tier, featureType) });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier, featureType);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily build-me limit reached. Upgrade for more blueprints.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(`Generate a Build-with-me AI prompt pack and repo structure for: ${safeHeadline}`, schema);
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[build-me] Generation error:', err);
    return res.status(500).json({ error: 'Build pack generation failed. Please try again.' });
  }
}
