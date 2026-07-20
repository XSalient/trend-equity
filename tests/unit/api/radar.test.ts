/**
 * Unit tests for api/generate/radar.ts
 *
 * Covers:
 *  + Returns radar data on successful Gemini call
 *  + Returns cached result with _cached:true on cache hit
 *  + Attaches _usage response for authenticated user
 *  + Builder tier is always allowed (no usage limit)
 *  - Returns 405 for non-POST request
 *  - Returns 401 when unauthenticated (TE-13: radar is Builder-only)
 *  - Returns 403 for free/pro tier (TE-13)
 *  - Returns 429 when usage limit exceeded
 *  - Returns 503 when Gemini throws
 *  - Does NOT return mock data when Gemini fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';
import { MOCK_RADAR_RESPONSE, MOCK_USAGE_RESPONSE } from '../helpers/fixtures';

// ── Module mocks ──────────────────────────────────────────────────────────────

const {
  mockGenerateWithAI,
  mockGetCached,
  mockSetCached,
  mockCheckAndIncrementUsage,
  mockBuildUsageResponse,
  mockGetAuthContext,
} = vi.hoisted(() => ({
  mockGenerateWithAI: vi.fn(),
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
  mockCheckAndIncrementUsage: vi.fn(),
  mockBuildUsageResponse: vi.fn(),
  mockGetAuthContext: vi.fn(),
}));

vi.mock('../../../api/_lib/ai-provider', () => {
  const mockAI = {
    generateWithAI: mockGenerateWithAI,
    normalizeAIResponse: vi.fn((data) => data),
    radarSchema: { type: 'OBJECT' },
    getToday: vi.fn(() => '2026-04-11'),
  };
  return { ...mockAI, default: mockAI };
});

vi.mock('../../../api/_lib/cache', () => ({
  getCached: mockGetCached,
  setCached: mockSetCached,
}));

vi.mock('../../../api/_lib/usage', () => ({
  checkAndIncrementUsage: mockCheckAndIncrementUsage,
  buildUsageResponse: mockBuildUsageResponse,
}));

vi.mock('../../../api/_lib/auth', async () => {
  const actual =
    await vi.importActual<typeof import('../../../api/_lib/auth')>('../../../api/_lib/auth');
  return {
    getAuthContext: mockGetAuthContext,
    requireTier: actual.requireTier,
  };
});

import handler from '../../../api/_handlers/radar';

describe('POST /api/generate/radar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null); // cache miss by default
    mockSetCached.mockResolvedValue(undefined);
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, remaining: 2, limit: 3 });
    mockBuildUsageResponse.mockResolvedValue({ ...MOCK_USAGE_RESPONSE, featureType: 'radar' });
    mockGenerateWithAI.mockResolvedValue(MOCK_RADAR_RESPONSE);
    // Radar is Builder-only (TE-13) — authenticated Builder user by default
    mockGetAuthContext.mockResolvedValue({ uid: 'user-1', tier: 'builder' });
  });

  // ── Positive cases ────────────────────────────────────────────────

  it('returns radar data with correct shape on success', async () => {
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body;
    expect(body.week).toBeTruthy();
    expect(Array.isArray(body.topTrends)).toBe(true);
    expect(body.topTrends.length).toBe(5);
    expect(body.marketShift).toBeTruthy();
    expect(Array.isArray(body.opportunityAreas)).toBe(true);
  });

  it('returns cached result with _cached:true when cache hit', async () => {
    mockGetCached.mockResolvedValue(MOCK_RADAR_RESPONSE);

    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body._cached).toBe(true);
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it('writes result to cache after successful Gemini call', async () => {
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(mockSetCached).toHaveBeenCalledOnce();
    const [key, value] = mockSetCached.mock.calls[0];
    expect(key).toContain('radar');
    expect(value).toEqual(MOCK_RADAR_RESPONSE);
  });

  it('attaches _usage response for authenticated user', async () => {
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body._usage).toBeDefined();
    expect(res._body._usage.featureType).toBe('radar');
  });

  // ── Negative cases ────────────────────────────────────────────────

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._body.error).toContain('Method not allowed');
  });

  it('returns 429 when daily usage limit is exceeded', async () => {
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: false, remaining: 0, limit: 3 });

    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect(res._body.error).toContain('limit reached');
    expect(res._body._usage.remaining).toBe(0);
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated (TE-13)', async () => {
    mockGetAuthContext.mockResolvedValue(null);

    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('returns 403 for free/pro tier — radar is Builder-only (TE-13)', async () => {
    mockGetAuthContext.mockResolvedValue({ uid: 'user-1', tier: 'pro' });

    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._body.upgradeRequired).toBe(true);
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it('returns 503 when Gemini throws — no mock data in response', async () => {
    mockGenerateWithAI.mockRejectedValue(new Error('Gemini API error'));

    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._body.error).toContain('temporarily unavailable');
    // Must NOT contain any mock trend data
    expect(res._body.topTrends).toBeUndefined();
    expect(res._body.week).toBeUndefined();
  });
});
