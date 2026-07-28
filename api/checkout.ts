import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext } from './_lib/auth';
import { getAdminDb } from './_lib/admin';
import {
  getStripe,
  getPriceId,
  getAppUrl,
  provisionSubscription,
  StripeConfigError,
  type PaidTier,
} from './_lib/stripe';

/**
 * STRIPE SETUP GUIDE (TE-08)
 *
 * Required environment variables (locally in `.env`, in Vercel for deploys):
 *
 *   STRIPE_SECRET_KEY=sk_test_…       https://dashboard.stripe.com/test/apikeys
 *   STRIPE_PRICE_PRO=price_…          Pro, $9/month recurring
 *   STRIPE_PRICE_BUILDER=price_…      Builder, $19/month recurring
 *   STRIPE_WEBHOOK_SECRET=whsec_…     https://dashboard.stripe.com/test/webhooks
 *   APP_URL=https://your-domain       origin Stripe redirects back to
 *
 * Webhook endpoint: POST {APP_URL}/api/webhook/stripe
 * Events: checkout.session.completed, invoice.payment_succeeded,
 *         customer.subscription.deleted
 *
 * Local webhook forwarding:
 *   stripe listen --forward-to localhost:3001/api/webhook/stripe
 *
 * Test card: 4242 4242 4242 4242, any future expiry / CVC / postcode.
 *
 * Note: the webhook is the source of truth, but GET /api/checkout?session_id=…
 * provisions the same upgrade on return from Stripe, so checkout still works
 * end-to-end before a webhook endpoint is registered.
 */

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, builder: 2 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return verifySession(req, res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authCtx = await getAuthContext(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier } = req.body ?? {};

    if (!tier || !['pro', 'builder'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    if (TIER_RANK[authCtx.tier] >= TIER_RANK[tier as string]) {
      return res.status(400).json({ error: 'User already has this tier or higher' });
    }

    // A live subscription must be changed in the Customer Portal — a second
    // Checkout would create a second Stripe subscription and double-bill.
    // downgradeToFree() nulls stripeSubscriptionId, so lapsed users can
    // re-subscribe through Checkout normally.
    const userSnap = await getAdminDb().collection('users').doc(authCtx.uid).get();
    if (userSnap.data()?.stripeSubscriptionId) {
      return res.status(409).json({
        error: 'You already have an active subscription. Use “Manage billing” to change plans.',
        usePortal: true,
      });
    }

    const stripe = getStripe();
    const priceId = getPriceId(tier as PaidTier);
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?tab=pro&checkout=cancelled`,
      // A Firebase uid is not an email — passing it here made Stripe reject
      // every session with "Invalid email address". The uid belongs in
      // client_reference_id / metadata; only a real address goes in customer_email.
      ...(authCtx.email ? { customer_email: authCtx.email } : {}),
      client_reference_id: authCtx.uid,
      metadata: { uid: authCtx.uid, tier },
      // Copied onto the Subscription so renewal/cancellation events can be
      // traced back to the user (they do not inherit session metadata).
      subscription_data: { metadata: { uid: authCtx.uid, tier } },
    });

    if (!session.url) {
      console.error('[checkout] Stripe returned a session with no URL:', session.id);
      return res.status(502).json({ error: 'Stripe did not return a checkout URL' });
    }

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return handleStripeError(error, res, 'Failed to create checkout session');
  }
}

/**
 * Confirms a completed Checkout Session on return from Stripe and provisions
 * the tier immediately, without waiting for the webhook to land. Idempotent —
 * `provisionSubscription` dedups on the session id.
 */
async function verifySession(req: VercelRequest, res: VercelResponse) {
  try {
    const authCtx = await getAuthContext(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : null;
    if (!sessionId?.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session_id' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // The session must belong to the caller — otherwise anyone holding a
    // session id could grant themselves a tier.
    const sessionUid = session.metadata?.uid ?? session.client_reference_id;
    if (sessionUid !== authCtx.uid) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: session.payment_status, tier: authCtx.tier });
    }

    const tier = session.metadata?.tier as PaidTier | undefined;
    if (!tier || !['pro', 'builder'].includes(tier)) {
      console.error('[checkout] Paid session missing tier metadata:', sessionId);
      return res.status(500).json({ error: 'Session is missing tier metadata' });
    }

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    const result = await provisionSubscription({
      uid: authCtx.uid,
      tier,
      sessionId,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscriptionId,
      amountTotal: session.amount_total,
      currency: session.currency,
    });

    return res.status(200).json({ status: 'paid', tier: result.tier, applied: result.applied });
  } catch (error) {
    return handleStripeError(error, res, 'Failed to verify checkout session');
  }
}

function handleStripeError(error: unknown, res: VercelResponse, fallback: string) {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof StripeConfigError) {
    console.error('[checkout] Stripe not configured:', message);
    return res.status(503).json({
      error: 'Payments are not configured yet. Please contact support.',
      debug: message,
    });
  }

  console.error('[checkout]', message);

  if (message.includes('No such price')) {
    return res.status(503).json({
      error: 'Payment configuration error: the configured Stripe price does not exist.',
      debug: message,
    });
  }

  const exposeDetails =
    process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';

  return res
    .status(500)
    .json(exposeDetails ? { error: fallback, details: message } : { error: fallback });
}
