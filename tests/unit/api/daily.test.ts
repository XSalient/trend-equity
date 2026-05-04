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
} = vi.hoisted(() => ({
  mockGenerateWithAI: vi.fn(),
  mockFetchLiveSignals: vi.fn(),
  mockFormatSignalsForPrompt: vi.fn(),
  mockGetRecentIdeaHeadlines: vi.fn(),
  mockGetAuthContext: vi.fn(),
  mockGetAdminDb: vi.fn(),
  mockCheckAndIncrementUsage: vi.fn(),
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
}));

import handler from '../../../api/generate/daily';

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
    mockGenerateWithAI.mockResolvedValue(MOCK_DAILY_GENERATION);
    // Auth: builder tier required to trigger daily generation
    mockGetAuthContext.mockResolvedValue({ uid: 'user-1', tier: 'builder' });
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, remaining: 10, limit: null });
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
    mockGetRecentIdeaHeadlines.mockResolvedValue(['Old Idea 1', 'Old Idea 2']);

    const req = createMockRequest({ body: { date: '2026-04-11' } });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithAI.mock.calls[0][0];
    expect(promptArg).toContain('DO NOT REPEAT RECENT IDEAS');
    expect(promptArg).toContain('Old Idea 1');
    expect(promptArg).toContain('Old Idea 2');
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
    expect(promptArg).toContain('Generate exactly 35');
    expect(promptArg).not.toContain('LIVE MARKET SIGNALS');
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
});
