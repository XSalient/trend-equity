import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, dailyResponseSchema, getToday } from '../_lib/gemini';
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
  return value.replace(/[<>"`]/g, '').trim().slice(0, maxLen);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth context (S-2): uid/tier come from verified token, never body
  const authCtx = await getAuthContext(req);
  const uid = authCtx?.uid;
  const tier = authCtx?.tier || 'free';

  // Per-user rate limiting for authenticated users (S-4)
  if (uid) {
    const usage = await checkAndIncrementUsage(uid, tier, 'daily');
    if (!usage.allowed) {
      return res.status(429).json({ error: 'Daily generation limit reached. Please try again tomorrow.' });
    }
  } else {
    // IP-based rate limit for unauthenticated requests
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    if (!checkIpRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many requests. Please sign in or try again tomorrow.' });
    }
  }

  // FIX (D-2): Derive date server-side — never trust the client
  const today = getToday();

  // Sanitise country input before embedding in prompt (S-6)
  const country = sanitiseInput(req.body?.country, 60);
  const countryCount = Math.min(Math.max(0, Number(req.body?.countryCount) || 0), 10);

  try {
    const [signals, recentHeadlines] = await Promise.all([
      fetchLiveSignals(),
      getRecentIdeaHeadlines(today),
    ]);
    const signalContext = formatSignalsForPrompt(signals);

    const dedupeBlock = recentHeadlines.length > 0
      ? `\n\nDO NOT REPEAT RECENT IDEAS — these headlines were already generated in the past 3 days. Generate completely different problem spaces, target markets, and business models:\n${recentHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}\n`
      : '';

    let promptStr = signalContext
      ? `${signalContext}${dedupeBlock}\nUsing the live market signals above as your PRIMARY source, generate exactly 35 high-conviction business ideas for ${today}.\n\nREQUIREMENTS:\n- Every idea MUST cite ≥1 specific signal in trendSources — include the actual data point, not just the source name\n- Identify SECOND-ORDER opportunities: what problem does each trending signal CREATE that is currently undersolved?\n- Enforce sector diversity: no more than 3 ideas from any single sector (AI/ML, FinTech, HealthTech, EdTech, CleanTech, Consumer, B2B SaaS, Marketplace, PropTech, AgriTech, LegalTech, etc.)\n- The unfairAdvantage field must describe a STRUCTURAL edge (proprietary data, regulatory moat, distribution lock-in, network effects) — never "better UX" or "first mover"\n- Cover all effort levels: at least 8 ideas buildable solo in under 6 weeks, at least 8 requiring a small team, the rest for well-funded teams\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`
      : `Generate exactly 35 high-conviction business ideas for ${today}.${dedupeBlock}\n\nREQUIREMENTS:\n- Enforce sector diversity: no more than 3 ideas from any single sector\n- Each idea must have a STRUCTURAL unfair advantage (proprietary data, regulatory moat, distribution lock-in, network effects)\n- Cover all effort levels: mix of solo-buildable, small team, and well-funded team ideas\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`;

    if (country && country !== 'Global' && countryCount > 0) {
      promptStr += ` Include exactly ${countryCount} ideas heavily tailored for the market and demographics in ${country}. Ensure those ideas include the exact string "Local Market" in their categoryTags array.`;
    }

    const data = await generateWithGemini(promptStr, dailyResponseSchema);

    // FIX (B-2): Persist to Firestore server-side using Admin SDK (bypasses client rules)
    // Only creates if it doesn't already exist — idempotent
    try {
      const db = getAdminDb();
      const docRef = db.collection('daily_generations').doc(today);
      const existing = await docRef.get();
      if (!existing.exists) {
        await docRef.set({
          date: today,
          intro: data.intro,
          ideas: data.ideas,
          disclaimer: data.disclaimer,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[daily] Firestore persist error (non-fatal):', e);
    }

    return res.json(data);
  } catch (err: any) {
    console.error('[daily] Generation error:', err);
    return res.status(503).json({ error: 'AI generation temporarily unavailable. Please try again later.' });
  }
}
