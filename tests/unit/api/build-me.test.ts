import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/generate/build-me';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

// Mock dependencies
vi.mock('../../../api/_lib/ai-provider', () => ({
  generateWithAI: vi.fn(),
  normalizeAIResponse: vi.fn((raw) => raw),
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY: 'ARRAY',
    NUMBER: 'NUMBER',
  },
  default: {
    generateWithAI: vi.fn(),
    normalizeAIResponse: vi.fn((raw) => raw),
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY',
      NUMBER: 'NUMBER',
    },
  },
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
  buildUsageResponse: vi.fn(),
}));

import { generateWithAI } from '../../../api/_lib/ai-provider';
import { getCached } from '../../../api/_lib/cache';
import { getAuthContext } from '../../../api/_lib/auth';
import { checkAndIncrementUsage } from '../../../api/_lib/usage';

describe('build-me handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 for missing idea', async () => {
    const req = createMockRequest({ method: 'POST', body: {} });
    const res = createMockResponse();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('generates build pack when not cached', async () => {
    const mockIdea = { id: '123', headline: 'Test Idea' };
    const req = createMockRequest({ method: 'POST', body: { idea: mockIdea } });
    const res = createMockResponse();

    vi.mocked(getAuthContext).mockResolvedValue({ uid: 'user1', tier: 'builder', isAdmin: false });
    vi.mocked(getCached).mockResolvedValue(null);
    vi.mocked(checkAndIncrementUsage).mockResolvedValue({ allowed: true, limit: 10 } as any);
    vi.mocked(generateWithAI).mockResolvedValue({
      promptPack: [],
      repoStructure: 'Test Structure',
      first24Hours: [],
    });

    await handler(req as any, res as any);

    expect(generateWithAI).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
