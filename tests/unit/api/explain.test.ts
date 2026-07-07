import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/_handlers/explain';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

vi.mock('../../../api/_lib/ai-provider', () => ({
  generateWithAI: vi.fn(),
}));

vi.mock('../../../api/_lib/cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
}));

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../../api/_lib/usage', () => ({
  checkAndIncrementUsage: vi.fn(),
}));

import { generateWithAI } from '../../../api/_lib/ai-provider';
import { getCached, setCached } from '../../../api/_lib/cache';
import { getAuthContext } from '../../../api/_lib/auth';
import { checkAndIncrementUsage } from '../../../api/_lib/usage';

const mockIdea = { id: 'idea-123', headline: 'AI Scheduling SaaS' };
const mockExplanation = { text: 'This section means your TAM is $5B because...' };

describe('explain handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 when idea is missing', async () => {
    const req = createMockRequest({ method: 'POST', body: { section: 'Revenue Model' } });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required field: idea' });
  });

  it('returns 400 when idea.headline is missing', async () => {
    const req = createMockRequest({
      method: 'POST',
      body: { idea: { id: '1' }, section: 'Revenue' },
    });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required field: idea.headline' });
  });

  it('returns 400 when section is missing', async () => {
    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required field: section' });
  });

  it('returns cached explanation on cache hit', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    vi.mocked(getCached).mockResolvedValue(mockExplanation);

    const req = createMockRequest({
      method: 'POST',
      body: { idea: mockIdea, section: 'Revenue Model' },
    });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(generateWithAI).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ...mockExplanation, _cached: true });
  });

  it('generates explanation when cache misses', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 20 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockExplanation);

    const req = createMockRequest({
      method: 'POST',
      body: { idea: mockIdea, section: 'Revenue Model' },
    });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(generateWithAI).toHaveBeenCalled();
    expect(setCached).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(mockExplanation);
  });

  it('passes additional context to the AI prompt', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 20 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockExplanation);

    const req = createMockRequest({
      method: 'POST',
      body: { idea: mockIdea, section: 'Unit Economics', context: 'SaaS B2B model' },
    });
    const res = createMockResponse();

    await handler(req as any, res as any);

    const prompt = vi.mocked(generateWithAI).mock.calls[0][0] as string;
    expect(prompt).toContain('Unit Economics');
    expect(prompt).toContain('SaaS B2B model');
  });

  it('returns 429 when usage limit reached', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'free' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: false, limit: 5 } as any);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea, section: 'Revenue' } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(generateWithAI).not.toHaveBeenCalled();
  });

  it('returns 500 on AI generation error', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 20 } as any);
    vi.mocked(generateWithAI).mockRejectedValue(new Error('Service error'));

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea, section: 'Revenue' } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(setCached).not.toHaveBeenCalled();
  });

  it('sanitizes dangerous characters in section name before prompt', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'pro' } as any);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 20 } as any);
    vi.mocked(generateWithAI).mockResolvedValue(mockExplanation);

    const req = createMockRequest({
      method: 'POST',
      body: { idea: mockIdea, section: '<script>alert("xss")</script>Revenue' },
    });
    const res = createMockResponse();

    await handler(req as any, res as any);

    const prompt = vi.mocked(generateWithAI).mock.calls[0][0] as string;
    expect(prompt).not.toContain('<script>');
    expect(prompt).toContain('Revenue');
  });

  it('skips usage check for unauthenticated users', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(generateWithAI).mockResolvedValue(mockExplanation);

    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea, section: 'Revenue' } });
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(checkAndIncrementUsage).not.toHaveBeenCalled();
    expect(generateWithAI).toHaveBeenCalled();
  });
});
