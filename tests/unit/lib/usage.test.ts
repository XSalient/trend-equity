/**
 * Unit tests for api/_lib/usage.ts
 *
 * Covers:
 *  + builder tier is always allowed (infinite limit)
 *  + free tier is allowed when under limit (count < 3)
 *  + free tier is blocked when at limit (count >= 3)
 *  + pro tier is allowed when under limit (count < 15)
 *  + pro tier is blocked when at limit (count >= 15)
 *  + transaction increments count atomically
 *  + fails open on Firestore error (request still allowed)
 *  + buildUsageResponse returns null for unauthenticated users
 *  + buildUsageResponse returns correct shape for free tier
 *  + buildUsageResponse returns null limit/remaining for builder tier
 *  + doc ID format is uid_featureType_YYYY-MM-DD
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firestore mock ────────────────────────────────────────────────────────────

const mockTransactionGet = vi.fn();
const mockTransactionSet = vi.fn();
const mockRunTransaction = vi.fn();
const mockDocGet = vi.fn();

const mockDocRef = { get: mockDocGet };
const mockCollection = { doc: vi.fn(() => mockDocRef) };
const mockDb = {
  collection: vi.fn(() => mockCollection),
  runTransaction: mockRunTransaction,
};

vi.mock('firebase-admin/app', () => ({
  cert: vi.fn(),
  getApps: vi.fn(() => [{}]),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => '__serverTimestamp__'),
  },
}));

import { checkAndIncrementUsage, buildUsageResponse } from '../../../api/_lib/usage';

/** Helper: simulate a Firestore transaction that increments count from `currentCount` */
function setupTransaction(currentCount: number) {
  mockRunTransaction.mockImplementation(
    async (
      callback: (tx: {
        get: typeof mockTransactionGet;
        set: typeof mockTransactionSet;
      }) => Promise<unknown>
    ) => {
      const snap = {
        exists: true,
        data: () => ({ count: currentCount }),
      };
      const tx = {
        get: mockTransactionGet.mockResolvedValue(snap),
        set: mockTransactionSet,
      };
      return callback(tx);
    }
  );
}

describe('checkAndIncrementUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockCollection);
  });

  // ── Builder tier (infinite) ───────────────────────────────────────

  it('always allows builder tier without hitting Firestore', async () => {
    const result = await checkAndIncrementUsage('uid-123', 'builder', 'radar');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  // ── Free tier (limit: 3) ──────────────────────────────────────────

  it('allows free tier on first request (count 0 → 1)', async () => {
    setupTransaction(0);

    const result = await checkAndIncrementUsage('uid-123', 'free', 'radar');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 - 1 = 2
    expect(result.limit).toBe(3);
  });

  it('allows free tier on third request (count 2 → 3)', async () => {
    setupTransaction(2);

    const result = await checkAndIncrementUsage('uid-123', 'free', 'radar');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks free tier when limit exceeded (count 3 → 4)', async () => {
    setupTransaction(3);

    const result = await checkAndIncrementUsage('uid-123', 'free', 'radar');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(3);
  });

  // ── Pro tier (limit: 15) ──────────────────────────────────────────

  it('allows pro tier on first request (count 0 → 1)', async () => {
    setupTransaction(0);

    const result = await checkAndIncrementUsage('uid-456', 'pro', 'futurecasting');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(14);
    expect(result.limit).toBe(15);
  });

  it('blocks pro tier when limit exceeded (count 15 → 16)', async () => {
    setupTransaction(15);

    const result = await checkAndIncrementUsage('uid-456', 'pro', 'futurecasting');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  // ── Doc ID format ─────────────────────────────────────────────────

  it('constructs doc ID as uid_featureType_YYYY-MM-DD', async () => {
    setupTransaction(0);
    await checkAndIncrementUsage('user-abc', 'free', 'action-plan');

    const docId = (mockCollection.doc.mock.calls as any[][])[0]?.[0] as string;
    const today = new Date().toISOString().split('T')[0];
    expect(docId).toBe(`user-abc_action-plan_${today}`);
  });

  // ── Fail-open on DB error ─────────────────────────────────────────

  it('fails open (allows request) when Firestore transaction throws', async () => {
    mockRunTransaction.mockRejectedValue(new Error('Firestore unavailable'));

    const result = await checkAndIncrementUsage('uid-999', 'free', 'radar');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
  });
});

describe('buildUsageResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockCollection);
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ count: 2 }) });
  });

  it('returns null when uid is undefined (unauthenticated)', async () => {
    const result = await buildUsageResponse(undefined, 'free', 'radar');
    expect(result).toBeNull();
  });

  it('returns correct shape for free tier', async () => {
    const result = await buildUsageResponse('uid-123', 'free', 'radar');

    expect(result).toMatchObject({
      featureType: 'radar',
      used: 2,
      limit: 3,
      remaining: 1,
    });
  });

  it('returns null limit and remaining for builder tier', async () => {
    const result = await buildUsageResponse('uid-123', 'builder', 'radar');

    expect(result?.limit).toBeNull();
    expect(result?.remaining).toBeNull();
  });

  it('returns correct remaining count based on current usage', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ count: 14 }) });

    const result = await buildUsageResponse('uid-456', 'pro', 'futurecasting');

    expect(result?.used).toBe(14);
    expect(result?.remaining).toBe(1); // 15 - 14 = 1
    expect(result?.limit).toBe(15);
  });
});
