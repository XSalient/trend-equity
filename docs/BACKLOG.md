# Trend-Equity Backlog

Single source of truth for all planned, in-progress, and recently shipped work. If a task isn't here, it isn't planned.

**How this file works** (for humans and AI agents):

1. Every work item gets a `TE-NN` id and one row. Statuses: `todo` → `in progress` → `done` (or `parked`).
2. Starting work? Set the row to `in progress` and put your name/agent in Owner — in the same commit as your first change.
3. Shipping work? Move the row to **Recently shipped** with the commit hash, and add a line to [CHANGELOG.md](../CHANGELOG.md).
4. Making a product/architecture decision along the way? Record it in [DECISIONS.md](../DECISIONS.md) and link it here.
5. Big tasks link to a detailed implementation plan in `docs/superpowers/plans/`. Small tasks are fully described by their row + user story.

Related docs: [PRD.md](../PRD.md) (what the product is) · [DECISIONS.md](../DECISIONS.md) (why things are the way they are) · [CHANGELOG.md](../CHANGELOG.md) (what shipped when) · [CLAUDE.md](../CLAUDE.md) (how to work in this codebase).

---

## Now — P0: cost & abuse hardening

Detailed steps for TE-01…TE-10: [2026-07-08 pain-point remediation plan](superpowers/plans/2026-07-08-pain-point-remediation.md).

| ID    | Task                                                                                             | Status            | Owner  | Effort |
| ----- | ------------------------------------------------------------------------------------------------ | ----------------- | ------ | ------ |
| TE-01 | Restrict daily generation trigger to authed users + today's date only (`api/_handlers/daily.ts`) | done (2026-07-08) | Claude | S      |
| TE-02 | Replace per-instance in-memory IP limit with Firestore counter (`usage.ts` pattern, hashed IPs)  | done (2026-07-08) | Claude | S      |
| TE-03 | Fix CLAUDE.md drift (cache/usage docs, generation trigger policy, new `_lib` modules)            | done (2026-07-08) | Claude | S      |

**TE-01 user story:** As the product owner, I want the expensive AI generation path triggerable only by signed-in users and only for today's date, so attackers can't burn Gemini budget with anonymous arbitrary-date requests.

**TE-02 user story:** As the product owner, I want request limits enforced across all serverless instances, so cold starts and instance fan-out can't bypass the cap.
**Finding while implementing:** the old `checkIpRateLimit` in `daily.ts` was never actually called anywhere — the endpoint had **zero** IP protection in production, not just a weak per-instance one. Fixed by wiring the new Firestore-backed `checkAndIncrementIpLimit` into the non-refresh generation-trigger path.

## Now — P0: the daily-generation test suite has been dead since TE-04 (TE-46)

| ID    | Task                                                                                                           | Status | Owner | Effort |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------ | ----- | ------ |
| TE-46 | Repair `tests/unit/api/daily.test.ts` (13 failing) and stop the handler from masking programming errors as 503 | todo   | —     | S      |

**TE-46 user story:** As a developer, I want the daily-generation suite to actually exercise the generation path, so the most expensive endpoint in the product is not shipping unverified — and I want a broken test mock to fail as a broken mock, not as a plausible-looking 503.

**Symptom:** `npm run test:unit` → 13 failed / 402 passed / 81 skipped. Every failure is in `tests/unit/api/daily.test.ts`, and every one of them is a test that expects generation to _proceed_:

| Failing test (all in `POST /api/generate/daily`)                       |
| ---------------------------------------------------------------------- |
| returns generated daily ideas on success                               |
| calls getRecentIdeaHeadlines with the provided date                    |
| injects DO NOT REPEAT block into prompt when recent headlines exist    |
| does NOT inject dedup block when no recent headlines                   |
| includes signal context in prompt when signals are non-empty           |
| uses fallback prompt without signal prefix when signals are empty      |
| overgenerates 60 candidates and publishes the quality-engine top 35    |
| appends country localisation clause when country is not Global         |
| does NOT append country clause when country is Global                  |
| allows non-builder tier to trigger initial generation for the day      |
| proceeds to generation for an authenticated request on today, uncached |
| does not apply the per-IP limit to admin refresh requests              |
| pre-fetches embeddings in parallel with generation batches             |

The other 11 tests in the file pass because they are guard/early-return cases (405, 401, 404, 429, cached singleton) that never reach the signal fetch.

**Root cause — mock drift, masked by a catch-all:** TE-04 (`915db97`, 2026-07-23) switched `api/_handlers/daily.ts:4` from `fetchLiveSignals()` to `getMarketSignals()` (the wrapper that adds `sourceCount`). The test's factory at `daily.test.ts:57` still declares only `fetchLiveSignals` + `formatSignalsForPrompt`. Vitest factories are strict, so touching the undeclared export throws:

```
No "getMarketSignals" export is defined on the "../../../api/_lib/signals" mock
```

`daily.ts`'s outer `try/catch` catches that and returns **503 `{ error: 'AI generation temporarily unavailable…' }`**. `res.json` is therefore called exactly once — so `expect(res.json).toHaveBeenCalledOnce()` still passes and the tests fail one line later on `body.ideas` being undefined, which reads like a response-shape problem rather than a missing mock. Verified by probe: `status=503`, body carries the vitest mock error.

**Ruled out:** the hardcoded `'2026-04-11'` request date. It is in the past and TE-01 404s uncached past dates, so it looks like the culprit — substituting today's date changes nothing. Fix the mock, not the date (but see fix step 3).

**Impact:** since 2026-07-23 there has been **zero** unit coverage of the daily generation path — quality-engine top-35 publishing, semantic-dedup block injection, signal grounding, country localisation, the admin IP-limit exemption and the embeddings prefetch are all unasserted on the most expensive endpoint in the product. Nothing is wrong in production because of this ticket; the risk is that the next regression there ships silently.

**Fix:**

1. Add `getMarketSignals` to the `vi.mock('../../../api/_lib/signals', …)` factory, returning `SignalMetrics` (`{ signals, sourceCount }`) — `daily.ts:125` passes `signalMetrics.signals` to `formatSignalsForPrompt`, so returning a bare `LiveSignals` will fail differently. Keep `fetchLiveSignals` only if something still imports it.
2. Re-run and treat every one of the 13 as a fresh assertion review: they were written pre-TE-04 and have never run against the current response shape (`qualityStats.signals`, `sourceCount`, degraded flag).
3. Replace the hardcoded date with a `getToday()`-derived value (or fake timers pinned to a fixed day) so the suite does not silently drift into the TE-01 past-date 404 branch later.
4. **Stop the handler swallowing programming errors.** A `catch` that maps _any_ throw to "AI generation temporarily unavailable" hides `TypeError`s and bad-import bugs in production exactly as it hid this one in CI. Narrow it to provider/network failures and let the rest 500 with the real message (server-side log at minimum).
5. Consider a CI gate: `npm run test:unit` is currently able to go red without blocking anything.

**Not failures, for the record:** the 81 skipped tests in `tests/unit/firestore.test.ts` are the documented emulator-gated rules suite (run via `firebase emulators:exec`, see CLAUDE.md) — expected skips, not breakage. The Playwright E2E suite was not assessed as part of this ticket.

## Shipped — P0: the upgrade button 500'd because the portal config was never applied (TE-48)

| ID    | Task                                                                                                    | Status            | Owner  | Effort |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-48 | Apply the Stripe portal configuration; make its absence fail loudly in preflight and legibly at runtime | done (2026-07-29) | Claude | S      |

**TE-48 user story:** As a Pro subscriber, I want "Upgrade now" to take me to Stripe's confirm page — and as the operator, I want a Stripe environment that has not been configured to fail in `npm run stripe:verify`, not in front of a paying customer.

**Symptom:** pro→builder showed "Failed to open the billing portal" under the Builder card. "Manage billing" and "Downgrade" both worked.

**Root cause — not code.** `npm run stripe:configure-portal`, shipped by TE-47 and flagged in that ticket as a deploy step that is not code, had never been run. The default portal configuration has `subscription_update.enabled: false`, so Stripe rejected the session:

```
StripeInvalidRequestError: This subscription cannot be updated because
the subscription update feature in the portal configuration is disabled.
```

`subscription_cancel` is enabled by default, which is exactly why the two neighbouring buttons worked and the failure read as a bug in the upgrade path. Confirmed by reproducing all three flows against the account: bare OK, cancel OK, update refused.

**Why nothing caught it (the same shape as TE-47's own post-mortem):**

| Guard                           | Why it passed                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `tests/unit/api/portal.test.ts` | Mocks `sessions.create`; a mock cannot refuse the call it is handed. 15 tests, all green.       |
| `npm run stripe:verify`         | Checked `STRIPE_SECRET_KEY` and the two price ids. Said nothing about the portal configuration. |
| TE-47's ⚠️ deploy note          | A note in a shipped ticket is not a check. It was correct, and it was not run.                  |

**Fixed:**

1. Portal configuration applied to the test environment — `subscription_update.enabled: true`, `always_invoice`, `[decreasing_item_amount]`, cancel `at_period_end`. Verified end-to-end in a browser: the confirm page charges **$9.80 today** for pro→builder with the Aug 28 anchor unmoved.
2. `npm run stripe:verify` now asserts all four portal settings and exits non-zero on any of them. Proved in both directions by disabling plan switching and re-running (exit 1), then restoring (exit 0).
3. `api/portal.ts` maps a Stripe-refused flow to a 503 plus an operator log naming the script to run, instead of an opaque 500. It deliberately does not retry as a bare session — the homepage has no plan switcher while the feature is off.
4. `docs/PAYMENTS.md` gained the `subscription_update.enabled` row it never had, and its "degrades to the portal homepage rather than erroring" claim is corrected.

**⚠️ Still outstanding — production.** The live Stripe environment is configured separately and could not be checked from here (no `sk_live_…` key). Run `STRIPE_SECRET_KEY=sk_live_… npm run stripe:configure-portal` and then `npm run stripe:verify` against live before trusting paid→paid switching there.

## Shipped — P0: pro↔builder plan switching was a dead end (TE-47)

| ID    | Task                                                                                                    | Status            | Owner  | Effort |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-47 | Make paid→paid plan changes a real journey: prorated immediate upgrade, period-end downgrade, honest UI | done (2026-07-29) | Claude | M      |

**⚠️ Deploy step that is not code:** `npm run stripe:configure-portal` must be run once per Stripe environment (test **and** live). Until it is, the portal still bills with `create_prorations` — upgrades take no payment at switch time. See `docs/PAYMENTS.md`.

**TE-47 user story:** As a Pro subscriber, I want pressing "Upgrade now" on Builder to select Builder on screen, tell me it is opening, and land me on a Stripe page that asks me to pay the difference today — not on a billing overview page that makes me hunt for the plan switcher. And as a Builder subscriber stepping down to Pro, I want to keep what I paid for until the period ends rather than losing features the moment I click.

**The transition matrix (the deliverable — every cell must be specified before code):**

| From → To            | Mechanism                                         | Money                                     | Effective  | Tier writer                             |
| -------------------- | ------------------------------------------------- | ----------------------------------------- | ---------- | --------------------------------------- |
| free → pro           | Checkout session                                  | Full price now                            | Immediate  | `provisionSubscription`                 |
| free → builder       | Checkout session                                  | Full price now                            | Immediate  | `provisionSubscription`                 |
| pro → builder        | Portal `subscription_update_confirm`              | **Net difference now** (`always_invoice`) | Immediate  | `updateSubscriptionState` (webhook)     |
| builder → pro        | Portal `subscription_update_confirm`              | Nothing now; lower price from next cycle  | Period end | `updateSubscriptionState` (at rollover) |
| pro/builder → free   | Portal `subscription_cancel`                      | Nothing                                   | Period end | `downgradeToFree` (on `.deleted`)       |
| lapsed → pro/builder | Checkout session (`stripeSubscriptionId` is null) | Full price now                            | Immediate  | `provisionSubscription`                 |

Billing anchor never moves on a paid→paid switch — Stripe does the calendar maths.

**Defects fixed (all four reported symptoms, one root cause):**

1. **Card never highlights on upgrade.** Every card button calls `e.stopPropagation()`, which is what makes the parent card's `onClick={() => setSelectedTier(...)}` unreachable. No button handler set the selection itself, so the ring and the feature showcase stayed on the previous plan.
2. **No feedback on the button pressed.** `portalBusy` / `portalError` existed but were rendered only inside the separate "Manage billing" block, so the card button that triggered the portal showed nothing at all.
3. **Portal opened on its homepage.** `api/portal.ts` created a bare session (`customer` + `return_url`). It did not accept a target tier, so it could not have opened the plan-switch flow even in principle.
4. **Proration semantics were never configured.** The lifecycle plan chose `create_prorations`, which books the credit and the charge onto the _next_ invoice — no payment is taken at switch time. Immediate net charge is `always_invoice`. Period-end downgrade needs `schedule_at_period_end.conditions: [decreasing_item_amount]`. Neither was set anywhere.

**Root cause (process, not knowledge):** TE-44 and TE-45 were both scoped as free→paid stories, and the fixes stopped at the boundary of the reported symptom. The pro→builder branch (`if (activePlan === 'pro') void openPortal()`) satisfied the one hard constraint it was written against — never create a second Checkout for a live subscriber — and satisfied nothing else. "Routes to Stripe" was accepted as "handled", when Stripe only handles what the portal configuration tells it to.

**Why no test caught it:** `tests/unit/api/portal.test.ts` exists and passes — it asserts `sessions.create` is called with _exactly_ `{ customer, return_url }`. The incomplete behaviour was pinned by a green assertion. `PricingSection.test.tsx` asserts a Pro member's Builder click reaches `/api/portal` and never inspects the request body. Both tests encoded "the call happens" rather than "the user can complete the journey".

**Guard added:** the six-cell matrix above now lives in `docs/PAYMENTS.md` and every cell has a test. Any future billing change states its cells before code.

## Now — P0 (wave 2): findings from the 2026-07-08 UI/feature/tier audit

Full evidence and per-surface inventory: [2026-07-08 UI, Feature & Tier-Promise Audit](audits/2026-07-08-ui-feature-tier-audit.md).

| ID    | Task                                                                                              | Status            | Owner  | Effort |
| ----- | ------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-12 | Production Firestore rules: replace dev-mode allow-all with per-collection least-privilege        | done (2026-07-20) | Claude | M      |
| TE-13 | Server-side tier gates + auth requirement on all generate endpoints (copy `analyze-idea` pattern) | done (2026-07-20) | Claude | M      |
| TE-14 | Replace fake client-side upgrade flow with honest pre-Stripe state (waitlist CTA)                 | done (2026-07-21) | Claude | S      |
| TE-15 | Fix enterprise lead capture (anonymous submits fail rules) via serverless endpoint                | done (2026-07-21) | Claude | S      |

**TE-12 user story:** As the product owner, I want Firestore rules that only let users write their own safe fields, so a signed-in user can't self-upgrade to Builder, reset quotas, or edit the global feed/config from the browser console.

**TE-13 user story:** As the product owner, I want every paid AI endpoint to verify auth and tier server-side, so Builder features can't be used for free (or anonymously, with no quota at all) by calling the API directly.

**TE-14 user story:** As a free user, I want the upgrade button to tell me the truth (payments coming soon / join waitlist), so the app never shows me "PRO" while the server still treats me as free.

**TE-15 user story:** As a logged-out VC on /enterprise, I want my early-access request to actually be captured, so the B2B funnel isn't silently dropping every lead.

## Next — P1 (wave 2): audit follow-ups, UX & honesty

| ID    | Task                                                                                                                                                                                                | Status            | Owner  | Effort |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-16 | Anonymous read path for the daily feed (public flag + rules, or API read) so logged-out visitors see the product                                                                                    | done (2026-07-21) | Claude | S      |
| TE-17 | Cron for daily generation (before the 07:00 UTC digest cron) — remove dependence on a human admin                                                                                                   | done (2026-07-21) | Claude | S      |
| TE-18 | Alerts: generate only for Builder tier; stop hidden AI spend for Free/Pro who can't see the bell                                                                                                    | done (2026-07-20) | Claude | S      |
| TE-19 | Dead-UI fixes: 2 dead upgrade buttons, footer legal links, click-to-open export menu (touch), comment relative timestamps, FilterBar top-16 stickiness, Tailwind literal classes in PricingSection  | done (2026-07-21) | Claude | M      |
| TE-20 | `updateIdea` must also sync the Weekly Best list (fold into TE-10 hook split)                                                                                                                       | done (2026-07-21) | Claude | S      |
| TE-21 | Promise/copy reconciliation: saves wording, dead digest weekly toggle, co-founder button, X/Twitter signal claims, PRD digest + validation-toolkit tier corrections (next-steps cap moved to TE-25) | done (2026-07-22) | Claude | M      |

**TE-18 note:** shipped as a side effect of TE-13 — `alerts.ts` now 403s below Builder tier, so `useAlerts`'s per-signed-in-user generation attempt can no longer trigger AI spend for Free/Pro (it just gets a harmless rejected call). The client still fires that doomed request rather than skipping it client-side; leaving that micro-optimization out of scope here.

## Next — P1 (wave 3): free-tier value ladder

Decision + full rationale: [Free-Tier Value Ladder (DECISIONS.md, 2026-07-10)](../DECISIONS.md). Sequencing: all of these gates are cosmetic until TE-12 (rules) and TE-13 (server tier guards) ship — implement TE-23…TE-26 on top of TE-13's `requireTier` helper.

**Vibe-coding sprint plan for all remaining items:** [2026-07-23 vibe-coding 15-item sprint](superpowers/plans/2026-07-23-vibe-coding-15-item-sprint.md) — parallel flows, ruthless scoping, no ceremony.

| ID    | Task                                                                                                               | Status            | Owner  | Effort |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ----------------- | ------ | ------ |
| TE-22 | Basic-vs-Full VC analysis: lock unfair advantage, revenue model & market dynamics behind a visible upsell for Free | done (2026-07-22) | Claude | M      |
| TE-23 | Market Evidence becomes Pro+: server gate in `evidence.ts` + locked teaser button for Free                         | done (2026-07-22) | Claude | S      |
| TE-24 | CSV export becomes Pro+: gate the FilterBar export option, match the PDF-only Free promise                         | done (2026-07-23) | Claude | S      |
| TE-25 | Enforce Pro next-steps cap of 7 using the existing (currently dead) `TIER_LIMITS.roadmapSteps` constant            | done (2026-07-23) | Claude | S      |
| TE-26 | Comments tiering: Free read-only, Pro+ can post — rules + UI state with inline upgrade prompt                      | done (2026-07-23) | Claude | M      |

**TE-22 user story:** As a free user browsing the feed, I want to see that each idea has an unfair-advantage read, a revenue model, and market dynamics waiting behind a lock, so I understand exactly what upgrading buys me — and as the owner, I want my strongest upsell shown on every single card instead of given away.
Acceptance: Free sees headline, pitch, score, VC justification, trend sources, 3 next steps; the locked sections render as titled, blurred/locked panels with one "Unlock full analysis — Pro" CTA (not silently hidden — visible absence sells). Pro/Builder unchanged. PRD §3 already promises this split.

**TE-23 user story:** As a Pro subscriber, I want search-grounded market evidence (competitors, cited market size, why-now) to be part of what I pay for, so my plan visibly includes the platform's core intelligence — and as the owner, I want the most expensive-per-call feature to stop being free.
Acceptance: `evidence.ts` returns 403 with `upgradeRequired` for free tier; Free sees the Evidence button in a locked state with tooltip copy; Pro/Builder unchanged; pricing page Pro card gains "Market Evidence" line.

**TE-24 user story:** As a Pro subscriber, I want bulk CSV export as a paid capability, so power-user workflows are a reason to subscribe — and Free stays aligned with its promised PDF-only export.
Acceptance: CSV option in the FilterBar export dropdown routes Free users to the pricing tab (same pattern as filter chips); PDF remains free everywhere.

**TE-25 user story:** As a Pro subscriber, I want 7 next steps where Free gets 3, and as a Builder I want the full roadmap suite to be a visible step beyond that, so each tier's execution depth is distinct instead of Pro silently getting everything.
Acceptance: `IdeaCardActionSteps` slices by `TIER_LIMITS[tier].roadmapSteps` (3/7/10) instead of `isFree ? 3 : all`; Pro sees "Upgrade to Builder for the full roadmap" note when steps are truncated; dead-constant warning from the audit resolved.

**TE-26 user story:** As a free user, I want to read every idea's community thread but be prompted to upgrade when I try to post, so the community is visible value with a clear next step — matching the PRD's read-only → post ladder.
Acceptance: comment input disabled for Free with "Posting is a Pro feature" inline prompt; Firestore rules allow comment `create` only for pro/builder (requires TE-12's per-collection rules; tier lookup via custom claims or a rules-readable field decided during TE-12); existing free-authored comments remain readable.

## Now — P0.5: idea diversity quick-wins (stop the reworded-duplicate feed)

Context: dedup already exists in two layers — a prompt "DO NOT REPEAT" block over the **last 3 days** ([`cache.ts`](../api/_lib/cache.ts) `getRecentIdeaHeadlines`, wired at [`daily.ts:118`](../api/_handlers/daily.ts)) and a hard semantic drop over the **last 30 days** at cosine ≥ **0.85** ([`embeddings.ts`](../api/_lib/embeddings.ts) `semanticDedupeCandidates`). The feed still feels repetitive because "same idea, different words" scores ~0.78–0.84 and passes the 0.85 gate, and the embedding text is only `headline: pitch`. These two items are low-effort, high-value, and independent of the P0 security work (they touch the generation pipeline, not Firestore rules).

| ID    | Task                                                                                                                                                                           | Status            | Owner  | Effort |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------ | ------ |
| TE-27 | Widen the prompt "DO NOT REPEAT" window from 3 → **14 days** and include a one-line problem/target descriptor per prior idea, not just the headline                            | done (2026-07-21) | Claude | S      |
| TE-28 | Tighten + enrich semantic dedup: lower default `DEDUP_SIM_THRESHOLD` 0.85 → **0.80**, and embed `headline + pitch + targetMarket + businessModel` instead of `headline: pitch` | done (2026-07-21) | Claude | S      |

**TE-27 user story:** As a user, I want the generator told the _last 14 days_ of ideas (each as headline + a one-line problem/target-market summary) so it steers into genuinely new problem spaces up front, instead of only avoiding the last 3 days' headlines. Acceptance: `getRecentIdeaHeadlines` (or a new `getRecentIdeaSummaries`) lookback param is 14; the prompt block lists `headline — <short problem/target>`; both [`daily.ts`](../api/_handlers/daily.ts) and [`server.ts`](../server.ts) dev paths use the same window; existing tests updated.

**TE-28 user story:** As a user, I want an idea that is the _same concept reworded_ to be caught and dropped, so the feed stops feeling repetitive. Acceptance: default threshold in `getDedupeThreshold()` is 0.80 (still env-overridable via `DEDUP_SIM_THRESHOLD`); `embedText()` in [`embeddings.ts`](../api/_lib/embeddings.ts) concatenates headline, pitch, target market and business model; `.env.example` default updated; unit tests in `tests/unit/lib/embeddings.test.ts` cover the richer text + new default. Ship together with TE-29 so the 0.80 choice is validated by measured drop rates, not guessed.

## Now — P1.5: Agent & Generation Pipeline Performance (50% velocity uplift)

Full implementation plan: [2026-07-21 agent performance optimization](superpowers/plans/2026-07-21-agent-performance-optimization.md).

**Context:** Agent story completion takes ~30 min. Profiling identified three bottlenecks: (1) serialized backend AI operations (2–3s waste), (2) redundant discovery per session (3–4 min waste), (3) sequential post-story workflow (2 min waste). This epic targets ~15 min completion time (50% reduction).

| ID    | Task                                                                               | Status            | Owner  | Effort |
| ----- | ---------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-32 | Parallelize AI handler pipeline (pre-fetch embeddings + signals during generation) | done (2026-07-21) | Claude | M      |
| TE-33 | Merge code+docs workflow (update BACKLOG/CHANGELOG inline, single commit)          | done (2026-07-21) | Claude | S      |
| TE-35 | Auto-verify deployments (smoke-test key routes post-Vercel push)                   | done (2026-07-23) | Claude | M      |
| TE-36 | Shard E2E tests by feature area (parallel Playwright execution)                    | done (2026-07-23) | Claude | M      |
| TE-37 | Optimize Vitest threading (enable parallel test execution)                         | done (2026-07-23) | Claude | S      |

**TE-32 user story:** As an agent executing generation requests, I want the AI handler to fetch embeddings and market signals in parallel with the main generation call, so independent operations don't serialize. Acceptance: `Promise.all([generateWithAI(), getRecentEmbeddings(), getMarketSignals()])` in handlers; embeddings + signals pre-fetched during generation (not after); unit tests confirm concurrent execution; live handler latency improves by 2–3s per call; no functional change to output.

**TE-33 user story:** As an agent, I want to update BACKLOG.md, CHANGELOG.md, and DECISIONS.md in the same edit session as code, so documentation updates don't add a serialized step. Acceptance: workflow checklist reordered (docs + code in one session); single commit includes all changes; DECISIONS.md updated immediately when a decision is made (not batched); no intermediate "docs commit".

**TE-34 user story:** As an agent starting a new session, I want a memory manifest listing hot files and key patterns, so I don't re-read architecture docs every story. Acceptance: memory file lists 8–10 hot files with line ranges (types.ts, ai-provider.ts, handlers, auth pattern, tier lookup, Firestore transaction); indexed in MEMORY.md; saves 3–4 min per story via cached context; memory is updated in-repo whenever hot files change significantly.

**TE-35 user story:** As an agent, I want key routes auto-verified after a Vercel deployment, so I don't spend 2 min manually checking the live site. Acceptance: smoke-test suite covers <10 critical paths (app load, daily feed render, save idea, auth visible, tier gate visible); runs in <30s; agent can run `npm run test:smoke` before declaring live; optional auto-trigger post-deploy webhook (low priority).

**TE-36 user story:** As an agent running tests before merge, I want E2E tests to run in parallel by feature, so the full suite finishes in ~2 min instead of ~5 min. Acceptance: tests sharded by feature (feed, auth, saves, tier-gates); Playwright config enables workers (3–4 parallel); each shard gets isolated test state (unique users, snapshot reset); no flakiness regression; snapshots still committed correctly.

**TE-37 user story:** As an agent running unit tests, I want Vitest to use multiple worker threads, so `npm run test:unit` finishes in ~1 min instead of ~2 min. Acceptance: vitest.config.ts enables `threads: true`, `maxThreads: 4` (or auto-detect); all tests pass; watch mode still works; no race conditions in shared state.

**Rollout:** Sequence TE-32/33/34 in Week 1 (high ROI), then TE-35/36/37 in Week 2 (testing infrastructure).

## Next — P1 (wave 4): idea diversity — measurement & structural fixes

Sequencing: TE-29 done — now measure the near-miss distribution to ground the 0.80 threshold choice. TE-30/TE-31 follow once the data says whether tuning alone was enough.

| ID    | Task                                                                                                                                                                              | Status            | Owner  | Effort |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-29 | Dedup observability: record per-run semantic-dup drop count + the 0.75–0.85 near-miss similarity distribution in `qualityStats`                                                   | done (2026-07-21) | Claude | S      |
| TE-30 | Intra-day diversity guard: cap how many near-neighbour ideas (above a cluster threshold) publish in a single day; enforce category spread across the published set                | todo              | —      | M      |
| TE-31 | Right-size daily volume: reduce `PUBLISH_COUNT` (35) and/or raise overgeneration (`CANDIDATES_PER_BATCH`), so the model isn't forced to pad with reworded filler to hit the count | todo              | —      | S      |

**TE-29 user story:** As the product owner, I want each generation run to log how many candidates were dropped as semantic duplicates and the distribution of near-misses (candidates scoring 0.75–0.85 vs the prior 30 days), so I can tune the threshold from evidence instead of intuition. Acceptance: `semanticDedupeCandidates` returns per-candidate max-similarity; `daily.ts` writes `qualityStats.dedup = { dropped, nearMissBuckets }`; visible in `daily_generations_history`. Mirrors the TE-04 signal-observability pattern.

**TE-30 user story:** As a user, I want a day's feed to span distinct problem spaces rather than several minor variants of one hot concept, so scrolling feels like breadth, not echoes. Acceptance: after critic ranking, a diversity pass ensures no more than K published ideas fall within a tighter intra-day similarity cluster (drop or backfill from the next-best distinct candidate); category focuses already exist in the 3 batches — extend the guard to the merged published set.

**TE-31 user story:** As the product owner, I want the daily publish count matched to how many genuinely distinct high-conviction ideas the pipeline can actually produce, so quality isn't diluted to hit a number. Acceptance: `PUBLISH_COUNT` and `CANDIDATES_PER_BATCH` revisited with TE-29 data; if diversity data shows filler, lower `PUBLISH_COUNT` or raise overgeneration ratio; decision recorded in [DECISIONS.md](../DECISIONS.md).

## Next — P1: protect the "grounded in live signals" differentiator

| ID    | Task                                                                                                                              | Status | Owner | Effort |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ------ |
| TE-05 | Signal citation verification: match `trendSources` against the signal snapshot, `signalVerified` flag (measure-first, don't drop) | todo   | —     | M      |
| TE-06 | Resilient signal fetching: Reddit RSS fallback, Firestore-shared 1 h cache, real failure logging                                  | todo   | —     | M      |
| TE-07 | Generation lock hardening: 10-min TTL, runId ownership check, unlock in `finally`                                                 | todo   | —     | S      |

**TE-05 user story:** As a user evaluating an idea, I want its cited trend sources to provably match signals that existed at generation time, so grounding is verifiable, not model self-assertion.

**TE-06 user story:** As the product owner, I want signal fetching to survive Reddit's datacenter-IP blocking and share one cache across instances, so production generations are consistently grounded.

**TE-07 user story:** As the product owner, I want exactly one generation run per day regardless of request races, so a slow run can never double AI spend.

Sequencing note: TE-04 (now shipped) provided observability; use its data to inform TE-06 — how bad is the Reddit problem actually?

## Later — P2: prove the business

| ID     | Task                                                                                                                                                | Status            | Owner  | Effort |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-04  | Signal observability: per-source counts in `qualityStats`, `signalsDegraded` flag, admin alert at zero                                              | done (2026-07-23) | Claude | S      |
| TE-09  | Product analytics: `logEvent()` service + 5 events (`tab_view`, `idea_save`, `quota_hit`, `upgrade_click`, `evidence_view`)                         | done (2026-07-23) | Claude | M      |
| TE-08  | Stripe monetization Phase 1: checkout endpoint + webhook as sole writer of `users/{uid}.tier`; Pro/Builder monthly only; live Stripe checkout modal | done (2026-07-28) | Claude | L      |
| TE-08b | ~~Stripe Phase 2 placeholder~~ — superseded by the TE-38…TE-42 lifecycle stories below (2026-07-29 audit)                                           | superseded        | —      | —      |

**TE-08 user story:** As a free user who hit my quota, I want to upgrade to Pro with a card in under a minute — and as the owner, I finally learn whether anyone pays, which gates the entire Wave 2 roadmap.

**TE-08 Phase 1 (shipped 2026-07-23):** Checkout endpoint + live Stripe modal with real pricing ($9 Pro, $19 Builder). Stripe webhook atomically updates `users/{uid}.tier` and `proEndDate`. UI shows "UPGRADE NOW" buttons that redirect to Stripe checkout.

**TE-08 Phase 1 repair (2026-07-28, shipped 2026-07-29 6f12809):** The shipped flow never completed a payment. Five defects fixed — uid sent as `customer_email`, `/api/checkout` unmounted in local dev, webhook raw body consumed before signature verification, renewal/cancel `metadata.uid` never populated, and stub env values passing validation. Added `api/_lib/stripe.ts` (idempotent provisioning) and a session-verify return path so checkout completes without a registered webhook. See CHANGELOG. **Blocked on:** `STRIPE_SECRET_KEY` (sandbox) is absent from `.env`, Doppler and Vercel — end-to-end payment cannot be verified until it is set.

**TE-08 Phase 2 (planned):** Superseded by TE-38…TE-42 below — see the [subscription lifecycle section](#now--p2-stripe-subscription-lifecycle-te-08-phase-2).

## Shipped — P2: Stripe subscription lifecycle (TE-08 Phase 2)

All five stories (TE-38…TE-42) shipped 2026-07-29 — rows are in [Recently shipped](#recently-shipped). Source: 2026-07-29 lifecycle audit — root cause of the "user already has this tier or higher" bug was the client-only `handleDowngrade` in `useTier.ts` desyncing UI tier from Firestore. Decision record: [DECISIONS.md 2026-07-29](../DECISIONS.md). Canonical lifecycle reference: [docs/PAYMENTS.md](PAYMENTS.md). Implementation plan: [2026-07-29 Stripe subscription lifecycle](superpowers/plans/2026-07-29-stripe-subscription-lifecycle.md).

**Remaining before charging real money:** the end-to-end Stripe sandbox run (plan Task 10 Step 2) — test keys are present in `.env`, but the portal/cancel/dunning legs have only been verified by unit tests and a local endpoint smoke test, not against live Stripe. The Customer Portal must also be configured in the Stripe dashboard (period-end cancellation + plan switching between both prices), and the webhook endpoint must subscribe to `customer.subscription.updated` and `invoice.payment_failed`.

**TE-38 user story:** As a subscriber, I want the plan shown in the app to always match what the server will enforce — including my renewal or expiry date — so I never see a "downgrade" that didn't happen or get blocked from an upgrade I'm entitled to.

**TE-39 user story:** As a subscriber, I want one "Manage billing" place to cancel, switch plans, update my card, and see my payment history — and as the owner, I want Stripe to host all of it so plan changes are prorated correctly and a Pro user can never end up paying for two subscriptions at once.

**TE-40 user story:** As a subscriber who cancels, I want the app to immediately show "Ends {date}" while keeping my access until then; and when a renewal charge fails, I want a clear warning with a fix path instead of silently losing (or silently keeping) my plan.

**TE-41 user story:** As the owner, I want paid access to provably end even if a Stripe webhook never arrives, so a delivery failure can't turn into an indefinite free ride — while hand-granted tiers (no proEndDate) stay untouched.

**TE-42 user story:** As a subscriber, I want the renewal date shown in-app to be my actual Stripe billing date (not "purchase + 30 days"), and as the owner I want every successful charge — first purchase and renewals — in an append-only internal ledger for support and revenue queries.

**TE-09 user story:** As the product owner, I want to see which tabs get used and where users hit walls, so I can prioritize from evidence instead of intuition. Runs well in parallel with TE-08 — `quota_hit`/`upgrade_click` are the Stripe conversion funnel.

## Shipped — P0: signed-out data leakage (TE-43)

| ID    | Task                                                                                                  | Status            | Owner  | Effort |
| ----- | ----------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-43 | Reset every user-scoped hook state on sign-out / tier loss (saves, filters, custom feed, latest idea) | done (2026-07-29) | Claude | S      |

**TE-43 user story:** As a user who signs out on a shared or personal browser, I want everything tied to my account to disappear from the screen immediately — saved ideas, my filters, my custom feed, my analyzed idea — so the next person to use the browser sees a genuinely signed-out app and never inherits my data.

**Root cause:** the Firestore subscription effects in `useIdeas`/`useAnalyzeIdea` early-returned on `user === null`. The effect cleanup detaches the listener but does not clear the data it already delivered, so the previous session's React state stayed rendered. `useAlerts` and `useTier` already did this correctly — the bug was the inconsistency, not a missing capability. Firestore rules were never at fault: the reads had been legitimately authorized at the time they happened. Related to [TE-10](#later--p3-code-health) — `useIdeas` owning this much account state is what let the omission hide.

**Second-order impact (worse than the display bug):** filters loaded from account A stayed in state through a sign-out, and the debounced "save filters" effect then wrote them into account B's `users/{uid}` document on the next sign-in — silent cross-account data corruption, not just a stale view.

## Shipped — P1: signed-out plan identity (TE-44)

| ID    | Task                                                                                                       | Status            | Owner  | Effort |
| ----- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-44 | Stop presenting Free as the signed-out visitor's "current plan"; every pricing CTA actionable without auth | done (2026-07-29) | Claude | S      |

**TE-44 user story:** As a visitor who has never signed in, I want the pricing page to show me three plans I could choose, not to tell me I am already on Free — and I want every plan's button to actually do something, so picking Pro doesn't dead-end at a login wall that says my session expired.

**Root cause:** `useTier(null)` returns `tier: 'free'`, and `App.tsx` passed that straight to `PricingSection` as `currentPlan`. The value conflates two different things — the visitor's _entitlement_ (correctly `free`: anonymous users get free-tier feature gates) and their _plan identity_ (should be nothing at all). `Header.tsx` had always drawn its tier badge inside `{user && …}`, so the two surfaces disagreed about whether a signed-out visitor has a plan. Fixed by adding `hasAccount` to `useTier` and deriving `activePlan = isAuthenticated ? safePlan : null` inside `PricingSection`; every entitlement gate keeps reading `tier` unchanged.

**Conversion half of the bug:** the Free card's only control was a disabled `CURRENT PLAN` button — the sign-up path was a dead control — while Pro/Builder said `UPGRADE NOW` and opened a Checkout modal that could only fail, with the misleading copy "your session has expired" for someone who never had one. All three cards now read `PROCEED` and start sign-in, and the chosen plan is remembered so Checkout resumes once the token lands.

## Shipped — P1: checkout modal billed the wrong plan (TE-45)

| ID    | Task                                                                                                     | Status            | Owner  | Effort |
| ----- | -------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------ |
| TE-45 | Checkout modal must offer the plan the user clicked, and must never be reachable before the tier is read | done (2026-07-29) | Claude | S      |

**TE-45 user story:** As someone upgrading, I want the checkout modal to charge me for the plan whose button I pressed — and if I already subscribe, I want to be sent to the billing portal instead of an "Upgrade to Pro" button that cannot work.

**Root cause (two defects, one symptom):**

1. `PricingSection` tracked the clicked plan in `checkoutTier` and **never passed it to the modal**. `StripeCheckoutModal` kept its own `useState('pro')` and never reconciled it with the tiers on offer, so clicking **Builder → UPGRADE NOW** opened a modal preselected on Pro with an "Upgrade to Pro" CTA — a $9 Pro subscription for someone who asked for $19 Builder. `checkoutTier` was dead state from the day it was written (`d8946ba`).
2. `useTier` initialised `tier: 'free'` but flipped `hasAccount: true` immediately on sign-in, with no loading flag. Until the Firestore snapshot landed, a paying member was seen as `activePlan === 'free'`, so the upgrade CTAs and the TE-44 `pendingIntent` resume opened Checkout for them. The snapshot then arrived as `pro`, the modal's `tierOptions` collapsed to `['builder']`, and the stale `'pro'` selection was left behind — rendering a lone Builder card under an "UPGRADE TO PRO" button (the reported screenshot). `userTier === 'builder'` was worse: zero cards and a dangling CTA.

**Fix:** the modal takes `initialTier`, clamps the selection to `tierOptions` so the CTA can never name a plan that is not on offer, and resets on open. Per `docs/PAYMENTS.md`, Checkout is free → paid only, so a subscriber is now offered no tier at all — just a "Manage billing" hand-off to the portal. `useTier` exposes `tierLoading`; every plan-changing control waits for it.

**Not a billing incident:** `api/checkout.ts` already rejected both the rank case (400) and any live `stripeSubscriptionId` (409, TE-39), so no double-charge was possible. The wrong-plan default (defect 1) _was_ chargeable for free users.

## Later — P3: code health

| ID    | Task                                                                                                                        | Status | Owner | Effort |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ------ |
| TE-10 | Split `src/hooks/useIdeas.ts` (~20 KB) into `useDailyFeed` / `useIdeaMutations` / `useCustomFeed`; single `updateIdea` path | todo   | —     | M      |
| TE-11 | Remove tracked debug files from git (`tmp/probe_models*.ts`, `tmp/probe_results.txt`); add `tmp/` to `.gitignore`           | todo   | —     | S      |

**TE-10 user story:** As a developer, I want a single `updateIdea` path shared by every idea list, so the "stale idea in one list" bug class stops recurring. Pick up before the next feature touching idea lists, not during the Stripe push.

**TE-11 user story:** As a developer, I want throwaway probe scripts out of version control, so the repo contains only intentional code.

## Parked (decided, not scheduled — see DECISIONS.md for rationale)

| Item                                                    | Decision date | Revisit when                                                                 |
| ------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Time-delayed free feed (Pro at publish, Free at noon)   | 2026-07-10    | Post-Stripe, only if the value-ladder gates (TE-22…26) don't move conversion |
| App-store signal mining (Google Play / iOS reviews)     | 2026-07-08    | Post-Stripe, as per-idea _validation_ evidence, not discovery                |
| Growth guides / acquire.com / trustmrr.com integrations | 2026-07-08    | Post-Stripe, only if Wave 2 evidence layer ships                             |
| Multi-signal ML pipeline expansion                      | 2026-07-02    | Stripe proves willingness to pay                                             |
| Personalization (favorite sectors, user signals)        | 2026-07-02    | Stripe proves willingness to pay                                             |

## Recently shipped

| ID    | Task                                                                                                                                                               | Shipped    | Commits                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------- |
| TE-48 | Portal configuration applied; `stripe:verify` asserts it and fails non-zero; a Stripe-refused flow reports as a 503 with the fix, not an opaque 500                | 2026-07-29 | 8701bba                   |
| TE-47 | Paid→paid plan switching: `targetTier` portal deep links, prorated immediate upgrade, period-end downgrade + `pendingTier`, per-button state, portal config script | 2026-07-29 | 00ea80f                   |
| TE-45 | Checkout modal honours the clicked plan (`initialTier`, clamped selection); subscribers get the portal, not a broken CTA; `tierLoading` gate                       | 2026-07-29 | 065a4e8                   |
| TE-44 | Signed-out plan identity: no "current plan" claim without an account; single `PROCEED` CTA per card with post-sign-in checkout resume                              | 2026-07-29 | 308f7ec                   |
| TE-43 | Sign-out data isolation: clear saves, filters, custom feed, latest idea, Weekly Best and gated tabs when the account or tier goes away                             | 2026-07-29 | bb295a5                   |
| TE-38 | Server-truth tier UI: deleted client-side tier mutations (the `handleDowngrade` bug class); `useTier` exposes read-only `SubscriptionInfo`                         | 2026-07-29 | c6a75da, e33feeb          |
| TE-39 | Stripe Customer Portal: `POST /api/portal`, pricing-tab wiring (cancel, plan switch, invoices, cards) + 409 checkout guard against double subscriptions            | 2026-07-29 | 5616578, 318a328, a77b2b6 |
| TE-40 | Lifecycle webhooks: `customer.subscription.updated` (plan switch, cancel-at-period-end, status) + `invoice.payment_failed` (past_due flag + user alert)            | 2026-07-29 | 30503d5, e0846e1          |
| TE-41 | Expiry backstop: `getAuthContext` resolves a paid tier as free after `proEndDate` + 3-day grace; manual grants never expire                                        | 2026-07-29 | 2de45ea                   |
| TE-42 | Billing accuracy: provision with Stripe's real `current_period_end`; renewal audit rows in `stripe_transactions` (invoice-id keyed, `type` field)                  | 2026-07-29 | af8a030                   |
| TE-09 | Product analytics: `logEvent()` service + batch writes to `user_analytics`, tracks 5 core events for funnel analysis                                               | 2026-07-23 | (this commit)             |
| TE-04 | Signal observability: `qualityStats.signals` tracks per-run sourceCount + degraded flag, admin alert at zero sources                                               | 2026-07-23 | (this commit)             |
| TE-26 | Comments: Free read-only with inline "Pro feature" prompt, Pro+ can post, Firestore rules gate create by tier                                                      | 2026-07-23 | c436d58                   |
| TE-25 | Pro next-steps cap of 7 (Free 3, Builder 10), sliced by TIER_LIMITS.roadmapSteps, with tier-specific upgrade messaging                                             | 2026-07-23 | f3a45f8                   |
| TE-24 | CSV export becomes Pro+: tier gate routes Free to pricing tab, "(Pro+)" label in Export dropdown, PDF remains free                                                 | 2026-07-23 | 831afde                   |
| TE-23 | Market Evidence: server 403 gate + locked teaser button UI for Free tier, added to Pro pricing showcase                                                            | 2026-07-22 | d920a11                   |
| TE-22 | Basic-vs-Full VC analysis: lock unfair advantage, revenue model, market dynamics behind visible locked panels for Free tier                                        | 2026-07-22 | 9a35413                   |
| TE-21 | Promise/copy reconciliation: saves wording, co-founder button gating, Weekly Radar tier, Twitter/X claims, Validation Toolkit tier, Email Digest status            | 2026-07-22 | a602fef                   |
| TE-20 | `updateIdea` must sync Weekly Best list when ideas are updated across all feeds and tabs                                                                           | 2026-07-21 | 14092b6                   |
| TE-19 | Dead-UI fixes: Tailwind literal classes, footer links, FilterBar stickiness, comment timestamps                                                                    | 2026-07-21 | e9b267d                   |
| TE-17 | Cron for daily generation: automatic trigger at 06:30 UTC (before digest cron), removes admin dependency                                                           | 2026-07-21 | 2404943                   |
| TE-16 | Anonymous read path: daily feed marked public so logged-out visitors can see the product                                                                           | 2026-07-21 | 9ceb051                   |
| TE-33 | Merge code+docs workflow: eliminate serialized doc steps, single commit with BACKLOG/CHANGELOG/DECISIONS                                                           | 2026-07-21 | d985f05                   |
| TE-32 | Parallelize AI handler pipeline: pre-fetch embeddings in parallel with generation batches                                                                          | 2026-07-21 | c63cf5c                   |
| TE-29 | Dedup observability: per-run drop count + 0.75–0.85 near-miss distribution in qualityStats                                                                         | 2026-07-21 | 288f826                   |
| TE-34 | Pre-load memory manifest (hot files, key patterns, line ranges)                                                                                                    | 2026-07-21 | d6e7060                   |
| TE-28 | Tighten semantic dedup: lower threshold 0.85 → 0.80, embed headline+pitch+marketSize+revenueSkeleton                                                               | 2026-07-21 | 9e96561                   |
| TE-27 | Extend dedup window to 14 days + enrich prompt with headline + pitch per recent idea                                                                               | 2026-07-21 | b46310b                   |
| TE-15 | Anonymous lead capture: serverless endpoint accepts form submissions, stores in Firestore with server auth                                                         | 2026-07-21 | adb53ef                   |
| TE-14 | Honest waitlist flow: replace fake tier upgrades with "Join Waitlist" modal, remove deceptive UI state                                                             | 2026-07-21 | a6a6a14                   |
| TE-13 | Server-side auth + tier gates on all 8 previously-ungated generate endpoints                                                                                       | 2026-07-20 | b2bef09                   |
| TE-18 | Alerts stop generating (and spending AI budget) for Free/Pro — side effect of TE-13's Builder gate                                                                 | 2026-07-20 | b2bef09                   |
| TE-12 | Production Firestore rules: per-collection least-privilege security (prevent self-upgrade, quota tampering)                                                        | 2026-07-20 | 6fd7159                   |
| TE-01 | Restrict daily generation trigger to authed users + today's date only                                                                                              | 2026-07-08 | f11d6a7                   |
| TE-02 | Firestore-backed per-IP daily limit on daily generation (found the old limiter was dead code, never called)                                                        | 2026-07-08 | f11d6a7                   |
| —     | Project tracking system (this file, CHANGELOG, doc map, CLAUDE.md sync)                                                                                            | 2026-07-08 | (this commit)             |
| —     | Pain-point audit + remediation plan                                                                                                                                | 2026-07-08 | (this commit)             |
| —     | DECISIONS.md cross-machine decision log                                                                                                                            | 2026-07-08 | 985347f                   |
| —     | `/api/generate/*` consolidation into dispatch catch-all (Vercel Hobby 12-fn limit)                                                                                 | 2026-07-08 | 210be12, 85ab8dc          |
| —     | Custom requirement feed (Builder, 1 gen/24 h, peek/restore)                                                                                                        | 2026-07-03 | 44ec85c, b5436d8          |
| —     | Quality Engine Wave 1: critic pipeline, semantic dedup, evidence grounding, prediction tracking                                                                    | 2026-07-03 | 5608d81                   |
| —     | CI pipeline + component tests                                                                                                                                      | 2026-05-21 | 39f18be                   |
| —     | Self-learning prompt pipeline (AI critique + user reactions)                                                                                                       | 2026-05-20 | 491b7 series              |
