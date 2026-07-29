import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { getAuthContext } from './_lib/auth';
import { getStripe, getAppUrl, getPriceId, StripeConfigError, type PaidTier } from './_lib/stripe';
import { getAdminDb } from './_lib/admin';

/**
 * TE-39 / TE-47: Stripe Customer Portal session.
 *
 * The portal is the ONLY place cancels, plan switches, card updates, and
 * invoice history live — we never rebuild billing UI in-app. The resulting
 * changes flow back through the webhook (`customer.subscription.updated` /
 * `.deleted`), which stays the sole writer of `users/{uid}.tier`.
 *
 * TE-47: an optional `targetTier` in the body deep-links into the flow the user
 * actually asked for, instead of dropping them on the portal homepage to hunt
 * for the plan switcher:
 *
 *   pro → builder   `subscription_update_confirm` — confirm page showing the
 *                   prorated amount due today (portal config: always_invoice)
 *   builder → pro   the same flow; the portal's `schedule_at_period_end`
 *                   condition defers a decreasing amount to the period end
 *   paid → free     `subscription_cancel` — cancel-at-period-end confirmation
 *
 * `targetTier` is a routing hint only. It can never grant anything: the tier
 * still comes from Firestore via the webhook, and an unusable hint degrades to
 * the portal homepage rather than failing the request.
 *
 * TE-48: a hint we *can* build but Stripe then refuses is the opposite case —
 * see `isFlowRejection` below. That is a deployment fault, and it is reported
 * as one.
 */

const KNOWN_TIERS = ['free', 'pro', 'builder'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Hoisted so the catch can tell a refused deep link apart from a bare
  // session failing — the two have different causes and different fixes.
  let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | null = null;

  try {
    const authCtx = await getAuthContext(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(authCtx.uid).get();
    const userData = userDoc.data();
    const customerId = userData?.stripeCustomerId as string | undefined;

    if (!customerId) {
      return res
        .status(404)
        .json({ error: 'No billing account found. Subscribe to a plan first.' });
    }

    const stripe = getStripe();
    const returnUrl = `${getAppUrl()}/?tab=pro`;

    // The tier is read server-side (never from the body) — the hint only says
    // which screen to open, and is discarded unless it is a real transition.
    flowData = await buildFlowData({
      stripe,
      requestedTier: readTargetTier(req.body),
      currentTier: authCtx.tier,
      subscriptionId: userData?.stripeSubscriptionId as string | undefined,
      returnUrl,
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      ...(flowData ? { flow_data: flowData } : {}),
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
    if (isFlowRejection(error, flowData)) {
      console.error(
        '[portal] Stripe refused the requested flow — run `npm run stripe:configure-portal` ' +
          `against this Stripe environment (test *and* live are configured separately): ${message}`
      );
      return res
        .status(503)
        .json({ error: 'Plan changes are temporarily unavailable. Please contact support.' });
    }
    console.error('[portal]', message);
    return res.status(500).json({ error: 'Failed to open the billing portal' });
  }
}

/**
 * TE-48: Stripe rejected the deep link itself.
 *
 * The cause seen in production was a portal configuration with
 * `subscription_update` disabled — the state a Stripe account is in until
 * `npm run stripe:configure-portal` has been run against it. Only the plan
 * switch fails; "Manage billing" and "Downgrade" build sessions the same
 * configuration still allows, which is exactly what makes it look like a bug
 * in the upgrade button.
 *
 * Deliberately *not* retried as a bare session. The portal homepage has no
 * plan switcher while the feature that rejected us is off, so falling back
 * would trade a visible failure for an invisible dead end and leave a broken
 * deployment undetected — the same reason a missing price id is a 503 rather
 * than a degrade.
 */
function isFlowRejection(error: unknown, flowData: unknown): boolean {
  if (!flowData) return false;
  return (error as { type?: string } | null)?.type === 'StripeInvalidRequestError';
}

/** Accepts only the three tier names; anything else means "no hint". */
function readTargetTier(body: unknown): 'free' | PaidTier | null {
  const raw = (body as { targetTier?: unknown } | undefined)?.targetTier;
  return raw === 'free' || raw === 'pro' || raw === 'builder' ? raw : null;
}

interface FlowDataParams {
  stripe: Stripe;
  requestedTier: 'free' | PaidTier | null;
  currentTier: string;
  subscriptionId: string | undefined;
  returnUrl: string;
}

/**
 * Resolves the deep-link flow, or null to open the portal homepage.
 *
 * Runtime failures return null rather than throwing: a user who asked to
 * upgrade should land on a page where they still can, not on an error. The
 * homepage offers the same actions, just with more clicks. A missing price id
 * is the exception — that is an operator misconfiguration and surfaces as a
 * 503, because degrading it would hide a broken deployment.
 */
async function buildFlowData({
  stripe,
  requestedTier,
  currentTier,
  subscriptionId,
  returnUrl,
}: FlowDataParams): Promise<Stripe.BillingPortal.SessionCreateParams.FlowData | null> {
  if (!requestedTier || !subscriptionId) return null;
  // Not a transition — e.g. a bare "Manage billing" press, or a stale UI.
  if (requestedTier === currentTier) return null;
  if (!KNOWN_TIERS.includes(currentTier as (typeof KNOWN_TIERS)[number])) return null;

  const afterCompletion = {
    type: 'redirect' as const,
    redirect: { return_url: returnUrl },
  };

  if (requestedTier === 'free') {
    return {
      type: 'subscription_cancel',
      subscription_cancel: { subscription: subscriptionId },
      after_completion: afterCompletion,
    };
  }

  // A paid↔paid switch needs the *item* to re-price, which only a live
  // subscription can supply.
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    console.warn('[portal] subscription lookup failed:', (err as Error).message);
    return null;
  }

  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return null;
  }

  const items = subscription.items?.data ?? [];
  // Stripe's confirm flow updates at most one item; a multi-item subscription
  // is not something this product creates, but guessing would re-price the
  // wrong line.
  if (items.length !== 1) return null;

  const itemId = items[0]?.id;
  if (!itemId) return null;

  return {
    type: 'subscription_update_confirm',
    subscription_update_confirm: {
      subscription: subscriptionId,
      items: [{ id: itemId, price: getPriceId(requestedTier), quantity: 1 }],
    },
    after_completion: afterCompletion,
  };
}
