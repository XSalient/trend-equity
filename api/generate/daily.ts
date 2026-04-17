import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, dailyResponseSchema, getToday } = AI;
import { fetchLiveSignals, formatSignalsForPrompt } from '../_lib/signals';
import { getRecentIdeaHeadlines } from '../_lib/cache';
import { getAdminDb } from '../_lib/admin';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementUsage } from '../_lib/usage';

// Max requests per unique IP per day (unauthenticated protection) (S-4)
const IP_DAILY_LIMIT = 5;
const _ipCounts: Map<string, { count: number; date: string }> = new Map();

function checkIpRateLimit(ip: string): boolean {
  const today = getToday();
  const entry = _ipCounts.get(ip);
  if (!entry || entry.date !== today) {
    _ipCounts.set(ip, { count: 1, date: today });
    return true;
  }
  if (entry.count >= IP_DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

// Sanitise a user-provided string for safe prompt injection (S-6)
function sanitiseInput(value: unknown, maxLen = 100): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>"`]/g, '')
    .trim()
    .slice(0, maxLen);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  if (!uid) return res.status(401).json({ error: 'Authentication required.' });

  // Rate limiting (S-4) omitted here because the Singleton pattern handles it via locking
  // and tier restriction.

  const today = getToday();

  try {
    const db = getAdminDb();
    const docRef = db.collection('daily_generations').doc(today);
    const existing = await docRef.get();

    // 1. Singleton Check: If it exists, return it immediately
    if (existing.exists) {
      return res.json(existing.data());
    }

    // 2. Authorization: Only allow 'builder' tier (Admin) to trigger the initial generation
    if (tier !== 'builder') {
      return res
        .status(403)
        .json({ error: 'Daily ideas are currently being curated. Please check back shortly.' });
    }

    // 3. Locking: Prevent concurrent AI calls
    const lockRef = db.collection('locks').doc(`daily_gen_${today}`);
    const isLocked = await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists && lockSnap.data()?.status === 'generating') {
        const startedAt = lockSnap.data()?.startedAt?.toDate();
        if (startedAt && Date.now() - startedAt.getTime() < 5 * 60 * 1000) return true;
      }
      tx.set(lockRef, { status: 'generating', startedAt: new Date(), uid });
      return false;
    });

    if (isLocked) {
      return res.status(429).json({ error: 'Generation already in progress.' });
    }

    const [signals, recentHeadlines] = await Promise.all([
      fetchLiveSignals(),
      getRecentIdeaHeadlines(today),
    ]);
    const signalContext = formatSignalsForPrompt(signals);

    const dedupeBlock =
      recentHeadlines.length > 0
        ? `\n\nDO NOT REPEAT RECENT IDEAS — these headlines were already generated in the past 3 days. Generate completely different problem spaces, target markets, and business models:\n${recentHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}\n`
        : '';

    const promptStr = signalContext
      ? `${signalContext}${dedupeBlock}\nUsing the live market signals above as your PRIMARY source, generate exactly 35 high-conviction business ideas for ${today}.`
      : `Generate exactly 35 high-conviction business ideas for ${today}.${dedupeBlock}`;

    // 4. Generate & Normalize
    const { normalizeAIResponse } = require('../_lib/ai-provider');
    const rawData = await generateWithAI(promptStr, dailyResponseSchema);

    const data = normalizeAIResponse(rawData, ['ideas'], {
      intro: "Today's high-signal ideas, curated from live market trends.",
      ideas: [],
      disclaimer: 'All ideas are AI-generated from real market signals.',
      date: today,
      generatedAt: new Date().toISOString(),
    });

    // 5. Persist and Unlock
    await docRef.set({
      ...data,
      date: today,
      generatedAt: new Date().toISOString(),
    });
    await lockRef.delete();

    return res.json(data);
  } catch (err: any) {
    console.error('[daily] Generation error:', err);
    return res.status(503).json({ error: 'AI generation temporarily unavailable.' });
  }
}
