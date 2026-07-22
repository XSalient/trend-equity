import type { VercelRequest, VercelResponse } from '@vercel/node';
import daily from './_handlers/daily';

/**
 * Cron-triggered daily generation endpoint. Runs at 06:30 UTC each day
 * (before the 07:00 UTC digest email cron). Vercel secures this endpoint
 * automatically — only Vercel's cron infrastructure can invoke it.
 *
 * Removes manual admin trigger dependency for daily idea feed generation.
 * TE-17: Trigger daily generation from cron instead of requiring manual admin action.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[cron] Triggered: daily generation');

  try {
    // Directly invoke the daily handler with cron context.
    // This avoids external HTTP call overhead and eliminates network failure points.
    // The daily handler checks for x-cron-trigger header to bypass auth checks.
    const cronReq = {
      ...req,
      method: 'POST',
      headers: {
        ...req.headers,
        'content-type': 'application/json',
        'x-cron-trigger': 'true',
      },
      body: JSON.stringify({ refresh: false }),
    } as VercelRequest;

    // Capture response without actually sending HTTP
    let statusCode = 200;
    let responseData: any = null;

    const cronRes = {
      status: (code: number) => {
        statusCode = code;
        return cronRes;
      },
      json: (data: any) => {
        responseData = data;
        return cronRes;
      },
    } as any;

    // Invoke the daily handler directly (synchronously waits for async completion)
    await daily(cronReq, cronRes);

    // Forward the handler's response
    if (statusCode >= 400) {
      console.error('[cron] Daily generation failed:', responseData);
      return res.status(statusCode).json(responseData);
    }

    console.log('[cron] Daily generation succeeded');
    return res.status(200).json({ success: true, ideas: responseData?.ideas?.length || 0 });
  } catch (err) {
    console.error('[cron] Error triggering daily generation:', err);
    return res.status(503).json({
      error: 'Cron-triggered generation failed: ' + (err instanceof Error ? err.message : ''),
    });
  }
}
