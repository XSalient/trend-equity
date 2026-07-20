import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/_handlers/vetting';
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
    .mockResolvedValue({ featureType: 'vetting', remaining: 5, limit: 10, used: 5 }),
}));

import { generateWithAI, normalizeAIResponse } from '../../../api/_lib/ai-provider';
import { getCached, setCached } from '../../../api/_lib/cache';
import { getAuthContext } from '../../../api/_lib/auth';
import { checkAndIncrementUsage, buildUsageResponse } from '../../../api/_lib/usage';

const mockIdea = {
  id: 'idea-123',
  headline: 'AI Scheduling SaaS',
  pitch: 'Automates bookings',
  vcJustification: 'Large TAM',
};

const mockVettingData = {
  score: 82,
  verdict: 'High Conviction',
  strengths: ['Strong market'],
  weaknesses: ['High CAC'],
  riskMitigation: ['Focus organic growth'],
  pivotSuggestions: ['B2B pivot'],
  comparableExits: ['Calendly'],
};

describe('vetting handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildUsageResponse).mockResolvedValue({
      featureType: 'vetting',
      remaining: 5,
      limit: 10,
      used: 5,
    } as any);
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns 400 when idea is missing', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when idea.headline is missing', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    const req = createMockRequest({ method: 'POST', body: { idea: { id: '1' } } });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required field: idea.headline' });
  });

  it('returns cached result when cache hit and refresh=false', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(mockVettingData);
    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(getCached).toHaveBeenCalledWith(`vetting_${mockIdea.id}`);
    expect(generateWithAI).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ _cached: true, score: 82 }));
  });

  it('bypasses cache and regenerates when refresh=true', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(mockVettingData);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockVettingData);
    vi.mocked(normalizeAIResponse).mockReturnValue(mockVettingData as any);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea, refresh: true } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(generateWithAI).toHaveBeenCalled();
  });

  it('generates vetting when no cache exists', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockVettingData);
    vi.mocked(normalizeAIResponse).mockReturnValue(mockVettingData as any);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(generateWithAI).toHaveBeenCalled();
    expect(setCached).toHaveBeenCalledWith(`vetting_${mockIdea.id}`, mockVettingData);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ score: 82, verdict: 'High Conviction' })
    );
  });

  it('returns 429 when usage limit reached', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: false, limit: 1 } as any);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(generateWithAI).not.toHaveBeenCalled();
    expect(setCached).not.toHaveBeenCalled();
  });

  it('returns 500 and does not cache on AI generation error', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockRejectedValue(new Error('AI service unavailable'));

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(setCached).not.toHaveBeenCalled();
  });

  it('sanitizes dangerous characters from headline before prompt', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockVettingData);
    vi.mocked(normalizeAIResponse).mockReturnValue(mockVettingData as any);

    const maliciousIdea = { ...mockIdea, headline: '<script>alert("xss")</script> Real Idea' };
    const req = createMockRequest({ method: 'POST', body: { idea: maliciousIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    const prompt = vi.mocked(generateWithAI).mock.calls[0][0] as string;
    expect(prompt).not.toContain('<script>');
    expect(prompt).not.toContain('"xss"');
    expect(prompt).toContain('Real Idea');
  });

  it('returns 401 when unauthenticated (TE-13)', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getCached).not.toHaveBeenCalled();
    expect(checkAndIncrementUsage).not.toHaveBeenCalled();
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns 403 for free/pro tier — vetting is Builder-only (TE-13)', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ upgradeRequired: true }));
    expect(generateWithAI).not.toHaveBeenCalled();
  });
});
