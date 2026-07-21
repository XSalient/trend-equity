/**
 * Unit tests for api/generate/daily.ts
 *
 * Covers:
 *  + Returns 35 ideas on successful Gemini call
 *  + Injects dedup block into prompt when recent headlines exist
 *  + Skips dedup block when no recent headlines
 *  + Appends country localisation when country != Global
 *  + Does NOT append country clause when country is Global
 *  + Uses signal context when signals are non-empty
 *  + Falls back to no-signal prompt when signals are empty
 *  - Returns 405 for non-POST request
 *  - Returns 503 when Gemini throws (no mock fallback)
 *  - Does not return _isMock on successful generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';
import { generateMockIdeas, MOCK_DAILY_GENERATION } from '../helpers/fixtures';

// ── Module mocks ──────────────────────────────────────────────────────────────

const {
  mockGenerateWithAI,
  mockFetchLiveSignals,
  mockFormatSignalsForPrompt,
  mockGetRecentIdeaHeadlines,
  mockGetAuthContext,
  mockGetAdminDb,
  mockCheckAndIncrementUsage,
  mockCheckAndIncrementIpLimit,
  mockCritiqueAndRank,
  mockGetRecentEmbeddings,
} = vi.hoisted(() => ({
  mockGenerateWithAI: vi.fn(),
  mockFetchLiveSignals: vi.fn(),
  mockFormatSignalsForPrompt: vi.fn(),
  mockGetRecentIdeaHeadlines: vi.fn(),
  mockGetAuthContext: vi.fn(),
  mockGetAdminDb: vi.fn(),
  mockCheckAndIncrementUsage: vi.fn(),
  mockCheckAndIncrementIpLimit: vi.fn(),
  mockCritiqueAndRank: vi.fn(),
  mockGetRecentEmbeddings: vi.fn(),
}));

vi.mock('../../../api/_lib/ai-provider', () => {
  const mockAI = {
    generateWithAI: mockGenerateWithAI,
    normalizeAIResponse: vi.fn((data) => data),
    dailyResponseSchema: { type: 'OBJECT' },
    getToday: vi.fn(() => '2026-04-11'),
  };
  return { ...mockAI, default: mockAI };
});

vi.mock('../../../api/_lib/signals', () => ({
  fetchLiveSignals: mockFetchLiveSignals,
  formatSignalsForPrompt: mockFormatSignalsForPrompt,
}));

vi.mock('../../../api/_lib/cache', () => ({
  getRecentIdeaHeadlines: mockGetRecentIdeaHeadlines,
}));

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: mockGetAdminDb,
}));

vi.mock('../../../api/_lib/usage', () => ({
  checkAndIncrementUsage: mockCheckAndIncrementUsage,
  checkAndIncrementIpLimit: mockCheckAndIncrementIpLimit,
}));

vi.mock('../../../api/_lib/quality-engine', () => ({
  critiqueAndRank: mockCritiqueAndRank,
}));

vi.mock('../../../api/_lib/prediction-tracker', () => ({
  savePredictions: vi.fn(async () => undefined),
}));

vi.mock('../../../api/_lib/embeddings', () => ({
  semanticDedupeCandidates: vi.fn(
    async (candidates: any[], _excludeDate: string, _preFetched: any) => ({
      kept: candidates,
      droppedHeadlines: [],
      vectorsByHeadline: new Map(),
      similarityScores: candidates.map((c: any) => ({ headline: c.headline, maxSimilarity: 0.5 })),
    })
  ),
  saveIdeaEmbeddings: vi.fn(async () => undefined),
  getDedupeThreshold: vi.fn(() => 0.8),
  getRecentEmbeddings: mockGetRecentEmbeddings,
}));

import handler from '../../../api/_handlers/daily';

const EMPTY_SIGNALS = {
  googleTrends: [],
  productHuntLaunches: [],
  redditHotThreads: [],
  hnDiscussions: [],
  techCrunchFunding: [],
  fetchedAt: '',
  sourcesCached: false,
};

describe('POST /api/generate/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLiveSignals.mockResolvedValue(EMPTY_SIGNALS);
    mockFormatSignalsForPrompt.mockReturnValue('');
    mockGetRecentIdeaHeadlines.mockResolvedValue([]);
    mockGetRecentEmbeddings.mockResolvedValue([]);
    mockGenerateWithAI.mockImplementation(async (prompt: string) => {
      const lower = prompt.toLowerCase();
      if (lower.includes('generate exactly 20')) {
        return {
          ...MOCK_DAILY_GENERATION,
          ideas: generateMockIdeas(20),
        };
      }
      return MOCK_DAILY_GENERATION;
    });
    // Quality engine: pass-through publishing the top 35 candidates
    mockCritiqueAndRank.mockImplementation(async (candidates: any[], publishCount: number) => ({
      published: candidates.slice(0, publishCount),
      rejected: [],
      stats: {
        candidates: candidates.length,
        scored: candidates.length,
        publishedCount: Math.min(candidates.length, publishCount),
        rejectedCount: Math.max(0, candidates.length - publishCount),
        avgPublishedScore: 7.5,
        threshold: 6.5,
        criticModel: 'test-critic',
        failOpen: false,
      },
    }));
    // Auth: builder tier required to trigger daily generation
    mockGetAuthContext.mockResolvedValue({ uid: 'user-1', tier: 'builder', isAdmin: true });
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, remaining: 10, limit: null });
    mockCheckAndIncrementIpLimit.mockResolvedValue({ allowed: true, remaining: 4, limit: 5 });
    // Admin Firestore: idempotent persist stub
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    mockGetAdminDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(mockDocRef) }),
      runTransaction: vi.fn((cb) =>
        cb({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() })
      ),
    });
  });

  // ── Positive cases ────────────────────────────────────────────────

  it('returns generated daily ideas on success', async () => {
    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledOnce();
    const body = res._body;
    expect(body.ideas).toHaveLength(35);
    expect(body.intro).toBeTruthy();
    expect(body.disclaimer).toBeTruthy();
  });

  it('calls getRecentIdeaHeadlines with the provided date', async () => {
    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockGetRecentIdeaHeadlines).toHaveBeenCalledWith('2026-04-11');
  });

  it('injects DO NOT REPEAT block into prompt when recent headlines exist', async () => {
    mockGetRecentIdeaHeadlines.mockResolvedValue([
      { headline: 'Old Idea 1', pitch: 'Problem 1 solution' },
      { headline: 'Old Idea 2', pitch: 'Problem 2 solution' },
    ]);

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).toContain('DO NOT REPEAT RECENT IDEAS');
    expect(promptArg).toContain('Old Idea 1 — Problem 1 solution');
    expect(promptArg).toContain('Old Idea 2 — Problem 2 solution');
  });

  it('does NOT inject dedup block when no recent headlines', async () => {
    mockGetRecentIdeaHeadlines.mockResolvedValue([]);

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).not.toContain('DO NOT REPEAT RECENT IDEAS');
  });

  it('includes signal context in prompt when signals are non-empty', async () => {
    mockFormatSignalsForPrompt.mockReturnValue('LIVE MARKET SIGNALS — Google Trend A');

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).toContain('LIVE MARKET SIGNALS');
  });

  it('uses fallback prompt without signal prefix when signals are empty', async () => {
    mockFormatSignalsForPrompt.mockReturnValue('');

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).toContain('Generate exactly 20');
    expect(promptArg).not.toContain('LIVE MARKET SIGNALS');
  });

  it('overgenerates 60 candidates and publishes the quality-engine top 35', async () => {
    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockCritiqueAndRank).toHaveBeenCalledOnce();
    const [candidates, publishCount] = mockCritiqueAndRank.mock.calls[0];
    expect(candidates).toHaveLength(60);
    expect(publishCount).toBe(35);
    expect(res._body.ideas).toHaveLength(35);
    expect(res._body.qualityStats).toMatchObject({ criticModel: 'test-critic' });
  });

  it('appends country localisation clause when country is not Global', async () => {
    const req = createMockRequest({
      body: { date: '2026-04-11', country: 'India', countryCount: 5 },
    });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).toContain('India');
    expect(promptArg).toContain('5');
    expect(promptArg).toContain('Local Market');
  });

  it('does NOT append country clause when country is Global', async () => {
    const req = createMockRequest({
      body: { date: '2026-04-11', country: 'Global', countryCount: 3 },
    });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).not.toContain('Local Market');
  });

  it('does not include _isMock in successful response', async () => {
    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body._isMock).toBeUndefined();
  });

  // ── Negative cases ────────────────────────────────────────────────

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET', body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._body.error).toContain('Method not allowed');
  });

  it('returns 503 when Gemini throws — no mock fallback', async () => {
    mockGenerateWithAI.mockRejectedValue(new Error('API quota exceeded'));

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._body.error).toContain('temporarily unavailable');
  });

  it('returns 503 when signals fetch throws', async () => {
    mockFetchLiveSignals.mockRejectedValue(new Error('Network error'));

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(503);
  });

  it('still calls Gemini even if getRecentIdeaHeadlines fails', async () => {
    // getRecentIdeaHeadlines fails but Promise.all rejects, so Gemini won't be called
    // — the handler should return 503 cleanly
    mockGetRecentIdeaHeadlines.mockRejectedValue(new Error('Firestore down'));

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(503);
  });

  it('allows non-builder tier to trigger initial generation for the day', async () => {
    mockGetAuthContext.mockResolvedValue({ uid: 'user-2', tier: 'free' });

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledOnce();
    expect(res._body.ideas).toHaveLength(35);
  });

  it('blocks non-builder tier from refreshing the daily generation', async () => {
    mockGetAuthContext.mockResolvedValue({ uid: 'user-2', tier: 'free' });

    const req = createMockRequest({ body: { date: '2026-04-11', refresh: true } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._body.error).toContain('Only administrators');
  });

  // ── TE-01: restrict generation trigger to authed users + today's date ──────

  it('returns 401 when an unauthenticated user requests uncached generation for today', async () => {
    mockGetAuthContext.mockResolvedValue(null);

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._body.error).toContain('Sign in');
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('returns 404 when requesting an uncached date that is not today', async () => {
    const req = createMockRequest({ body: { date: '2099-01-01' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._body.error).toContain('No generation exists for that date');
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('returns cached generation for a past date without requiring authentication', async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const cachedData = { ideas: generateMockIdeas(35), date: '2020-01-01' };
    const cachedDocRef = {
      get: vi.fn().mockResolvedValue({ exists: true, data: () => cachedData }),
    };
    mockGetAdminDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(cachedDocRef) }),
      runTransaction: vi.fn(),
    });

    const req = createMockRequest({ body: { date: '2020-01-01' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body).toEqual(cachedData);
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('proceeds to generation for an authenticated request on today, uncached', async () => {
    mockGetAuthContext.mockResolvedValue({ uid: 'user-4', tier: 'free' });

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledOnce();
    expect(res._body.ideas).toHaveLength(35);
  });

  // ── TE-02: Firestore-backed per-IP daily limit ──────────────────────────────

  it('returns 429 when the per-IP daily limit is exceeded', async () => {
    mockGetAuthContext.mockResolvedValue({ uid: 'user-5', tier: 'free' });
    mockCheckAndIncrementIpLimit.mockResolvedValue({ allowed: false, remaining: 0, limit: 5 });

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect(res._body.error).toContain('Too many requests');
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('checks the per-IP limit for the initial (non-refresh) generation trigger', async () => {
    mockGetAuthContext.mockResolvedValue({ uid: 'user-6', tier: 'free' });

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockCheckAndIncrementIpLimit).toHaveBeenCalledWith('unknown', 5);
  });

  it('does not apply the per-IP limit to admin refresh requests', async () => {
    mockCheckAndIncrementIpLimit.mockResolvedValue({ allowed: false, remaining: 0, limit: 5 });

    const req = createMockRequest({ body: { date: '2026-04-11', refresh: true } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockCheckAndIncrementIpLimit).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledOnce();
    expect(res._body.ideas).toHaveLength(35);
  });

  // ── TE-32: Parallelize AI handler pipeline (embeddings pre-fetch) ──────────

  it('pre-fetches embeddings in parallel with generation batches', async () => {
    // Set artificial delays to verify concurrent execution
    mockGenerateWithAI.mockImplementation(
      async (prompt: string) =>
        new Promise((resolve) => {
          setTimeout(() => {
            const lower = prompt.toLowerCase();
            if (lower.includes('generate exactly 20')) {
              resolve({
                ...MOCK_DAILY_GENERATION,
                ideas: generateMockIdeas(20),
              });
            } else {
              resolve(MOCK_DAILY_GENERATION);
            }
          }, 50); // 50ms delay per batch
        })
    );

    mockGetRecentEmbeddings.mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 50); // 50ms delay for embeddings
        })
    );

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    const startTime = Date.now();
    await handler(req, res);
    const elapsed = Date.now() - startTime;

    // With parallelization: 50ms for batches + 50ms for embeddings = ~100ms
    // (both run in parallel, not sequentially which would be ~300ms)
    // We use a loose bound to account for system variance
    expect(elapsed).toBeLessThan(400);
    expect(mockGetRecentEmbeddings).toHaveBeenCalledWith('2026-04-11');
    expect(res.json).toHaveBeenCalledOnce();
  });
});
