/**
 * Server-side authentication context.
 *
 * SECURITY: uid and tier are NEVER read from req.body — they are derived
 * exclusively from a verified Firebase ID token in the Authorization header.
 * This prevents clients from spoofing their identity or tier level.
 */
import type { VercelRequest } from '@vercel/node';
import { createHash } from 'crypto';
import { getAdminDb, getAdminAuth } from './admin';

export interface AuthContext {
  uid: string;
  tier: 'free' | 'pro' | 'builder';
  isAdmin: boolean;
  /** Verified email claim, when the identity provider supplied one. */
  email?: string;
}

/** Grace after proEndDate before paid access lapses — covers a missed webhook
 *  without punishing users for Stripe retry latency. */
const EXPIRY_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * TE-41 backstop: the tier a request actually gets. Admin grants (paid tier,
 * no proEndDate) never expire; Stripe-provisioned tiers lapse to free once
 * proEndDate + grace has passed, even if `customer.subscription.deleted`
 * never arrived. There is no cron — both Vercel Hobby slots are taken — so
 * this per-request check is what actually ends access.
 */
export function resolveEffectiveTier(
  data: Record<string, unknown> | undefined
): AuthContext['tier'] {
  const raw = (data?.tier ?? 'free') as string;
  if (!(['free', 'pro', 'builder'] as const).includes(raw as AuthContext['tier'])) return 'free';
  if (raw === 'free') return 'free';

  const end = data?.proEndDate as { toMillis?: () => number } | Date | null | undefined;
  if (!end) return raw as AuthContext['tier'];
  const endMs =
    typeof (end as { toMillis?: () => number }).toMillis === 'function'
      ? (end as { toMillis: () => number }).toMillis()
      : new Date(end as Date).getTime();
  // An unparseable date leaves access intact rather than revoking it.
  if (Number.isFinite(endMs) && Date.now() > endMs + EXPIRY_GRACE_MS) return 'free';
  return raw as AuthContext['tier'];
}

/**
 * Verifies the Bearer token from the Authorization header.
 * Returns { uid, tier } on success, or null for unauthenticated requests.
 */
export async function getAuthContext(req: VercelRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // API key path: te_live_ prefix → hash lookup in Firestore
  if (token.startsWith('te_live_')) {
    try {
      const keyHash = createHash('sha256').update(token).digest('hex');
      const db = getAdminDb();
      const snap = await db.collection('api_keys').doc(keyHash).get();
      if (!snap.exists || !snap.data()?.active) return null;
      const d = snap.data()!;
      snap.ref.update({ lastUsed: new Date() }).catch(() => {});
      return { uid: d.uid, tier: d.tier as AuthContext['tier'], isAdmin: false };
    } catch {
      return null;
    }
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);

    // Look up the user's tier from Firestore — the client cannot forge this
    try {
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const tier = resolveEffectiveTier(userDoc.exists ? userDoc.data() : undefined);
      const role = userDoc.exists ? userDoc.data()?.role : null;
      const isAdmin = role === 'admin';
      const email = decoded.email ?? userDoc.data()?.email ?? undefined;
      return { uid: decoded.uid, tier, isAdmin, email };
    } catch {
      // Firestore lookup failed — default to free tier (fail-open on tier, not auth)
      return { uid: decoded.uid, tier: 'free', isAdmin: false, email: decoded.email ?? undefined };
    }
  } catch {
    // Invalid or expired token
    return null;
  }
}

const TIER_RANK: Record<AuthContext['tier'], number> = { free: 0, pro: 1, builder: 2 };

/**
 * Server-side gate for endpoints promised to a specific tier or above
 * (see docs/audits/2026-07-08-ui-feature-tier-audit.md §3). Callers must
 * call getAuthContext() first and 401 on a null result — this only decides
 * whether an *authenticated* caller's tier clears the bar.
 * Returns null when the check passes, or the { status, body } pair to send
 * as-is when it fails.
 */
export function requireTier(
  authCtx: AuthContext,
  minTier: 'pro' | 'builder'
): { status: number; body: { error: string; upgradeRequired: true } } | null {
  if (TIER_RANK[authCtx.tier] >= TIER_RANK[minTier]) return null;

  const label = minTier === 'builder' ? 'Builder' : 'Pro or Builder';
  return {
    status: 403,
    body: { error: `This feature requires a ${label} plan.`, upgradeRequired: true },
  };
}
