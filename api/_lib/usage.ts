import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountKey)),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'trend-equity-63c48' });
    }
  }
  return getFirestore();
}

const USAGE_COLLECTION = 'api_usage';

const FEATURE_DAILY_LIMITS: Record<string, number> = {
  free: 3,
  pro: 15,
  builder: Infinity,
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function usageDocId(uid: string, featureType: string): string {
  return `${uid}_${featureType}_${getToday()}`;
}

/**
 * Atomically increment usage counter.
 * Returns { allowed, remaining, limit }.
 */
export async function checkAndIncrementUsage(
  uid: string,
  tier: string,
  featureType: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = FEATURE_DAILY_LIMITS[tier] ?? FEATURE_DAILY_LIMITS.free;

  if (!isFinite(limit)) return { allowed: true, remaining: Infinity, limit };

  try {
    const db = getAdminDb();
    const docRef = db.collection(USAGE_COLLECTION).doc(usageDocId(uid, featureType));

    // Atomic increment via Firestore transaction
    const newCount = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const current: number = snap.exists ? (snap.data()!.count ?? 0) : 0;
      const next = current + 1;
      tx.set(docRef, {
        uid,
        featureType,
        date: getToday(),
        count: next,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return next;
    });

    if (newCount > limit) {
      return { allowed: false, remaining: 0, limit };
    }
    return { allowed: true, remaining: limit - newCount, limit };
  } catch (e) {
    console.error('[usage] checkAndIncrementUsage error:', e);
    // Fail open on errors — don't block the user due to DB issues
    return { allowed: true, remaining: limit, limit };
  }
}

export async function getUserUsageCount(uid: string, featureType: string): Promise<number> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(USAGE_COLLECTION).doc(usageDocId(uid, featureType)).get();
    return snap.exists ? (snap.data()!.count ?? 0) : 0;
  } catch {
    return 0;
  }
}

export async function buildUsageResponse(
  uid: string | undefined,
  tier: string | undefined,
  featureType: string
) {
  if (!uid) return null;
  const t = tier || 'free';
  const limit = FEATURE_DAILY_LIMITS[t] ?? FEATURE_DAILY_LIMITS.free;
  const used = await getUserUsageCount(uid, featureType);
  return {
    featureType,
    used,
    limit: isFinite(limit) ? limit : null,
    remaining: isFinite(limit) ? Math.max(0, limit - used) : null,
  };
}
