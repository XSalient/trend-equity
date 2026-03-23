import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[cache] Upstash env vars missing — caching disabled.');
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

const CACHE_TTL_SECS = 24 * 60 * 60; // 24 hours

export async function getCached(key: string): Promise<any | null> {
  if (!key) return null;
  const client = getRedis();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ?? null;
  } catch (e) {
    console.error('[cache] getCached error:', e);
    return null;
  }
}

export async function setCached(
  key: string,
  value: any,
  ttlSecs = CACHE_TTL_SECS
): Promise<void> {
  if (!key) return;
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttlSecs });
  } catch (e) {
    console.error('[cache] setCached error:', e);
  }
}
