import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, radarSchema, getToday } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth context from verified token (S-2)
  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const featureType = 'radar';
  const cacheKey = `radar_${getToday()}`;

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
          error: 'Daily radar limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      'Perform a VC-grade market analysis. Provide 5 top trends, a core market shift, and 5 opportunity areas.',
      radarSchema
    );
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[radar] Generation error:', err);
    return res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
}
