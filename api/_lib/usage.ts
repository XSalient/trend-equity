import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const FEATURE_DAILY_LIMITS: Record<string, number> = {
  free: 3,
  pro: 15,
  builder: Infinity,
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function usageKey(uid: string, featureType: string): string {
  return `usage:${uid}:${featureType}:${getToday()}`;
}

export async function checkAndIncrementUsage(
  uid: string,
  tier: string,
  featureType: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = FEATURE_DAILY_LIMITS[tier] ?? FEATURE_DAILY_LIMITS.free;

  // Builder has unlimited access
  if (!isFinite(limit)) return { allowed: true, remaining: Infinity, limit };

  const client = getRedis();

  // No Redis → fail open (allow) but log
  if (!client) {
    console.warn('[usage] Redis unavailable — allowing request without tracking.');
    return { allowed: true, remaining: limit, limit };
  }

  const key = usageKey(uid, featureType);
  try {
    const current = await client.incr(key);
    // Set TTL on first increment (expires at midnight + buffer)
    if (current === 1) {
      await client.expire(key, 26 * 60 * 60); // 26h to be safe
    }
    if (current > limit) {
      return { allowed: false, remaining: 0, limit };
    }
    return { allowed: true, remaining: limit - current, limit };
  } catch (e) {
    console.error('[usage] Redis error:', e);
    // Fail open on Redis errors
    return { allowed: true, remaining: limit, limit };
  }
}

export async function getUserUsageCount(uid: string, featureType: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;
  try {
    const val = await client.get<number>(usageKey(uid, featureType));
    return val ?? 0;
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
