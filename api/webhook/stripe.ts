import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Stripe } from 'stripe';
import {
  getStripe,
  provisionSubscription,
  extendSubscription,
  downgradeToFree,
  updateSubscriptionState,
  tierForPriceId,
  resolveScheduledTierChange,
  resolveUid,
  getPeriodEnd,
  StripeConfigError,
  type PaidTier,
} from '../_lib/stripe';
import { getAdminDb } from '../_lib/admin';
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
        return await onCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session, res);
      case 'invoice.payment_succeeded':
        return await onInvoicePaid(stripe, event.data.object as Stripe.Invoice, res);
      case 'invoice.payment_failed':
        return await onInvoicePaymentFailed(stripe, event.data.object as Stripe.Invoice, res);
      case 'customer.subscription.updated':
        return await onSubscriptionUpdated(stripe, event.data.object as Stripe.Subscription, res);
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

async function onCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  res: VercelResponse
) {
  const uid = session.metadata?.uid ?? session.client_reference_id ?? undefined;
  const tier = session.metadata?.tier as PaidTier | undefined;

  if (!uid || !tier || !['pro', 'builder'].includes(tier)) {
    console.error('[webhook] Session missing uid/tier metadata:', session.id);
    return res.status(200).json({ received: true, skipped: 'missing metadata' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true, skipped: session.payment_status });
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  // TE-42: use Stripe's real billing anchor rather than "now + 30 days" so the
  // renewal date shown in-app matches the invoice. Best-effort — provisioning
  // falls back to the 30-day default if the lookup fails.
  let currentPeriodEnd: number | null = null;
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = getPeriodEnd(subscription);
    } catch (err) {
      console.warn('[stripe] period-end lookup failed:', (err as Error).message);
    }
  }

  const result = await provisionSubscription({
    uid,
    tier,
    sessionId: session.id,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    subscriptionId,
    currentPeriodEnd,
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

  await extendSubscription({
    uid,
    currentPeriodEnd: periodEnd,
    invoiceId: invoice.id,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    subscriptionId,
  });
  console.log(`✓ Renewed subscription for user ${uid}`);
  return res.status(200).json({ received: true });
}

/**
 * A renewal charge failed. Stripe now runs its dunning retries — we do NOT
 * drop the tier here (subscription.deleted / the proEndDate backstop own
 * that). We flag the account and tell the user how to fix their card.
 */
async function onInvoicePaymentFailed(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  res: VercelResponse
) {
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  const uid = await resolveUid(stripe, { subscriptionId, customerId });
  if (!uid) {
    return res.status(200).json({ received: true, skipped: 'uid not resolvable' });
  }

  const db = getAdminDb();
  const userRef = db.collection('users').doc(uid);
  // Alert doc id embeds the invoice id → dunning retries don't stack alerts.
  const alertRef = db.collection('user_alerts').doc(`payment_failed_${invoice.id}`);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(alertRef);
    if (existing.exists) return;
    tx.set(userRef, { subscriptionStatus: 'past_due', updatedAt: new Date() }, { merge: true });
    tx.set(alertRef, {
      userId: uid,
      title: 'Payment failed',
      message:
        'Your last subscription payment failed. Update your payment method in Manage billing to keep your plan.',
      type: 'error',
      timestamp: new Date(),
      isRead: false,
    });
  });

  console.log(`⚠ Payment failed for user ${uid} (invoice ${invoice.id})`);
  return res.status(200).json({ received: true });
}

/**
 * Portal plan-switches, cancel-at-period-end flags and status changes land
 * here. Never drops tier to free — `customer.subscription.deleted` and the
 * proEndDate backstop own the end of paid access.
 */
async function onSubscriptionUpdated(
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

  const priceId = subscription.items?.data?.[0]?.price?.id;

  // TE-47: a period-end downgrade leaves the *current* price in place and hangs
  // the new one off a schedule, so this event alone looks like a no-op. Read the
  // schedule too, and always write the result — passing null is what clears a
  // pending switch the user reversed in the portal.
  const scheduled = await resolveScheduledTierChange(stripe, subscription);

  await updateSubscriptionState({
    uid,
    tier: tierForPriceId(priceId),
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodEnd: getPeriodEnd(subscription),
    pendingTier: scheduled.tier,
    pendingTierDate: scheduled.effectiveAt,
  });

  console.log(
    scheduled.tier
      ? `✓ Subscription state synced for user ${uid} (${subscription.status}; → ${scheduled.tier} at period end)`
      : `✓ Subscription state synced for user ${uid} (${subscription.status})`
  );
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
