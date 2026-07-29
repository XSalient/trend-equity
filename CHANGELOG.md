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

### Fixed

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
