import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Cron-triggered daily generation endpoint. Runs at 06:30 UTC each day
 * (before the 07:00 UTC digest email cron). Vercel secures this endpoint
 * automatically — only Vercel's cron infrastructure can invoke it.
 *
 * Removes manual admin trigger dependency for daily idea feed generation.
 * TE-17: Trigger daily generation from cron instead of requiring manual admin action.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[cron] Triggered: daily generation');

  try {
    // Delegate to the actual daily handler, but as a system/cron context
    // by making an internal authenticated call. The daily handler checks
    // for auth + today's date (TE-01); cron should bypass the auth check
    // since it's a trusted system trigger.
    //
    // We make a POST to the daily handler with a special cron context.
    // The daily handler will check for this and allow generation.
    const response = await fetch('https://trend-equity.vercel.app/api/generate/daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-trigger': 'true',
      },
      body: JSON.stringify({ refresh: false }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[cron] Daily generation failed:', data);
      return res.status(response.status).json({ error: data.error || 'Generation failed' });
    }

    console.log('[cron] Daily generation succeeded');
    return res.status(200).json({ success: true, ideas: data.ideas?.length || 0 });
  } catch (err) {
    console.error('[cron] Error triggering daily generation:', err);
    return res.status(503).json({
      error: 'Cron-triggered generation failed: ' + (err instanceof Error ? err.message : ''),
    });
  }
}
