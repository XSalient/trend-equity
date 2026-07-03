import { getAdminDb } from './admin';

/**
 * Prediction accuracy tracker — writes an immutable snapshot of every
 * published idea and its publish-time scores to `idea_predictions`. Records
 * are graded against real-world outcomes after REVIEW_AFTER_MONTHS by a
 * later review workflow. The dataset compounds over time and cannot be
 * backfilled, so logging starts now even though grading lands later.
 */

export const REVIEW_AFTER_MONTHS = 6;

export interface PredictionCritique {
  problemSeverity: number;
  timing: number;
  moat: number;
  feasibility: number;
  founderAccessibility: number;
  reason: string;
}

export interface PredictionRecord {
  ideaId: string;
  date: string;
  headline: string;
  pitch: string;
  categoryTags: string[];
  qualityScore: number | null;
  critique: PredictionCritique | null;
  criticModel: string | null;
  revenuePotentialScore: number | null;
  promptVersion: number | null;
  status: 'open';
  reviewAfter: string;
  createdAt: string;
}

/** Sanitise to a safe Firestore doc-id fragment (same charset as track.ts). */
function sanitiseId(value: unknown, maxLen = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>"`/\\#?[\]*]/g, '')
    .trim()
    .slice(0, maxLen);
}

function slugifyHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Add calendar months to a YYYY-MM-DD date string (UTC). */
export function addMonthsIso(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildPredictionRecords(
  date: string,
  ideas: any[],
  promptVersion?: number | null
): PredictionRecord[] {
  const createdAt = new Date().toISOString();
  const reviewAfter = addMonthsIso(date, REVIEW_AFTER_MONTHS);
  const records: PredictionRecord[] = [];

  for (const idea of ideas) {
    if (!idea || typeof idea !== 'object') continue;
    const headline = typeof idea.headline === 'string' ? idea.headline.trim() : '';
    const ideaId = sanitiseId(idea.id) || (headline ? slugifyHeadline(headline) : '');
    if (!ideaId || !headline) continue;

    const c = idea.critique;
    const critique: PredictionCritique | null =
      c && typeof c === 'object'
        ? {
            problemSeverity: c.problemSeverity ?? null,
            timing: c.timing ?? null,
            moat: c.moat ?? null,
            feasibility: c.feasibility ?? null,
            founderAccessibility: c.founderAccessibility ?? null,
            reason: c.reason ?? '',
          }
        : null;

    records.push({
      ideaId,
      date,
      headline,
      pitch: typeof idea.pitch === 'string' ? idea.pitch : '',
      categoryTags: Array.isArray(idea.categoryTags) ? idea.categoryTags : [],
      qualityScore: typeof idea.qualityScore === 'number' ? idea.qualityScore : null,
      critique,
      criticModel: typeof idea.criticModel === 'string' ? idea.criticModel : null,
      revenuePotentialScore:
        typeof idea.revenuePotentialScore === 'number' ? idea.revenuePotentialScore : null,
      promptVersion: typeof promptVersion === 'number' ? promptVersion : null,
      status: 'open',
      reviewAfter,
      createdAt,
    });
  }

  return records;
}

/**
 * Persist prediction records for a published feed. Non-fatal: a tracking
 * failure must never break the daily generation itself.
 */
export async function savePredictions(
  date: string,
  ideas: any[],
  promptVersion?: number | null
): Promise<void> {
  try {
    const records = buildPredictionRecords(date, ideas, promptVersion);
    if (records.length === 0) return;

    const db = getAdminDb();
    const batch = db.batch();
    for (const record of records) {
      batch.set(db.collection('idea_predictions').doc(`${date}_${record.ideaId}`), record);
    }
    await batch.commit();
    console.log(`[prediction-tracker] Logged ${records.length} prediction records for ${date}`);
  } catch (err) {
    console.warn('[prediction-tracker] Failed to save prediction records (non-fatal):', err);
  }
}
