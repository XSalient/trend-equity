import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { getAdminDb } from './admin';

const USAGE_COLLECTION = 'api_usage';

const FEATURE_DAILY_LIMITS: Record<string, number> = {
  free: 3,
  pro: 15,
  builder: Infinity,
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getYearMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function usageDocId(uid: string, featureType: string): string {
  return `${uid}_${featureType}_${getToday()}`;
}

function monthlyUsageDocId(uid: string, featureType: string): string {
  return `${uid}_${featureType}_${getYearMonth()}`;
}

function getNextMonthStart(): string {
  const d = new Date();
  // First day of next month
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0];
}

/**
 * Checks whether the user is within their daily limit, then atomically increments.
 * FIX (B-1): Check is performed BEFORE incrementing so the counter never inflates
 * beyond the limit on denied requests.
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

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const current: number = snap.exists ? (snap.data()!.count ?? 0) : 0;

      // Check BEFORE incrementing — counter must not inflate on denied requests
      if (current >= limit) {
        return { allowed: false, count: current };
      }

      const next = current + 1;
      tx.set(
        docRef,
        {
          uid,
          featureType,
          date: getToday(),
          count: next,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { allowed: true, count: next };
    });

    if (!result.allowed) {
      return { allowed: false, remaining: 0, limit };
    }
    return { allowed: true, remaining: limit - result.count, limit };
  } catch (e) {
    console.error('[usage] checkAndIncrementUsage error:', e);
    // Fail open on DB errors — don't block the user due to infrastructure issues
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

export async function buildDailyUsageResponse(
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

// ─── Monthly quota functions (used for custom idea analysis) ─────────────────

/**
 * Atomically checks then increments the monthly usage counter.
 * `limit` is passed in from tier-config so this function stays limit-agnostic.
 * Uses doc ID `${uid}_${featureType}_${YYYY-MM}` so counters reset each month.
 */
export async function checkAndIncrementMonthlyUsage(
  uid: string,
  limit: number,
  featureType: string
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
  if (limit === 0) return { allowed: false, remaining: 0, limit: 0, used: 0 };

  try {
    const db = getAdminDb();
    const docRef = db.collection(USAGE_COLLECTION).doc(monthlyUsageDocId(uid, featureType));

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const current: number = snap.exists ? (snap.data()!.count ?? 0) : 0;

      if (current >= limit) {
        return { allowed: false, count: current };
      }

      const next = current + 1;
      tx.set(
        docRef,
        {
          uid,
          featureType,
          month: getYearMonth(),
          count: next,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { allowed: true, count: next };
    });

    if (!result.allowed) {
      return { allowed: false, remaining: 0, limit, used: limit };
    }
    return { allowed: true, remaining: limit - result.count, limit, used: result.count };
  } catch (e) {
    console.error('[usage] checkAndIncrementMonthlyUsage error:', e);
    return { allowed: true, remaining: limit, limit, used: 0 };
  }
}

export async function getMonthlyUsageCount(uid: string, featureType: string): Promise<number> {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(USAGE_COLLECTION)
      .doc(monthlyUsageDocId(uid, featureType))
      .get();
    return snap.exists ? (snap.data()!.count ?? 0) : 0;
  } catch {
    return 0;
  }
}

export async function buildMonthlyUsageResponse(
  uid: string | undefined,
  limit: number,
  featureType: string
) {
  if (!uid) return null;
  const used = await getMonthlyUsageCount(uid, featureType);
  return {
    featureType: featureType as 'analyze-idea',
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: getNextMonthStart(),
  };
}

/** Alias used by Vercel handler files — same as buildDailyUsageResponse. */
export const buildUsageResponse = buildDailyUsageResponse;

// ─── Per-IP daily limiting (unauthenticated/abuse protection) ────────────────

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function ipUsageDocId(ip: string): string {
  return `ip_${hashIp(ip)}_${getToday()}`;
}

/**
 * Checks whether the given (hashed) IP is within its daily limit, then
 * atomically increments. Backed by Firestore rather than an in-memory Map so
 * the limit is enforced across all serverless instances — a Map only ever
 * protects the single instance that happens to handle the request.
 * Raw IPs are never persisted, only their SHA-256 hash.
 */
export async function checkAndIncrementIpLimit(
  ip: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  try {
    const db = getAdminDb();
    const docRef = db.collection(USAGE_COLLECTION).doc(ipUsageDocId(ip));

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const current: number = snap.exists ? (snap.data()!.count ?? 0) : 0;

      if (current >= limit) {
        return { allowed: false, count: current };
      }

      const next = current + 1;
      tx.set(
        docRef,
        {
          featureType: 'ip-daily',
          date: getToday(),
          count: next,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { allowed: true, count: next };
    });

    if (!result.allowed) {
      return { allowed: false, remaining: 0, limit };
    }
    return { allowed: true, remaining: limit - result.count, limit };
  } catch (e) {
    // Fail open on DB errors, but log distinctly so occurrences are countable —
    // unlike quota fail-open, this is the only backstop against IP-based abuse.
    console.warn('[usage] fail-open: checkAndIncrementIpLimit error:', e);
    return { allowed: true, remaining: limit, limit };
  }
}
