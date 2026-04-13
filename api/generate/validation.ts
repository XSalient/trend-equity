import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
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

  const safeHeadline = idea.headline
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, 200);

  const featureType = 'validation';
  const cacheKey = idea?.id ? `validation_${String(idea.id).slice(0, 100)}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
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
          error: 'Daily validation limit reached. Upgrade for more toolkits.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      `Generate a validation toolkit for: ${safeHeadline}`,
      schema
    );
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[validation] Generation error:', err);
    return res
      .status(500)
      .json({ error: 'Validation toolkit generation failed. Please try again.' });
  }
}
