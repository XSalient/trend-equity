/**
 * Unit tests for api/_lib/cache.ts
 *
 * Covers:
 *  + getCached returns value on cache hit within TTL
 *  + getCached returns null on cache miss (doc doesn't exist)
 *  + getCached returns null and deletes stale doc when TTL expired
 *  + getCached returns null (not throw) on Firestore error
 *  + getCached returns null when key is empty string
 *  + setCached writes correct shape to Firestore
 *  + setCached is a no-op when key is empty string
 *  + setCached silently handles Firestore write errors
 *  + getRecentIdeaHeadlines returns headlines from prior days
 *  + getRecentIdeaHeadlines returns [] when docs don't exist
 *  + getRecentIdeaHeadlines returns [] on Firestore error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firestore mock factory ────────────────────────────────────────────────────

const mockDelete = vi.fn();
const mockSet = vi.fn();

function makeDocSnap(exists: boolean, data?: any, ref?: any) {
  return { exists, data: () => data, ref: ref ?? { delete: mockDelete } };
}

const mockDocGet = vi.fn();
const mockDocRef = { get: mockDocGet, set: mockSet, delete: mockDelete };
const mockCollection = { doc: vi.fn(() => mockDocRef) };
const mockDb = { collection: vi.fn(() => mockCollection) };

vi.mock('firebase-admin/app', () => ({
  cert: vi.fn(),
  getApps: vi.fn(() => [{}]), // return non-empty — skip initializeApp
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => '__serverTimestamp__'),
  },
}));

import { getCached, setCached, getRecentIdeaHeadlines } from '../../../api/_lib/cache';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

describe('getCached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.doc.mockReturnValue(mockDocRef);
    mockDb.collection.mockReturnValue(mockCollection);
  });

  it('returns cached value when doc exists and TTL not expired', async () => {
    const payload = { ideas: [{ headline: 'Idea 1' }] };
    mockDocGet.mockResolvedValue(
      makeDocSnap(true, { result: payload, generatedAt: Date.now() - 1000 })
    );

    const result = await getCached('test-key');
    expect(result).toEqual(payload);
  });

  it('returns null when doc does not exist (cache miss)', async () => {
    mockDocGet.mockResolvedValue(makeDocSnap(false));

    const result = await getCached('missing-key');
    expect(result).toBeNull();
  });

  it('returns null and deletes doc when TTL is expired', async () => {
    const staleRef = { delete: mockDelete };
    mockDocGet.mockResolvedValue(
      makeDocSnap(true, { result: {}, generatedAt: Date.now() - CACHE_TTL_MS - 1 }, staleRef)
    );

    const result = await getCached('stale-key');
    expect(result).toBeNull();
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it('returns null (not throw) when Firestore throws', async () => {
    mockDocGet.mockRejectedValue(new Error('Firestore unavailable'));

    const result = await getCached('error-key');
    expect(result).toBeNull();
  });

  it('returns null immediately for empty key', async () => {
    const result = await getCached('');
    expect(result).toBeNull();
    expect(mockDocGet).not.toHaveBeenCalled();
  });
});

describe('setCached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.doc.mockReturnValue(mockDocRef);
    mockDb.collection.mockReturnValue(mockCollection);
  });

  it('writes result and generatedAt to Firestore', async () => {
    mockSet.mockResolvedValue(undefined);
    const data = { foo: 'bar' };

    await setCached('my-key', data);

    expect(mockSet).toHaveBeenCalledOnce();
    const written = mockSet.mock.calls[0][0];
    expect(written.result).toEqual(data);
    expect(typeof written.generatedAt).toBe('number');
  });

  it('is a no-op when key is empty string', async () => {
    await setCached('', { foo: 'bar' });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('silently handles Firestore write errors', async () => {
    mockSet.mockRejectedValue(new Error('Write failed'));

    await expect(setCached('key', { foo: 'bar' })).resolves.not.toThrow();
  });
});

describe('getRecentIdeaHeadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockCollection);
  });

  it('returns enriched summaries (headline + pitch) from the lookbackDays prior daily_generations docs', async () => {
    const summaries = [
      { headline: 'Idea A', pitch: 'Problem A solution' },
      { headline: 'Idea B', pitch: 'Problem B solution' },
      { headline: 'Idea C', pitch: 'Problem C solution' },
    ];

    // First call returns doc with 2 ideas, second with 1, third empty
    mockCollection.doc
      .mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(
          makeDocSnap(true, {
            ideas: [
              { headline: 'Idea A', pitch: 'Problem A solution' },
              { headline: 'Idea B', pitch: 'Problem B solution' },
            ],
          })
        ),
        set: vi.fn(),
        delete: vi.fn(),
      })
      .mockReturnValueOnce({
        get: vi
          .fn()
          .mockResolvedValue(
            makeDocSnap(true, { ideas: [{ headline: 'Idea C', pitch: 'Problem C solution' }] })
          ),
        set: vi.fn(),
        delete: vi.fn(),
      })
      .mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(makeDocSnap(false)),
        set: vi.fn(),
        delete: vi.fn(),
      });

    const result = await getRecentIdeaHeadlines('2026-04-11', 3);

    expect(result).toEqual(summaries);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when all docs are missing', async () => {
    mockCollection.doc.mockReturnValue({
      get: vi.fn().mockResolvedValue(makeDocSnap(false)),
      set: vi.fn(),
      delete: vi.fn(),
    });

    const result = await getRecentIdeaHeadlines('2026-04-11', 3);
    expect(result).toEqual([]);
  });

  it('skips ideas missing headline or pitch fields', async () => {
    mockCollection.doc
      .mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(
          makeDocSnap(true, {
            ideas: [
              { headline: 'Good Idea', pitch: 'Good pitch' },
              { headline: 'No pitch idea' }, // missing pitch
              { pitch: 'No headline pitch' }, // missing headline
            ],
          })
        ),
        set: vi.fn(),
        delete: vi.fn(),
      })
      .mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(makeDocSnap(false)),
        set: vi.fn(),
        delete: vi.fn(),
      })
      .mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(makeDocSnap(false)),
        set: vi.fn(),
        delete: vi.fn(),
      });

    const result = await getRecentIdeaHeadlines('2026-04-11', 3);
    expect(result).toEqual([{ headline: 'Good Idea', pitch: 'Good pitch' }]);
  });

  it('uses default 14-day lookback window', async () => {
    mockCollection.doc.mockReturnValue({
      get: vi.fn().mockResolvedValue(makeDocSnap(false)),
      set: vi.fn(),
      delete: vi.fn(),
    });

    const result = await getRecentIdeaHeadlines('2026-04-11');
    // Should not throw, returns empty array from 14 missing docs
    expect(result).toEqual([]);
  });

  it('returns empty array on Firestore error (fail-open)', async () => {
    mockCollection.doc.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Firestore down')),
      set: vi.fn(),
      delete: vi.fn(),
    });

    const result = await getRecentIdeaHeadlines('2026-04-11', 3);
    expect(result).toEqual([]);
  });
});
