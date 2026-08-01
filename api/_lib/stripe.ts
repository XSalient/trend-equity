/**
 * Shared Stripe wiring for TE-08.
 *
 * Both the checkout endpoint and the webhook go through here so that a paid
 * subscription is provisioned by exactly one piece of logic, whichever path
 * observes the payment first:
 *
 *   - webhook  `checkout.session.completed`  (source of truth, async)
 *   - checkout `GET /api/checkout?session_id` (return-from-Stripe confirmation)
 *
 * Provisioning is idempotent: the Stripe session id is the dedup key, so a
 * webhook retry and a page refresh can both run without double-granting.
 */
// Default import, not named: stripe@22's CJS export *is* the constructor, so
// `import { Stripe }` resolves to undefined at runtime under CJS interop
// (tsx locally, esbuild on Vercel) even though it typechecks.
import Stripe from 'stripe';
import { getAdminDb } from './admin';

export type PaidTier = 'pro' | 'builder';

export const STRIPE_API_VERSION = '2026-06-24.dahlia' as const;

/** Thrown when the deployment is missing Stripe env vars. Surfaced as a 503, not a 500. */
export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConfigError';
  }
}

let cachedClient: Stripe | null = null;

/**
 * Lazily builds the Stripe client. Constructing it at module scope with an
 * empty key silently produced a client that failed on first call with an
 * opaque error — this fails fast with an actionable message instead.
 */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    throw new StripeConfigError(
      'STRIPE_SECRET_KEY is missing or malformed. Set it to your sk_test_… (sandbox) or sk_live_… key.'
    );
  }

  cachedClient = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return cachedClient;
}

/**
 * Resolves the configured price id for a tier.
 * Rejects the stub values (`price_`, `price_..._placeholder`) that ship in
 * `.env.example`, which previously passed validation and were sent to Stripe.
 *
 * TE-69: also rejects the two tiers resolving to the *same* price. A deployment
 * where `STRIPE_PRICE_BUILDER` holds the Pro price id is not a half-working one:
 * Checkout sells Builder for $9 and the portal's pro→builder flow is refused by
 * Stripe ("there are no changes to confirm"). Both are silent until somebody
 * reads an invoice, so the collision fails loudly at every call site instead.
 */
export function getPriceId(tier: PaidTier): string {
  const envVar = tier === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_BUILDER';
  const priceId = process.env[envVar]?.trim();

  if (!priceId || !/^price_[A-Za-z0-9]{8,}$/.test(priceId)) {
    throw new StripeConfigError(
      `${envVar} is missing or malformed (got "${priceId ?? ''}"). Copy the monthly recurring price id from the Stripe dashboard.`
    );
  }

  const otherVar = tier === 'pro' ? 'STRIPE_PRICE_BUILDER' : 'STRIPE_PRICE_PRO';
  if (process.env[otherVar]?.trim() === priceId) {
    throw new StripeConfigError(
      `STRIPE_PRICE_PRO and STRIPE_PRICE_BUILDER are both set to "${priceId}". ` +
        "Pro and Builder must be different prices — copy each tier's own monthly price id from the Stripe dashboard."
    );
  }

  return priceId;
}

/**
 * Absolute origin used for Stripe success/cancel redirects.
 * VERCEL_URL alone is wrong for production — it is the immutable per-deployment
 * hostname, not the project domain — so an explicit APP_URL wins when set.
 */
export function getAppUrl(): string {
  const candidates = [
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const raw of candidates) {
    const value = raw?.trim();
    // `.env` historically shipped the literal placeholder `MY_APP_URL`.
    if (!value || value === 'MY_APP_URL') continue;
    const url = /^https?:\/\//.test(value) ? value : `https://${value}`;
    return url.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export interface ProvisionParams {
  uid: string;
  tier: PaidTier;
  sessionId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  /** Unix seconds; when absent the period defaults to 30 days from now. */
  currentPeriodEnd?: number | null;
  amountTotal?: number | null;
  currency?: string | null;
}

export interface ProvisionResult {
  tier: PaidTier;
  /** false when this session had already been applied (idempotent replay). */
  applied: boolean;
}

/**
 * Grants a paid tier in a single Firestore transaction, keyed on the Stripe
 * session id so replays are no-ops.
 *
 * Uses `set(..., { merge: true })` rather than `update()`: a brand-new user may
 * not have a `users/{uid}` document yet, and `update()` on a missing doc throws,
 * which previously turned a successful payment into an unrecoverable 500.
 */
export async function provisionSubscription(params: ProvisionParams): Promise<ProvisionResult> {
  const {
    uid,
    tier,
    sessionId,
    customerId,
    subscriptionId,
    currentPeriodEnd,
    amountTotal,
    currency,
  } = params;

  const db = getAdminDb();
  const userRef = db.collection('users').doc(uid);
  const auditRef = db.collection('stripe_transactions').doc(sessionId);

  return db.runTransaction(async (transaction) => {
    const auditSnap = await transaction.get(auditRef);
    if (auditSnap.exists) {
      return { tier, applied: false };
    }

    const periodEnd = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    transaction.set(
      userRef,
      {
        tier,
        proEndDate: periodEnd,
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: subscriptionId ?? null,
        stripeSessionId: sessionId,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    transaction.set(auditRef, {
      uid,
      tier,
      type: 'checkout',
      stripeSessionId: sessionId,
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
      amount: amountTotal ?? null,
      currency: currency ?? null,
      completedAt: new Date(),
    });

    return { tier, applied: true };
  });
}

/** Maps a Stripe price id back to a tier — how portal plan-switches resolve. */
export function tierForPriceId(priceId: string | null | undefined): PaidTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO?.trim()) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_BUILDER?.trim()) return 'builder';
  return null;
}

export interface SubscriptionStateParams {
  uid: string;
  /** Written only when the subscription's price maps to a known tier. */
  tier?: PaidTier | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: number | null;
  /**
   * TE-47: a builder→pro downgrade is *scheduled*, not applied — the user keeps
   * the tier they paid for until the period ends. `undefined` leaves the stored
   * value alone; `null` clears it (the schedule was released or reversed).
   */
  pendingTier?: PaidTier | null;
  /** Unix seconds at which `pendingTier` takes effect. */
  pendingTierDate?: number | null;
}

/**
 * Mirrors a `customer.subscription.updated` event onto the user doc.
 * Deliberately never sets tier to free — deletion/backstop own that, because
 * a dunning or proration update must not strip access the user paid for.
 */
export async function updateSubscriptionState(params: SubscriptionStateParams): Promise<void> {
  const { uid, tier, status, cancelAtPeriodEnd, currentPeriodEnd, pendingTier, pendingTierDate } =
    params;
  const db = getAdminDb();
  const update: Record<string, unknown> = {
    subscriptionStatus: status,
    cancelAtPeriodEnd,
    updatedAt: new Date(),
  };
  if (tier) update.tier = tier;
  if (currentPeriodEnd) update.proEndDate = new Date(currentPeriodEnd * 1000);
  // Explicit null is meaningful here (clear the pending switch), so only an
  // absent key is skipped — `if (pendingTier)` would never clear anything.
  if (pendingTier !== undefined) update.pendingTier = pendingTier;
  if (pendingTierDate !== undefined) {
    update.pendingTierDate = pendingTierDate ? new Date(pendingTierDate * 1000) : null;
  }
  await db.collection('users').doc(uid).set(update, { merge: true });
}

export interface ScheduledTierChange {
  tier: PaidTier | null;
  /** Unix seconds — start of the phase that applies `tier`. */
  effectiveAt: number | null;
}

/**
 * TE-47: reads the pending plan change off a subscription's schedule.
 *
 * A period-end downgrade (portal `schedule_at_period_end`) leaves the
 * subscription on its current price and attaches a schedule whose next phase
 * carries the new one — so `subscription.items[0].price` still reports Builder
 * while the user is on their way to Pro. Without this the UI would show no sign
 * of the change until it silently landed.
 *
 * Returns nulls when there is no schedule, no future phase, or the phase's
 * price is not one of ours — all of which mean "nothing pending".
 */
export async function resolveScheduledTierChange(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<ScheduledTierChange> {
  const none: ScheduledTierChange = { tier: null, effectiveAt: null };

  const scheduleRef = subscription.schedule;
  if (!scheduleRef) return none;

  try {
    const schedule =
      typeof scheduleRef === 'string'
        ? await stripe.subscriptionSchedules.retrieve(scheduleRef)
        : scheduleRef;

    // Released/cancelled schedules describe history, not intent.
    if (schedule.status === 'released' || schedule.status === 'canceled') return none;

    const now = Math.floor(Date.now() / 1000);
    const upcoming = (schedule.phases ?? [])
      .filter((phase) => typeof phase.start_date === 'number' && phase.start_date > now)
      .sort((a, b) => a.start_date - b.start_date)[0];
    if (!upcoming) return none;

    const priceRef = upcoming.items?.[0]?.price;
    const priceId = typeof priceRef === 'string' ? priceRef : (priceRef?.id ?? null);
    const tier = tierForPriceId(priceId);
    if (!tier) return none;

    return { tier, effectiveAt: upcoming.start_date };
  } catch (err) {
    // Best-effort display data — never fail a webhook over it (Stripe retries
    // would then replay a state write that already succeeded).
    console.warn('[stripe] schedule lookup failed:', (err as Error).message);
    return none;
  }
}

/**
 * Reads a subscription's period end across API-version shapes: recent versions
 * moved `current_period_end` from the subscription onto its items.
 */
export function getPeriodEnd(subscription: Stripe.Subscription): number | null {
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof legacy === 'number') return legacy;

  const itemEnd = subscription.items?.data?.[0] as unknown as
    | { current_period_end?: number }
    | undefined;
  return typeof itemEnd?.current_period_end === 'number' ? itemEnd.current_period_end : null;
}

/**
 * TE-69: mirrors a live Stripe subscription onto `users/{uid}` — price → tier,
 * status, period end, and any scheduled switch — in one call.
 *
 * Extracted from the `customer.subscription.updated` handler so the portal can
 * reconcile a user doc that has drifted from Stripe without duplicating the
 * schedule/period-end reading (a second copy would drift in its own way).
 * `updateSubscriptionState` stays the only writer of `tier` on this path, so
 * the exhaustive writer list in docs/PAYMENTS.md is unchanged.
 *
 * Returns the tier the subscription's price maps to, or null when the price is
 * not one of ours (in which case the stored tier is deliberately left alone).
 */
export async function syncSubscriptionToUser(
  stripe: Stripe,
  uid: string,
  subscription: Stripe.Subscription
): Promise<PaidTier | null> {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const tier = tierForPriceId(priceId);
  const scheduled = await resolveScheduledTierChange(stripe, subscription);

  await updateSubscriptionState({
    uid,
    tier,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodEnd: getPeriodEnd(subscription),
    pendingTier: scheduled.tier,
    pendingTierDate: scheduled.effectiveAt,
  });

  return tier;
}

export interface RenewalParams {
  uid: string;
  currentPeriodEnd?: number | null;
  /** Invoice id — the idempotency key for the renewal audit row. */
  invoiceId?: string | null;
  amountPaid?: number | null;
  currency?: string | null;
  subscriptionId?: string | null;
}

/** Extends the paid period after a successful renewal invoice and records
 *  the payment in stripe_transactions (doc id = invoice id, replay-safe). */
export async function extendSubscription(params: RenewalParams): Promise<void> {
  const { uid, currentPeriodEnd, invoiceId, amountPaid, currency, subscriptionId } = params;
  const db = getAdminDb();
  const periodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const batch = db.batch();
  batch.set(
    db.collection('users').doc(uid),
    { proEndDate: periodEnd, subscriptionStatus: 'active', updatedAt: new Date() },
    { merge: true }
  );
  if (invoiceId) {
    batch.set(db.collection('stripe_transactions').doc(invoiceId), {
      uid,
      type: 'renewal',
      stripeSubscriptionId: subscriptionId ?? null,
      amount: amountPaid ?? null,
      currency: currency ?? null,
      completedAt: new Date(),
    });
  }
  await batch.commit();
}

/** Drops a user back to free — subscription cancelled, expired, or refunded. */
export async function downgradeToFree(uid: string) {
  const db = getAdminDb();
  await db.collection('users').doc(uid).set(
    {
      tier: 'free',
      proEndDate: null,
      stripeSubscriptionId: null,
      // The subscription is gone, so any scheduled plan switch went with it —
      // leaving it set would render "switches to Pro" on a free account.
      pendingTier: null,
      pendingTierDate: null,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

/**
 * Finds the Firebase uid behind a Stripe event.
 *
 * Only Checkout Sessions carry our metadata directly. Charges, invoices and
 * subscriptions do not inherit session metadata, so those events previously
 * read `metadata.uid` and always got `undefined`. This walks the available
 * references instead: explicit metadata → subscription metadata → customer
 * metadata → Firestore lookup by stored customer id.
 */
export async function resolveUid(
  stripe: Stripe,
  refs: {
    metadataUid?: string | null;
    subscriptionId?: string | null;
    customerId?: string | null;
  }
): Promise<string | null> {
  if (refs.metadataUid) return refs.metadataUid;

  if (refs.subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(refs.subscriptionId);
      if (subscription.metadata?.uid) return subscription.metadata.uid;
    } catch (err) {
      console.warn('[stripe] subscription lookup failed:', (err as Error).message);
    }
  }

  if (refs.customerId) {
    try {
      // A DeletedCustomer carries no metadata, so the optional chain simply
      // yields undefined for one — no need to discriminate the union.
      const customer = (await stripe.customers.retrieve(refs.customerId)) as Stripe.Customer;
      const customerUid = customer.metadata?.uid;
      if (customerUid) return customerUid;
    } catch (err) {
      console.warn('[stripe] customer lookup failed:', (err as Error).message);
    }

    try {
      const db = getAdminDb();
      const snap = await db
        .collection('users')
        .where('stripeCustomerId', '==', refs.customerId)
        .limit(1)
        .get();
      if (!snap.empty) return snap.docs[0].id;
    } catch (err) {
      console.warn('[stripe] Firestore customer lookup failed:', (err as Error).message);
    }
  }

  return null;
}
