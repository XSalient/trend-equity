import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, dailyResponseSchema, getToday, normalizeAIResponse } = AI;
import { getMarketSignals, formatSignalsForPrompt } from '../_lib/signals';
import { getRecentIdeaHeadlines } from '../_lib/cache';
import { getAdminDb } from '../_lib/admin';
import { getAuthContext } from '../_lib/auth';
import { checkAndIncrementIpLimit } from '../_lib/usage';
import { getDynamicPrompt, runSelfImprovement } from '../_lib/prompt-optimizer';
import { critiqueAndRank } from '../_lib/quality-engine';
import {
  semanticDedupeCandidates,
  saveIdeaEmbeddings,
  getDedupeThreshold,
  getRecentEmbeddings,
} from '../_lib/embeddings';
import { cleanDailyDisclaimer, prepareCandidatesForCritique } from '../_lib/idea-quality';
import { savePredictions } from '../_lib/prediction-tracker';

// Overgenerate candidates, then a stronger critic model publishes only the top N.
const CANDIDATES_PER_BATCH = 20;
const PUBLISH_COUNT = 35;

// Max requests per unique IP per day (unauthenticated/abuse protection) (S-4, TE-02).
// Enforced via Firestore (api/_lib/usage.ts) so the cap survives across serverless
// instances — an in-memory Map only ever limits the single instance that handles
// the request, which on Vercel is effectively no limit at all.
const IP_DAILY_LIMIT = 5;

function getRequestIp(req: VercelRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
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
  const isAdmin = authCtx?.isAdmin || false;
  const isCronTrigger = req.headers['x-cron-trigger'] === 'true';

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

    // 2. Generation may only be triggered for today's date, by a signed-in user (TE-01).
    // Prevents anonymous callers from burning AI spend via arbitrary client-supplied dates.
    // Exception: Vercel cron (TE-17) is trusted and can trigger without auth.
    // The singleton check above still serves cached results for any date, to any caller.
    if (today !== getToday()) {
      return res.status(404).json({ error: 'No generation exists for that date.' });
    }
    if (!uid && !isCronTrigger) {
      return res.status(401).json({ error: "Sign in to load today's feed." });
    }

    // 3. Authorization: Only allow Admin users to refresh (regenerate) existing generation.
    // However, any signed-in tier can trigger the initial daily generation.
    if (refresh && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Only administrators can refresh the daily generation.' });
    }

    // 4. Per-IP daily cap on the (non-refresh) generation trigger — refresh is already
    // gated to admins above, who are trusted and would otherwise get needlessly capped.
    if (!refresh) {
      const ip = getRequestIp(req);
      const ipCheck = await checkAndIncrementIpLimit(ip, IP_DAILY_LIMIT);
      if (!ipCheck.allowed) {
        return res.status(429).json({ error: 'Too many requests from this network today.' });
      }
    }

    console.log(`[daily] Triggering generation for ${today} (refresh=${!!refresh})`);

    // 5. Locking: Prevent concurrent AI calls
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

    // 6. Self-Learning Optimization Loop: Evaluates comments, reactions and self-critiques to refine prompt
    await runSelfImprovement(db, !!refresh);
    const { systemPrompt, qualityBlock, version } = await getDynamicPrompt(db);

    const [signalMetrics, recentHeadlines] = await Promise.all([
      getMarketSignals(),
      getRecentIdeaHeadlines(today),
    ]);
    const signalContext = formatSignalsForPrompt(signalMetrics.signals);

    const dedupeBlock =
      recentHeadlines.length > 0
        ? `\n\nDO NOT REPEAT RECENT IDEAS — these headlines and problem spaces were already generated in the past 14 days. Generate completely different problem spaces, target markets, and business models:\n${recentHeadlines.map((idea, i) => `  ${i + 1}. ${idea.headline} — ${idea.pitch}`).join('\n')}\n`
        : '';

    const countryClause =
      country && country !== 'Global'
        ? `\n\nAdditionally, specifically include ${countryCount || 5} ideas tailored for the ${country} Local Market.`
        : '';

    // We generate candidates in three concurrent batches with disjoint category focuses
    // (Promise.all keeps wall time low and avoids duplicates/truncation). We deliberately
    // overgenerate (3 x CANDIDATES_PER_BATCH), then critiqueAndRank publishes the top
    // PUBLISH_COUNT ideas as judged by a stronger critic model.
    const N = CANDIDATES_PER_BATCH;
    const promptStr1 = signalContext
      ? `${signalContext}${dedupeBlock}${countryClause}${qualityBlock}\n\nUsing the live market signals above as your PRIMARY source, generate exactly ${N} high-conviction business ideas for ${today}. Focus specifically on the following categories: 'Digital / SaaS / AI-SaaS'.`
      : `Generate exactly ${N} high-conviction business ideas for ${today}.${dedupeBlock}${countryClause}${qualityBlock} Focus specifically on the following categories: 'Digital / SaaS / AI-SaaS'.`;

    const promptStr2 = signalContext
      ? `${signalContext}${dedupeBlock}${countryClause}${qualityBlock}\n\nUsing the live market signals above as your PRIMARY source, generate exactly ${N} high-conviction business ideas for ${today}. Focus specifically on the following categories: 'Service / Local / On-Demand', 'Wildcard (creative/misc)'.`
      : `Generate exactly ${N} high-conviction business ideas for ${today}.${dedupeBlock}${countryClause}${qualityBlock} Focus specifically on the following categories: 'Service / Local / On-Demand', 'Wildcard (creative/misc)'.`;

    const promptStr3 = signalContext
      ? `${signalContext}${dedupeBlock}${countryClause}${qualityBlock}\n\nUsing the live market signals above as your PRIMARY source, generate exactly ${N} high-conviction business ideas for ${today}. Focus specifically on the following categories: 'Physical / Sustainable / Hardware', 'Deep-Tech / Moonshot'.`
      : `Generate exactly ${N} high-conviction business ideas for ${today}.${dedupeBlock}${countryClause}${qualityBlock} Focus specifically on the following categories: 'Physical / Sustainable / Hardware', 'Deep-Tech / Moonshot'.`;

    async function generateBatch(promptStr: string, _count: number): Promise<any> {
      let attempts = 0;
      while (attempts < 2) {
        try {
          const rawData = await generateWithAI(promptStr, dailyResponseSchema, systemPrompt);
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

    console.log('[daily] Running 3 batch generation + pre-fetching embeddings concurrently...');
    const [data1, data2, data3, preFetchedEmbeddings] = await Promise.all([
      generateBatch(promptStr1, N),
      generateBatch(promptStr2, N),
      generateBatch(promptStr3, N),
      getRecentEmbeddings(today),
    ]);

    const mergedIdeas = [...(data1.ideas || []), ...(data2.ideas || []), ...(data3.ideas || [])];

    // Semantic dedup vs past 30 days runs BEFORE the critic to save critic tokens.
    // Pre-fetched embeddings avoid redundant network calls during dedup.
    const dedupResult = await semanticDedupeCandidates(mergedIdeas, today, preFetchedEmbeddings);
    const { kept, droppedHeadlines, vectorsByHeadline, similarityScores } = dedupResult;

    // Compute near-miss distribution (candidates close to the dedup threshold)
    const threshold = getDedupeThreshold();
    const nearMissBuckets = {
      '0.75-0.80': 0,
      '0.80-0.85': 0,
      '0.85-0.90': 0,
      '0.90+': 0,
    };
    for (const score of similarityScores.filter((s) => s.maxSimilarity >= 0.75)) {
      if (score.maxSimilarity < 0.8) nearMissBuckets['0.75-0.80']++;
      else if (score.maxSimilarity < 0.85) nearMissBuckets['0.80-0.85']++;
      else if (score.maxSimilarity < 0.9) nearMissBuckets['0.85-0.90']++;
      else nearMissBuckets['0.90+']++;
    }

    const gate = prepareCandidatesForCritique(kept, PUBLISH_COUNT);

    console.log(
      `[daily] Quality gate kept ${gate.stats.publishableCount}/${gate.stats.inputCount} candidates (fallback: ${gate.stats.fallbackUsed})`
    );
    console.log(
      `[daily] Critiquing ${gate.candidatesForCritique.length} candidates with quality engine...`
    );
    const { published, rejected, stats } = await critiqueAndRank(
      gate.candidatesForCritique,
      PUBLISH_COUNT
    );
    console.log(
      `[daily] Quality engine published ${stats.publishedCount}/${stats.candidates} (avg score: ${stats.avgPublishedScore}, failOpen: ${stats.failOpen})`
    );

    const data = {
      intro:
        data1.intro ||
        data2.intro ||
        data3.intro ||
        "Today's high-signal ideas, curated from live market trends.",
      ideas: published,
      disclaimer: cleanDailyDisclaimer(
        data1.disclaimer ||
          data2.disclaimer ||
          data3.disclaimer ||
          'All ideas are AI-generated from real market signals.'
      ),
      date: today,
      generatedAt: new Date().toISOString(),
    };

    // 7. Persist and Unlock
    const isDegraded = signalMetrics.sourceCount === 0;
    if (isDegraded) {
      console.warn('[daily] ADMIN ALERT: Signal degradation — zero sources returned');
    }

    const finalData = {
      ...data,
      promptVersion: version,
      qualityStats: {
        ...stats,
        signals: {
          sourceCount: signalMetrics.sourceCount,
          degraded: isDegraded,
        },
        semanticDupesDropped: droppedHeadlines.length,
        dedup: {
          dropped: droppedHeadlines.length,
          nearMissBuckets,
          threshold,
        },
        gate: gate.stats,
      },
      date: today,
      generatedAt: new Date().toISOString(),
      public: true,
    };
    await docRef.set(finalData);

    // Persist published idea vectors for future semantic dedup (non-fatal)
    await saveIdeaEmbeddings(today, published, vectorsByHeadline);

    // Log publish-time score snapshots for prediction accuracy grading (non-fatal)
    await savePredictions(today, published, version);

    // Save run snapshot in history for audits and logs. Rejected candidates are kept
    // here (headline + score + reason only) as training signal for the prompt optimizer.
    const runTimestamp = new Date().toISOString();
    const runId = `${today}_${runTimestamp.replace(/[:.]/g, '-')}`;
    await db
      .collection('daily_generations_history')
      .doc(runId)
      .set({
        ...finalData,
        rejectedCandidates: [
          ...gate.rejectedByGate.map((idea) => ({
            headline: idea.headline,
            qualityScore: idea.qualityScorePrecheck ?? null,
            reason: 'quality gate: ' + ((idea.qualityIssues || []).join(', ') || 'cut'),
          })),
          ...rejected,
        ],
        generatedAt: runTimestamp,
      });

    await lockRef.delete();

    return res.json(finalData);
  } catch (err: any) {
    console.error('[daily] Generation error:', err);

    // Attempt to unlock on failure
    try {
      const db = getAdminDb();
      await db.collection('locks').doc(`daily_gen_${today}`).delete();
    } catch (_lockErr) {
      // Ignore unlock errors
    }

    return res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. ' + (err?.message || '') });
  }
}
