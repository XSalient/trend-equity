/**
 * Unit tests for api/_lib/embeddings.ts
 *
 * Covers:
 *  + cosineSim math (identical, orthogonal, mismatched-length, zero vectors)
 *  + semanticDedupeCandidates drops candidates similar to recent published ideas
 *  + semanticDedupeCandidates drops near-duplicate siblings within the batch
 *  + fail-open: returns all candidates when embedding call throws
 *  + getRecentEmbeddings reads idea_embeddings docs, skips missing days
 *  + saveIdeaEmbeddings writes the expected doc shape, skips ideas without vectors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEmbedContent, mockGetAdminDb } = vi.hoisted(() => ({
  mockEmbedContent: vi.fn(),
  mockGetAdminDb: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { embedContent: mockEmbedContent },
  })),
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: mockGetAdminDb,
}));

import {
  cosineSim,
  semanticDedupeCandidates,
  getRecentEmbeddings,
  saveIdeaEmbeddings,
} from '../../../api/_lib/embeddings';

function makeDocSnap(exists: boolean, data?: any) {
  return { exists, data: () => data };
}

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet, set: mockDocSet }));
const mockDb = { collection: vi.fn(() => ({ doc: mockDoc })) };

function embedResponse(vectors: number[][]) {
  return { embeddings: vectors.map((v) => ({ values: v })) };
}

describe('cosineSim', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSim([1, 0], [0, 1])).toBe(0);
  });

  it('returns 0 for mismatched lengths or zero vectors', () => {
    expect(cosineSim([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSim([0, 0], [1, 2])).toBe(0);
    expect(cosineSim([], [])).toBe(0);
  });
});

describe('semanticDedupeCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.DEDUP_SIM_THRESHOLD;
    mockGetAdminDb.mockReturnValue(mockDb);
    mockDocGet.mockResolvedValue(makeDocSnap(false));
  });

  it('uses 0.80 as the default dedup threshold', async () => {
    mockEmbedContent.mockResolvedValue(
      embedResponse([
        [1, 0],
        [0.81, 0.19], // Similarity ~0.81 > 0.80 (default) → should be dropped
      ])
    );

    const candidates = [
      { id: 'a', headline: 'One', pitch: 'p1', marketSize: 'm1', revenueSkeleton: 'r1' },
      { id: 'b', headline: 'Two', pitch: 'p2', marketSize: 'm2', revenueSkeleton: 'r2' },
    ];

    const { kept, droppedHeadlines } = await semanticDedupeCandidates(candidates, '2026-07-02');

    expect(kept).toHaveLength(1);
    expect(droppedHeadlines).toEqual(['Two']);
  });

  it('drops candidates too similar to recently published ideas', async () => {
    // Existing vector [1,0]; candidate 0 identical → dropped, candidate 1 orthogonal → kept
    mockDocGet.mockResolvedValueOnce(
      makeDocSnap(true, { vectors: [{ id: 'old', headline: 'Old Idea', v: [1, 0] }] })
    );
    mockEmbedContent.mockResolvedValue(
      embedResponse([
        [1, 0],
        [0, 1],
      ])
    );

    const candidates = [
      { id: 'a', headline: 'Dupe Idea', pitch: 'p1' },
      { id: 'b', headline: 'Fresh Idea', pitch: 'p2' },
    ];

    const { kept, droppedHeadlines } = await semanticDedupeCandidates(candidates, '2026-07-02');

    expect(kept.map((c: any) => c.headline)).toEqual(['Fresh Idea']);
    expect(droppedHeadlines).toEqual(['Dupe Idea']);
  });

  it('drops near-duplicate siblings within the same candidate batch', async () => {
    mockEmbedContent.mockResolvedValue(
      embedResponse([
        [1, 0],
        [0.999, 0.001],
        [0, 1],
      ])
    );

    const candidates = [
      { id: 'a', headline: 'First', pitch: 'p' },
      { id: 'b', headline: 'Near Clone', pitch: 'p' },
      { id: 'c', headline: 'Different', pitch: 'p' },
    ];

    const { kept, droppedHeadlines, vectorsByHeadline } = await semanticDedupeCandidates(
      candidates,
      '2026-07-02'
    );

    expect(kept.map((c: any) => c.headline)).toEqual(['First', 'Different']);
    expect(droppedHeadlines).toEqual(['Near Clone']);
    expect(vectorsByHeadline.get('First')).toEqual([1, 0]);
    expect(vectorsByHeadline.get('Near Clone')).toBeUndefined();
  });

  it('embeds richer text: headline + pitch + marketSize + revenueSkeleton', async () => {
    mockEmbedContent.mockResolvedValue(
      embedResponse([
        [1, 0],
        [0, 1],
      ])
    );

    const candidates = [
      {
        id: 'a',
        headline: 'AI Copilot for Accountants',
        pitch: 'Automate tax prep for solo CPAs',
        marketSize: '$50B tax software market',
        revenueSkeleton: 'Subscription at $299/mo per CPA',
      },
      {
        id: 'b',
        headline: 'ML Audit Tool',
        pitch: 'Detect accounting errors',
        marketSize: '$20B audit market',
        revenueSkeleton: 'Per-audit fees',
      },
    ];

    const { kept } = await semanticDedupeCandidates(candidates, '2026-07-02');

    // Verify embedText was called with enriched text by checking the first call's argument
    expect(mockEmbedContent).toHaveBeenCalledOnce();
    const embedCall = mockEmbedContent.mock.calls[0][0];
    const embeddedTexts = embedCall.contents;

    // Should have richer text including all four fields
    expect(embeddedTexts[0]).toContain('AI Copilot for Accountants');
    expect(embeddedTexts[0]).toContain('Automate tax prep');
    expect(embeddedTexts[0]).toContain('$50B tax software market');
    expect(embeddedTexts[0]).toContain('Subscription at $299/mo');

    expect(kept).toHaveLength(2);
  });

  it('respects DEDUP_SIM_THRESHOLD from env', async () => {
    process.env.DEDUP_SIM_THRESHOLD = '0.99';
    mockEmbedContent.mockResolvedValue(
      embedResponse([
        [1, 0],
        [0.97, 0.24], // sim ~0.97 < 0.99 → kept
      ])
    );

    const candidates = [
      { id: 'a', headline: 'One', pitch: 'p' },
      { id: 'b', headline: 'Two', pitch: 'p' },
    ];

    const { kept } = await semanticDedupeCandidates(candidates, '2026-07-02');
    expect(kept).toHaveLength(2);
    delete process.env.DEDUP_SIM_THRESHOLD;
  });

  it('fails open (returns all candidates) when embedding call throws', async () => {
    mockEmbedContent.mockRejectedValue(new Error('Embed API down'));

    const candidates = [
      { id: 'a', headline: 'One', pitch: 'p' },
      { id: 'b', headline: 'Two', pitch: 'p' },
    ];

    const { kept, droppedHeadlines, vectorsByHeadline } = await semanticDedupeCandidates(
      candidates,
      '2026-07-02'
    );

    expect(kept).toEqual(candidates);
    expect(droppedHeadlines).toEqual([]);
    expect(vectorsByHeadline.size).toBe(0);
  });

  it('returns immediately for empty candidate list', async () => {
    const { kept } = await semanticDedupeCandidates([], '2026-07-02');
    expect(kept).toEqual([]);
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });
});

describe('getRecentEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminDb.mockReturnValue(mockDb);
  });

  it('collects vectors across existing days and skips missing ones', async () => {
    mockDocGet
      .mockResolvedValueOnce(
        makeDocSnap(true, { vectors: [{ id: '1', headline: 'A', v: [1, 0] }] })
      )
      .mockResolvedValueOnce(makeDocSnap(false))
      .mockResolvedValue(makeDocSnap(false));

    const vectors = await getRecentEmbeddings('2026-07-02', 3);

    expect(vectors).toHaveLength(1);
    expect(vectors[0].headline).toBe('A');
    expect(mockDoc).toHaveBeenCalledTimes(3);
  });

  it('returns [] on Firestore error (fail-open)', async () => {
    mockDocGet.mockRejectedValue(new Error('Firestore down'));

    const vectors = await getRecentEmbeddings('2026-07-02', 3);
    expect(vectors).toEqual([]);
  });
});

describe('saveIdeaEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminDb.mockReturnValue(mockDb);
    mockDocSet.mockResolvedValue(undefined);
  });

  it('writes one doc with vectors for ideas that have them, skipping those without', async () => {
    const vectors = new Map<string, number[]>([['Idea A', [1, 2, 3]]]);
    const ideas = [
      { id: 'a', headline: 'Idea A' },
      { id: 'b', headline: 'Idea B (no vector)' },
    ];

    await saveIdeaEmbeddings('2026-07-02', ideas, vectors);

    expect(mockDocSet).toHaveBeenCalledOnce();
    const written = mockDocSet.mock.calls[0][0];
    expect(written.date).toBe('2026-07-02');
    expect(written.vectors).toHaveLength(1);
    expect(written.vectors[0]).toMatchObject({ id: 'a', headline: 'Idea A', v: [1, 2, 3] });
  });

  it('is a no-op when no idea has a vector', async () => {
    await saveIdeaEmbeddings('2026-07-02', [{ id: 'a', headline: 'X' }], new Map());
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('swallows Firestore write errors (non-fatal)', async () => {
    mockDocSet.mockRejectedValue(new Error('Write failed'));
    const vectors = new Map<string, number[]>([['A', [1]]]);

    await expect(
      saveIdeaEmbeddings('2026-07-02', [{ id: 'a', headline: 'A' }], vectors)
    ).resolves.not.toThrow();
  });
});
