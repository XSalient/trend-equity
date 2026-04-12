/**
 * Unit tests for api/generate/action-plan.ts
 * (pattern applies to build-me, validation, vetting — same handler shape)
 *
 * Covers:
 *  + Returns roadmap data on successful Gemini call
 *  + Returns cached result with _cached:true on cache hit
 *  + Attaches _usage to response for authenticated user
 *  + Uses idea.id as cache key; skips cache when no idea.id
 *  + Free tier: allowed when under limit
 *  - Returns 405 for non-POST requests
 *  - Returns 429 when usage limit exceeded
 *  - Returns 500 when Gemini throws
 *  - Does NOT cache on error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';
import { MOCK_IDEA, MOCK_ACTION_PLAN_RESPONSE, MOCK_USAGE_RESPONSE } from '../helpers/fixtures';

// ── Module mocks ──────────────────────────────────────────────────────────────

const {
  mockGenerateWithGemini,
  mockGetCached,
  mockSetCached,
  mockCheckAndIncrementUsage,
  mockBuildUsageResponse,
  mockGetAuthContext,
} = vi.hoisted(() => ({
  mockGenerateWithGemini: vi.fn(),
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
  mockCheckAndIncrementUsage: vi.fn(),
  mockBuildUsageResponse: vi.fn(),
  mockGetAuthContext: vi.fn(),
}));

vi.mock('../../../api/_lib/gemini', () => ({
  generateWithGemini: mockGenerateWithGemini,
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
}));

vi.mock('../../../api/_lib/cache', () => ({
  getCached: mockGetCached,
  setCached: mockSetCached,
}));

vi.mock('../../../api/_lib/usage', () => ({
  checkAndIncrementUsage: mockCheckAndIncrementUsage,
  buildUsageResponse: mockBuildUsageResponse,
}));

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: mockGetAuthContext,
}));

import handler from '../../../api/generate/action-plan';

describe('POST /api/generate/action-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null);
    mockSetCached.mockResolvedValue(undefined);
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, remaining: 2, limit: 3 });
    mockBuildUsageResponse.mockResolvedValue(MOCK_USAGE_RESPONSE);
    mockGenerateWithGemini.mockResolvedValue(MOCK_ACTION_PLAN_RESPONSE);
    // Auth: authenticated user by default (most action tests use a uid)
    mockGetAuthContext.mockResolvedValue({ uid: 'user-1', tier: 'free' });
  });

  // ── Positive cases ────────────────────────────────────────────────

  it('returns action plan with correct shape on success', async () => {
    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body;
    expect(Array.isArray(body.roadmap)).toBe(true);
    expect(body.roadmap.length).toBeGreaterThan(0);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(Array.isArray(body.risks)).toBe(true);
    expect(typeof body.timeline).toBe('string');
  });

  it('returns cached result with _cached:true on cache hit', async () => {
    mockGetCached.mockResolvedValue(MOCK_ACTION_PLAN_RESPONSE);

    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body._cached).toBe(true);
    expect(mockGenerateWithGemini).not.toHaveBeenCalled();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it('uses idea.id as cache key', async () => {
    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    const cacheKeyRead: string = mockGetCached.mock.calls[0][0];
    expect(cacheKeyRead).toContain(MOCK_IDEA.id);
    expect(cacheKeyRead).toContain('action-plan');
  });

  it('writes to cache after successful generation', async () => {
    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockSetCached).toHaveBeenCalledOnce();
    expect(mockSetCached.mock.calls[0][1]).toEqual(MOCK_ACTION_PLAN_RESPONSE);
  });

  it('attaches _usage to response', async () => {
    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body._usage).toBeDefined();
    expect(res._body._usage.featureType).toBe('action-plan');
  });

  it('includes idea headline in the generation prompt', async () => {
    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    const promptArg: string = mockGenerateWithGemini.mock.calls[0][0];
    expect(promptArg).toContain(MOCK_IDEA.headline);
  });

  it('skips cache lookup when idea has no id', async () => {
    const ideaNoId = { ...MOCK_IDEA, id: undefined };
    const req = createMockRequest({ body: { idea: ideaNoId, uid: 'user-1', tier: 'free' } });
    const res = createMockResponse();

    await handler(req, res);

    // getCached called with empty string — which returns null immediately
    expect(mockGetCached).toHaveBeenCalledWith('');
  });

  // ── Negative cases ────────────────────────────────────────────────

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._body.error).toContain('Method not allowed');
  });

  it('returns 429 when free tier limit is exceeded', async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: false, remaining: 0, limit: 3 });

    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect(res._body.error).toContain('limit reached');
    expect(mockGenerateWithGemini).not.toHaveBeenCalled();
  });

  it('returns 500 when Gemini throws', async () => {
    mockGenerateWithGemini.mockRejectedValue(new Error('Generation failed'));

    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._body.error).toContain('Action plan generation failed');
  });

  it('does NOT write to cache when Gemini throws', async () => {
    mockGenerateWithGemini.mockRejectedValue(new Error('Error'));

    const req = createMockRequest({ body: { idea: MOCK_IDEA } });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockSetCached).not.toHaveBeenCalled();
  });
});
