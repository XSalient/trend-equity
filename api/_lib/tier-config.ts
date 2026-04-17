import { getAdminDb } from './admin';

export interface TierConfig {
  analyze_idea_monthly: { pro: number; builder: number };
  custom_saves: { pro: number; builder: number };
}

const DEFAULT_CONFIG: TierConfig = {
  analyze_idea_monthly: { pro: 5, builder: 20 },
  custom_saves: { pro: 3, builder: 10 },
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache: { config: TierConfig; fetchedAt: number } | null = null;

/**
 * Returns the current tier configuration.
 * Reads from Firestore `app_config/tier_limits` doc with a 5-minute in-memory cache.
 * Admin can update the Firestore doc via Firebase console — changes take effect
 * within 5 minutes without any redeployment.
 * Falls back to DEFAULT_CONFIG if the doc is missing or a read error occurs.
 */
export async function getTierConfig(): Promise<TierConfig> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.config;
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('app_config').doc('tier_limits').get();

    if (snap.exists) {
      const data = snap.data()!;
      // Merge over defaults so partial docs still work
      const config: TierConfig = {
        analyze_idea_monthly: {
          ...DEFAULT_CONFIG.analyze_idea_monthly,
          ...(data.analyze_idea_monthly ?? {}),
        },
        custom_saves: {
          ...DEFAULT_CONFIG.custom_saves,
          ...(data.custom_saves ?? {}),
        },
      };
      _cache = { config, fetchedAt: Date.now() };
      return config;
    }
  } catch (e) {
    console.error('[tier-config] Failed to read app_config/tier_limits (using defaults):', e);
  }

  // Doc missing or read error — use defaults, but don't cache so we retry next request
  return DEFAULT_CONFIG;
}

export function getAnalyzeIdeaLimit(tier: string, config: TierConfig): number {
  if (tier === 'builder') return config.analyze_idea_monthly.builder;
  if (tier === 'pro') return config.analyze_idea_monthly.pro;
  return 0; // free tier: blocked
}

export function getCustomSavesLimit(tier: string, config: TierConfig): number {
  if (tier === 'builder') return config.custom_saves.builder;
  if (tier === 'pro') return config.custom_saves.pro;
  return 0;
}
