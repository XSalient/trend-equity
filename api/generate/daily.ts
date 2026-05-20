import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, dailyResponseSchema, getToday, normalizeAIResponse } = AI;
import { fetchLiveSignals, formatSignalsForPrompt } from '../_lib/signals';
import { getRecentIdeaHeadlines } from '../_lib/cache';
import { getAdminDb } from '../_lib/admin';
import { getAuthContext } from '../_lib/auth';

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

  const { date, country, countryCount, refresh } = req.body;
  const today = sanitiseInput(date, 10) || getToday();

  try {
    const db = getAdminDb();
    const docRef = db.collection('daily_generations').doc(today);

    // 1. Singleton Check: If it exists, return it immediately UNLESS refresh is requested
    if (!refresh) {
      const existing = await docRef.get();
      if (existing.exists) {
        return res.json(existing.data());
      }
    }

    // 2. Authorization: Only allow 'builder' tier (Admin) to refresh (regenerate) existing generation.
    // However, any tier (including free/pro/anonymous) can trigger the initial daily generation.
    if (refresh && tier !== 'builder') {
      return res
        .status(403)
        .json({ error: 'Only administrators can refresh the daily generation.' });
    }

    console.log(`[daily] Triggering generation for ${today} (refresh=${!!refresh})`);

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

    const countryClause =
      country && country !== 'Global'
        ? `\n\nAdditionally, specifically include ${countryCount || 5} ideas tailored for the ${country} Local Market.`
        : '';

    const qualityBlock = `\n\nREQUIREMENTS FOR EVERY IDEA:\n- Cite ≥1 specific signal in trendSources — include the actual data point, not just the source name\n- Find SECOND-ORDER opportunities: what problem does the signal CREATE downstream that is currently undersolved?\n- Enforce sector diversity: no more than 3 ideas from any single sector (AI/ML, FinTech, HealthTech, EdTech, CleanTech, Consumer, B2B SaaS, Marketplace, PropTech, AgriTech, LegalTech, GovTech, etc.)\n- unfairAdvantage must describe a STRUCTURAL edge (proprietary data, regulatory moat, distribution lock-in, network effects) — never "better UX" or "first mover"\n- Spread effort levels: at least 8 solo-buildable (<6 weeks), at least 8 small-team, the rest for well-funded teams\n- At least 20% of ideas should address markets outside the US\n- AVOID: generic AI assistants without proprietary data, basic CRUD SaaS, copycat marketplaces without structural differentiation`;

    // We split the generation of 35 ideas into three concurrent batches (12, 12, and 11 ideas)
    // with disjoint category focuses. This allows us to run them in parallel (Promise.all),
    // speeding up generation from 2+ minutes to ~25s, while avoiding duplicates and truncation.
    const promptStr1 = signalContext
      ? `${signalContext}${dedupeBlock}${countryClause}${qualityBlock}\n\nUsing the live market signals above as your PRIMARY source, generate exactly 12 high-conviction business ideas for ${today}. Focus specifically on the following categories: 'Digital / SaaS / AI-SaaS'.`
      : `Generate exactly 12 high-conviction business ideas for ${today}.${dedupeBlock}${countryClause}${qualityBlock} Focus specifically on the following categories: 'Digital / SaaS / AI-SaaS'.`;

    const promptStr2 = signalContext
      ? `${signalContext}${dedupeBlock}${countryClause}${qualityBlock}\n\nUsing the live market signals above as your PRIMARY source, generate exactly 12 high-conviction business ideas for ${today}. Focus specifically on the following categories: 'Service / Local / On-Demand', 'Wildcard (creative/misc)'.`
      : `Generate exactly 12 high-conviction business ideas for ${today}.${dedupeBlock}${countryClause}${qualityBlock} Focus specifically on the following categories: 'Service / Local / On-Demand', 'Wildcard (creative/misc)'.`;

    const promptStr3 = signalContext
      ? `${signalContext}${dedupeBlock}${countryClause}${qualityBlock}\n\nUsing the live market signals above as your PRIMARY source, generate exactly 11 high-conviction business ideas for ${today}. Focus specifically on the following categories: 'Physical / Sustainable / Hardware', 'Deep-Tech / Moonshot'.`
      : `Generate exactly 11 high-conviction business ideas for ${today}.${dedupeBlock}${countryClause}${qualityBlock} Focus specifically on the following categories: 'Physical / Sustainable / Hardware', 'Deep-Tech / Moonshot'.`;

    async function generateBatch(promptStr: string, count: number): Promise<any> {
      let attempts = 0;
      while (attempts < 2) {
        try {
          const rawData = await generateWithAI(promptStr, dailyResponseSchema);
          return normalizeAIResponse(rawData, ['ideas'], {
            intro: "Today's high-signal ideas, curated from live market trends.",
            ideas: [],
            disclaimer: 'All ideas are AI-generated from real market signals.',
          });
        } catch (err) {
          attempts++;
          if (attempts >= 2) throw err;
          console.warn(
            `[daily] Batch generation attempt ${attempts} failed, retrying... Error:`,
            err
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    console.log('[daily] Running 3 batch generation calls concurrently...');
    const [data1, data2, data3] = await Promise.all([
      generateBatch(promptStr1, 12),
      generateBatch(promptStr2, 12),
      generateBatch(promptStr3, 11),
    ]);

    const mergedIdeas = [...(data1.ideas || []), ...(data2.ideas || []), ...(data3.ideas || [])];
    const data = {
      intro:
        data1.intro ||
        data2.intro ||
        data3.intro ||
        "Today's high-signal ideas, curated from live market trends.",
      ideas: mergedIdeas,
      disclaimer:
        data1.disclaimer ||
        data2.disclaimer ||
        data3.disclaimer ||
        'All ideas are AI-generated from real market signals.',
      date: today,
      generatedAt: new Date().toISOString(),
    };

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

    // Attempt to unlock on failure
    try {
      const db = getAdminDb();
      await db.collection('locks').doc(`daily_gen_${today}`).delete();
    } catch (lockErr) {
      // Ignore unlock errors
    }

    return res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. ' + (err?.message || '') });
  }
}
