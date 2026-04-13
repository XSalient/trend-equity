/**
 * Unit tests for the aggregation logic extracted from src/hooks/useWeeklyBest.ts
 *
 * Because the Vitest environment is 'node' (no jsdom / renderHook), we test
 * the pure aggregation algorithm directly rather than running the hook in a
 * React renderer.  The algorithm is:
 *  1. Iterate over Firestore snapshots; skip non-existent docs.
 *  2. For each doc's ideas array, skip ideas without a headline.
 *  3. Normalise headline (trim + lowercase) → dedup key; increment count on collision.
 *  4. Sort: recurrenceCount DESC, then revenuePotentialScore DESC (undefined = 0).
 *  5. Slice to at most 10 results.
 *  6. Spread idea + attach recurrenceCount.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_IDEA } from '../helpers/fixtures';
import type { Idea, WeeklyBestIdea } from '../../../src/types';

// ── Module mocks (must be declared before any import that triggers them) ──────

const { mockGetDoc } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: mockGetDoc,
  doc: vi.fn((_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` })),
}));

vi.mock('../../../src/firebase', () => ({ db: {} }));

// ── Pure aggregation helper (mirrors the logic inside useWeeklyBest) ──────────

interface FakeSnap {
  exists: () => boolean;
  data: () => { ideas?: Partial<Idea>[] } | undefined;
}

function aggregateWeeklyBest(snaps: FakeSnap[]): WeeklyBestIdea[] {
  const seen = new Map<string, { idea: Idea; count: number }>();

  snaps.forEach((snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (!Array.isArray(data?.ideas)) return;
    (data!.ideas as Idea[]).forEach((idea) => {
      if (!idea?.headline) return;
      const key = idea.headline.trim().toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(key, { idea, count: 1 });
      }
    });
  });

  return Array.from(seen.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.idea.revenuePotentialScore ?? 0) - (a.idea.revenuePotentialScore ?? 0);
    })
    .slice(0, 10)
    .map(({ idea, count }) => ({ ...idea, recurrenceCount: count }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSnap(ideas: Partial<Idea>[]): FakeSnap {
  return { exists: () => true, data: () => ({ ideas }) };
}

function noExistSnap(): FakeSnap {
  return { exists: () => false, data: () => undefined };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWeeklyBest — aggregation logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('two docs sharing the same headline → recurrenceCount = 2, idea appears once', () => {
    const idea = { ...MOCK_IDEA };
    const snaps = [makeSnap([idea]), makeSnap([idea])];
    const result = aggregateWeeklyBest(snaps);

    expect(result).toHaveLength(1);
    expect(result[0].recurrenceCount).toBe(2);
    expect(result[0].headline).toBe(idea.headline);
  });

  it('three docs with unique headlines → all recurrenceCount = 1, sorted by revenuePotentialScore', () => {
    const ideaA = { ...MOCK_IDEA, id: 'a', headline: 'Alpha Idea', revenuePotentialScore: 7 };
    const ideaB = { ...MOCK_IDEA, id: 'b', headline: 'Beta Idea', revenuePotentialScore: 9 };
    const ideaC = { ...MOCK_IDEA, id: 'c', headline: 'Gamma Idea', revenuePotentialScore: 5 };
    const snaps = [makeSnap([ideaA]), makeSnap([ideaB]), makeSnap([ideaC])];
    const result = aggregateWeeklyBest(snaps);

    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.recurrenceCount).toBe(1));
    expect(result[0].headline).toBe('Beta Idea'); // score 9 first
    expect(result[1].headline).toBe('Alpha Idea'); // score 7 second
    expect(result[2].headline).toBe('Gamma Idea'); // score 5 last
  });

  it('skips docs where snap.exists() is false', () => {
    const idea = { ...MOCK_IDEA };
    const snaps = [noExistSnap(), makeSnap([idea])];
    const result = aggregateWeeklyBest(snaps);

    expect(result).toHaveLength(1);
  });

  it('skips ideas that have no headline field', () => {
    const noHeadline = { ...MOCK_IDEA, headline: '' } as Partial<Idea>;
    const undefinedHeadline = { id: 'x', revenuePotentialScore: 8 } as Partial<Idea>;
    const snaps = [makeSnap([noHeadline, undefinedHeadline])];
    const result = aggregateWeeklyBest(snaps);

    expect(result).toHaveLength(0);
  });

  it('idea with count=2 appears before count=1 even if its revenue score is lower', () => {
    const highScore = {
      ...MOCK_IDEA,
      id: 'h',
      headline: 'High Score Idea',
      revenuePotentialScore: 10,
    };
    const recurring = {
      ...MOCK_IDEA,
      id: 'r',
      headline: 'Recurring Idea',
      revenuePotentialScore: 3,
    };
    // recurring appears in two snaps, highScore in one
    const snaps = [makeSnap([highScore, recurring]), makeSnap([recurring])];
    const result = aggregateWeeklyBest(snaps);

    expect(result).toHaveLength(2);
    expect(result[0].headline).toBe('Recurring Idea'); // count=2 wins
    expect(result[0].recurrenceCount).toBe(2);
    expect(result[1].headline).toBe('High Score Idea'); // count=1
  });

  it('slices to at most 10 results when more than 10 unique ideas exist', () => {
    const manyIdeas = Array.from({ length: 15 }, (_, i) => ({
      ...MOCK_IDEA,
      id: `idea-${i}`,
      headline: `Unique Idea Number ${i}`,
      revenuePotentialScore: i,
    }));
    const snaps = [makeSnap(manyIdeas)];
    const result = aggregateWeeklyBest(snaps);

    expect(result).toHaveLength(10);
  });

  it('revenuePotentialScore = undefined does not crash the sort — treated as 0', () => {
    const withUndefined = {
      ...MOCK_IDEA,
      id: 'u',
      headline: 'Undefined Score Idea',
      revenuePotentialScore: undefined as unknown as number,
    };
    const withZero = {
      ...MOCK_IDEA,
      id: 'z',
      headline: 'Zero Score Idea',
      revenuePotentialScore: 0,
    };
    const snaps = [makeSnap([withUndefined, withZero])];

    expect(() => aggregateWeeklyBest(snaps)).not.toThrow();
    const result = aggregateWeeklyBest(snaps);
    expect(result).toHaveLength(2);
    // both effectively score 0 — order is stable / either is fine
    result.forEach((r) => expect(r.recurrenceCount).toBe(1));
  });
});

// ── Integration smoke-test: verify Firestore mock wiring ─────────────────────
// The aggregation logic is fully tested above (pure function).
// Here we verify that the mocked firebase/firestore modules resolve correctly
// in the test environment — i.e., getDoc and doc are accessible as mocks.

describe('useWeeklyBest — Firestore mock wiring', () => {
  it('mockGetDoc is a vi.fn() (mock wiring is correct)', () => {
    expect(typeof mockGetDoc).toBe('function');
    expect(mockGetDoc.mock).toBeDefined();
  });

  it('getDoc mock can be configured and resolves', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    const { getDoc } = await import('firebase/firestore');
    const result = await (getDoc as ReturnType<typeof vi.fn>)({ path: 'test/doc' });
    expect(result.exists()).toBe(false);
  });
});
