import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/_handlers/futurecasting';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

vi.mock('../../../api/_lib/ai-provider', () => ({
  generateWithAI: vi.fn(),
  normalizeAIResponse: vi.fn((raw) => raw),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', NUMBER: 'NUMBER' },
}));

vi.mock('../../../api/_lib/cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
}));

vi.mock('../../../api/_lib/auth', async () => {
  const actual =
    await vi.importActual<typeof import('../../../api/_lib/auth')>('../../../api/_lib/auth');
  return {
    getAuthContext: vi.fn(),
    requireTier: actual.requireTier,
  };
});

vi.mock('../../../api/_lib/usage', () => ({
  checkAndIncrementUsage: vi.fn(),
  buildUsageResponse: vi
    .fn()
    .mockResolvedValue({ featureType: 'futurecasting', remaining: 5, limit: 10, used: 5 }),
}));

import { generateWithAI, normalizeAIResponse } from '../../../api/_lib/ai-provider';
import { getCached, setCached } from '../../../api/_lib/cache';
import { getAuthContext } from '../../../api/_lib/auth';
import { checkAndIncrementUsage } from '../../../api/_lib/usage';

const mockFuturecastingData = {
  horizon: '2030',
  predictions: [
    {
      title: 'AI-native SaaS displaces seat-based pricing',
      probability: 0.7,
      rationale: 'Usage-based billing already gaining share',
      winners: ['Usage-billing platforms'],
      losers: ['Legacy per-seat SaaS'],
    },
  ],
  paradigmShifts: [
    { title: 'Agents as default interface', rationale: 'LLM cost curve', impact: 'High' },
  ],
};

describe('futurecasting handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 when unauthenticated (TE-13)', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);
    const req = createMockRequest({ method: 'POST', body: { horizon: '2030' } });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns 403 for free/pro tier — futurecasting is Builder-only (TE-13)', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    const req = createMockRequest({ method: 'POST', body: { horizon: '2030' } });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ upgradeRequired: true }));
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns cached result when cache hit', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(mockFuturecastingData);

    const req = createMockRequest({ method: 'POST', body: { horizon: '2030' } });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(generateWithAI).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ _cached: true, horizon: '2030' })
    );
  });

  it('generates futurecasting when no cache exists', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockFuturecastingData);
    vi.mocked(normalizeAIResponse).mockReturnValue(mockFuturecastingData as any);

    const req = createMockRequest({ method: 'POST', body: { horizon: '2030' } });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(generateWithAI).toHaveBeenCalled();
    expect(setCached).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ horizon: '2030' }));
  });

  it('falls back to 2030 for an invalid horizon value', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockFuturecastingData);
    vi.mocked(normalizeAIResponse).mockReturnValue({
      ...mockFuturecastingData,
      horizon: '2030',
    } as any);

    const req = createMockRequest({ method: 'POST', body: { horizon: '9999' } });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(getCached).toHaveBeenCalledWith(expect.stringContaining('futurecasting_2030_'));
  });

  it('returns 429 when usage limit reached', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: false, limit: 1 } as any);

    const req = createMockRequest({ method: 'POST', body: { horizon: '2030' } });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns 503 when AI generation fails', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockRejectedValue(new Error('AI service unavailable'));

    const req = createMockRequest({ method: 'POST', body: { horizon: '2030' } });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(setCached).not.toHaveBeenCalled();
  });
});
