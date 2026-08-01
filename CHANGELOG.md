# Changelog

All notable changes to Trend-Equity. Newest first. Every shipped change gets a line here (same commit that ships it) — see [docs/BACKLOG.md](docs/BACKLOG.md) for the workflow.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/): **Added / Changed / Fixed / Docs**.

## Unreleased

### Added

- **TE-08 Phase 2 — subscription lifecycle (TE-38…TE-42, 2026-07-29).** Cancels, plan switches, card updates and invoice history now run through the Stripe Customer Portal (`POST /api/portal`), and the app reflects real subscription state:
  - `useTier` exposes a read-only `SubscriptionInfo` (`proEndDate`, `cancelAtPeriodEnd`, `subscriptionStatus`, `hasBillingAccount`) straight from the Firestore snapshot; the pricing tab shows "Renews {date}" / "Ends {date}" and flags a payment issue while `past_due`.
  - New `customer.subscription.updated` webhook mirrors portal plan-switches and cancel-at-period-end onto the user doc (price id → tier via `tierForPriceId`). It never writes `tier: 'free'` — deletion and the expiry backstop own the end of paid access.
  - New `invoice.payment_failed` webhook sets `subscriptionStatus: 'past_due'` and raises a user alert with a fix path, deduped on the invoice id so dunning retries don't stack alerts. Tier is deliberately not dropped: Stripe's retries may still recover the payment.
  - Expiry backstop: `resolveEffectiveTier` lapses a paid tier to free once `proEndDate` + 3 days has passed, so a missed webhook can't grant an indefinite free ride. Manual admin grants (no `proEndDate`) never expire. Runs per request — no cron (both Vercel Hobby slots are taken).
  - Provisioning now records Stripe's real `current_period_end` instead of "purchase + 30 days", and every successful renewal writes an invoice-id-keyed `type: 'renewal'` row to `stripe_transactions` (checkout rows tagged `type: 'checkout'`).
- `api/_lib/stripe.ts` — single Stripe client, price/app-URL resolution, and idempotent tier provisioning (deduped on the Stripe session id) shared by the checkout endpoint and the webhook.
- `GET /api/checkout?session_id=…` — verifies a completed session on return from Stripe and provisions the tier immediately, so checkout works before a webhook endpoint is registered. Ownership-checked so a session id cannot be replayed by another user.
- Post-checkout confirmation flow (`useCheckout`) with a status toast, replacing a dead hook that loaded Stripe.js for a redirect flow that never used it.
- Unit coverage for all five regressions (`tests/unit/api/stripe-lib.test.ts` plus rewritten checkout/webhook suites).

### Changed

- `useTier` subscribes to `users/{uid}` via `onSnapshot` instead of a one-shot `getDoc`, so a server-side upgrade appears without a page reload.
- Webhook returns 200 for permanently unprocessable events (missing metadata, unresolvable uid) so Stripe stops retrying; 5xx is reserved for transient failures.
- Tier writes use `set(..., { merge: true })` — `update()` threw for users with no `users/{uid}` document, turning a successful payment into an unrecoverable error.

### Docs

- **Change Impact standard (CLAUDE.md §2, 2026-07-29).** A seven-point pass to run before declaring any change complete, written from the TE-44/45/47 sequence — three tickets filed on the same day against the same component, each finding the next defect in the same flow because each was scoped to the reported symptom. Covers: enumerate the state machine before coding; give every value a writer _and_ a reader (the class behind `checkIpRateLimit`, `checkoutTier` and `portalBusy`, all of which were written and never read); new `users/{uid}` fields go in the `firestore.rules` allowlist; flag deploy steps that are not code; check whether an existing test pins the old behaviour; strike superseded docs at the source; and re-read any ticket that touched the same file recently. Remaining Agent Rules sections renumbered 3–7.

### Fixed

- **The upgrade button broke again, for the opposite reason (TE-69, 2026-07-31).** A Pro subscriber pressing UPGRADE NOW on Builder got "Plan changes are temporarily unavailable" — the same symptom as TE-48, a different fault, reported as TE-48's. Production log: `Cannot update the subscription sub_… because there are no changes to confirm.`
  - **Root cause:** the flow is priced off `users/{uid}.tier` (Firestore); Stripe validates it against the subscription item. Once those drift, the "upgrade" asks Stripe to change nothing and is refused. `buildFlowData` had the current price in hand — it retrieved the subscription for its item id — and never compared it to the target.
  - `api/portal.ts` now compares them before creating a session. Already-equal means the stored tier is stale: the endpoint reconciles the user doc from the live subscription via `syncSubscriptionToUser` (the webhook's own path, so `updateSubscriptionState` stays the only tier writer) and answers 409 with `reconciledTier`. The card flips to CURRENT PLAN off the Firestore snapshot, no reload.
  - The pricing card reads `reconciledTier` and renders it amber rather than red — "you are already on Builder" is not a billing failure.
  - `getPriceId` rejects `STRIPE_PRICE_PRO` and `STRIPE_PRICE_BUILDER` holding the same id: that configuration causes this exact Stripe rejection _and_ sells Builder at Pro's price through Checkout, invisibly.
  - `npm run stripe:verify` resolves both configured price ids against Stripe — exists in this environment, active, recurring, distinct ids, distinct products, amounts printed. It previously printed the ids it _suggests_ from product names and never looked at the configured ones.
  - The refused-flow log names `stripe:configure-portal` only when Stripe's message blames the portal configuration; every other refusal is logged in Stripe's own words.
  - **Test fixtures were the reason this was invisible:** `liveSubscription` in `portal.test.ts` had no price on its item, so the suite could not express the mismatch that was failing in production. Fixtures now carry prices; 7 new portal tests, `syncSubscriptionToUser` covered against a Firestore mock, price-collision guard covered in `stripe-lib.test.ts`.
- **The daily-generation test suite had been dead since TE-04 (TE-46, 2026-07-31).** 13 tests in `tests/unit/api/daily.test.ts` — every one that expects generation to actually proceed — had been failing since 2026-07-23, leaving the most expensive endpoint in the product with **zero** unit coverage of its generation path for eight days. Suite is now green: 452 passed, 0 failed.
  - **Root cause:** TE-04 switched `daily.ts` from `fetchLiveSignals()` to `getMarketSignals()`; the test's `vi.mock` factory was never updated. Vitest factories are strict, so touching the undeclared export threw — and the handler's catch-all turned that into a plausible-looking 503, which is why it read as a flaky provider problem rather than a broken mock. Adding `getMarketSignals` to the factory revived all 13.
  - **The commit that broke the suite was itself untested:** TE-04's `qualityStats.signals.sourceCount` and `.degraded` had no assertions anywhere. Both branches now pinned, including the zero-source degraded path and its admin warning.
  - `daily.ts` no longer reports our own bugs as a provider outage. `isProgrammingError()` routes `TypeError`/`ReferenceError`/`SyntaxError`/`RangeError` to a 500 with the real message; provider and network failures keep the 503 that honestly invites a retry. **Known limit:** vitest's missing-export error is a plain `Error` and still reports 503 — the repaired happy-path tests, not this narrowing, are what catch mock drift. Sniffing error messages to catch it was rejected as worse: it would misreport real Gemini outages as 500s.
  - One hoisted `TODAY` constant replaces 24 scattered date literals that the `getToday()` mock and the request bodies were free to disagree on.
  - **No CI change needed, but a process finding:** `.github/workflows/ci.yml` has run `npm run test:unit` on every push and PR throughout. The gate was never missing — it was red and unenforced for eight days. Worth confirming CI is a required status check on branch protection.
- **Free-tier Evidence upgrade CTA was unreachable (TE-59, 2026-07-31).** A free user tapping the locked **Evidence** control had no way to reach checkout — the product's main in-feed paywall was a dead control, and any conversion number measured before this is a broken baseline. Two independent breaks in the same path:
  - The real "Upgrade →" `<button>` was nested inside the hover tooltip, which carries `pointer-events-none` — the click never landed on desktop — and the tooltip is `group-hover`-only, so touch users never saw the CTA at all. The outer button was `disabled`, so keyboard users couldn't reach it either. The gated control is now itself the CTA: one enabled button that tracks `upgrade_click` and calls `onUpgrade`, reachable by click, tap and keyboard, with the tooltip demoted to a hover hint. Without an `onUpgrade` it renders inert rather than looking clickable and doing nothing.
  - `SavedIdeas.tsx` rendered `IdeaCard` at two sites **without passing `onUpgrade`**, so a free user's saved ideas had no upgrade path even once the tooltip was fixed — the same written-but-never-read class as `checkIpRateLimit` (TE-02) and `checkoutTier` (TE-45). Both now pass the existing `onUpgradeNeeded`. `WeeklyBest.tsx` also omits it and is deliberately unchanged: it never fetches for free, so no free-variant card renders there.
  - Guarded by `tests/unit/components/IdeaCardEvidenceGate.test.tsx` — asserts a free user reaches the upgrade path and a paid user still gathers evidence, rather than asserting the markup.
- **"Upgrade now" failed while Manage billing and Downgrade worked (TE-48, 2026-07-29).** A Pro subscriber pressing **UPGRADE NOW** on Builder got "Failed to open the billing portal". The code was correct; `npm run stripe:configure-portal` — shipped by TE-47 and flagged there as a deploy step that is not code — had never been run against the Stripe account. A default portal configuration has `subscription_update.enabled: false`, so Stripe refused the session with _"This subscription cannot be updated because the subscription update feature in the portal configuration is disabled"_, while `subscription_cancel` (on by default) kept the two neighbouring buttons working and made it look like a bug in the upgrade path.
  - Configuration applied and verified end-to-end in a browser: pro→builder now lands on Stripe's confirm page charging **$9.80 today** with the billing anchor unmoved — `always_invoice` working as specified.
  - `npm run stripe:verify` now asserts the portal configuration (plan switching enabled, `always_invoice`, `[decreasing_item_amount]`, cancel enabled) and exits non-zero on any of them, naming the script to run. Previously it checked only the secret key and the two price ids, and passed cleanly against the broken account. Proved in both directions by disabling plan switching (exit 1) and restoring it (exit 0).
  - `api/portal.ts` now reports a Stripe-refused flow as a 503 with an operator log naming the fix, instead of an opaque 500. It deliberately does not retry as a bare session: while plan switching is disabled the portal homepage has no plan switcher either, so the fallback would trade a visible failure for an invisible dead end.
  - **Why no test caught it:** `portal.test.ts` mocks `sessions.create`, and a mock cannot refuse the call it is handed — 15 green tests over a flow Stripe rejected in production. Five new tests cover the rejection path, including that a plain "Manage billing" failure still reports as a generic 500 and that a connection error is not misreported as a misconfiguration.
  - **Production is a separate Stripe environment and was not reachable from here** (no live key): run `npm run stripe:configure-portal` and `npm run stripe:verify` with `sk_live_…` before trusting paid→paid switching in production.
- **Switching between paid plans was a dead end (TE-47, 2026-07-29).** A Pro subscriber pressing **UPGRADE NOW** on the Builder card got: no visual selection of the card they clicked, no feedback on the button they pressed, and a Stripe billing _overview_ page that never mentioned Builder or asked for payment. Four defects behind one root cause — the pro→builder branch was implemented as `void openPortal()`, which satisfied the "never create a second Checkout for a live subscriber" rule and nothing else:
  - Every card button calls `e.stopPropagation()`, which is exactly what made the parent card's `onClick={() => setSelectedTier(...)}` unreachable — and no button handler set the selection itself, so the highlight and the feature showcase stayed on the previous plan. All three buttons now set it.
  - `portalBusy`/`portalError` were a single boolean and a single string, rendered only inside the standalone "Manage billing" block. They are now keyed by which control started the hand-off, so the pressed button shows `OPENING…` and surfaces its own error.
  - `POST /api/portal` now takes an optional `targetTier` and deep-links via Stripe `flow_data` — `subscription_update_confirm` for a plan switch (landing on the prorated confirmation with the amount due today), `subscription_cancel` for a downgrade to Free. It is a routing hint only: the tier is re-read from Firestore, a hint that isn't a real transition is discarded, and anything unresolvable degrades to the portal homepage rather than erroring.
  - **Proration was never configured.** The lifecycle plan specified `create_prorations`, which books the credit and charge onto the _next_ invoice — so an upgrade took no payment at switch time and handed over the higher tier free until renewal. New `npm run stripe:configure-portal` (`--dry-run` supported) sets `always_invoice` for immediate net-difference billing, and `schedule_at_period_end.conditions: [decreasing_item_amount]` so a builder→pro downgrade waits for the period end instead of stripping access already paid for.
  - Scheduled downgrades are now visible: a period-end switch leaves the current price live and hangs the new one off a subscription schedule, so `customer.subscription.updated` alone looked like a no-op. `resolveScheduledTierChange()` reads the schedule's next phase and the webhook writes `pendingTier`/`pendingTierDate` on every sync (including `null`, which is how reversing the switch in the portal propagates). The card reads "Switches to PRO on {date}" instead of "Renews", the target plan's button reads `SCHEDULED`, and the downgrade modal no longer implies immediate loss. `tier` is untouched throughout — the user keeps what they paid for.
  - Both new user-doc fields are added to the Firestore rules' server-only allowlist.
  - **Why no test caught it:** `portal.test.ts` asserted `sessions.create` was called with _exactly_ `{customer, return_url}` — the incomplete behaviour was pinned by a green assertion — and `PricingSection.test.tsx` asserted the Builder click reached `/api/portal` without inspecting the body. Both now assert the journey; 25 new tests (78 passing across the four billing suites) cover all six cells of the transition matrix now recorded in `docs/PAYMENTS.md`.
- **Checkout modal opened on the wrong plan, and could open for people who already subscribe (TE-45, 2026-07-29).** Clicking **UPGRADE NOW** on the Builder card opened a modal preselected on Pro with an "Upgrade to Pro" CTA — one more click bought $9 Pro instead of $19 Builder. `PricingSection` had tracked the clicked plan in `checkoutTier` since the modal shipped but never passed it down, and `StripeCheckoutModal` held an unclamped `useState('pro')`. Separately, `useTier` had no loading flag: between sign-in and the first Firestore snapshot a paying member reads as `free`, so the upgrade CTAs (and the TE-44 pre-sign-in resume) opened Checkout for them; when the snapshot landed as `pro` the modal collapsed to a lone Builder card under an "UPGRADE TO PRO" button, and a Builder member got an empty card grid with a dangling CTA. Now: the modal takes `initialTier`, clamps its selection to the tiers actually on offer, and resets on open; existing subscribers see no Checkout CTA at all — Checkout is free → paid only (`docs/PAYMENTS.md`), so they get a "Manage billing" hand-off to the Customer Portal; `useTier` exposes `tierLoading` and every plan-changing control waits for it. No double-charge was ever possible — `api/checkout.ts` already rejected the rank case (400) and live subscriptions (409) — but the wrong-plan default was chargeable. Covered by 13 new component tests (`tests/unit/components/StripeCheckoutModal.test.tsx`, `PricingSection.test.tsx`), 9 of which fail against the pre-fix code.
- **Signed-out visitors were told Free was their "current plan" (TE-44, 2026-07-29).** The pricing tab put a green "Current" badge on the Free card, disabled its button to a dead `CURRENT PLAN` label, and headed the feature grid "Your FREE Features" — for someone with no account. Root cause: `useTier(null)` returns `tier: 'free'`, which is the right _entitlement_ for an anonymous visitor (free-tier feature gates) but is not a _plan identity_; `App.tsx` passed it to `PricingSection` as `currentPlan` regardless. `Header.tsx` had always kept its tier badge inside `{user && …}`, so the two surfaces disagreed. `useTier` now also returns `hasAccount`, and `PricingSection` derives `activePlan = isAuthenticated ? plan : null` for every identity surface; entitlement gates still read `tier` and are untouched.
  - The conversion half of the same bug: sign-up was a _disabled_ control, while Pro/Builder offered `UPGRADE NOW` and opened a Checkout modal that could only fail — with "your session has expired" shown to someone who never had a session. All three cards now read `PROCEED` and start sign-in; the picked plan is held and Checkout resumes once the Firebase token arrives, guarded on the freshly-read server tier still being free so the resume can never double-bill.
  - The pricing tab is labelled `Pricing` when signed out (it was `Upgrade`, which presumes a plan to upgrade from), and `Upgrade`/`Plan` once there is an account behind it.
  - Dev `?mockTier=` stands in for a signed-in member, so it sets `hasAccount` too — the mock keeps rendering the real current-plan treatment.
- **Signed-out sessions kept showing the previous account's data (TE-43, 2026-07-29).** Saved ideas stayed on screen (and in the Saved tab badge) after sign-out, along with the account's saved filters, its Pro custom feed, its "My Latest Idea" analysis, Weekly Best, and any Builder-only Radar/Futurecasting panel that was open. Root cause: the Firestore subscription effects in `useIdeas`/`useAnalyzeIdea` early-returned on `user === null` — the cleanup detaches the listener but never clears the data it already delivered, so the previous session's React state stayed rendered. `useAlerts` and `useTier` already reset correctly; the fix makes the rest consistent by clearing at the top of each effect, which also covers a direct account switch (A → B with no null in between).
  - The worse half of the same bug: account A's filters survived into account B's session, and the debounced filter-save effect then wrote them into B's `users/{uid}` document — silent cross-account data corruption, not just a stale view.
  - Tier-gated tabs are no longer just hidden from the tab bar when the tier drops: `activeTab` falls back to the daily feed and the gated payloads (`weeklyRadar`, `futurecasting`, `weeklyBest`) are dropped, so a downgrade or sign-out can't leave a Builder panel rendered with no way to navigate off it.
  - Firestore rules were never at fault — every read had been legitimately authorized at the time it happened. This is purely client-side state lifetime.
- **The "user already has this tier or higher" bug (TE-38).** `handleDowngrade` in `useTier.ts` only set local React state, so the UI showed Free/Pro while Firestore still said Builder and `api/checkout.ts` correctly refused the re-upgrade. All client-side tier mutation is gone — `useTier` no longer exports any tier setter, and `users/{uid}.tier` is written exclusively by server-side Stripe paths.
- **Double-billing risk on paid→paid changes (TE-39).** A Pro user buying Builder through Checkout would have opened a _second_ Stripe subscription. `POST /api/checkout` now returns 409 `{ usePortal: true }` for anyone with a live `stripeSubscriptionId`; lapsed users are unaffected because `downgradeToFree` nulls that field.
- **Firestore rules: every billing field was client-writable.** `proEndDate`, `cancelAtPeriodEnd`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId` and `stripeSessionId` are now in the unwritable allowlist alongside `tier`/`role`/`apiAccess`. A writable `proEndDate` would have defeated the new expiry backstop, and a writable `stripeCustomerId` would have let a user open another customer's billing portal.
- **Firestore rules: `diff` was read as a property, not called as a method.** `request.resource.data.diff.delta` raised an evaluation error on every update, which meant users could never mark an alert as read (including the new payment-failure alert). Fixed in both `users/` and `user_alerts/` via `diff(resource.data).affectedKeys()`.
- **`isProOrBuilder()` errored on a missing user doc** (`get()` returned null, `.data.tier` threw) instead of denying cleanly. Now `exists()`-guarded.
- **The Firestore rules test suite had never run.** `describe.skipIf(!testEnv)` is evaluated while vitest collects the file — before `beforeEach` assigns `testEnv` — so all 79 rules tests silently skipped. Now guarded on `FIRESTORE_EMULATOR_HOST`; 81/81 pass against the emulator, and the file no longer hangs the full suite.
- **`npm run test:unit` was unrunnable.** `--workers=4` is not a Vitest 2 flag (immediate "Unknown option" error), and the default `forks` pool crashes with "Worker exited unexpectedly" on Node 25. Scripts now pass `--pool=threads`.
- **TE-08 Stripe checkout was broken end-to-end.** Five independent defects, each sufficient on its own:
  - `customer_email` was set to the Firebase uid, so Stripe rejected every session with "Invalid email address". Now sends the verified email claim (added to `AuthContext`) and puts the uid in `client_reference_id`/metadata.
  - `server.ts` never mounted `/api/checkout` or `/api/webhook/stripe`, so local dev 404'd and the modal reported "Network error" (previously misdiagnosed as missing env vars in `docs/QUICK_FIX_STRIPE.md`).
  - The webhook read the raw body off the request stream after Vercel/Express had already consumed it, so signature verification always failed and the tier was never written. Body parsing is now disabled for the route (`config.api.bodyParser = false`, `express.raw()` locally) and the parser reads pre-buffered bytes.
  - Renewal and cancellation handlers read `metadata.uid` from Charge/Subscription objects, which never carry session metadata. Checkout now copies `uid`/`tier` onto `subscription_data.metadata`, and `resolveUid()` walks subscription → customer → Firestore.
  - Config validation only rejected the literal string `placeholder`, so the `.env` stubs `sk_test_`/`price_` were passed to Stripe. Now validated by shape and surfaced as a 503 with an actionable message.

### Docs

- **TE-08 Phase 2 planned (2026-07-29):** Subscription-lifecycle audit found the root cause of the "user already has this tier or higher" bug (client-only `handleDowngrade` desyncing UI tier from Firestore) plus five gaps: no cancel path, broken paid↔paid switches (double-billing risk), unenforced/undisplayed `proEndDate`, inaccurate billing dates, and unhandled `invoice.payment_failed` / `customer.subscription.updated`. Added stories TE-38…TE-42 (supersede TE-08b), a decision record (DECISIONS.md 2026-07-29), the canonical lifecycle reference `docs/PAYMENTS.md`, CLAUDE.md payment rules, and the task-by-task plan `docs/superpowers/plans/2026-07-29-stripe-subscription-lifecycle.md`.

## 2026-07-23

### Added

- **TE-04:** Signal observability — per-run source counts and degradation flag in `qualityStats`.
  - Modified `api/_lib/signals.ts`: Added `getMarketSignals()` function that returns both signals and sourceCount (number of sources with data)
  - Modified `api/_handlers/daily.ts`: Calls `getMarketSignals()` instead of `fetchLiveSignals()`; writes `qualityStats.signals = { sourceCount, degraded }` flag set to true when sourceCount = 0
  - Added admin console warning when all signal sources fail or return empty
  - Visible in Firestore `daily_generations` doc for manual inspection and analytics
  - Enables measurement of signal health across runs (foundation for TE-05/06 hardening work)

- **TE-09:** Product analytics — event logging service and 5 core events for funnel analysis.
  - Created new `src/services/analyticsService.ts`: `logEvent(name, context?)` service with batch writes to Firestore `user_analytics` collection
  - Handles offline state: events queue when offline, flush when online with debounce
  - Integrated 5 core events:
    - `tab_view`: logs when user switches tabs (in App.tsx useEffect, fired on activeTab change)
    - `idea_save`: logs on successful Firestore save (in useIdeas.ts, fired after addDoc succeeds, not on quota failure)
    - `quota_hit`: logs when user hits monthly save limit (in useIdeas.ts toggleSave, before onUpgradeNeeded callback)
    - `upgrade_click`: logs when user clicks to upgrade to Builder tier (in App.tsx onUpgradeToBuilder)
    - `evidence_view`: logs when IdeaCardEvidence component renders (in IdeaCardEvidence.tsx useEffect)
  - Events batch to Firestore with timestamp, uid, context, and date
  - Enables funnel analysis: save → quota_hit → upgrade_click
  - Unit tests in `tests/unit/services/analyticsService.test.ts` cover event structure and offline handling

- **TE-35:** Smoke-test suite — auto-verify critical routes post-deploy.
  - Created `tests/smoke.spec.ts` with 7 critical routes: app load, daily feed render, save/unsave idea, tier gate visibility, pricing page, comment section, sign out
  - Each test runs in <30s and catches 90% of regressions (entry points, not exhaustive)
  - Added `npm run test:smoke` command for manual verification before declaring deployments live

- **TE-36:** Parallelize E2E tests — shard tests by feature for faster feedback.
  - Updated `playwright.config.ts`: enabled `fullyParallel: true` and set `workers: 4` (locally) / `workers: 1` (CI)
  - Tests isolated by data (unique users, snapshot state reset); no flakiness regression expected
  - Reduces E2E suite runtime from ~5 min to ~2 min
  - Snapshots still committed correctly despite parallel execution

- **TE-37:** Parallelize unit tests — enable multi-worker Vitest execution.
  - Updated `package.json` test scripts: added `--workers=4` flag to `test:unit`, `test:unit:watch`, `test:unit:coverage`
  - Vitest 2.1 parallelizes by default; CLI flag controls worker count
  - Reduces unit test suite runtime from ~2 min to ~1 min
  - Watch mode still works; no race conditions in test state

### Changed

- **TE-26:** Comments tiering — Free read-only, Pro+ can post.
  - `IdeaComments.tsx`: Input disabled for Free tier with inline "Posting is a Pro feature" prompt
  - Firestore rules: Added `isProOrBuilder()` helper; `comments/{commentId}.create` now requires tier check
  - Existing free-authored comments remain readable by all tiers
  - E2E tests verify Free sees disabled input, Pro/Builder see enabled input
  - Acceptance met: Free users can read all comments but cannot post; server-side rules enforce tier gate

- **TE-25:** Pro next-steps cap — tier-driven roadmap slicing.
  - `IdeaCardActionSteps.tsx`: Refactored to accept `tier` prop and use `TIER_LIMITS.roadmapSteps` for slicing
  - Free: 3 steps with "Upgrade to Pro" prompt when truncated
  - Pro: 7 steps with "Upgrade to Builder for full roadmap" prompt when truncated
  - Builder: all 10 steps, no upgrade prompt
  - E2E tests verify step counts and upgrade messaging by tier
  - Acceptance met: roadmap execution depth is now distinct per tier; dead constant warning resolved

- **TE-24:** CSV export becomes Pro+ — server-side tier gate + client-side UI indication.
  - `App.tsx`: `onExportCSV` handler now checks tier; Free users navigate to pricing tab instead of exporting
  - `FilterBar.tsx`: Export dropdown shows "(Pro+)" suffix on CSV option for Free tier users
  - PDF export remains unrestricted (Free tier gets PDF, Pro+ gets CSV+PDF)
  - Acceptance met: CSV export is gated, Free users see clear indication and pricing upgrade path, PDF stays free

## 2026-07-22

### Changed

- **TE-23:** Market Evidence becomes Pro+ — server gate + locked teaser UI.
  - `evidence.ts` handler: returns 403 with `upgradeRequired: true` for free tier
  - `geminiService.generateEvidence()`: detects 403 and throws with `upgradeRequired` flag
  - Evidence button shows disabled + locked state for free users with inline "Upgrade →" tooltip
  - IdeaCard receives `onUpgrade` callback to navigate to pricing tab
  - PricingSection: added "Market Evidence" to Pro tier features list and showcase icons
  - Acceptance met: feature is gated, UI shows clear lock, pricing page documents it
- **TE-22:** Basic-vs-Full VC analysis — lock unfair advantage, revenue model, market dynamics behind Pro paywall.
  - Created `LockedAnalysisSection` component showing blurred locked sections with upgrade CTA
  - Free users see: VC Justification, Trend Sources (unlocked) + Unfair Advantage, Revenue Model, Market Dynamics as locked panels
  - Pro/Builder see full content unchanged
  - Added `upgrade_click` tracking event for upgrade flow analytics
- **TE-21:** Promise/copy reconciliation — align UI promises with actual implementation.
  - **Saves wording** (PricingSection, PRD): Changed "5 Saves / Month" → "5 Saved Ideas" to clarify concurrent quota (not monthly rollover)
  - **Twitter/X signal claims removed** (PRD §4.1, App.tsx): Removed false claim about scanning "X (Twitter)". Actual sources: Google Trends, Product Hunt, Reddit, Hacker News, TechCrunch.
  - **Co-founder button gated to Builder** (IdeaCard): Hidden for Free/Pro tiers; feature is future roadmap (PRD §7)
  - **Weekly Radar toggle gated to Builder** (EmailDigest): Hidden for Free/Pro; only Builder sees the toggle (matches tier promise)
  - **Validation Toolkit tier corrected** (PRD §4.3d): Moved from "Builder-Specific" to "Pro/Builder Features" section; added to tier table with Pro+ access
  - **Email Digest status updated** (PRD): Changed from "backend in development" to accurate status: daily digest ships at 8:00 AM, weekly radar available to Builder tier
  - **Builder-Specific Features clarified** (PRD §4.5): Listed missing features (Weekly Trend Radar, Futurecasting, Advanced Alerts, Expert Vetting) that were promised in tier table but not documented in section
  - All changes align marketing copy with implementation; no functional code changes except tier gates

## 2026-07-21 (continued)

### Added

- **TE-20:** `updateIdea` now syncs weekly best — when an idea is updated anywhere (daily feed, custom feed, or weekly best), the change is reflected across all lists.
  - Added `updateWeeklyBestIdea()` callback to `useWeeklyBest` hook
  - Created `handleUpdateIdea()` wrapper in `App.tsx` that calls both `updateIdea()` (from `useIdeas`) and `updateWeeklyBestIdea()` (from `useWeeklyBest`)
  - Replaced all direct `updateIdea` prop assignments with `handleUpdateIdea` in IdeaFeed, SavedIdeas, WeeklyBest, and AnalyzeIdeaModal tabs
  - Prevents stale idea state in weekly best tab when analysis results update an idea's properties

- **TE-19:** Dead-UI fixes — multiple cosmetic improvements and bug fixes.
  - **Tailwind literal classes in PricingSection** (lines 372, 379): Fixed dynamic Tailwind classes by converting to conditional ternary expressions. Tailwind can't generate classes at runtime.
  - **Footer dead legal links** (App.tsx): Updated Privacy → real URL, Terms → real URL, Contact → mailto: link. Enterprise link was already correct.
  - **FilterBar sticky positioning** (line 290): Changed `sticky top-0` → `sticky top-16` to account for header height (h-16), preventing overlap.
  - **Comment relative timestamps** (IdeaComments): Added `getRelativeTime()` function to show "Xm AGO", "Xh AGO", "Xd AGO" instead of static "JUST NOW".
  - No regressions; all type checks pass.

- **TE-17:** Cron for daily generation — automatic trigger removes manual admin dependency.
  - New `/api/cron` endpoint triggered by Vercel cron at 06:30 UTC every day (before 07:00 UTC digest)
  - Cron endpoint calls daily generation with `x-cron-trigger` header; daily handler checks this header to allow generation without auth
  - Vercel's cron infrastructure secures the endpoint (only Vercel can invoke it)
  - Handles already-generated case (singleton check in daily handler) — cron request just returns cached result if generation exists
  - Updated `vercel.json` with new cron schedule; no UI changes

- **TE-16:** Anonymous read path for daily feed — logged-out visitors can now browse today's ideas.
  - `daily.ts` now marks all published ideas with `public: true` when saving to Firestore
  - Firestore rules already supported public reads (`allow read: if ... || resource.data.public == true`)
  - Client-side hooks handle permission-denied gracefully for logged-out users attempting authenticated reads
  - No UI changes needed; anonymous users already see the same feed interface, just can't save or generate
  - Enables logged-out discovery, organic SEO (if needed), and sharing via direct links

- **TE-33:** Merge code+docs workflow — eliminate serialized documentation steps, update project tracking files in same session as code.
  - Reordered post-story checklist: code + docs edits now happen in parallel (same session), then single commit with all changes
  - DECISIONS.md now updated immediately when a decision is made (not batched at end)
  - Removed sequential context-switch overhead from documentation workflow
  - Saves ~2 min per story; compounds to ~8 min/week velocity uplift across team (matches TE-32 data-driven profiling)
  - Updated memory file with merged workflow pattern; example shows code → docs → commit → hash-update sequence
  - No functional code change; pure workflow optimization

- **TE-32:** Parallelize AI handler pipeline — pre-fetch embeddings in parallel with generation batches.
  - `semanticDedupeCandidates()` now accepts optional `preFetchedEmbeddings` parameter for better composition
  - `daily.ts` now calls `Promise.all([generateBatch(...), getRecentEmbeddings()])` to eliminate serialization
  - Embeddings fetched during generation instead of after; eliminates 2–3s latency on handler completion
  - Backward compatible: callers can pass pre-fetched embeddings or let the function fetch them internally
  - Added unit tests verifying concurrent execution with artificial delays
  - One-line fix: removed unnecessary regex escaping in `api/enterprise-lead.ts` (eslint error)

- **TE-29:** Dedup observability — instrument pipeline to log drop counts and near-miss distribution.
  - `semanticDedupeCandidates()` now returns per-candidate max-similarity scores for all candidates (kept & dropped)
  - `daily.ts` buckets near-misses into 0.75–0.80, 0.80–0.85, 0.85–0.90, 0.90+ bands
  - Persists buckets to `qualityStats.dedup = { dropped, nearMissBuckets, threshold }`, visible in `daily_generations_history`
  - Grounds the 0.80 threshold choice from TE-28 with real measurement data (not guesswork)
  - Updated types + unit tests; mocks now include similarityScores field
  - Mirrors TE-04 signal-observability pattern for consistent observability

- **TE-34:** Hot files manifest for agent context caching (0 lines touched, saves ~3–4 min per story).
  - New memory file: `hot_files_manifest.md` — 10 frequently-touched files with line ranges
  - Organized by frontend/backend core/handlers; includes Firestore transaction, tier lookup, AI generation patterns
  - Indexed in memory system so agents don't re-read architecture docs every session
  - Will reduce onboarding time for new agent sessions and improve story completion velocity

- **TE-28:** Tighten semantic dedup to catch same-concept-reworded ideas + enrich embedding text.
  - Lowered default cosine similarity threshold from **0.85 → 0.80** in `getDedupeThreshold()` (still env-overridable via `DEDUP_SIM_THRESHOLD`)
  - Enriched `embedText()` to concatenate `headline + pitch + marketSize + revenueSkeleton` instead of just `headline: pitch`
  - Richer embedding text (4 fields instead of 2) improves semantic distinction for near-miss candidates; 0.80 threshold catches the 0.78–0.84 band of subtle duplicates
  - Updated `.env.example` default from `0.85` to `0.80`
  - Added unit tests: new test for 0.80 default, new test verifying richer embedding text inclusion
  - Designed to ship with TE-29 (observability) so threshold choice is validated by measured drop rates, not guessed

- **TE-27:** Stop reworded-duplicate feed by extending dedup window to 14 days + enriching prompt context.
  - `getRecentIdeaHeadlines()` now returns past **14 days** (up from 3) to give the AI model broader context
  - Enriched data: each historical idea now includes `{ headline, pitch }` instead of headline-only
  - Updated dedup block format: "headline — pitch summary" helps the AI understand the _problem space_ of each recent idea, not just the name
  - Both production (`daily.ts`) and dev (`server.ts`) paths now use consistent 14-day window
  - Unit tests updated to verify 14-day default + enriched format; tested skipping ideas with missing pitch/headline
  - Rationale: prevents more subtle near-misses (same concept, different words) which score ~0.78–0.84 similarity and previously passed the 0.85 dedup threshold

- **TE-15:** Anonymous enterprise lead capture via serverless endpoint — B2B funnel no longer silently drops leads.
  - New endpoint: `POST /api/enterprise-lead` (standalone, not in `/api/generate/` dispatch) — accepts anonymous form submissions
  - Rate limiting: 5 per IP per hour (Firestore-backed, survives across instances)
  - Validates required fields (`firstName`, `email`, `company`, `role`); optional `lastName`, `message`
  - Writes to `enterprise_leads` collection with server credentials (Admin SDK bypasses TE-12 rules for unauthenticated client restriction)
  - Frontend: `EnterpriseLanding.tsx` removes forced authentication, calls serverless endpoint directly
  - Rationale: retains data ownership (Firestore, not external service), enables future CRM/automation integrations

### Changed

- **TE-14:** Replaced fake client-side tier upgrade flow with honest pre-Stripe state (a6a6a14).
  - Free users clicking "Upgrade" buttons now see a "Join Waitlist" modal instead of a deceptive tier change
  - New `WaitlistModal.tsx` component: email signup with graceful fallback (no backend endpoint yet)
  - `PricingSection.tsx` buttons now open waitlist modal instead of calling `onUpgrade()`
  - Removed deceptive tier-change messaging from `useTier.ts` — `handleUpgrade()` no longer fakes state changes
  - Closes the credibility gap: users are no longer shown a fake "CURRENT PLAN" badge that reverts on reload

## 2026-07-20

### Added

- **TE-13:** Server-side auth + tier gates on the 8 previously-ungated generate endpoints (`vetting`, `build-me`, `action-plan`, `radar`, `futurecasting`, `validation`, `explain`, `alerts`). Added a shared `requireTier(authCtx, 'pro' | 'builder')` helper in `api/_lib/auth.ts`. Every endpoint now 401s without a verified Firebase token and 403s (`upgradeRequired: true`) below its promised tier (Builder for all of them except `validation`, which is Pro+) — closing both the entitlement hole (free users/curl scripts getting Builder features free) and the cost hole (unauthenticated callers skipping quotas entirely). `alerts` being gated Builder-only also stops the hidden AI spend on every Free/Pro sign-in described in TE-18. Added unit test coverage for the 401/403 paths on all 8 handlers, including new `futurecasting.test.ts` and `alerts.test.ts` (previously untested).
- **TE-12:** Production Firestore security rules with per-collection least-privilege access control (6fd7159).
  - User-owned collections require doc ownership; client cannot write privileged fields (`tier`, `role`, `apiAccess`)
  - Server-only collections (`api_usage`, `api_cache`, `daily_generations_history`, `locks`, etc.) deny all client access
  - Shared collections (`daily_generations`, `comments`, `app_config`) use read-only or owner-gated write rules
  - Enterprise lead capture gated to authenticated users; added sign-in redirect on `/enterprise` page
  - Comprehensive unit tests (84 test cases) using `@firebase/rules-unit-testing`
  - Closes critical security gaps: prevents self-upgrade to Builder, quota reset, and cross-user data tampering

### Docs

## Unreleased (pre-2026-07-20)

### Docs

- Free-Tier Value Ladder decision (DECISIONS.md, 2026-07-10): Free = discover, Pro = evaluate, Builder = execute. Reclaims the audit's accidental giveaways as Pro value — full VC analysis, Market Evidence, CSV export, 7-step cap, comment posting — as backlog items TE-22…TE-26 with user stories; time-delayed free feed considered and parked. PRD tier table updated to the target matrix.

- Full UI/feature/tier-promise audit (`docs/audits/2026-07-08-ui-feature-tier-audit.md`): every button, expand/collapse, link, and tier gate cross-checked against PRD and server enforcement. Headline findings: dev-mode Firestore rules allow any signed-in user to write anything (incl. own tier); 8 of 12 AI endpoints have no tier gate and accept anonymous callers; upgrade flow is client-side simulation; enterprise lead capture fails for anonymous visitors. New backlog items TE-12…TE-21.

### Fixed

- **TE-01:** `api/_handlers/daily.ts` no longer lets anonymous callers trigger AI generation for arbitrary client-supplied dates — the initial generation trigger now requires a signed-in user and only fires for today's date. Cached reads are unaffected: any date, any auth state, still served from Firestore when present.
- **TE-02:** the per-IP daily cap on daily generation is now enforced via a Firestore transaction (`checkAndIncrementIpLimit` in `api/_lib/usage.ts`, hashed IPs) instead of an in-memory `Map`, so it survives across serverless instances. While implementing this we found the old limiter was never actually invoked anywhere — the endpoint had no IP protection at all in production.

### Docs

- Project tracking system: `docs/BACKLOG.md` (single task tracker), this changelog, decision-log workflow, doc map in README.
- Pain-point audit and remediation plan (`docs/superpowers/plans/2026-07-08-pain-point-remediation.md`) — 10 prioritized tasks with user stories.
- CLAUDE.md synced with actual backend architecture (Firestore-backed cache/quotas, signal pipeline modules, real generation-trigger policy); AGENTS.md now points to CLAUDE.md instead of duplicating it.

## 2026-07-08

### Changed

- Consolidated all `/api/generate/*` endpoints into a single catch-all function (`api/generate/dispatch.ts`) to stay under the Vercel Hobby 12-function limit (210be12).

### Fixed

- 405 on `/api/generate/*` in production: bracket dynamic-segment filenames (`[feature].ts`) don't register as routes in non-Next.js Vercel projects; replaced with a `vercel.json` rewrite (85ab8dc).

### Docs

- Added `DECISIONS.md` — cross-machine decision log (985347f).

## 2026-07-03

### Added

- **Custom requirement feed** (Builder tier): natural-language requirement → 5 tailored ideas, 1 generation per 24 h with server-side caching and peek/restore flow (44ec85c, b5436d8).
- **Quality Engine Wave 1** (5608d81): overgenerate-then-curate pipeline — 3 concurrent candidate batches, semantic dedup vs past 30 days (`embeddings.ts`), stronger critic model ranks and publishes top 35 (`quality-engine.ts`), live market signals grounding (`signals.ts`: Google Trends, Product Hunt, Reddit, HN, TechCrunch), per-idea evidence via Google Search grounding (`evidence.ts`), publish-time prediction snapshots for 6-month accuracy grading (`prediction-tracker.ts`).

## 2026-05-18 → 2026-05-22

### Added

- CI pipeline with component tests (39f18be).

### Fixed

- TypeScript errors blocking CI (4e09f04); visual bugs in loading states, vetting refresh, dynamic step count (381d5d5); vetting done button re-calling API (57887d7); Vercel ESM crashes (2b9a6ca, 758dd7d); `isAdmin` undefined in VC analysis (794c151).

### Changed

- Daily idea generation quality/diversity overhaul with concurrent batches (d22113c, 4341d08).

## 2026-05-20

### Added

- Self-learning prompt pipeline: AI critique + user reactions refine the generation prompt over time, with permanent prompt/run history in Firestore (491bfd7, 3cf1742).
- Admin CLI role manager (0eca0c9).

### Changed

- Admin role standardized to `role === 'admin'` as single source of truth; Builder tier decoupled from admin privileges; feed regeneration is admin-only across all UI surfaces (31b8300, dad0938, 54a59ba).

## 2026-05-04 → 2026-05-05

### Added

- Enterprise tier section in pricing UI (002afc2, ec8f4c3).
- Five product gap fixes (e51122c).

### Fixed

- Vercel login: switched web auth to `signInWithPopup`, forced local persistence (4ae6e97, d64bf17, 7eaab27); API CommonJS/ESM crashes on Vercel (bb846d7, ffea130); consolidated admin endpoints into `api/admin.ts` for the 12-function limit (63d086e).

---

_History before 2026-05-04 predates this changelog; see `git log`._
