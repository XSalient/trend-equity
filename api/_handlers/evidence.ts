import type { VercelRequest, VercelResponse } from '@vercel/node';
import { gatherEvidence } from '../_lib/evidence';
import { getCached, setCached } from '../_lib/cache';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../_lib/usage';
import { getAdminDb } from '../_lib/admin';

/**
 * On-demand evidence gathering for a single idea (grounded Google Search).
 * Cached 24h per idea — grounding is the most expensive AI call in the app.
 * The result is also patched onto the idea inside daily_generations/{date}
 * so the whole feed benefits from one user's request.
 */

async function patchIdeaInDailyDoc(date: string, ideaId: string, evidence: any): Promise<void> {
  try {
    const db = getAdminDb();
    const docRef = db.collection('daily_generations').doc(date);
    const snap = await docRef.get();
    if (!snap.exists) return;
    const data = snap.data();
    if (!Array.isArray(data?.ideas)) return;
    let found = false;
    const ideas = data.ideas.map((i: any) => {
      if (i?.id === ideaId) {
        found = true;
        return { ...i, evidence };
      }
      return i;
    });
    if (found) await docRef.set({ ideas }, { merge: true });
  } catch (e) {
    console.error('[evidence] Failed to patch daily doc (non-fatal):', e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  if (!uid) {
    return res.status(401).json({ error: 'Sign in to gather market evidence.' });
  }

  const { idea, date, refresh } = req.body;

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
  const safePitch =
    typeof idea.pitch === 'string' ? idea.pitch.replace(/[<>"`]/g, '').slice(0, 500) : '';

  const featureType = 'evidence';
  const cacheKey = idea?.id ? `evidence_${String(idea.id).slice(0, 100)}` : '';

  try {
    const cached = await getCached(cacheKey);
    if (cached && !refresh) {
      return res.json({
        ...cached,
        _cached: true,
        _usage: await buildUsageResponse(uid, tier, featureType),
      });
    }

    const usage = await checkAndIncrementUsage(uid, tier, featureType);
    if (!usage.allowed) {
      return res.status(429).json({
        error: 'Daily evidence limit reached. Upgrade for more market research.',
        _usage: { featureType, remaining: 0, limit: usage.limit, used: usage.limit },
      });
    }

    const data = await gatherEvidence({ headline: safeHeadline, pitch: safePitch });

    await setCached(cacheKey, data);
    if (idea?.id && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      await patchIdeaInDailyDoc(date, idea.id, data);
    }

    return res.json({ ...data, _usage: await buildUsageResponse(uid, tier, featureType) });
  } catch (err: any) {
    console.error('[evidence] Generation error:', err);
    return res.status(500).json({ error: 'Evidence gathering failed. Please try again.' });
  }
}
