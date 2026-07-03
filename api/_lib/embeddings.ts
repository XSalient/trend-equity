import { GoogleGenAI } from '@google/genai';
import { getAdminDb } from './admin';

/**
 * Semantic deduplication for generated ideas. Candidate ideas are embedded and
 * compared (cosine similarity) against the past 30 days of published ideas and
 * against each other, so the feed diverges in problem space — not just wording.
 * Every function fails open: on any error the pipeline continues undeduped.
 */

const EMBEDDINGS_COLLECTION = 'idea_embeddings';
const EMBED_DIMENSIONS = 768;
const EMBED_BATCH_LIMIT = 100;
const DEFAULT_LOOKBACK_DAYS = 30;

export interface IdeaVector {
  id: string;
  headline: string;
  v: number[];
}

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing from environment.');
  return _client || (_client = new GoogleGenAI({ apiKey }));
}

function getEmbedModel(): string {
  return process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
}

export function getDedupeThreshold(): number {
  const parsed = Number(process.env.DEDUP_SIM_THRESHOLD);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : 0.85;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getClient();
  const model = getEmbedModel();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH_LIMIT) {
    const batch = texts.slice(i, i + EMBED_BATCH_LIMIT);
    const resp = await client.models.embedContent({
      model,
      contents: batch,
      config: { outputDimensionality: EMBED_DIMENSIONS },
    });
    const embeddings = resp.embeddings || [];
    if (embeddings.length !== batch.length) {
      throw new Error(`Embedding count mismatch: sent ${batch.length}, got ${embeddings.length}`);
    }
    for (const e of embeddings) results.push(e.values || []);
  }
  return results;
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Parallel-fetch published idea vectors from the past `lookbackDays` days. */
export async function getRecentEmbeddings(
  excludeDate: string,
  lookbackDays = DEFAULT_LOOKBACK_DAYS
): Promise<IdeaVector[]> {
  try {
    const db = getAdminDb();
    const base = new Date(excludeDate);
    const fetches = Array.from({ length: lookbackDays }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (i + 1));
      const key = d.toISOString().split('T')[0];
      return db.collection(EMBEDDINGS_COLLECTION).doc(key).get();
    });

    const snaps = await Promise.all(fetches);
    const vectors: IdeaVector[] = [];
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data();
      if (Array.isArray(data?.vectors)) {
        for (const vec of data.vectors) {
          if (Array.isArray(vec?.v) && vec.v.length > 0) vectors.push(vec as IdeaVector);
        }
      }
    }
    return vectors;
  } catch (e) {
    console.error('[embeddings] getRecentEmbeddings error (fail-open):', e);
    return [];
  }
}

function embedText(idea: any): string {
  return `${idea.headline || ''}: ${idea.pitch || ''}`;
}

/**
 * Drops candidates too similar to recently published ideas or to an
 * earlier-indexed sibling in the same candidate set.
 * Returns kept candidates plus their vectors (keyed by headline) so the
 * caller can persist vectors for the ideas it ultimately publishes.
 */
export async function semanticDedupeCandidates(
  candidates: any[],
  excludeDate: string
): Promise<{ kept: any[]; droppedHeadlines: string[]; vectorsByHeadline: Map<string, number[]> }> {
  const failOpen = {
    kept: candidates,
    droppedHeadlines: [] as string[],
    vectorsByHeadline: new Map<string, number[]>(),
  };
  if (candidates.length === 0) return failOpen;

  try {
    const threshold = getDedupeThreshold();
    const [existing, candidateVectors] = await Promise.all([
      getRecentEmbeddings(excludeDate),
      embedTexts(candidates.map(embedText)),
    ]);

    const kept: any[] = [];
    const keptVectors: number[][] = [];
    const droppedHeadlines: string[] = [];
    const vectorsByHeadline = new Map<string, number[]>();

    for (let i = 0; i < candidates.length; i++) {
      const v = candidateVectors[i];
      const tooSimilar =
        existing.some((e) => cosineSim(v, e.v) >= threshold) ||
        keptVectors.some((k) => cosineSim(v, k) >= threshold);

      if (tooSimilar) {
        droppedHeadlines.push(candidates[i].headline);
      } else {
        kept.push(candidates[i]);
        keptVectors.push(v);
        vectorsByHeadline.set(candidates[i].headline, v);
      }
    }

    if (droppedHeadlines.length > 0) {
      console.log(
        `[embeddings] Semantic dedup dropped ${droppedHeadlines.length}/${candidates.length} candidates (threshold ${threshold})`
      );
    }
    return { kept, droppedHeadlines, vectorsByHeadline };
  } catch (e) {
    console.error('[embeddings] semanticDedupeCandidates error (fail-open):', e);
    return failOpen;
  }
}

/** Persist vectors for the published ideas as one doc per day. Non-fatal. */
export async function saveIdeaEmbeddings(
  date: string,
  ideas: any[],
  vectorsByHeadline: Map<string, number[]>
): Promise<void> {
  try {
    const vectors: IdeaVector[] = [];
    for (const idea of ideas) {
      const v = vectorsByHeadline.get(idea.headline);
      if (v && v.length > 0) {
        vectors.push({ id: idea.id || idea.headline, headline: idea.headline, v });
      }
    }
    if (vectors.length === 0) return;

    const db = getAdminDb();
    await db.collection(EMBEDDINGS_COLLECTION).doc(date).set({
      date,
      vectors,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[embeddings] saveIdeaEmbeddings error (non-fatal):', e);
  }
}
