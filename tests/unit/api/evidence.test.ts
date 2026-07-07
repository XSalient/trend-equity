/**
 * Unit tests for api/generate/evidence.ts
 *
 * Covers:
 *  + Returns cached evidence without calling the AI
 *  + Generates, caches, and returns evidence on cache miss
 *  + Patches the idea inside daily_generations/{date} when date provided
 *  + Requires authentication (401 for anonymous)
 *  + Enforces daily usage limit (429)
 *  + Validates input (400 for missing idea/headline), 405 for non-POST
 *  + Returns 500 (not throw) when generation fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

const {
  mockGatherEvidence,
  mockGetCached,
  mockSetCached,
  mockGetAuthContext,
  mockCheckAndIncrementUsage,
  mockBuildUsageResponse,
  mockGetAdminDb,
} = vi.hoisted(() => ({
  mockGatherEvidence: vi.fn(),
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
  mockGetAuthContext: vi.fn(),
  mockCheckAndIncrementUsage: vi.fn(),
  mockBuildUsageResponse: vi.fn(),
  mockGetAdminDb: vi.fn(),
}));

vi.mock('../../../api/_lib/evidence', () => ({
  gatherEvidence: mockGatherEvidence,
}));

vi.mock('../../../api/_lib/cache', () => ({
  getCached: mockGetCached,
  setCached: mockSetCached,
}));

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('../../../api/_lib/usage', () => ({
  checkAndIncrementUsage: mockCheckAndIncrementUsage,
  buildUsageResponse: mockBuildUsageResponse,
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: mockGetAdminDb,
}));

import handler from '../../../api/_handlers/evidence';

const IDEA = { id: '2026-07-02-abc123', headline: 'Test Idea', pitch: 'A pitch.' };
const EVIDENCE = {
  competitors: [{ name: 'X', oneLiner: 'y' }],
  marketSizeCited: '$1B',
  whyNowEvidence: 'because',
  sources: [{ title: 'Src', url: 'https://a.com' }],
  evidenceScore: 7,
};

describe('POST /api/generate/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ uid: 'user-1', tier: 'pro' });
    mockGetCached.mockResolvedValue(null);
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, remaining: 10, limit: 15 });
    mockBuildUsageResponse.mockResolvedValue({ featureType: 'evidence', used: 1 });
    mockGatherEvidence.mockResolvedValue(EVIDENCE);
    mockGetAdminDb.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    });
  });

  it('generates, caches, and returns evidence on cache miss', async () => {
    const req = createMockRequest({ body: { idea: IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockGatherEvidence).toHaveBeenCalledOnce();
    expect(mockSetCached).toHaveBeenCalledWith('evidence_2026-07-02-abc123', EVIDENCE);
    expect(res._body.evidenceScore).toBe(7);
    expect(res._body._usage).toBeTruthy();
  });

  it('returns cached evidence without calling the AI', async () => {
    mockGetCached.mockResolvedValue(EVIDENCE);
    const req = createMockRequest({ body: { idea: IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockGatherEvidence).not.toHaveBeenCalled();
    expect(res._body._cached).toBe(true);
  });

  it('patches the idea in daily_generations when a valid date is provided', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ ideas: [{ id: IDEA.id, headline: 'Test Idea' }, { id: 'other' }] }),
    });
    mockGetAdminDb.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: mockGet, set: mockSet })) })),
    });

    const req = createMockRequest({ body: { idea: IDEA, date: '2026-07-02' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockSet).toHaveBeenCalledOnce();
    const [update, opts] = mockSet.mock.calls[0];
    expect(update.ideas[0].evidence).toEqual(EVIDENCE);
    expect(update.ideas[1].evidence).toBeUndefined();
    expect(opts).toEqual({ merge: true });
  });

  it('does not touch Firestore when date is missing or malformed', async () => {
    const req = createMockRequest({ body: { idea: IDEA, date: 'DROP TABLE' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockGetAdminDb).not.toHaveBeenCalled();
    expect(res._body.evidenceScore).toBe(7);
  });

  it('returns 401 for anonymous users', async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const req = createMockRequest({ body: { idea: IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(mockGatherEvidence).not.toHaveBeenCalled();
  });

  it('returns 429 when the daily limit is exhausted', async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: false, remaining: 0, limit: 3 });
    const req = createMockRequest({ body: { idea: IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect(mockGatherEvidence).not.toHaveBeenCalled();
  });

  it('validates input: 400 for missing idea or headline, 405 for GET', async () => {
    const res1 = createMockResponse();
    await handler(createMockRequest({ body: {} }), res1);
    expect(res1._status).toBe(400);

    const res2 = createMockResponse();
    await handler(createMockRequest({ body: { idea: { pitch: 'no headline' } } }), res2);
    expect(res2._status).toBe(400);

    const res3 = createMockResponse();
    await handler(createMockRequest({ method: 'GET' }), res3);
    expect(res3._status).toBe(405);
  });

  it('returns 500 (not throw) when evidence gathering fails', async () => {
    mockGatherEvidence.mockRejectedValue(new Error('Grounding quota exceeded'));
    const req = createMockRequest({ body: { idea: IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._body.error).toContain('Evidence gathering failed');
  });
});
