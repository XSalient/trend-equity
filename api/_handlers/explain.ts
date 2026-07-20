import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithAI } from '../_lib/ai-provider';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext, requireTier } from '../_lib/auth';
import { checkAndIncrementUsage } from '../_lib/usage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  if (!authCtx) return res.status(401).json({ error: 'Authentication required.' });
  const tierCheck = requireTier(authCtx, 'builder');
  if (tierCheck) return res.status(tierCheck.status).json(tierCheck.body);
  const { uid, tier } = authCtx;

  const { idea, section, context } = req.body;

  // FIX (B-9, D-1): Validate required inputs
  if (!idea || typeof idea !== 'object') {
    return res.status(400).json({ error: 'Missing required field: idea' });
  }
  if (!idea.headline || typeof idea.headline !== 'string') {
    return res.status(400).json({ error: 'Missing required field: idea.headline' });
  }
  if (!section || typeof section !== 'string') {
    return res.status(400).json({ error: 'Missing required field: section' });
  }

  // FIX (S-6): Sanitise all user-controlled strings before prompt injection
  const safeHeadline = idea.headline
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, 200);
  const safeSection = String(section)
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, 100);
  const safeContext = context
    ? String(context)
        .replace(/[<>"`]/g, '')
        .trim()
        .slice(0, 500)
    : '';

  const featureType = 'explain';
  const cacheKey =
    idea?.id && safeSection
      ? `explain_${String(idea.id).slice(0, 100)}_${safeSection.replace(/\s+/g, '_')}`
      : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });

    const usage = await checkAndIncrementUsage(uid, tier, featureType);
    if (!usage.allowed) {
      return res
        .status(429)
        .json({ text: 'Daily explanation limit reached. Upgrade for more.', _limited: true });
    }

    const data = await generateWithAI(
      `Explain the "${safeSection}" aspect for this startup idea: ${safeHeadline}${safeContext ? `. Additional context: ${safeContext}` : ''}`
    );
    await setCached(cacheKey, data);
    return res.json(data);
  } catch (err: any) {
    console.error('[explain] Generation error:', err);
    return res.status(500).json({ text: 'Explanation unavailable. Please try again.' });
  }
}
