import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';
import { getAdminDb } from '../_lib/admin';
import { getAuthContext } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authCtx = await getAuthContext(req);
  if (!authCtx) return res.status(401).json({ error: 'Authentication required.' });
  if (authCtx.tier !== 'builder') {
    return res.status(403).json({ error: 'API key generation requires Builder tier.' });
  }

  const rawKey = `te_live_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  try {
    const db = getAdminDb();
    await db.collection('api_keys').doc(keyHash).set({
      uid: authCtx.uid,
      tier: authCtx.tier,
      keyHash,
      createdAt: new Date(),
      active: true,
      lastUsed: null,
    });

    return res.json({ key: rawKey });
  } catch (err: any) {
    console.error('[api-key] Error storing key:', err);
    return res.status(500).json({ error: 'Failed to generate API key. Please try again.' });
  }
}
