/**
 * Unit tests for api/track.ts
 *
 * Covers:
 *  + Aggregates batched events into per-(date, ideaId) increment writes
 *  + Multiple events of same type on same idea collapse into one increment(n)
 *  + Rejects non-POST, empty payloads, oversized batches
 *  + Skips events with invalid types or missing/sanitised-away ideaIds
 *  + Returns 500 (not throw) when Firestore batch fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse } from '../helpers/mockVercel';

const { mockGetAdminDb, mockIncrement } = vi.hoisted(() => ({
  mockGetAdminDb: vi.fn(),
  mockIncrement: vi.fn((n: number) => ({ __increment: n })),
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: mockGetAdminDb,
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: mockIncrement },
}));

import handler from '../../../api/track';

const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockDoc = vi.fn((id: string) => ({ _id: id }));

function setupDb() {
  mockGetAdminDb.mockReturnValue({
    collection: vi.fn(() => ({ doc: mockDoc })),
    batch: vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit })),
  });
}

describe('POST /api/track', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDb();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it('aggregates events into per-idea daily counter increments', async () => {
    const req = createMockRequest({
      body: {
        events: [
          { ideaId: 'idea-1', type: 'impression', date: '2026-07-02' },
          { ideaId: 'idea-1', type: 'impression', date: '2026-07-02' },
          { ideaId: 'idea-1', type: 'save', date: '2026-07-02' },
          { ideaId: 'idea-2', type: 'expand', date: '2026-07-02' },
        ],
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._body).toEqual({ ok: true, tracked: 2 });
    expect(mockBatchSet).toHaveBeenCalledTimes(2);

    const [docRef1, update1, opts1] = mockBatchSet.mock.calls[0];
    expect(docRef1._id).toBe('2026-07-02_idea-1');
    expect(update1).toMatchObject({
      date: '2026-07-02',
      ideaId: 'idea-1',
      impression: { __increment: 2 },
      save: { __increment: 1 },
    });
    expect(opts1).toEqual({ merge: true });

    const [docRef2, update2] = mockBatchSet.mock.calls[1];
    expect(docRef2._id).toBe('2026-07-02_idea-2');
    expect(update2.expand).toEqual({ __increment: 1 });
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('defaults malformed dates to today', async () => {
    const req = createMockRequest({
      body: { events: [{ ideaId: 'idea-1', type: 'vet', date: 'not-a-date' }] },
    });
    const res = createMockResponse();

    await handler(req, res);

    const today = new Date().toISOString().split('T')[0];
    expect(mockBatchSet.mock.calls[0][0]._id).toBe(`${today}_idea-1`);
  });

  it('skips events with unknown types or empty ideaIds', async () => {
    const req = createMockRequest({
      body: {
        events: [
          { ideaId: 'idea-1', type: 'hacked-type', date: '2026-07-02' },
          { ideaId: '<>#?*[]', type: 'save', date: '2026-07-02' },
          { ideaId: 42, type: 'save', date: '2026-07-02' },
        ],
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body.error).toContain('No valid events');
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(405);
  });

  it('returns 400 for empty or missing events array', async () => {
    const res1 = createMockResponse();
    await handler(createMockRequest({ body: {} }), res1);
    expect(res1._status).toBe(400);

    const res2 = createMockResponse();
    await handler(createMockRequest({ body: { events: [] } }), res2);
    expect(res2._status).toBe(400);
  });

  it('returns 400 when batch exceeds 50 events', async () => {
    const events = Array.from({ length: 51 }, (_, i) => ({
      ideaId: `idea-${i}`,
      type: 'impression',
      date: '2026-07-02',
    }));
    const res = createMockResponse();

    await handler(createMockRequest({ body: { events } }), res);

    expect(res._status).toBe(400);
    expect(res._body.error).toContain('Max 50');
  });

  it('returns 500 (not throw) when Firestore batch commit fails', async () => {
    mockBatchCommit.mockRejectedValue(new Error('Firestore down'));
    const req = createMockRequest({
      body: { events: [{ ideaId: 'idea-1', type: 'save', date: '2026-07-02' }] },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._body.error).toContain('Failed to record');
  });
});
