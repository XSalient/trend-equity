import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/admin';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  try {
    const db = getAdminDb();
    const today = new Date().toISOString().slice(0, 10);

    // Fetch today's ideas
    const dailySnap = await db.collection('daily_generations').doc(today).get();
    const allIdeas: any[] = dailySnap.exists ? (dailySnap.data()?.ideas ?? []) : [];
    const topIdeas = [...allIdeas]
      .sort((a, b) => (b.revenuePotentialScore ?? 0) - (a.revenuePotentialScore ?? 0))
      .slice(0, 5);

    if (topIdeas.length === 0) {
      return res.json({ sent: 0, message: 'No ideas available for today.' });
    }

    // Fetch subscribers
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
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
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
          console.error(`[digest] Failed to send to ${sub.email}:`, await emailRes.text());
          failed++;
        }
      } catch (err) {
        console.error(`[digest] Error sending to ${sub.email}:`, err);
        failed++;
      }
    }

    return res.json({ sent, failed, total: subscribers.length, date: today });
  } catch (err: any) {
    console.error('[digest] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
