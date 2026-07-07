import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

const { generateWithAI, normalizeAIResponse, docGet, docSet } = vi.hoisted(() => ({
  generateWithAI: vi.fn(),
  normalizeAIResponse: vi.fn(),
  docGet: vi.fn(),
  docSet: vi.fn(),
}));

vi.mock('../../../api/_lib/ai-provider', () => ({
  default: {
    generateWithAI,
    normalizeAIResponse,
    dailyResponseSchema: {},
    getToday: () => '2026-07-03',
  },
}));

vi.mock('../../../api/_lib/signals', () => ({
  fetchLiveSignals: vi.fn().mockResolvedValue([]),
  formatSignalsForPrompt: vi.fn().mockReturnValue(''),
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({ get: docGet, set: docSet }),
    }),
  }),
}));

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: vi.fn(),
}));

import handler from '../../../api/_handlers/custom-feed';
import { getAuthContext } from '../../../api/_lib/auth';

const freshFeed = {
  date: '2026-07-03',
  intro: 'Cached intro',
  ideas: [{ id: 'custom-feed-2026-07-03-1-abc', headline: 'Cached idea' }],
  generatedAt: new Date().toISOString(),
  customRequirement: 'fintech',
};

const staleFeed = {
  ...freshFeed,
  generatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
};

function mockCacheDoc(data: Record<string, unknown> | null) {
  docGet.mockResolvedValue(
    data ? { exists: true, data: () => data } : { exists: false, data: () => undefined }
  );
}

describe('custom-feed handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null as any);
    const req = createMockRequest({ body: { requirement: 'fintech' } });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for free tier', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'free' } as any);
    const req = createMockRequest({ body: { requirement: 'fintech' } });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when requirement is missing and not peeking', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'builder' } as any);
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns the cached feed without regenerating when fresh', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'builder' } as any);
    mockCacheDoc(freshFeed);
    const req = createMockRequest({ body: { requirement: 'anything else' } });
    const res = createMockResponse();
    await handler(req, res);
    expect(generateWithAI).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ _cached: true }));
  });

  it('peek returns the cached feed when fresh', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'builder' } as any);
    mockCacheDoc(freshFeed);
    const req = createMockRequest({ body: { peek: true } });
    const res = createMockResponse();
    await handler(req, res);
    expect(generateWithAI).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ _cached: true, customRequirement: 'fintech' })
    );
  });

  it('peek returns 404 when no cache exists — never generates', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'builder' } as any);
    mockCacheDoc(null);
    const req = createMockRequest({ body: { peek: true } });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('peek returns 404 when the cache is older than 24h — never generates', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'builder' } as any);
    mockCacheDoc(staleFeed);
    const req = createMockRequest({ body: { peek: true } });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('generates and persists a feed when the cache is stale', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'builder' } as any);
    mockCacheDoc(staleFeed);
    generateWithAI.mockResolvedValue({ ideas: [] });
    normalizeAIResponse.mockReturnValue({
      intro: 'New intro',
      ideas: [{ headline: 'Fresh idea' }],
      disclaimer: 'd',
    });
    const req = createMockRequest({
      body: { requirement: 'solo-friendly B2B ideas' },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(generateWithAI).toHaveBeenCalled();
    expect(docSet).toHaveBeenCalledWith(
      expect.objectContaining({ customRequirement: 'solo-friendly B2B ideas' })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ customFeedStatus: 'partial' }));
  });

  it('normalises pro requirements down to a single keyword', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'u1', tier: 'pro' } as any);
    mockCacheDoc(null);
    generateWithAI.mockResolvedValue({ ideas: [] });
    normalizeAIResponse.mockReturnValue({ intro: 'i', ideas: [], disclaimer: 'd' });
    const req = createMockRequest({ body: { requirement: 'solar power plants' } });
    const res = createMockResponse();
    await handler(req, res);
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ customRequirement: 'solar' }));
  });
});
