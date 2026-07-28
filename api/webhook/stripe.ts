import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Stripe } from 'stripe';
import {
  getStripe,
  provisionSubscription,
  extendSubscription,
  downgradeToFree,
  resolveUid,
  getPeriodEnd,
  StripeConfigError,
  type PaidTier,
} from '../_lib/stripe';
import { getRawBody } from './_lib/body-parser';

/**
 * Vercel parses request bodies by default, which consumes the stream and
 * destroys the exact bytes Stripe signed. Signature verification cannot work
 * without this.
 */
export const config = {
  api: { bodyParser: false },
};

/**
 * Stripe retries any non-2xx response. Client errors we can never recover from
 * (unknown user, missing metadata) return 200 with a note so Stripe stops
 * retrying; only transient failures return 5xx.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) {
    return res.status(400).json({ error: 'Missing signature' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !webhookSecret.startsWith('whsec_')) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is missing or malformed');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    const message = err instanceof StripeConfigError ? err.message : String(err);
    console.error('[webhook] Stripe not configured:', message);
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  let event: Stripe.Event;
  try {
    const body = await getRawBody(req);
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', (err as Error).message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session, res);
      case 'invoice.payment_succeeded':
        return await onInvoicePaid(stripe, event.data.object as Stripe.Invoice, res);
      case 'customer.subscription.deleted':
        return await onSubscriptionDeleted(stripe, event.data.object as Stripe.Subscription, res);
      default:
        return res.status(200).json({ received: true, ignored: event.type });
    }
  } catch (error) {
    // Transient (Firestore/Stripe outage) — let Stripe retry.
    console.error('[webhook] Processing failed for', event.type, (error as Error).message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session, res: VercelResponse) {
  const uid = session.metadata?.uid ?? session.client_reference_id ?? undefined;
  const tier = session.metadata?.tier as PaidTier | undefined;

  if (!uid || !tier || !['pro', 'builder'].includes(tier)) {
    console.error('[webhook] Session missing uid/tier metadata:', session.id);
    return res.status(200).json({ received: true, skipped: 'missing metadata' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true, skipped: session.payment_status });
  }

  const result = await provisionSubscription({
    uid,
    tier,
    sessionId: session.id,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    subscriptionId:
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    amountTotal: session.amount_total,
    currency: session.currency,
  });

  console.log(
    result.applied
      ? `✓ Upgraded user ${uid} to ${tier} tier`
      : `· Session ${session.id} already applied for ${uid}`
  );
  return res.status(200).json({ received: true });
}

async function onInvoicePaid(stripe: Stripe, invoice: Stripe.Invoice, res: VercelResponse) {
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  const uid = await resolveUid(stripe, { subscriptionId, customerId });
  if (!uid) {
    return res.status(200).json({ received: true, skipped: 'uid not resolvable' });
  }

  let periodEnd: number | null = null;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = getPeriodEnd(subscription);
  }

  await extendSubscription(uid, periodEnd);
  console.log(`✓ Renewed subscription for user ${uid}`);
  return res.status(200).json({ received: true });
}

async function onSubscriptionDeleted(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  res: VercelResponse
) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  const uid = await resolveUid(stripe, {
    metadataUid: subscription.metadata?.uid,
    customerId,
  });

  if (!uid) {
    return res.status(200).json({ received: true, skipped: 'uid not resolvable' });
  }

  await downgradeToFree(uid);
  console.log(`✓ Downgraded user ${uid} to free tier (subscription cancelled)`);
  return res.status(200).json({ received: true });
}

/**
 * `Invoice.subscription` was relocated to `parent.subscription_details` in
 * recent API versions; read whichever this account's version returns.
 */
function readInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy?.id) return legacy.id;

  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } };
    }
  ).parent;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  return nested?.id ?? null;
}
