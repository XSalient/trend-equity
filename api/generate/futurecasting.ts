import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';

const VALID_HORIZONS = ['2027', '2030', '2035'] as const;

const schema = {
  type: Type.OBJECT,
  properties: {
    horizon: { type: Type.STRING },
    predictions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          probability: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          winners: { type: Type.ARRAY, items: { type: Type.STRING } },
          losers: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['title', 'probability', 'rationale', 'winners', 'losers'],
      },
    },
    paradigmShifts: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['horizon', 'predictions', 'paradigmShifts'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  // FIX (D-1, S-6): Whitelist horizon values — never trust free-form input in prompts
  const rawHorizon = req.body?.horizon;
  const horizon = VALID_HORIZONS.includes(rawHorizon) ? rawHorizon : '2030';

  const featureType = 'futurecasting';
  const cacheKey = `futurecasting_${horizon}`;

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
          error: 'Daily futurecasting limit reached. Upgrade for more analyses.',
          _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
        });
      }
    }

    const data = await generateWithGemini(
      `Perform a deep-future technology and market simulation up to the year ${horizon}. Provide 5 high-probability predictions with rationale, winners, and losers, plus 3 paradigm shifts.`,
      schema
    );
    await setCached(cacheKey, data);
    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[futurecasting] Generation error:', err);
    return res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
}
