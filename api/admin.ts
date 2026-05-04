import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';
import { getAdminDb, getAdminAuth } from './_lib/admin';
import { getAuthContext } from './_lib/auth';

// ── Digest helpers ────────────────────────────────────────────────────────────

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'digest@trend-equity.app';

function buildEmailHtml(ideas: any[]): string {
  const ideaCards = ideas
    .map(
      (idea) => `
    <div style="margin-bottom:24px;padding:20px;background:#18181b;border:1px solid #27272a;border-radius:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;color:#fff;font-size:16px;font-weight:700;">${idea.headline || 'Untitled Idea'}</h3>
        <span style="background:#059669;color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">
          Score: ${idea.revenuePotentialScore ?? '—'}/10
        </span>
      </div>
      <p style="margin:0 0 12px;color:#a1a1aa;font-size:14px;line-height:1.6;">${idea.pitch || ''}</p>
      ${idea.nextSteps?.length ? `<p style="margin:0;color:#6ee7b7;font-size:12px;font-weight:600;">→ ${idea.nextSteps[0]}</p>` : ''}
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Trend-Equity Daily Digest</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="margin-bottom:32px;">
      <h1 style="margin:0 0 4px;color:#fff;font-size:24px;font-weight:900;text-transform:uppercase;font-style:italic;">
        Trend-Equity Daily Digest
      </h1>
      <p style="margin:0;color:#71717a;font-size:13px;">
        Today's top ${ideas.length} investable signals — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </div>
    ${ideaCards}
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #27272a;text-align:center;">
      <p style="margin:0;color:#52525b;font-size:11px;">
        You're receiving this because you enabled Daily Digest in Trend-Equity.<br>
        All ideas are AI-generated from live market signals.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function handleDigest(res: VercelResponse) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const db = getAdminDb();
  const today = new Date().toISOString().slice(0, 10);

  const dailySnap = await db.collection('daily_generations').doc(today).get();
  const allIdeas: any[] = dailySnap.exists ? (dailySnap.data()?.ideas ?? []) : [];
  const topIdeas = [...allIdeas]
    .sort((a, b) => (b.revenuePotentialScore ?? 0) - (a.revenuePotentialScore ?? 0))
    .slice(0, 5);

  if (topIdeas.length === 0) return res.json({ sent: 0, message: 'No ideas available for today.' });

  const prefsSnap = await db.collection('user_digest_prefs').where('dailyOn', '==', true).get();
  const subscribers = prefsSnap.docs.map((d: any) => ({ uid: d.id, ...d.data() })) as Array<{
    uid: string;
    email: string;
    dailyOn: boolean;
  }>;

  const html = buildEmailHtml(topIdeas);
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    if (!sub.email) continue;
    try {
      const emailRes = await fetch(RESEND_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: sub.email,
          subject: `Trend-Equity: Top 5 Ideas for ${today}`,
          html,
        }),
      });
      if (emailRes.ok) {
        sent++;
      } else {
        console.error(`[digest] Failed for ${sub.email}:`, await emailRes.text());
        failed++;
      }
    } catch (err) {
      console.error(`[digest] Error for ${sub.email}:`, err);
      failed++;
    }
  }

  return res.json({ sent, failed, total: subscribers.length, date: today });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization ?? '';
  const cronSecret = process.env.CRON_SECRET;

  // Cron path: Vercel sends no body, just hits the endpoint at schedule time
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    try {
      return await handleDigest(res);
    } catch (err: any) {
      console.error('[admin/digest] Error:', err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  }

  const { action, submissionId } = req.body ?? {};

  // ── API key generation (builder tier) ─────────────────────────────────────
  if (action === 'api-key') {
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
      console.error('[admin/api-key] Error:', err);
      return res.status(500).json({ error: 'Failed to generate API key. Please try again.' });
    }
  }

  // ── TE100 approval (admin role) ────────────────────────────────────────────
  if (action === 'te100-approve') {
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (!submissionId || typeof submissionId !== 'string') {
      return res.status(400).json({ error: 'submissionId is required' });
    }
    const subRef = db.collection('te100_submissions').doc(submissionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) return res.status(404).json({ error: 'Submission not found' });
    if (subSnap.data()?.status === 'approved')
      return res.status(409).json({ error: 'Already approved' });
    const d = subSnap.data()!;
    await Promise.all([
      db
        .collection('te100')
        .doc(submissionId)
        .set({
          projectName: d.projectName,
          url: d.url,
          pitch: d.pitch,
          mrr: d.mrr || null,
          userId: d.userId,
          userEmail: d.userEmail,
          submissionId,
          approvedAt: new Date(),
          approvedBy: uid,
        }),
      subRef.update({ status: 'approved', approvedAt: new Date(), approvedBy: uid }),
    ]);
    return res.json({ success: true, submissionId });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
