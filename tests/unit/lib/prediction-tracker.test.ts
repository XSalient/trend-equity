/**
 * Unit tests for api/_lib/prediction-tracker.ts
 *
 * Covers:
 *  + addMonthsIso adds calendar months in UTC
 *  + buildPredictionRecords snapshots publish-time scores + critique
 *  + buildPredictionRecords nulls missing scores, skips unusable ideas
 *  + buildPredictionRecords falls back to slugged headline when id missing
 *  + savePredictions writes one doc per record via a batch
 *  + savePredictions is non-fatal when Firestore throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetAdminDb } = vi.hoisted(() => ({
  mockGetAdminDb: vi.fn(),
}));

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: mockGetAdminDb,
}));

import {
  addMonthsIso,
  buildPredictionRecords,
  savePredictions,
  REVIEW_AFTER_MONTHS,
} from '../../../api/_lib/prediction-tracker';

const fullIdea = {
  id: 'idea-1',
  headline: 'HIPAA-native AI support for dental clinics',
  pitch: 'Automate patient intake calls for dentists.',
  categoryTags: ['Digital / SaaS / AI-SaaS'],
  qualityScore: 7.8,
  critique: {
    problemSeverity: 8,
    timing: 7,
    moat: 7,
    feasibility: 9,
    founderAccessibility: 8,
    reason: 'Real wedge in a regulated niche.',
  },
  criticModel: 'gemini-2.5-flash',
  revenuePotentialScore: 8,
};

describe('addMonthsIso', () => {
  it('adds calendar months', () => {
    expect(addMonthsIso('2026-07-03', 6)).toBe('2027-01-03');
    expect(addMonthsIso('2026-01-15', 6)).toBe('2026-07-15');
  });
});

describe('buildPredictionRecords', () => {
  it('snapshots publish-time scores, critique and review date', () => {
    const records = buildPredictionRecords('2026-07-03', [fullIdea], 4);

    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.ideaId).toBe('idea-1');
    expect(r.date).toBe('2026-07-03');
    expect(r.qualityScore).toBe(7.8);
    expect(r.critique?.moat).toBe(7);
    expect(r.critique?.reason).toBe('Real wedge in a regulated niche.');
    expect(r.criticModel).toBe('gemini-2.5-flash');
    expect(r.revenuePotentialScore).toBe(8);
    expect(r.promptVersion).toBe(4);
    expect(r.status).toBe('open');
    expect(r.reviewAfter).toBe(addMonthsIso('2026-07-03', REVIEW_AFTER_MONTHS));
    expect(r.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('nulls missing scores and skips unusable ideas', () => {
    const records = buildPredictionRecords('2026-07-03', [
      { id: 'bare', headline: 'Unscored idea (critic failed open)' },
      { id: 'no-headline' },
      null,
      'not-an-object',
    ]);

    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.qualityScore).toBeNull();
    expect(r.critique).toBeNull();
    expect(r.criticModel).toBeNull();
    expect(r.revenuePotentialScore).toBeNull();
    expect(r.promptVersion).toBeNull();
  });

  it('slugs the headline as ideaId when id is missing', () => {
    const records = buildPredictionRecords('2026-07-03', [
      { headline: 'AI Employees: Replacing Call Centers!' },
    ]);
    expect(records[0].ideaId).toBe('ai-employees-replacing-call-centers');
  });
});

describe('savePredictions', () => {
  const mockBatchSet = vi.fn();
  const mockBatchCommit = vi.fn();
  const mockDoc = vi.fn((id: string) => ({ id }));
  const mockDb = {
    collection: vi.fn(() => ({ doc: mockDoc })),
    batch: vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminDb.mockReturnValue(mockDb);
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it('writes one doc per record keyed by date_ideaId and commits', async () => {
    await savePredictions('2026-07-03', [fullIdea], 4);

    expect(mockDb.collection).toHaveBeenCalledWith('idea_predictions');
    expect(mockDoc).toHaveBeenCalledWith('2026-07-03_idea-1');
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
      ideaId: 'idea-1',
      qualityScore: 7.8,
      status: 'open',
    });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('does not touch Firestore when there is nothing to log', async () => {
    await savePredictions('2026-07-03', []);
    expect(mockDb.batch).not.toHaveBeenCalled();
  });

  it('is non-fatal when Firestore throws', async () => {
    mockBatchCommit.mockRejectedValue(new Error('firestore down'));
    await expect(savePredictions('2026-07-03', [fullIdea])).resolves.toBeUndefined();
  });
});
