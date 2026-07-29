# Payments, Tiers & Subscription Lifecycle

Canonical reference for how money and tiers work in Trend-Equity. If code and this doc disagree, fix one of them in the same PR. Implementation plan for the lifecycle work: [2026-07-29 Stripe subscription lifecycle](superpowers/plans/2026-07-29-stripe-subscription-lifecycle.md). Decisions: `DECISIONS.md` (2026-07-28 and 2026-07-29 entries).

## The one rule

**`users/{uid}.tier` is written exclusively server-side by Stripe-driven code paths.** The client renders whatever the Firestore snapshot says (`useTier` → `onSnapshot`) and never mutates tier state locally — not optimistically, not for mocking outside dev mode, not "temporarily". The 2026-07-29 "already has this tier or higher" bug was exactly a client-side tier mutation desyncing UI from server truth.

## Tier writers (exhaustive list)

| Writer                                           | Direction             | Trigger                                                                                                                     |
| ------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `provisionSubscription()` (`api/_lib/stripe.ts`) | free → pro/builder    | `checkout.session.completed` webhook **or** `GET /api/checkout?session_id=` return leg (idempotent, dedup key = session id) |
| `updateSubscriptionState()`                      | pro ↔ builder         | `customer.subscription.updated` webhook (Customer Portal plan switch; price id → tier via `tierForPriceId`)                 |
| `downgradeToFree()`                              | paid → free           | `customer.subscription.deleted` webhook (portal cancel at period end, dashboard cancel, dunning exhaustion)                 |
| `resolveEffectiveTier()` (`api/_lib/auth.ts`)    | paid → free (virtual) | Per-request backstop: `proEndDate` + 3-day grace elapsed. Doesn't write the doc; the request just resolves as free          |
| Admin (Firestore console)                        | any                   | Manual grants. Leave `proEndDate` unset/null — manual grants never expire                                                   |

Anything else writing `tier` is a bug.

## User-doc billing fields (`users/{uid}`)

| Field                  | Type                           | Meaning                                                                                                             |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `tier`                 | `'free' \| 'pro' \| 'builder'` | Source of truth for entitlements                                                                                    |
| `proEndDate`           | Timestamp \| null              | End of paid period. Renewal date normally; expiry date when `cancelAtPeriodEnd`. Null for manual grants             |
| `cancelAtPeriodEnd`    | boolean                        | User cancelled in the portal; access continues until `proEndDate`                                                   |
| `subscriptionStatus`   | string \| null                 | Raw Stripe status (`active`, `past_due`, …) — display/diagnostics only, never an entitlement check                  |
| `stripeCustomerId`     | string \| null                 | Gates the "Manage billing" button; portal session key; uid lookup fallback for webhooks                             |
| `stripeSubscriptionId` | string \| null                 | Non-null = live subscription → checkout returns 409 (plan changes must use the portal). Nulled by `downgradeToFree` |
| `stripeSessionId`      | string                         | Last applied checkout session                                                                                       |

Firestore rules must keep every one of these fields client-unwritable (TE-12 safe-field allowlist).

## Payment history & audit: `stripe_transactions/{id}`

Append-only ledger, server-written, doubles as the idempotency store:

- **Checkout rows** — doc id = Checkout Session id, `type: 'checkout'`. Existence of the doc is what makes provisioning replay-safe.
- **Renewal rows** — doc id = Invoice id, `type: 'renewal'`.
- Fields: `uid`, `tier` (checkout only), `amount`, `currency`, `stripeCustomerId`/`stripeSubscriptionId`, `completedAt`.

**User-facing payment history is NOT built from this collection.** Users get invoices, receipts, and payment methods from the Stripe Customer Portal (`POST /api/portal`). `stripe_transactions` is for internal audit, support queries, and revenue reporting.

## Lifecycle flows

### Successful purchase (free → paid)

Pricing tab → `POST /api/checkout` (server re-checks tier + no live subscription) → Stripe-hosted Checkout → both provisioning paths race idempotently (webhook + return leg) → `tier`, `proEndDate` (real `current_period_end`), Stripe ids written in one transaction → UI updates live via `onSnapshot`.

### Renewal

`invoice.payment_succeeded` → `extendSubscription()` → new `proEndDate`, `subscriptionStatus: 'active'`, renewal audit row.

### Failed renewal payment

`invoice.payment_failed` → user doc `subscriptionStatus: 'past_due'` + `user_alerts` doc ("update your payment method", dedup on invoice id). **Tier is NOT dropped here** — Stripe dunning retries run their course. Access ends via `subscription.deleted` (if Stripe cancels) or the `proEndDate` grace backstop, whichever comes first.

### Cancel / downgrade to free

Only through the Customer Portal (cancel at period end). Immediately: `customer.subscription.updated` sets `cancelAtPeriodEnd: true` → UI shows "Ends {date}". At period end (anchored to the subscription start date): `customer.subscription.deleted` → `downgradeToFree()`. The user keeps paid access for the time already paid — never revoke early.

### Plan switch (pro ↔ builder)

Only through the Customer Portal (Stripe prorates automatically). `customer.subscription.updated` carries the new price id → `tierForPriceId` → tier updated. Checkout must never be used by a live subscriber (409 guard) — it would create a second subscription and double-bill.

### Expiry backstop

`getAuthContext` resolves a paid tier as `free` once `proEndDate + 3 days` has passed — the safety net for a missed `subscription.deleted` webhook. No cron (both Vercel Hobby cron slots are taken).

## What the user sees

| Surface                                              | Data source                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tier gates (what the visitor may do)                 | `useTier().tier` (Firestore snapshot) — `'free'` for anonymous visitors too               |
| Current plan badge / "CURRENT PLAN" CTA              | `useTier().tier` **and** `useTier().hasAccount` — no account, no plan claim (TE-44)       |
| "Renews {date}" / "Ends {date}" / "payment issue"    | `useTier().subscription` (`proEndDate`, `cancelAtPeriodEnd`, `status`) on the pricing tab |
| Invoices, receipts, card update, cancel, plan switch | Stripe Customer Portal via "Manage billing" (`POST /api/portal`)                          |
| Payment-failure warning                              | Alerts bell (`user_alerts` doc written by the webhook)                                    |
| Post-checkout confirmation                           | `useCheckout` banner (verify return leg)                                                  |

## Do / Avoid

**Do**

- Route every tier check through server-side `getAuthContext` / `requireTier`; treat client tier as display-only.
- Key every Stripe-driven write on a Stripe object id (session id, invoice id) so webhook retries and path races are no-ops.
- Return 200 from the webhook for permanently-unprocessable events (missing metadata, unknown uid) and 5xx only for transient failures — Stripe retries non-2xx.
- Resolve uid via the `resolveUid` chain (metadata → subscription → customer → Firestore) — only Checkout Sessions carry our metadata directly.
- Read subscription period ends via `getPeriodEnd()` (handles the API-version move of `current_period_end` onto items).
- Keep the portal return URL and checkout success/cancel URLs on `getAppUrl()` (APP_URL wins over VERCEL_URL).

**Avoid**

- Client-side tier mutation of any kind (the deleted `handleDowngrade` bug class).
- Building in-app billing UI the portal already provides (invoices, card forms, cancel dialogs).
- Creating a Checkout session for a user with a live `stripeSubscriptionId` (double-billing).
- Dropping tier on `invoice.payment_failed` or `past_due` status (dunning may still recover the payment).
- Writing `tier: 'free'` from `customer.subscription.updated` (deletion and the backstop own downgrades).
- Trusting `?checkout=success` or any client-supplied query param as payment proof.
- Adding new top-level `api/**/*.ts` files without checking the Vercel Hobby 12-function budget (9/12 after `api/portal.ts`).

## Environment & external setup

Env vars (`.env` locally, Doppler/Vercel for deploys): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUILDER`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`.

Stripe dashboard (test + live): webhook endpoint `{APP_URL}/api/webhook/stripe` subscribed to `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`; Customer Portal configured with period-end cancellation and plan switching between the two prices.

Local testing: `stripe listen --forward-to localhost:3001/api/webhook/stripe`; success card `4242 4242 4242 4242`; failing card `4000 0000 0000 0341`; `stripe trigger <event>` for lifecycle events.
