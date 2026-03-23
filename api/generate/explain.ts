import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini } from '../_lib/gemini';
import { getCached, setCached } from '../_lib/cache';
import { checkAndIncrementUsage } from '../_lib/usage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idea, section, context, uid, tier } = req.body;
  const featureType = 'explain';
  const cacheKey = idea?.id && section
    ? `explain_${idea.id}_${String(section).replace(/\s+/g, '_')}`
    : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    if (uid) {
      const usage = await checkAndIncrementUsage(uid, tier || 'free', featureType);
      if (!usage.allowed) {
        return res.status(429).json({ text: 'Daily explanation limit reached. Upgrade for more.', _limited: true });
      }
    }

    const data = await generateWithGemini(
      `Explain step "${section}" for idea: ${idea.headline}. Context: ${context}.`
    );
    await setCached(cacheKey, data);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ text: 'Explanation unavailable.', details: err.message });
  }
}
