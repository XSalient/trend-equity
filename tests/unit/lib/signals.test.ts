/**
 * Unit tests for api/_lib/signals.ts
 *
 * Covers:
 *  + Returns signals from all 5 sources when all succeed
 *  + Gracefully handles partial failures (some sources return empty)
 *  + Returns all-empty arrays when all sources fail
 *  + Caches signals in memory for 1 hour; second call skips fetch
 *  + Does NOT cache when all sources returned empty
 *  + formatSignalsForPrompt returns empty string for all-empty signals
 *  + formatSignalsForPrompt includes all non-empty source sections
 *  + formatSignalsForPrompt contains source instruction text
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock global fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to build a minimal RSS XML response
function rssXml(titles: string[]) {
  const items = titles.map(t => `<item><title><![CDATA[${t}]]></title></item>`).join('');
  return `<rss><channel>${items}</channel></rss>`;
}

// Helper to build a minimal Reddit JSON response
function redditJson(posts: { title: string; ups: number; subreddit: string }[]) {
  return JSON.stringify({
    data: {
      children: posts.map(p => ({
        data: { title: p.title, ups: p.ups, subreddit: p.subreddit, stickied: false },
      })),
    },
  });
}

// Helper to build a minimal HN Algolia JSON response
function hnJson(hits: { title: string; points: number }[]) {
  return JSON.stringify({ hits });
}

function mockResponse(body: string, ok = true) {
  return {
    ok,
    text: vi.fn().mockResolvedValue(body),
    // json() is lazy so XML bodies don't throw at mock creation time
    json: vi.fn().mockImplementation(() => {
      try { return Promise.resolve(JSON.parse(body)); }
      catch { return Promise.reject(new SyntaxError('Not valid JSON')); }
    }),
  };
}

describe('fetchLiveSignals', () => {
  // Reset module cache between tests so in-memory signal cache doesn't persist
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns signals from all 5 sources when all succeed', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(rssXml(['Google Trend 1', 'Google Trend 2'])))       // Google Trends
      .mockResolvedValueOnce(mockResponse(rssXml(['PH Launch 1'])))                             // Product Hunt
      .mockResolvedValueOnce({ ok: true, text: vi.fn(), json: vi.fn().mockResolvedValue(JSON.parse(redditJson([{ title: 'Reddit Post 1', ups: 100, subreddit: 'SaaS' }]))) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn(), json: vi.fn().mockResolvedValue(JSON.parse(hnJson([{ title: 'HN Story 1', points: 150 }]))) })
      .mockResolvedValueOnce(mockResponse(rssXml(['TC Funding 1'])));                           // TechCrunch

    const { fetchLiveSignals } = await import('../../../api/_lib/signals');
    const signals = await fetchLiveSignals();

    expect(signals.googleTrends).toContain('Google Trend 1');
    expect(signals.productHuntLaunches).toContain('PH Launch 1');
    expect(signals.redditHotThreads.length).toBeGreaterThan(0);
    expect(signals.hnDiscussions.length).toBeGreaterThan(0);
    expect(signals.techCrunchFunding).toContain('TC Funding 1');
    expect(signals.sourcesCached).toBe(false);
    expect(typeof signals.fetchedAt).toBe('string');
  });

  it('returns empty arrays for sources that fail, non-empty for sources that succeed', async () => {
    // Only Google Trends succeeds, everything else throws
    mockFetch
      .mockResolvedValueOnce(mockResponse(rssXml(['Trend A', 'Trend B']))) // Google Trends — OK
      .mockRejectedValueOnce(new Error('PH timeout'))                       // Product Hunt — fail
      .mockRejectedValueOnce(new Error('Reddit timeout'))                   // Reddit — fail
      .mockRejectedValueOnce(new Error('HN timeout'))                       // HN — fail
      .mockRejectedValueOnce(new Error('TC timeout'));                       // TechCrunch — fail

    const { fetchLiveSignals } = await import('../../../api/_lib/signals');
    const signals = await fetchLiveSignals();

    expect(signals.googleTrends.length).toBeGreaterThan(0);
    expect(signals.productHuntLaunches).toEqual([]);
    expect(signals.redditHotThreads).toEqual([]);
    expect(signals.hnDiscussions).toEqual([]);
    expect(signals.techCrunchFunding).toEqual([]);
  });

  it('returns all-empty arrays when all sources fail', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'));

    const { fetchLiveSignals } = await import('../../../api/_lib/signals');
    const signals = await fetchLiveSignals();

    expect(signals.googleTrends).toEqual([]);
    expect(signals.productHuntLaunches).toEqual([]);
    expect(signals.redditHotThreads).toEqual([]);
    expect(signals.hnDiscussions).toEqual([]);
    expect(signals.techCrunchFunding).toEqual([]);
  });

  it('does not cache results when all sources returned empty', async () => {
    mockFetch.mockRejectedValue(new Error('All down'));

    const { fetchLiveSignals } = await import('../../../api/_lib/signals');
    await fetchLiveSignals(); // first call — empty, should NOT cache

    mockFetch.mockResolvedValue(mockResponse(rssXml(['Trend A']))); // now sources are back

    const signals2 = await fetchLiveSignals(); // second call — should fetch again
    expect(signals2.googleTrends.length).toBeGreaterThan(0);
    expect(signals2.sourcesCached).toBe(false);
  });

  it('returns cached signals on second call within TTL', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(rssXml(['Trend A'])))
      .mockResolvedValueOnce(mockResponse(rssXml(['PH 1'])))
      .mockResolvedValueOnce({ ok: true, text: vi.fn(), json: vi.fn().mockResolvedValue({ data: { children: [] } }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn(), json: vi.fn().mockResolvedValue({ hits: [] }) })
      .mockResolvedValueOnce(mockResponse(rssXml(['TC 1'])));

    const { fetchLiveSignals } = await import('../../../api/_lib/signals');
    await fetchLiveSignals(); // warms cache

    const callCount = mockFetch.mock.calls.length;
    const signals2 = await fetchLiveSignals(); // should hit cache

    expect(mockFetch).toHaveBeenCalledTimes(callCount); // no new calls
    expect(signals2.sourcesCached).toBe(true);
  });

  it('filters out Reddit posts with under 30 upvotes', async () => {
    const posts = [
      { title: 'Low upvote post', ups: 5, subreddit: 'SaaS' },
      { title: 'High upvote post', ups: 200, subreddit: 'startups' },
    ];
    mockFetch
      .mockResolvedValueOnce(mockResponse(rssXml([])))                        // Google
      .mockResolvedValueOnce(mockResponse(rssXml([])))                        // PH
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(JSON.parse(redditJson(posts))), text: vi.fn() })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ hits: [] }), text: vi.fn() })
      .mockResolvedValueOnce(mockResponse(rssXml([])));                       // TC

    const { fetchLiveSignals } = await import('../../../api/_lib/signals');
    const signals = await fetchLiveSignals();

    expect(signals.redditHotThreads.some((t: string) => t.includes('High upvote post'))).toBe(true);
    expect(signals.redditHotThreads.some((t: string) => t.includes('Low upvote post'))).toBe(false);
  });
});

describe('formatSignalsForPrompt', () => {
  it('returns empty string when all signal arrays are empty', async () => {
    const { formatSignalsForPrompt } = await import('../../../api/_lib/signals');
    const result = formatSignalsForPrompt({
      googleTrends: [],
      productHuntLaunches: [],
      redditHotThreads: [],
      hnDiscussions: [],
      techCrunchFunding: [],
      fetchedAt: new Date().toISOString(),
      sourcesCached: false,
    });

    expect(result).toBe('');
  });

  it('includes Google Trends section when googleTrends is non-empty', async () => {
    const { formatSignalsForPrompt } = await import('../../../api/_lib/signals');
    const result = formatSignalsForPrompt({
      googleTrends: ['AI in healthcare'],
      productHuntLaunches: [],
      redditHotThreads: [],
      hnDiscussions: [],
      techCrunchFunding: [],
      fetchedAt: new Date().toISOString(),
      sourcesCached: false,
    });

    expect(result).toContain('GOOGLE TRENDS');
    expect(result).toContain('AI in healthcare');
    expect(result).not.toContain('PRODUCT HUNT');
  });

  it('includes all sections when all sources have data', async () => {
    const { formatSignalsForPrompt } = await import('../../../api/_lib/signals');
    const result = formatSignalsForPrompt({
      googleTrends: ['Trend 1'],
      productHuntLaunches: ['PH 1'],
      redditHotThreads: ['Reddit 1'],
      hnDiscussions: ['HN 1'],
      techCrunchFunding: ['TC 1'],
      fetchedAt: new Date().toISOString(),
      sourcesCached: false,
    });

    expect(result).toContain('GOOGLE TRENDS');
    expect(result).toContain('PRODUCT HUNT');
    expect(result).toContain('REDDIT HOT THREADS');
    expect(result).toContain('HACKER NEWS');
    expect(result).toContain('TECHCRUNCH');
    expect(result).toContain('LIVE MARKET SIGNALS');
  });

  it('instructs model to use signals as PRIMARY source', async () => {
    const { formatSignalsForPrompt } = await import('../../../api/_lib/signals');
    const result = formatSignalsForPrompt({
      googleTrends: ['Trend 1'],
      productHuntLaunches: [],
      redditHotThreads: [],
      hnDiscussions: [],
      techCrunchFunding: [],
      fetchedAt: new Date().toISOString(),
      sourcesCached: false,
    });

    expect(result).toContain('PRIMARY');
  });
});
