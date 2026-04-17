import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, Type, getToday } = AI;
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage } from '../_lib/usage';

const schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      message: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['info', 'success', 'warning', 'error'] },
    },
    required: ['title', 'message', 'type'],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth context from verified token (never from body)
  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  const featureType = 'alerts';
  const cacheKey = `alerts_${getToday()}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier, featureType);
      if (!usage.allowed) {
        return res.status(429).json({ error: 'Alert limit reached.' });
      }
    }

    const data = await generateWithAI('Generate 3-5 high-signal Market Trend Alerts.', schema);
    await setCached(cacheKey, data);
    return res.json(data);
  } catch (err: any) {
    // FIX (B-7): Return empty array on error — never fabricate fake market data
    console.error('[alerts] Generation error:', err);
    return res.json([]);
  }
}
