/**
 * Unit tests for api/_lib/quality-engine.ts
 *
 * Covers:
 *  + compositeScore weighted-mean math
 *  + critiqueAndRank publishes top N by composite, filters below threshold
 *  + fail-open floor: takes top N regardless when too few pass threshold
 *  + fail-open: critic returning no scores publishes candidates with null qualityScore
 *  + diversity cap: one category cluster cannot dominate the published set
 *  + threads GEMINI_CRITIC_MODEL through to generateWithAI
 *  + rejected list contains scored-out candidates with reasons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGenerateWithAI } = vi.hoisted(() => ({
  mockGenerateWithAI: vi.fn(),
}));

vi.mock('../../../api/_lib/ai-provider', () => ({
  generateWithAI: mockGenerateWithAI,
  Type: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
  },
}));

import { critiqueAndRank, compositeScore } from '../../../api/_lib/quality-engine';

function makeCandidates(count: number, tag = 'SaaS') {
  return Array.from({ length: count }, (_, i) => ({
    id: `idea-${i}`,
    headline: `Idea ${i}`,
    pitch: `Pitch ${i}`,
    unfairAdvantage: `Moat ${i}`,
    trendSources: [`Signal ${i}`],
    categoryTags: [tag],
  }));
}

/** Build a critic response giving every candidate the same flat score. */
function flatScores(indices: number[], value: number) {
  return {
    scores: indices.map((index) => ({
      index,
      problemSeverity: value,
      timing: value,
      moat: value,
      feasibility: value,
      founderAccessibility: value,
      reason: `reason ${index}`,
    })),
  };
}

describe('compositeScore', () => {
  it('computes the weighted mean (25/25/25/15/10)', () => {
    expect(
      compositeScore({
        problemSeverity: 10,
        timing: 10,
        moat: 10,
        feasibility: 10,
        founderAccessibility: 10,
      })
    ).toBe(10);

    expect(
      compositeScore({
        problemSeverity: 8, // 2.0
        timing: 6, // 1.5
        moat: 4, // 1.0
        feasibility: 10, // 1.5
        founderAccessibility: 5, // 0.5
      })
    ).toBe(6.3);
  });
});

describe('critiqueAndRank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QUALITY_MIN_SCORE;
    delete process.env.GEMINI_CRITIC_MODEL;
  });

  afterEach(() => {
    delete process.env.QUALITY_MIN_SCORE;
    delete process.env.GEMINI_CRITIC_MODEL;
  });

  it('publishes the top N by composite score and rejects the rest', async () => {
    const candidates = makeCandidates(10);
    // Indices 0-4 score 9, indices 5-9 score 7 — all pass default threshold 6.5
    mockGenerateWithAI.mockResolvedValue({
      scores: [...flatScores([0, 1, 2, 3, 4], 9).scores, ...flatScores([5, 6, 7, 8, 9], 7).scores],
    });

    const { published, rejected, stats } = await critiqueAndRank(candidates, 5);

    expect(published).toHaveLength(5);
    expect(published.map((i: any) => i.headline)).toEqual([
      'Idea 0',
      'Idea 1',
      'Idea 2',
      'Idea 3',
      'Idea 4',
    ]);
    expect(published[0].qualityScore).toBe(9);
    expect(published[0].critique.reason).toBe('reason 0');
    expect(rejected).toHaveLength(5);
    expect(rejected[0]).toMatchObject({ qualityScore: 7 });
    expect(stats.publishedCount).toBe(5);
    expect(stats.avgPublishedScore).toBe(9);
    expect(stats.failOpen).toBe(false);
  });

  it('filters candidates below QUALITY_MIN_SCORE when enough pass', async () => {
    process.env.QUALITY_MIN_SCORE = '6';
    const candidates = makeCandidates(6);
    // 4 strong (8), 2 weak (3) — publishCount 4 → weak ones rejected
    mockGenerateWithAI.mockResolvedValue({
      scores: [...flatScores([0, 1, 2, 3], 8).scores, ...flatScores([4, 5], 3).scores],
    });

    const { published, rejected } = await critiqueAndRank(candidates, 4);

    expect(published.map((i: any) => i.qualityScore)).toEqual([8, 8, 8, 8]);
    expect(rejected.map((r: any) => r.qualityScore)).toEqual([3, 3]);
  });

  it('takes top N regardless when too few candidates pass the threshold (floor)', async () => {
    process.env.QUALITY_MIN_SCORE = '9.5';
    const candidates = makeCandidates(6);
    mockGenerateWithAI.mockResolvedValue(flatScores([0, 1, 2, 3, 4, 5], 7));

    const { published } = await critiqueAndRank(candidates, 4);

    expect(published).toHaveLength(4);
    expect(published[0].qualityScore).toBe(7);
  });

  it('fails open with null qualityScore when the critic returns no usable scores', async () => {
    const candidates = makeCandidates(4);
    mockGenerateWithAI.mockResolvedValue({ scores: [] });

    const { published, stats } = await critiqueAndRank(candidates, 3);

    expect(published).toHaveLength(3);
    expect(published.every((i: any) => i.qualityScore === null)).toBe(true);
    expect(stats.scored).toBe(0);
  }, 10000);

  it('caps a single category cluster and refills from other clusters', async () => {
    // 8 SaaS candidates scoring 9, 4 HealthTech scoring 7; publish 5 → cap = ceil(5*0.4)=2
    const saas = makeCandidates(8, 'SaaS');
    const health = makeCandidates(4, 'HealthTech').map((c, i) => ({
      ...c,
      id: `health-${i}`,
      headline: `Health ${i}`,
    }));
    const candidates = [...saas, ...health];
    mockGenerateWithAI.mockResolvedValue({
      scores: [
        ...flatScores([0, 1, 2, 3, 4, 5, 6, 7], 9).scores,
        ...flatScores([8, 9, 10, 11], 7).scores,
      ],
    });

    const { published } = await critiqueAndRank(candidates, 5);

    expect(published).toHaveLength(5);
    const saasCount = published.filter((i: any) => i.categoryTags[0] === 'SaaS').length;
    const healthCount = published.filter((i: any) => i.categoryTags[0] === 'HealthTech').length;
    expect(saasCount).toBeLessThanOrEqual(3); // cap 2 + possible refill
    expect(healthCount).toBeGreaterThanOrEqual(2);
  });

  it('uses GEMINI_CRITIC_MODEL for the critic call', async () => {
    process.env.GEMINI_CRITIC_MODEL = 'gemini-2.5-pro';
    const candidates = makeCandidates(3);
    mockGenerateWithAI.mockResolvedValue(flatScores([0, 1, 2], 8));

    const { stats } = await critiqueAndRank(candidates, 2);

    const opts = mockGenerateWithAI.mock.calls[0][3];
    expect(opts).toEqual({ model: 'gemini-2.5-pro' });
    expect(stats.criticModel).toBe('gemini-2.5-pro');
  });

  it('defaults the critic model to gemini-2.5-flash', async () => {
    const candidates = makeCandidates(2);
    mockGenerateWithAI.mockResolvedValue(flatScores([0, 1], 8));

    await critiqueAndRank(candidates, 2);

    expect(mockGenerateWithAI.mock.calls[0][3]).toEqual({ model: 'gemini-2.5-flash' });
  });

  it('splits more than 20 candidates into parallel critic batches', async () => {
    const candidates = makeCandidates(45);
    mockGenerateWithAI.mockImplementation(async (prompt: string) => {
      // Extract the [index] markers present in this batch's prompt
      const indices = [...prompt.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      return flatScores(indices, 8);
    });

    const { published, stats } = await critiqueAndRank(candidates, 35);

    expect(mockGenerateWithAI).toHaveBeenCalledTimes(3); // 20 + 20 + 5
    expect(stats.scored).toBe(45);
    expect(published).toHaveLength(35);
  });
});
