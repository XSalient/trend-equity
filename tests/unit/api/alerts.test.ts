import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/_handlers/alerts';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

vi.mock('../../../api/_lib/ai-provider', () => ({
  generateWithAI: vi.fn(),
  getToday: vi.fn(() => '2026-07-20'),
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
}));

import { generateWithAI } from '../../../api/_lib/ai-provider';
import { getCached, setCached } from '../../../api/_lib/cache';
import { getAuthContext } from '../../../api/_lib/auth';
import { checkAndIncrementUsage } from '../../../api/_lib/usage';

const mockAlerts = [{ title: 'New trend detected', message: 'AI dev tools spiking', type: 'info' }];

describe('alerts handler', () => {
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
    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns 403 for free/pro tier — alerts are Builder-only (TE-13), stopping hidden AI spend', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns cached alerts when cache hit', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(mockAlerts);

    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(generateWithAI).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(mockAlerts);
  });

  it('generates alerts when no cache exists', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockAlerts);

    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(generateWithAI).toHaveBeenCalled();
    expect(setCached).toHaveBeenCalledWith(expect.stringContaining('alerts_'), mockAlerts);
    expect(res.json).toHaveBeenCalledWith(mockAlerts);
  });

  it('returns 429 when usage limit reached', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: false, limit: 1 } as any);

    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns an empty array (never fake data) when AI generation fails', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockRejectedValue(new Error('AI service unavailable'));

    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith([]);
    expect(setCached).not.toHaveBeenCalled();
  });
});
