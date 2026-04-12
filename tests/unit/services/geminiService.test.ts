/**
 * Unit tests for src/services/geminiService.ts
 *
 * The service is a thin fetch wrapper.  We mock global.fetch and verify that:
 *  - Successful responses return the parsed JSON.
 *  - Non-OK responses throw (or return safe defaults) with the correct message.
 *  - Auth token is forwarded via Authorization header when set.
 *  - Usage bookkeeping (_lastUsage) is updated correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_IDEA } from '../helpers/fixtures';

// ── Stub environment variables before importing the module ────────────────────

vi.stubEnv('VITE_API_BASE', '');

// ── Mock global fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
// @ts-ignore — deliberately replacing global fetch
global.fetch = mockFetch;

// ── import.meta.env polyfill for the node environment ────────────────────────
// The service reads `import.meta.env.VITE_API_BASE`.  Vitest exposes stubEnv
// through import.meta.env, but we also need to make sure the module sees it.

// ── Import service under test ─────────────────────────────────────────────────

import {
  generateDailyIdeas,
  generateFullActionPlan,
  generateWeeklyTrendRadar,
  explainPlanSection,
  generateAlerts,
  setCurrentIdToken,
  getFeatureUsage,
} from '../../../src/services/geminiService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockOk(data: unknown) {
  return mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFail(status: number, data: unknown) {
  return mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth token between tests
    setCurrentIdToken(null);
  });

  // ── generateDailyIdeas ────────────────────────────────────────────────────

  describe('generateDailyIdeas', () => {
    it('successful fetch returns the parsed data', async () => {
      const data = { date: '2026-04-12', ideas: [MOCK_IDEA] };
      mockOk(data);

      const result = await generateDailyIdeas();

      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toContain('/api/generate/daily');
    });

    it('non-OK response throws with error.error message from the body', async () => {
      mockFail(429, { error: 'Daily limit reached' });

      await expect(generateDailyIdeas()).rejects.toThrow('Daily limit reached');
    });

    it('non-OK response with no body throws a fallback message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('no body')),
      });

      await expect(generateDailyIdeas()).rejects.toThrow('Failed to generate ideas');
    });
  });

  // ── generateFullActionPlan ────────────────────────────────────────────────

  describe('generateFullActionPlan', () => {
    it('success stores _usage in _lastUsage (readable via getFeatureUsage)', async () => {
      const usage = { featureType: 'action-plan', used: 1, limit: 3, remaining: 2 };
      const data = { roadmap: [], tools: [], risks: [], timeline: '12w', _usage: usage };
      mockOk(data);

      await generateFullActionPlan(MOCK_IDEA);

      const stored = getFeatureUsage('action-plan');
      expect(stored).not.toBeNull();
      expect(stored?.used).toBe(1);
      expect(stored?.remaining).toBe(2);
    });

    it('non-OK response stores usage from error body and throws', async () => {
      const usage = { featureType: 'action-plan', used: 3, limit: 3, remaining: 0 };
      mockFail(429, { error: 'Limit exceeded', _usage: usage });

      await expect(generateFullActionPlan(MOCK_IDEA)).rejects.toThrow('Limit exceeded');

      const stored = getFeatureUsage('action-plan');
      expect(stored).not.toBeNull();
      expect(stored?.remaining).toBe(0);
    });
  });

  // ── generateWeeklyTrendRadar ──────────────────────────────────────────────

  describe('generateWeeklyTrendRadar', () => {
    it('success returns the radar data', async () => {
      const data = { week: '2026-04-12', topTrends: [], marketShift: 'shift', opportunityAreas: [] };
      mockOk(data);

      const result = await generateWeeklyTrendRadar();

      expect(result.week).toBe('2026-04-12');
      expect(Array.isArray(result.topTrends)).toBe(true);
    });

    it('failure throws with error from response body', async () => {
      mockFail(503, { error: 'Radar service down' });

      await expect(generateWeeklyTrendRadar()).rejects.toThrow('Radar service down');
    });
  });

  // ── explainPlanSection ────────────────────────────────────────────────────

  describe('explainPlanSection', () => {
    it('non-OK response throws with error message from body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Explanation unavailable. Please try again.' }),
      });

      await expect(explainPlanSection(MOCK_IDEA, 'roadmap', 'context'))
        .rejects.toThrow('Explanation unavailable');
    });

    it('success returns data.text', async () => {
      mockOk({ text: 'Here is the roadmap explanation.' });

      const result = await explainPlanSection(MOCK_IDEA, 'roadmap', 'context');

      expect(result).toBe('Here is the roadmap explanation.');
    });
  });

  // ── generateAlerts ────────────────────────────────────────────────────────

  describe('generateAlerts', () => {
    it('non-OK response throws (caller handles gracefully)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Alert generation failed' }) });

      await expect(generateAlerts()).rejects.toThrow('Alert generation failed');
    });

    it('success returns the alerts array', async () => {
      const alerts = [{ id: 'a1', title: 'New trend', message: 'msg', type: 'info', timestamp: null, isRead: false }];
      mockOk(alerts);

      const result = await generateAlerts();

      expect(result).toEqual(alerts);
    });
  });

  // ── setCurrentIdToken / Authorization header ──────────────────────────────

  describe('setCurrentIdToken', () => {
    it('sets token — subsequent calls include Authorization: Bearer header', async () => {
      setCurrentIdToken('my-firebase-id-token');
      mockOk({ date: '2026-04-12', ideas: [] });

      await generateDailyIdeas();

      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-firebase-id-token');
    });

    it('setCurrentIdToken(null) — subsequent calls have no Authorization header', async () => {
      setCurrentIdToken('some-token');
      setCurrentIdToken(null);
      mockOk({ date: '2026-04-12', ideas: [] });

      await generateDailyIdeas();

      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });
  });
});
