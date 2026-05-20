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
      const rawTier = userDoc.exists ? (userDoc.data()?.tier ?? 'free') : 'free';
      const tier = (['free', 'pro', 'builder'] as const).includes(rawTier as any)
        ? (rawTier as AuthContext['tier'])
        : 'free';
      const role = userDoc.exists ? userDoc.data()?.role : null;
      const isAdmin = role === 'admin';
      return { uid: decoded.uid, tier, isAdmin };
    } catch {
      // Firestore lookup failed — default to free tier (fail-open on tier, not auth)
      return { uid: decoded.uid, tier: 'free', isAdmin: false };
    }
  } catch {
    // Invalid or expired token
    return null;
  }
}
