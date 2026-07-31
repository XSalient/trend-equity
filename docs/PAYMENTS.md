# Payments, Tiers & Subscription Lifecycle

Canonical reference for how money and tiers work in Trend-Equity. If code and this doc disagree, fix one of them in the same PR. Implementation plan for the lifecycle work: [2026-07-29 Stripe subscription lifecycle](superpowers/plans/2026-07-29-stripe-subscription-lifecycle.md). Decisions: `DECISIONS.md` (2026-07-28 and 2026-07-29 entries).

## The one rule

**`users/{uid}.tier` is written exclusively server-side by Stripe-driven code paths.** The client renders whatever the Firestore snapshot says (`useTier` → `onSnapshot`) and never mutates tier state locally — not optimistically, not for mocking outside dev mode, not "temporarily". The 2026-07-29 "already has this tier or higher" bug was exactly a client-side tier mutation desyncing UI from server truth.

## Tier writers (exhaustive list)

| Writer                                           | Direction             | Trigger                                                                                                                                                                                 |
| ------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provisionSubscription()` (`api/_lib/stripe.ts`) | free → pro/builder    | `checkout.session.completed` webhook **or** `GET /api/checkout?session_id=` return leg (idempotent, dedup key = session id)                                                             |
| `updateSubscriptionState()`                      | pro ↔ builder         | `customer.subscription.updated` webhook, and `POST /api/portal` when it finds the stored tier stale (TE-60) — both via `syncSubscriptionToUser()`; price id → tier via `tierForPriceId` |
| `downgradeToFree()`                              | paid → free           | `customer.subscription.deleted` webhook (portal cancel at period end, dashboard cancel, dunning exhaustion)                                                                             |
| `resolveEffectiveTier()` (`api/_lib/auth.ts`)    | paid → free (virtual) | Per-request backstop: `proEndDate` + 3-day grace elapsed. Doesn't write the doc; the request just resolves as free                                                                      |
| Admin (Firestore console)                        | any                   | Manual grants. Leave `proEndDate` unset/null — manual grants never expire                                                                                                               |

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
| `pendingTier`          | `'pro' \| 'builder'` \| null   | Plan this subscription switches to at period end (TE-47). Null when nothing is scheduled                            |
| `pendingTierDate`      | Timestamp \| null              | When `pendingTier` takes effect                                                                                     |

Firestore rules must keep every one of these fields client-unwritable (TE-12 safe-field allowlist).

## Payment history & audit: `stripe_transactions/{id}`

Append-only ledger, server-written, doubles as the idempotency store:

- **Checkout rows** — doc id = Checkout Session id, `type: 'checkout'`. Existence of the doc is what makes provisioning replay-safe.
- **Renewal rows** — doc id = Invoice id, `type: 'renewal'`.
- Fields: `uid`, `tier` (checkout only), `amount`, `currency`, `stripeCustomerId`/`stripeSubscriptionId`, `completedAt`.

**User-facing payment history is NOT built from this collection.** Users get invoices, receipts, and payment methods from the Stripe Customer Portal (`POST /api/portal`). `stripe_transactions` is for internal audit, support queries, and revenue reporting.

## The transition matrix (TE-47)

Every plan change the product supports, and what each one costs and when. **Any billing change must state which cells it touches before code is written** — TE-44 and TE-45 were both scoped to the first two rows, and the pro↔builder rows silently shipped as "open the portal homepage" for it.

| From → To            | Mechanism                                         | Money                                     | Effective  | Tier writer                             |
| -------------------- | ------------------------------------------------- | ----------------------------------------- | ---------- | --------------------------------------- |
| free → pro           | Checkout session                                  | Full price now                            | Immediate  | `provisionSubscription`                 |
| free → builder       | Checkout session                                  | Full price now                            | Immediate  | `provisionSubscription`                 |
| pro → builder        | Portal `subscription_update_confirm`              | **Net difference now** (`always_invoice`) | Immediate  | `updateSubscriptionState` (webhook)     |
| builder → pro        | Portal `subscription_update_confirm`              | Nothing now; lower price from next cycle  | Period end | `updateSubscriptionState` (at rollover) |
| pro/builder → free   | Portal `subscription_cancel`                      | Nothing                                   | Period end | `downgradeToFree` (on `.deleted`)       |
| lapsed → pro/builder | Checkout session (`stripeSubscriptionId` is null) | Full price now                            | Immediate  | `provisionSubscription`                 |

The billing anchor never moves on a paid→paid switch — Stripe does the calendar maths. `api/portal.ts` takes an optional `targetTier` and deep-links to the right flow; it is a routing hint only, re-validated against the Firestore tier server-side. A hint that cannot be built (no subscription, multi-item subscription, unknown tier) degrades to the portal homepage; a flow Stripe **refuses** does not — see "when the configuration is missing" below. A hint that describes a switch Stripe has _already made_ is a third case: it reconciles the user doc rather than opening anything — see "when the stored tier is stale" below.

### Portal configuration is not optional

The behaviours above are properties of the **portal configuration object**, not of anything the session sends. `flow_data` opens the right screen; the configuration decides whether that screen exists at all and what it does. Apply with `npm run stripe:configure-portal` (`--dry-run` to preview), once per Stripe environment:

| Setting                                                 | Value                      | Why                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscription_update.enabled`                           | `true`                     | **Off by default.** While it is off Stripe rejects every `subscription_update_confirm` session outright — pro↔builder is not mis-billed, it is dead     |
| `subscription_update.proration_behavior`                | `always_invoice`           | Charges the net difference **today**. `create_prorations` (Stripe's default) only books it to the _next_ invoice — the user upgrades free until renewal |
| `subscription_update.schedule_at_period_end.conditions` | `[decreasing_item_amount]` | Defers builder→pro to the period end. Without it Stripe downgrades immediately and credits back — stripping access already paid for                     |
| `subscription_cancel.mode`                              | `at_period_end`            | Never revoke time already paid for                                                                                                                      |

A deployment where this script has never been run is broken, not merely unconfigured.

#### When the configuration is missing (TE-48)

This shipped. A Pro subscriber pressed **Upgrade now** and got "Failed to open the billing portal", while **Manage billing** and **Downgrade** worked — the tell that it is configuration and not code, because those two build sessions that a default configuration still permits:

```
StripeInvalidRequestError: This subscription cannot be updated because
the subscription update feature in the portal configuration is disabled.
```

Two consequences are load-bearing:

- **`npm run stripe:verify` asserts the portal configuration**, not just keys and prices. It exits non-zero on any of the four settings above being wrong. Run it after any Stripe environment change; the version that only checked prices passed cleanly against the broken account.
- **`api/portal.ts` reports a refused flow as a 503**, with an operator log naming the script to run. It does not retry as a bare session: the portal homepage has no plan switcher while plan switching is disabled, so the fallback would swap a visible failure for an invisible dead end.

#### When the stored tier is stale (TE-60)

This shipped too, from the same button, and the TE-48 handling reported it as the TE-48 fault:

```
StripeInvalidRequestError: Cannot update the subscription `sub_…` because there
are no changes to confirm. Provide a different `price` or `quantity`.
```

The flow is **priced off `users/{uid}.tier`**; Stripe validates it against the **subscription item**. Those are two different sources, and they drift — a portal switch whose `customer.subscription.updated` never landed, a price changed in the dashboard, an environment whose `STRIPE_PRICE_*` vars were swapped. Once they disagree, every press builds a flow that asks Stripe to change nothing, and Stripe refuses it.

- `api/portal.ts` now **reads the subscription's current price** (it was fetched for its item id and otherwise discarded) and compares it with the target price before creating the session.
- Equal means the subscription is already on the requested plan. The endpoint reconciles the user doc from the live subscription (`syncSubscriptionToUser`, the same call the webhook makes) and answers **409** with `reconciledTier`. `useTier`'s snapshot flips the card to CURRENT PLAN with no reload; the pricing card renders that as an amber notice, not a red error.
- **Two tiers must never resolve to the same price.** `getPriceId` throws `StripeConfigError` when `STRIPE_PRICE_PRO` and `STRIPE_PRICE_BUILDER` match, because that configuration also makes Checkout sell Builder at Pro's amount — silent until somebody reads an invoice. `npm run stripe:verify` resolves both configured ids against Stripe and fails on identical ids, identical products, archived prices, one-off prices, and ids that do not exist in that environment.
- The refused-flow log no longer names `stripe:configure-portal` unconditionally — only when Stripe's own message blames the portal configuration. The rest print Stripe's wording verbatim.

### Scheduled switches: `pendingTier`

A period-end downgrade leaves the **current** price live and attaches a subscription schedule, so `customer.subscription.updated` alone looks like a no-op. `resolveScheduledTierChange()` reads the schedule's next phase, and the webhook writes `pendingTier` / `pendingTierDate` on every sync — passing `null` is what clears a switch the user reversed in the portal. `tier` is untouched throughout: the user keeps what they paid for until the date lands, and the rollover invoice is what finally moves it.

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

Only through the Customer Portal — Checkout must never be used by a live subscriber (409 guard), as it would create a second subscription and double-bill. The pricing card passes the clicked plan as `targetTier`, so the user lands on Stripe's confirmation screen for that plan rather than the portal homepage.

**Upgrade (pro → builder)** is immediate and prorated: Stripe credits the unused days on Pro, prices Builder for those same days, and charges the net difference on the spot. `customer.subscription.updated` carries the new price id → `tierForPriceId` → tier updated.

**Downgrade (builder → pro)** is scheduled for the period end — the user keeps Builder for the time they paid for. The event arrives with the _old_ price still live plus a schedule; `pendingTier`/`pendingTierDate` record it, and the tier changes at the rollover.

Both behaviours come from the portal configuration (see above), not from the session.

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
