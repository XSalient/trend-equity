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
 */
export function getPriceId(tier: PaidTier): string {
  const envVar = tier === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_BUILDER';
  const priceId = process.env[envVar]?.trim();

  if (!priceId || !/^price_[A-Za-z0-9]{8,}$/.test(priceId)) {
    throw new StripeConfigError(
      `${envVar} is missing or malformed (got "${priceId ?? ''}"). Copy the monthly recurring price id from the Stripe dashboard.`
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
}

/**
 * Mirrors a `customer.subscription.updated` event onto the user doc.
 * Deliberately never sets tier to free — deletion/backstop own that, because
 * a dunning or proration update must not strip access the user paid for.
 */
export async function updateSubscriptionState(params: SubscriptionStateParams): Promise<void> {
  const { uid, tier, status, cancelAtPeriodEnd, currentPeriodEnd } = params;
  const db = getAdminDb();
  const update: Record<string, unknown> = {
    subscriptionStatus: status,
    cancelAtPeriodEnd,
    updatedAt: new Date(),
  };
  if (tier) update.tier = tier;
  if (currentPeriodEnd) update.proEndDate = new Date(currentPeriodEnd * 1000);
  await db.collection('users').doc(uid).set(update, { merge: true });
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

/** Extends the paid period after a successful renewal invoice. */
export async function extendSubscription(uid: string, currentPeriodEnd?: number | null) {
  const db = getAdminDb();
  const periodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .collection('users')
    .doc(uid)
    .set({ proEndDate: periodEnd, updatedAt: new Date() }, { merge: true });
}

/** Drops a user back to free — subscription cancelled, expired, or refunded. */
export async function downgradeToFree(uid: string) {
  const db = getAdminDb();
  await db.collection('users').doc(uid).set(
    {
      tier: 'free',
      proEndDate: null,
      stripeSubscriptionId: null,
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
