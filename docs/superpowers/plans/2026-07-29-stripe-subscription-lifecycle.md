# Stripe Subscription Lifecycle (TE-08 Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the subscription lifecycle on top of TE-08 Phase 1 — real downgrades/cancellations via the Stripe Customer Portal, failed-payment handling, expiry enforcement, accurate billing dates, and user-visible subscription state.

**Architecture:** The Stripe webhook and the checkout return-leg remain the only writers of `users/{uid}.tier` (upgrades) — this plan adds the Customer Portal as the only path for cancels/plan-switches (Stripe hosts the UI; our webhook receives the resulting `customer.subscription.updated` / `.deleted` events). A `proEndDate` grace check in `getAuthContext` is the backstop if a webhook is ever missed. All client-side tier mutation code is deleted.

**Tech Stack:** Stripe Node SDK v22 (`api/_lib/stripe.ts`), Vercel serverless + Express BFF shims, Firebase Admin Firestore, React 19 hooks, Vitest.

---

## Background: the audit that produced this plan (2026-07-29)

Observed bug: a Builder test user "downgraded" in the UI, then got `"User already has this tier or higher"` when re-upgrading. Root cause: `handleDowngrade` in `src/hooks/useTier.ts` only calls `setTier()` locally — Firestore still says `builder`, and `api/checkout.ts:57` correctly blocks the request based on the server-side tier. Full findings:

1. **No real downgrade/cancel flow exists** — the only downgrade writer is the `customer.subscription.deleted` webhook, and nothing in the app can trigger it.
2. **Paid→paid tier changes are broken both ways** — Builder→Pro is hard-blocked by the rank check; Pro→Builder through Checkout would create a _second_ subscription (double-billing).
3. **`proEndDate` is written but never read** — a missed webhook leaves a paid tier granted forever.
4. **`proEndDate` is inaccurate at purchase** — always "now + 30 days", never Stripe's real `current_period_end`.
5. **`invoice.payment_failed` and `customer.subscription.updated` are unhandled** — users in dunning keep silent access with no warning; portal cancellations-at-period-end would be invisible until deletion.
6. **No user-visible expiry date or payment history.**

Story mapping: TE-38 (server-truth tier UI), TE-39 (billing portal), TE-40 (lifecycle webhooks), TE-41 (expiry backstop), TE-42 (accurate dates + renewal audit). See `docs/BACKLOG.md` and `DECISIONS.md` (2026-07-29 entry) — read both before starting.

## Stripe Dashboard prerequisites (manual, before Task 3 can be verified live)

1. **Customer Portal configuration** (test mode): https://dashboard.stripe.com/test/settings/billing/portal
   - Enable **Cancel subscriptions** → "at end of billing period".
   - Enable **Switch plans** and add both prices (`STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUILDER`) as switchable products. ~~Proration: default (create prorations).~~
     > **Superseded by TE-47 (2026-07-29).** `create_prorations` books the credit and the charge onto the _next_ invoice, so an upgrade takes no payment at switch time — the user gets the higher tier free until renewal. Do not configure the portal by hand: run `npm run stripe:configure-portal`, which sets `always_invoice` plus `schedule_at_period_end` for downgrades. See `docs/PAYMENTS.md`.
   - Enable invoice history + payment-method update (on by default).
2. **Webhook endpoint** must subscribe to two additional events: `customer.subscription.updated`, `invoice.payment_failed` (alongside the existing `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`).
3. Local testing: `stripe listen --forward-to localhost:3001/api/webhook/stripe`, failing card `4000 0000 0000 0341`, and `stripe trigger customer.subscription.updated`.

## File structure

| File                                    | Change     | Responsibility                                                                                                                               |
| --------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/_lib/stripe.ts`                    | Modify     | + `tierForPriceId`, `updateSubscriptionState`, object-param `extendSubscription` with renewal audit row, `type` field on checkout audit rows |
| `api/portal.ts`                         | **Create** | `POST /api/portal` → Stripe Customer Portal session (9th Vercel function, budget 9/12)                                                       |
| `api/webhook/stripe.ts`                 | Modify     | + `customer.subscription.updated`, `invoice.payment_failed` handlers; real period-end on checkout provisioning                               |
| `api/checkout.ts`                       | Modify     | 409 guard: active subscribers must use the portal; real period-end in `verifySession`                                                        |
| `api/_lib/auth.ts`                      | Modify     | `resolveEffectiveTier` — proEndDate + 3-day grace backstop                                                                                   |
| `server.ts`                             | Modify     | Mount `/api/portal` in the dev BFF (same shim pattern as `/api/checkout`)                                                                    |
| `src/hooks/useTier.ts`                  | Modify     | Delete fake `handleUpgrade`/`handleDowngrade`/`upgradeToBuilder`; expose `SubscriptionInfo` from the user-doc snapshot                       |
| `src/App.tsx`                           | Modify     | Drop dead handler wiring; `onUpgradeToBuilder` routes to pricing tab; pass `subscription` down                                               |
| `src/components/PricingSection.tsx`     | Modify     | Downgrade/plan-switch buttons open the portal; show renew/expiry date; "Manage billing" button                                               |
| `tests/unit/api/portal.test.ts`         | **Create** | Portal endpoint unit tests                                                                                                                   |
| `tests/unit/api/webhook-stripe.test.ts` | Modify     | New event handlers + updated `extendSubscription` call shape                                                                                 |
| `tests/unit/api/checkout.test.ts`       | Modify     | 409-guard tests                                                                                                                              |
| `tests/unit/api/stripe-lib.test.ts`     | Modify     | `tierForPriceId`, `updateSubscriptionState`, renewal audit                                                                                   |
| `tests/unit/api/auth-tier.test.ts`      | **Create** | `resolveEffectiveTier` tests                                                                                                                 |

**Conventions for every task:** run `npm run test:unit` and `npm run check` before each commit. Commit format `feat(stripe): TE-NN — <what>` plus the Co-Author line from CLAUDE.md. Update `docs/BACKLOG.md` status in the same commit that starts/finishes a story (TE-33 merged workflow).

---

### Task 1: `SubscriptionInfo` from the user-doc snapshot (TE-38, part 1)

**Files:**

- Modify: `src/hooks/useTier.ts`

- [x] **Step 1: Add the type and state.** In `src/hooks/useTier.ts`, add above `export function useTier`:

```ts
export interface SubscriptionInfo {
  /** End of the paid period (renewal date, or expiry if cancelAtPeriodEnd). */
  proEndDate: Date | null;
  /** True when the user cancelled in the portal but the period hasn't ended. */
  cancelAtPeriodEnd: boolean;
  /** Raw Stripe subscription status: active | past_due | canceled | … */
  status: string | null;
  /** True once a Stripe customer exists — gates the "Manage billing" button. */
  hasBillingAccount: boolean;
}

const EMPTY_SUBSCRIPTION: SubscriptionInfo = {
  proEndDate: null,
  cancelAtPeriodEnd: false,
  status: null,
  hasBillingAccount: false,
};
```

Inside the hook add `const [subscription, setSubscription] = useState<SubscriptionInfo>(EMPTY_SUBSCRIPTION);`

- [x] **Step 2: Populate it in the existing `onSnapshot` callback.** In the `docSnap.exists()` branch (after `setIsAdmin`):

```ts
const end = data.proEndDate;
setSubscription({
  proEndDate: end && typeof end.toDate === 'function' ? end.toDate() : end ? new Date(end) : null,
  cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
  status: (data.subscriptionStatus as string) ?? null,
  hasBillingAccount: Boolean(data.stripeCustomerId),
});
```

In the `else` (doc missing), permission-denied, and signed-out branches add `setSubscription(EMPTY_SUBSCRIPTION);` alongside the existing `setTier('free')` calls. Add `subscription` to the hook's return object.

- [x] **Step 3: Verify.** Run: `npm run check` — expect 0 errors (no tests cover this hook; it's exercised via Task 5's UI and the E2E suite).

- [x] **Step 4: Commit** — `feat(stripe): TE-38 — expose subscription info (proEndDate, cancelAtPeriodEnd, status) from useTier`

---

### Task 2: Delete client-side tier mutations (TE-38, part 2)

The bug's root cause. After this task the client can _never_ change `tier` state except via the Firestore snapshot.

**Files:**

- Modify: `src/hooks/useTier.ts`
- Modify: `src/App.tsx:56`, `src/App.tsx:249-252`, `src/App.tsx:527-534`
- Modify: `src/components/PricingSection.tsx` (props only — behavior replaced in Task 5)

- [x] **Step 1: Remove the dead handlers from `useTier.ts`.** Delete `handleUpgrade`, `handleDowngrade`, `upgradeToBuilder`, the `notify` helper, and `tierNotification` state (its only writers are the deleted handlers). Also delete `setTier` from the return object (keep it internal for the mockTier branch). New return: `{ tier, isAdmin, subscription }`.

- [x] **Step 2: Update `App.tsx`.**
  - Line 56: `const { tier, isAdmin, subscription } = useTier(user);`
  - `onUpgradeToBuilder` (line 249): replace the `upgradeToBuilder(handleLogin)` call:

```ts
const onUpgradeToBuilder = () => {
  logEvent('upgrade_click', { fromTier: tier, toTier: 'builder' });
  if (!user) {
    handleLogin();
    return;
  }
  setActiveTab('pro'); // real upgrades happen via Stripe checkout on the pricing tab
};
```

- PricingSection call site (line 527): drop `onUpgrade`/`onDowngrade`, pass `subscription={subscription}`.
- Grep for remaining references and remove their render sites (the `tierNotification` toast block):

Run: `npx eslint src/App.tsx src/hooks/useTier.ts` — unused-variable errors point at any leftovers.

- [x] **Step 3: Update `PricingSection.tsx` props** so the app compiles: remove `onUpgrade`/`onDowngrade` from `PricingSectionProps` and the destructure; add `subscription?: SubscriptionInfo` (import the type from `../hooks/useTier`). Temporarily make `confirmDowngrade` a no-op that closes the modal (`setPendingDowngrade(null)`) — Task 5 wires it to the portal.

- [x] **Step 4: Verify.** Run: `npm run check` — expect 0 errors. Run: `npm run test:unit` — expect all green (no unit tests reference the deleted symbols).

- [x] **Step 5: Commit** — `feat(stripe): TE-38 — remove client-side tier mutations (fake downgrade caused desynced tier state)`

---

### Task 3: Billing-portal endpoint (TE-39, part 1)

**Files:**

- Create: `api/portal.ts`
- Create: `tests/unit/api/portal.test.ts`
- Modify: `server.ts` (mount the route in the dev BFF, same as `/api/checkout`)

- [x] **Step 1: Write the failing tests** — `tests/unit/api/portal.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../../api/_lib/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../../api/_lib/stripe', async () => {
  const actual = await vi.importActual<typeof import('../../../api/_lib/stripe')>(
    '../../../api/_lib/stripe'
  );
  return {
    StripeConfigError: actual.StripeConfigError,
    getStripe: vi.fn(),
    getAppUrl: vi.fn(() => 'https://trend-equity.vercel.app'),
  };
});

vi.mock('../../../api/_lib/admin', () => ({
  getAdminDb: vi.fn(),
}));

import handler from '../../../api/portal';
import { getAuthContext } from '../../../api/_lib/auth';
import { getStripe, StripeConfigError } from '../../../api/_lib/stripe';
import { getAdminDb } from '../../../api/_lib/admin';

describe('POST /api/portal', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let stripeClient: any;

  const authedPro = { uid: 'user123', tier: 'pro', isAdmin: false };

  const mockUserDoc = (data: Record<string, unknown> | undefined) => {
    (getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: !!data, data: () => data }),
        })),
      })),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { method: 'POST', headers: { authorization: 'Bearer token123' } };
    mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    stripeClient = {
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session_123' }),
        },
      },
    };
    (getStripe as any).mockReturnValue(stripeClient);
    (getAuthContext as any).mockResolvedValue(authedPro);
    mockUserDoc({ stripeCustomerId: 'cus_123' });
  });

  it('rejects non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 for unauthenticated requests', async () => {
    (getAuthContext as any).mockResolvedValue(null);
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when the user has no Stripe customer', async () => {
    mockUserDoc({ tier: 'free' });
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('creates a portal session for the stored customer and returns its url', async () => {
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(stripeClient.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://trend-equity.vercel.app/?tab=pro',
    });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ url: 'https://billing.stripe.com/p/session_123' });
  });

  it('returns 503 when Stripe is not configured', async () => {
    (getStripe as any).mockImplementation(() => {
      throw new StripeConfigError('STRIPE_SECRET_KEY is missing');
    });
    await handler(mockReq as VercelRequest, mockRes as VercelResponse);
    expect(mockRes.status).toHaveBeenCalledWith(503);
  });
});
```

- [x] **Step 2: Run tests to verify they fail.** Run: `npx vitest run tests/unit/api/portal.test.ts` — Expected: FAIL ("Cannot find module '../../../api/portal'").

- [x] **Step 3: Implement `api/portal.ts`:**

```ts
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
```

- [x] **Step 4: Run tests to verify they pass.** Run: `npx vitest run tests/unit/api/portal.test.ts` — Expected: 5 passed.

- [x] **Step 5: Mount in the dev BFF.** In `server.ts`, find where `/api/checkout` is mounted (search `checkout`) and mirror it exactly for `/api/portal` with the new handler (same dynamic-import/shim style used there).

- [x] **Step 6: Commit** — `feat(stripe): TE-39 — POST /api/portal creates a Customer Portal session`

---

### Task 4: Checkout guard — active subscribers must use the portal (TE-39, part 2)

Prevents the double-subscription bug when a Pro user buys Builder through Checkout.

**Files:**

- Modify: `api/checkout.ts` (POST branch, after the tier-rank check at line 57-59)
- Modify: `tests/unit/api/checkout.test.ts`

- [x] **Step 1: Write the failing test** (add to the `POST — create session` describe block; the file already mocks `../../../api/_lib/admin`? It does not — add the same `vi.mock('../../../api/_lib/admin', …)` and `mockUserDoc` helper as in `portal.test.ts`, and make `beforeEach` default to `mockUserDoc({})`):

```ts
it('returns 409 with usePortal for a user who already has an active subscription', async () => {
  (getAuthContext as any).mockResolvedValue({ ...authedFree, tier: 'pro' });
  mockUserDoc({ tier: 'pro', stripeSubscriptionId: 'sub_123' });
  mockReq.body = { tier: 'builder' };
  await handler(mockReq as VercelRequest, mockRes as VercelResponse);
  expect(mockRes.status).toHaveBeenCalledWith(409);
  expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ usePortal: true }));
  expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run it.** Run: `npx vitest run tests/unit/api/checkout.test.ts` — Expected: the new test FAILS (200 instead of 409); pre-existing tests may also fail on the unmocked admin module — fix by mocking as described.

- [x] **Step 3: Implement.** In `api/checkout.ts` add `import { getAdminDb } from './_lib/admin';` and insert after the rank check:

```ts
// A live subscription must be changed in the Customer Portal — a second
// Checkout would create a second Stripe subscription and double-bill.
const userSnap = await getAdminDb().collection('users').doc(authCtx.uid).get();
if (userSnap.data()?.stripeSubscriptionId) {
  return res.status(409).json({
    error: 'You already have an active subscription. Use “Manage billing” to change plans.',
    usePortal: true,
  });
}
```

(`downgradeToFree` nulls `stripeSubscriptionId`, so lapsed users can re-subscribe through Checkout normally.)

- [x] **Step 4: Run the whole file.** Run: `npx vitest run tests/unit/api/checkout.test.ts` — Expected: all pass.

- [x] **Step 5: Commit** — `feat(stripe): TE-39 — reject checkout for users with a live subscription (portal handles plan changes)`

---

### Task 5: Pricing UI — portal wiring + subscription visibility (TE-39, part 3)

**Files:**

- Modify: `src/components/PricingSection.tsx`

- [x] **Step 1: Add portal state + opener** inside the component:

```ts
const [portalBusy, setPortalBusy] = useState(false);
const [portalError, setPortalError] = useState<string | null>(null);

const openPortal = async () => {
  if (!firebaseToken || portalBusy) return;
  setPortalBusy(true);
  setPortalError(null);
  try {
    const res = await fetch('/api/portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${firebaseToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url; // Stripe-hosted; changes return via webhook
      return;
    }
    setPortalError(data.error ?? 'Could not open the billing portal. Please try again.');
  } catch {
    setPortalError('Could not open the billing portal. Please try again.');
  } finally {
    setPortalBusy(false);
  }
};
```

- [x] **Step 2: Reroute the three tier-change buttons.**
  - Free card (`line ~202`): `handleDowngradeClick('free')` stays (the "features you'll lose" modal is good retention UX) — but `confirmDowngrade` becomes:

```ts
const confirmDowngrade = () => {
  setPendingDowngrade(null);
  void openPortal();
};
```

- Pro card (`line ~259`): `builder → pro` keeps `handleDowngradeClick('pro')` (same confirm-then-portal flow).
- Builder card (`line ~321`): current code opens Checkout for _any_ non-builder plan. Split it: `free` → Checkout modal (unchanged); `pro` → `void openPortal()` (plan switch with proration, no second subscription).

- [x] **Step 3: Show subscription state on the current-plan card.** Under the "Current" badge area of whichever card matches `currentPlan` (extract a small helper above the return):

```tsx
const renewalLine =
  subscription?.proEndDate && currentPlan !== 'free' ? (
    <p className="text-[10px] text-zinc-500">
      {subscription.cancelAtPeriodEnd
        ? `Ends ${subscription.proEndDate.toLocaleDateString()}`
        : `Renews ${subscription.proEndDate.toLocaleDateString()}`}
      {subscription.status === 'past_due' && (
        <span className="text-red-400 font-bold"> · payment issue</span>
      )}
    </p>
  ) : null;
```

Render `{currentPlan === 'pro' && renewalLine}` / `{currentPlan === 'builder' && renewalLine}` under the respective price. Below the three cards, when `subscription?.hasBillingAccount`, render:

```tsx
<div className="text-center space-y-2">
  <button
    onClick={() => void openPortal()}
    disabled={portalBusy}
    className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all disabled:opacity-50"
  >
    {portalBusy ? 'Opening…' : 'Manage billing'}
  </button>
  <p className="text-[10px] text-zinc-600">
    Invoices, payment methods, plan changes & cancellation — via Stripe
  </p>
  {portalError && <p className="text-[10px] text-red-400">{portalError}</p>}
</div>
```

- [x] **Step 4: Verify in the browser.** Run: `npm run dev`, sign in as the test user, open the pricing tab. Expect: "Manage billing" appears only when `stripeCustomerId` exists; downgrade buttons open the confirm modal and then redirect to the Stripe portal (with test keys configured). `npm run check` clean.

- [x] **Step 5: Commit** — `feat(stripe): TE-39 — pricing tab drives downgrades/plan switches through the Customer Portal, shows renewal date`

---

### Task 6: Webhook — `customer.subscription.updated` (TE-40, part 1)

Propagates portal plan-switches, cancel-at-period-end flags, and status changes into Firestore. **Never writes `tier: 'free'`** — only `customer.subscription.deleted` (existing) and the TE-41 backstop end access.

**Files:**

- Modify: `api/_lib/stripe.ts` (+ `tierForPriceId`, `updateSubscriptionState`)
- Modify: `api/webhook/stripe.ts`
- Modify: `tests/unit/api/stripe-lib.test.ts`, `tests/unit/api/webhook-stripe.test.ts`

- [x] **Step 1: Failing lib tests** — add to `tests/unit/api/stripe-lib.test.ts` (follow the file's existing admin-mock pattern for `updateSubscriptionState`):

```ts
describe('tierForPriceId', () => {
  it('maps configured price ids to tiers', () => {
    process.env.STRIPE_PRICE_PRO = 'price_pro_123';
    process.env.STRIPE_PRICE_BUILDER = 'price_builder_456';
    expect(tierForPriceId('price_pro_123')).toBe('pro');
    expect(tierForPriceId('price_builder_456')).toBe('builder');
    expect(tierForPriceId('price_unknown')).toBeNull();
    expect(tierForPriceId(undefined)).toBeNull();
  });
});
```

- [x] **Step 2: Run.** `npx vitest run tests/unit/api/stripe-lib.test.ts` — Expected: FAIL (`tierForPriceId` not exported).

- [x] **Step 3: Implement in `api/_lib/stripe.ts`:**

```ts
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
 * Deliberately never sets tier to free — deletion/backstop own that.
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
```

- [x] **Step 4: Failing webhook test** — add to `tests/unit/api/webhook-stripe.test.ts` (extend the stripe-lib mock at the top with `tierForPriceId: actual.tierForPriceId` and `updateSubscriptionState: vi.fn()`):

```ts
it('mirrors subscription.updated onto the user doc (plan switch + cancel flag)', async () => {
  process.env.STRIPE_PRICE_BUILDER = 'price_builder_456';
  (resolveUid as any).mockResolvedValue('user123');
  stripeClient.webhooks.constructEvent.mockReturnValue({
    type: 'customer.subscription.updated',
    data: {
      object: {
        customer: 'cus_123',
        status: 'active',
        cancel_at_period_end: true,
        metadata: { uid: 'user123' },
        items: { data: [{ price: { id: 'price_builder_456' }, current_period_end: 1799999999 }] },
      },
    },
  });

  await handler(mockReq as VercelRequest, mockRes as VercelResponse);

  expect(updateSubscriptionState).toHaveBeenCalledWith({
    uid: 'user123',
    tier: 'builder',
    status: 'active',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: 1799999999,
  });
  expect(mockRes.status).toHaveBeenCalledWith(200);
});
```

- [x] **Step 5: Implement the handler** in `api/webhook/stripe.ts` — add the switch case and function:

```ts
case 'customer.subscription.updated':
  return await onSubscriptionUpdated(stripe, event.data.object as Stripe.Subscription, res);
```

```ts
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
  await updateSubscriptionState({
    uid,
    tier: tierForPriceId(priceId),
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodEnd: getPeriodEnd(subscription),
  });

  console.log(`✓ Subscription state synced for user ${uid} (${subscription.status})`);
  return res.status(200).json({ received: true });
}
```

Import `tierForPriceId` and `updateSubscriptionState` from `../_lib/stripe`.

- [x] **Step 6: Run.** `npx vitest run tests/unit/api/webhook-stripe.test.ts tests/unit/api/stripe-lib.test.ts` — Expected: all pass.

- [x] **Step 7: Commit** — `feat(stripe): TE-40 — handle customer.subscription.updated (plan switches, cancel-at-period-end, status)`

---

### Task 7: Webhook — `invoice.payment_failed` (TE-40, part 2)

**Files:**

- Modify: `api/webhook/stripe.ts`
- Modify: `tests/unit/api/webhook-stripe.test.ts`

- [x] **Step 1: Failing test** (mock `../../_lib/admin` in this file if not already; simplest is asserting the handler acks and reads the invoice — the Firestore write shape is covered by inspection + the transaction test below):

```ts
it('acks invoice.payment_failed and marks the user past_due with an alert', async () => {
  (resolveUid as any).mockResolvedValue('user123');
  const txSet = vi.fn();
  const txGet = vi.fn().mockResolvedValue({ exists: false });
  (getAdminDb as any).mockReturnValue({
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: 'ref' })) })),
    runTransaction: vi.fn(async (fn: any) => fn({ get: txGet, set: txSet })),
  });
  stripeClient.webhooks.constructEvent.mockReturnValue({
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_123', customer: 'cus_123', subscription: 'sub_123' } },
  });

  await handler(mockReq as VercelRequest, mockRes as VercelResponse);

  expect(txSet).toHaveBeenCalledTimes(2); // user doc + alert doc
  expect(mockRes.status).toHaveBeenCalledWith(200);
});
```

(Add `vi.mock('../../../api/_lib/admin', () => ({ getAdminDb: vi.fn() }));` and its import at the top of the test file; give the other tests a default `getAdminDb` mock in `beforeEach` so they keep passing.)

- [x] **Step 2: Implement.** In `api/webhook/stripe.ts` add `import { getAdminDb } from '../_lib/admin';`, the switch case:

```ts
case 'invoice.payment_failed':
  return await onInvoicePaymentFailed(stripe, event.data.object as Stripe.Invoice, res);
```

and the handler:

```ts
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
```

(The alert doc matches the `Alert` shape in `src/types.ts:160` and the `userId`/`timestamp`/`isRead` fields `useAlerts.ts` queries on.)

- [x] **Step 3: Run.** `npx vitest run tests/unit/api/webhook-stripe.test.ts` — Expected: all pass.

- [x] **Step 4: Commit** — `feat(stripe): TE-40 — handle invoice.payment_failed (past_due flag + user alert, dedup on invoice id)`

---

### Task 8: Expiry backstop in `getAuthContext` (TE-41)

If the `subscription.deleted` webhook is ever missed, paid access still ends: any request after `proEndDate + 3 days` resolves as `free`. Admin-granted tiers (no `proEndDate`) never expire.

**Files:**

- Modify: `api/_lib/auth.ts`
- Create: `tests/unit/api/auth-tier.test.ts`

- [x] **Step 1: Failing tests** — `tests/unit/api/auth-tier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveEffectiveTier } from '../../../api/_lib/auth';

const DAY = 24 * 60 * 60 * 1000;
const ts = (millis: number) => ({ toMillis: () => millis }); // Firestore Timestamp shape

describe('resolveEffectiveTier', () => {
  it('returns free for missing or invalid data', () => {
    expect(resolveEffectiveTier(undefined)).toBe('free');
    expect(resolveEffectiveTier({ tier: 'enterprise' })).toBe('free');
  });

  it('keeps a paid tier inside the period and inside the grace window', () => {
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: ts(Date.now() + DAY) })).toBe('pro');
    expect(resolveEffectiveTier({ tier: 'builder', proEndDate: ts(Date.now() - 2 * DAY) })).toBe(
      'builder'
    ); // grace: webhook may still land
  });

  it('drops to free past proEndDate + 3-day grace', () => {
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: ts(Date.now() - 4 * DAY) })).toBe(
      'free'
    );
  });

  it('never expires manual grants without a proEndDate', () => {
    expect(resolveEffectiveTier({ tier: 'builder' })).toBe('builder');
    expect(resolveEffectiveTier({ tier: 'builder', proEndDate: null })).toBe('builder');
  });
});
```

- [x] **Step 2: Run.** `npx vitest run tests/unit/api/auth-tier.test.ts` — Expected: FAIL (not exported).

- [x] **Step 3: Implement in `api/_lib/auth.ts`:**

```ts
/** Grace after proEndDate before paid access lapses — covers a missed webhook
 *  without punishing users for Stripe retry latency. */
const EXPIRY_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * TE-41 backstop: the tier a request actually gets. Admin grants (paid tier,
 * no proEndDate) never expire; Stripe-provisioned tiers lapse to free once
 * proEndDate + grace has passed, even if `customer.subscription.deleted`
 * never arrived.
 */
export function resolveEffectiveTier(
  data: Record<string, unknown> | undefined
): AuthContext['tier'] {
  const raw = (data?.tier ?? 'free') as string;
  if (!(['free', 'pro', 'builder'] as const).includes(raw as AuthContext['tier'])) return 'free';
  if (raw === 'free') return 'free';

  const end = data?.proEndDate as { toMillis?: () => number } | Date | null | undefined;
  if (!end) return raw as AuthContext['tier'];
  const endMs =
    typeof (end as { toMillis?: () => number }).toMillis === 'function'
      ? (end as { toMillis: () => number }).toMillis()
      : new Date(end as Date).getTime();
  if (Number.isFinite(endMs) && Date.now() > endMs + EXPIRY_GRACE_MS) return 'free';
  return raw as AuthContext['tier'];
}
```

Then replace the inline tier resolution in `getAuthContext` (lines 53-56) with:

```ts
const tier = resolveEffectiveTier(userDoc.exists ? userDoc.data() : undefined);
```

- [x] **Step 4: Run everything.** `npm run test:unit` — Expected: all pass (existing auth-dependent tests unaffected: they stub `getAuthContext` itself).

- [x] **Step 5: Commit** — `feat(stripe): TE-41 — enforce proEndDate (+3d grace) as tier backstop in getAuthContext`

---

### Task 9: Accurate period end + renewal audit rows (TE-42)

**Files:**

- Modify: `api/_lib/stripe.ts` (`extendSubscription` object params + audit row; `type: 'checkout'` on provision rows)
- Modify: `api/webhook/stripe.ts` (`onCheckoutCompleted` + `onInvoicePaid`), `api/checkout.ts` (`verifySession`)
- Modify: `tests/unit/api/webhook-stripe.test.ts`, `tests/unit/api/stripe-lib.test.ts`

- [x] **Step 1: Change `extendSubscription`** in `api/_lib/stripe.ts` to:

```ts
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
```

Update the caller in `onInvoicePaid` (`api/webhook/stripe.ts:128`):

```ts
await extendSubscription({
  uid,
  currentPeriodEnd: periodEnd,
  invoiceId: invoice.id,
  amountPaid: invoice.amount_paid,
  currency: invoice.currency,
  subscriptionId,
});
```

Update the existing renewal test in `webhook-stripe.test.ts` to expect this object shape, and any `extendSubscription` tests in `stripe-lib.test.ts` to the new signature.

- [x] **Step 2: Tag checkout audit rows.** In `provisionSubscription`, add `type: 'checkout',` to the `auditRef` payload so history rows are distinguishable from renewals.

- [x] **Step 3: Real period end at purchase.** In both `onCheckoutCompleted` (webhook) and `verifySession` (`api/checkout.ts`), before calling `provisionSubscription`, resolve the true period end (both scopes already have a `stripe` client — in `verifySession` it's the local `stripe` const):

```ts
let currentPeriodEnd: number | null = null;
if (subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    currentPeriodEnd = getPeriodEnd(subscription);
  } catch (err) {
    console.warn('[stripe] period-end lookup failed:', (err as Error).message);
  }
}
```

and pass `currentPeriodEnd` into the `provisionSubscription` call (the param already exists). In `onCheckoutCompleted`, note the handler signature must gain the `stripe` client: change the switch case to `onCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session, res)` and the function signature to match. Import `getPeriodEnd` in `api/checkout.ts`.

- [x] **Step 4: Run everything.** `npm run test:unit` — Expected: all pass after the call-shape updates. `npm run check` — clean.

- [x] **Step 5: Commit** — `feat(stripe): TE-42 — real current_period_end at provisioning + renewal audit rows in stripe_transactions`

---

### Task 10: Rules verification, live smoke test, ship

- [x] **Step 1: Firestore rules.** Confirm the client cannot write any billing field. Run: `npx vitest run tests/unit/firestore.test.ts` and inspect the `users` match block in `firestore.rules` — the safe-field allowlist (TE-12) must NOT include `tier`, `proEndDate`, `cancelAtPeriodEnd`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`. If any new field is writable, extend the rules test with an `assertFails` case and tighten the rule.

- [ ] **Step 2: End-to-end sandbox test** (requires `STRIPE_SECRET_KEY` — still the blocking item from Phase 1):
  1. `npm run dev` + `stripe listen --forward-to localhost:3001/api/webhook/stripe`
  2. Fresh free user → upgrade Pro (card `4242…`) → tier flips, "Renews {date}" shows the real Stripe date.
  3. "Manage billing" → portal → switch to Builder → back in app, tier = builder (via `subscription.updated`).
  4. Portal → cancel → app shows "Ends {date}"; `stripe trigger customer.subscription.deleted` → tier = free, checkout works again (guard cleared).
  5. `stripe trigger invoice.payment_failed` → alert appears in the bell, user doc `subscriptionStatus: 'past_due'`.
  6. Manually set `proEndDate` 4 days back on a paid user → any API call resolves tier free (TE-41).

- [x] **Step 3: Docs + ship.** Update `docs/BACKLOG.md` (TE-38…42 → Recently shipped), `CHANGELOG.md`, and `DECISIONS.md` if anything deviated from this plan — same commit. `git push origin main`, verify live at https://trend-equity.vercel.app within ~2 min (post-story checklist).

---

## Explicitly out of scope (do not build)

- **Custom in-app billing UI** (invoice lists, card forms) — the portal owns all of it; see DECISIONS.md 2026-07-29.
- **Refund/dispute webhooks** (`charge.refunded`, `charge.dispute.created`) — deferred until there is a real customer; manual dashboard handling + `downgradeToFree` suffices at current scale.
- **A cron for expiry** — Vercel Hobby allows 2 cron jobs and both slots are taken (daily generation 06:30, digest 07:00); the `getAuthContext` backstop costs nothing and runs on every request anyway.
- **Annual plans, trials, coupons** — per the 2026-07-08 P2 decision.
