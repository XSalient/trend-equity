import { generateWithAI, Type } from './ai-provider';

/**
 * Idea Quality Engine — second-stage critic that scores candidate ideas with a
 * stronger model, filters weak ones, and ranks the rest. The generator model
 * overproduces candidates; only the top `publishCount` survive.
 */

export const CRITIC_SYSTEM_PROMPT = `You are a skeptical seed-stage partner at a top-10 VC firm doing first-pass screening. You are the gatekeeper: most candidates should NOT excite you.

Score each candidate idea on five dimensions (1-10 each):
- problemSeverity: How painful and frequent is the problem? 9-10 = hair-on-fire, budget already exists. 1-3 = vitamin, nobody pays.
- timing: Why is NOW the moment? 9-10 = a specific recent shift (regulation, tech cost curve, behavior change) creates a window. 1-3 = could have been built 5 years ago.
- moat: Is the claimed unfair advantage structural (proprietary data, regulatory position, network effects, distribution lock-in)? 1-3 = "better UX" / "first mover" / no real moat.
- feasibility: Can a competent team realistically build and reach first revenue within 6-12 months? Punish hidden hard problems (cold-start marketplaces, hardware supply chains, medical approvals) unless acknowledged.
- founderAccessibility: Could an independent founder or small team actually enter this market (customer access, capital requirements, sales cycle)?

Be harsh and honest. Generic "AI copilot for X", rebranded CRUD SaaS, and trend-chasing ideas should score 4 or below on moat. A genuinely fresh, signal-grounded idea with a real wedge scores 7+. Reserve 9-10 for ideas you would actually take to partner meeting.

For each candidate return its index (as given), the five scores, and a one-sentence reason capturing your verdict. Respond with valid JSON matching the schema exactly.`;

export interface CritiqueSubscores {
  problemSeverity: number;
  timing: number;
  moat: number;
  feasibility: number;
  founderAccessibility: number;
}

export interface CritiqueResult extends CritiqueSubscores {
  index: number;
  reason: string;
}

export interface QualityStats {
  candidates: number;
  scored: number;
  publishedCount: number;
  rejectedCount: number;
  avgPublishedScore: number | null;
  threshold: number;
  criticModel: string;
  failOpen: boolean;
}

export const critiqueSchema = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          problemSeverity: { type: Type.NUMBER },
          timing: { type: Type.NUMBER },
          moat: { type: Type.NUMBER },
          feasibility: { type: Type.NUMBER },
          founderAccessibility: { type: Type.NUMBER },
          reason: { type: Type.STRING },
        },
        required: [
          'index',
          'problemSeverity',
          'timing',
          'moat',
          'feasibility',
          'founderAccessibility',
          'reason',
        ],
      },
    },
  },
  required: ['scores'],
};

const WEIGHTS: Record<keyof CritiqueSubscores, number> = {
  problemSeverity: 0.2,
  timing: 0.2,
  moat: 0.25,
  feasibility: 0.15,
  founderAccessibility: 0.2,
};

const BATCH_SIZE = 20;
// Cap how much of the published feed one category cluster may occupy.
const DIVERSITY_CAP_RATIO = 0.4;

export function compositeScore(s: CritiqueSubscores): number {
  const raw =
    s.problemSeverity * WEIGHTS.problemSeverity +
    s.timing * WEIGHTS.timing +
    s.moat * WEIGHTS.moat +
    s.feasibility * WEIGHTS.feasibility +
    s.founderAccessibility * WEIGHTS.founderAccessibility;
  return Math.round(raw * 10) / 10;
}

function getCriticModel(): string {
  return process.env.GEMINI_CRITIC_MODEL || 'gemini-2.5-flash';
}

function getThreshold(): number {
  const parsed = Number(process.env.QUALITY_MIN_SCORE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7.2;
}

function compactCandidate(idea: any, index: number): string {
  const tags = Array.isArray(idea.categoryTags) ? idea.categoryTags.join(', ') : '';
  const sources = Array.isArray(idea.trendSources) ? idea.trendSources.join(' | ') : '';
  const issues = Array.isArray(idea.qualityIssues) ? idea.qualityIssues.join(', ') : '';
  return `[${index}] ${idea.headline}\n  Pitch: ${idea.pitch}\n  Claimed moat: ${idea.unfairAdvantage}\n  Trend sources: ${sources}\n  Precheck issues: ${issues || 'none'}\n  Founder fit precheck: ${idea.founderFit || 'unknown'} (${idea.qualityScorePrecheck ?? 'n/a'}/10)\n  Categories: ${tags}`;
}

async function critiqueBatch(
  batch: { idea: any; index: number }[],
  model: string
): Promise<Map<number, CritiqueResult>> {
  const prompt = `Score the following ${batch.length} candidate startup ideas. Return one score entry per candidate, keyed by its [index].\n\n${batch
    .map((b) => compactCandidate(b.idea, b.index))
    .join('\n\n')}`;

  let attempts = 0;
  while (attempts < 2) {
    try {
      const raw = await generateWithAI(prompt, critiqueSchema, CRITIC_SYSTEM_PROMPT, { model });
      const scores: CritiqueResult[] = Array.isArray(raw?.scores) ? raw.scores : [];
      const map = new Map<number, CritiqueResult>();
      for (const s of scores) {
        if (typeof s?.index === 'number') map.set(s.index, s);
      }
      if (map.size > 0) return map;
      throw new Error('Critic returned no usable scores');
    } catch (err) {
      attempts++;
      if (attempts >= 2) {
        console.warn('[quality-engine] Critique batch failed twice, failing open:', err);
        return new Map();
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  return new Map();
}

function clusterKey(idea: any): string {
  const tag = Array.isArray(idea.categoryTags) ? idea.categoryTags[0] : '';
  return (typeof tag === 'string' ? tag : '').toLowerCase().trim() || 'uncategorized';
}

/** Greedy pick down the ranked list, capping any one category cluster; refill from skipped. */
function pickWithDiversity(ranked: any[], publishCount: number): any[] {
  const cap = Math.max(1, Math.ceil(publishCount * DIVERSITY_CAP_RATIO));
  const counts = new Map<string, number>();
  const picked: any[] = [];
  const skipped: any[] = [];

  for (const idea of ranked) {
    if (picked.length >= publishCount) break;
    const key = clusterKey(idea);
    const count = counts.get(key) || 0;
    if (count >= cap) {
      skipped.push(idea);
      continue;
    }
    counts.set(key, count + 1);
    picked.push(idea);
  }
  for (const idea of skipped) {
    if (picked.length >= publishCount) break;
    picked.push(idea);
  }
  return picked;
}

export async function critiqueAndRank(
  candidates: any[],
  publishCount: number
): Promise<{ published: any[]; rejected: any[]; stats: QualityStats }> {
  const model = getCriticModel();
  const threshold = getThreshold();
  const baseStats: QualityStats = {
    candidates: candidates.length,
    scored: 0,
    publishedCount: 0,
    rejectedCount: 0,
    avgPublishedScore: null,
    threshold,
    criticModel: model,
    failOpen: false,
  };

  try {
    const indexed = candidates.map((idea, index) => ({ idea, index }));
    const batches: { idea: any; index: number }[][] = [];
    for (let i = 0; i < indexed.length; i += BATCH_SIZE) {
      batches.push(indexed.slice(i, i + BATCH_SIZE));
    }

    const maps = await Promise.all(batches.map((b) => critiqueBatch(b, model)));
    const allScores = new Map<number, CritiqueResult>();
    for (const m of maps) for (const [k, v] of m) allScores.set(k, v);

    const enriched = indexed.map(({ idea, index }) => {
      const score = allScores.get(index);
      if (!score) return { ...idea, qualityScore: null };
      const composite = compositeScore(score);
      return {
        ...idea,
        qualityScore: composite,
        critique: {
          problemSeverity: score.problemSeverity,
          timing: score.timing,
          moat: score.moat,
          feasibility: score.feasibility,
          founderAccessibility: score.founderAccessibility,
          reason: score.reason,
        },
        criticModel: model,
      };
    });

    // Unscored candidates (critic batch failed) rank behind scored ones but are not discarded.
    const ranked = [...enriched].sort((a, b) => (b.qualityScore ?? -1) - (a.qualityScore ?? -1));
    const passing = ranked.filter(
      (i) => typeof i.qualityScore === 'number' && i.qualityScore >= threshold
    );
    // Use the full ranked list for final diversity selection. The threshold still
    // drives warnings/stats, while lower-scoring ideas can only enter when they
    // improve category diversity or prevent a short feed.
    const pool = ranked;
    if (passing.length < Math.min(publishCount, ranked.length)) {
      console.warn(
        `[quality-engine] Only ${passing.length} candidates passed threshold ${threshold}; taking top ${publishCount} regardless.`
      );
    }

    const published = pickWithDiversity(pool, publishCount);
    const publishedSet = new Set(published);
    const rejected = enriched
      .filter((i) => !publishedSet.has(i))
      .map((i) => ({
        headline: i.headline,
        qualityScore: i.qualityScore ?? null,
        reason: i.critique?.reason || 'not scored',
      }));

    const publishedScores = published
      .map((i) => i.qualityScore)
      .filter((s): s is number => typeof s === 'number');

    return {
      published,
      rejected,
      stats: {
        ...baseStats,
        scored: allScores.size,
        publishedCount: published.length,
        rejectedCount: rejected.length,
        avgPublishedScore: publishedScores.length
          ? Math.round((publishedScores.reduce((a, b) => a + b, 0) / publishedScores.length) * 10) /
            10
          : null,
      },
    };
  } catch (err) {
    console.error('[quality-engine] critiqueAndRank failed, failing open:', err);
    const published = candidates.slice(0, publishCount);
    return {
      published,
      rejected: [],
      stats: { ...baseStats, publishedCount: published.length, failOpen: true },
    };
  }
}
