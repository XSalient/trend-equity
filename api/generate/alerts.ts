import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, Type, getToday } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
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

  const { uid, tier } = req.body;
  const featureType = 'alerts';
  const cacheKey = `alerts_${getToday()}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({ error: 'Alert limit reached.' });
      }
    }

    const data = await generateWithGemini('Generate 3-5 high-signal Market Trend Alerts.', schema);
    await setCached(cacheKey, data);
    return res.json(data);
  } catch (err: any) {
    return res.json([{ title: 'AI Spike', message: 'Market signals active.', type: 'success' }]);
  }
}
