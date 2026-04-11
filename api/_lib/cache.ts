import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Lazy singleton — safe to call multiple times in warm invocations
function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      // Production: service account JSON stored in Doppler/Vercel env
      const credential = cert(JSON.parse(serviceAccountKey));
      initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID });
    } else {
      // Local dev fallback: Application Default Credentials (gcloud auth application-default login)
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'trend-equity-63c48' });
    }
  }
  return getFirestore();
}

const CACHE_COLLECTION = 'api_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCached(key: string): Promise<any | null> {
  if (!key) return null;
  try {
    const db = getAdminDb();
    const doc = await db.collection(CACHE_COLLECTION).doc(key).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    // Check TTL
    if (Date.now() - data.generatedAt > CACHE_TTL_MS) {
      await doc.ref.delete(); // clean up stale entry
      return null;
    }
    return data.result;
  } catch (e) {
    console.error('[cache] getCached error:', e);
    return null;
  }
}

export async function setCached(key: string, value: any): Promise<void> {
  if (!key) return;
  try {
    const db = getAdminDb();
    await db.collection(CACHE_COLLECTION).doc(key).set({
      result: value,
      generatedAt: Date.now(),
      expiresAt: FieldValue.serverTimestamp(), // informational
    });
  } catch (e) {
    console.error('[cache] setCached error:', e);
  }
}

/**
 * Returns headline strings from daily_generations docs for the `lookbackDays`
 * days immediately before `excludeDate` (ISO yyyy-mm-dd). Used to build a
 * deduplication block so the AI doesn't repeat recent idea spaces.
 */
export async function getRecentIdeaHeadlines(excludeDate: string, lookbackDays = 3): Promise<string[]> {
  try {
    const db = getAdminDb();
    const base = new Date(excludeDate);
    const headlines: string[] = [];

    const fetches = Array.from({ length: lookbackDays }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (i + 1));
      const key = d.toISOString().split('T')[0];
      return db.collection('daily_generations').doc(key).get();
    });

    const snaps = await Promise.all(fetches);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data();
      if (Array.isArray(data?.ideas)) {
        for (const idea of data.ideas) {
          if (idea?.headline) headlines.push(idea.headline as string);
        }
      }
    }
    return headlines;
  } catch (e) {
    console.error('[cache] getRecentIdeaHeadlines error:', e);
    return [];
  }
}
