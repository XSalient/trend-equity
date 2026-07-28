import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext } from './_lib/auth';
import { getStripe, getAppUrl, StripeConfigError } from './_lib/stripe';
import { getAdminDb } from './_lib/admin';

/**
 * TE-39: Stripe Customer Portal session.
 *
 * The portal is the ONLY place cancels, plan switches, card updates, and
 * invoice history live — we never rebuild billing UI in-app. The resulting
 * changes flow back through the webhook (`customer.subscription.updated` /
 * `.deleted`), which stays the sole writer of `users/{uid}.tier`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authCtx = await getAuthContext(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(authCtx.uid).get();
    const customerId = userDoc.data()?.stripeCustomerId as string | undefined;

    if (!customerId) {
      return res
        .status(404)
        .json({ error: 'No billing account found. Subscribe to a plan first.' });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/?tab=pro`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof StripeConfigError) {
      console.error('[portal] Stripe not configured:', message);
      return res
        .status(503)
        .json({ error: 'Payments are not configured yet. Please contact support.' });
    }
    console.error('[portal]', message);
    return res.status(500).json({ error: 'Failed to open the billing portal' });
  }
}
