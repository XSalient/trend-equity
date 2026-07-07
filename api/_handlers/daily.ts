import type { VercelRequest, VercelResponse } from '@vercel/node';
import AI from '../_lib/ai-provider';
const { generateWithAI, dailyResponseSchema, getToday, normalizeAIResponse } = AI;
import { fetchLiveSignals, formatSignalsForPrompt } from '../_lib/signals';
import { getRecentIdeaHeadlines } from '../_lib/cache';
import { getAdminDb } from '../_lib/admin';
import { getAuthContext } from '../_lib/auth';
import { getDynamicPrompt, runSelfImprovement } from '../_lib/prompt-optimizer';
import { critiqueAndRank } from '../_lib/quality-engine';
import { semanticDedupeCandidates, saveIdeaEmbeddings } from '../_lib/embeddings';
import { cleanDailyDisclaimer, prepareCandidatesForCritique } from '../_lib/idea-quality';
import { savePredictions } from '../_lib/prediction-tracker';

// Overgenerate candidates, then a stronger critic model publishes only the top N.
const CANDIDATES_PER_BATCH = 20;
const PUBLISH_COUNT = 35;

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
  const isAdmin = authCtx?.isAdmin || false;

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

    // 2. Authorization: Only allow Admin users to refresh (regenerate) existing generation.
    // However, any tier (including free/pro/anonymous) can trigger the initial daily generation.
    if (refresh && !isAdmin) {
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

    // 4. Self-Learning Optimization Loop: Evaluates comments, reactions and self-critiques to refine prompt
    await runSelfImprovement(db, !!refresh);
    const { systemPrompt, qualityBlock, version } = await getDynamicPrompt(db);

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

    async function generateBatch(promptStr: string, count: number): Promise<any> {
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

    console.log('[daily] Running 3 batch generation calls concurrently...');
    const [data1, data2, data3] = await Promise.all([
      generateBatch(promptStr1, N),
      generateBatch(promptStr2, N),
      generateBatch(promptStr3, N),
    ]);

    const mergedIdeas = [...(data1.ideas || []), ...(data2.ideas || []), ...(data3.ideas || [])];

    // Semantic dedup vs past 30 days runs BEFORE the critic to save critic tokens.
    const { kept, droppedHeadlines, vectorsByHeadline } = await semanticDedupeCandidates(
      mergedIdeas,
      today
    );

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

    // 5. Persist and Unlock
    const finalData = {
      ...data,
      promptVersion: version,
      qualityStats: {
        ...stats,
        semanticDupesDropped: droppedHeadlines.length,
        gate: gate.stats,
      },
      date: today,
      generatedAt: new Date().toISOString(),
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
    } catch (lockErr) {
      // Ignore unlock errors
    }

    return res
      .status(503)
      .json({ error: 'AI generation temporarily unavailable. ' + (err?.message || '') });
  }
}
