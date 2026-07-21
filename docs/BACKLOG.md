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
| TE-16 | Anonymous read path for the daily feed (public flag + rules, or API read) so logged-out visitors see the product                                                                                    | todo              | —      | S      |
| TE-17 | Cron for daily generation (before the 07:00 UTC digest cron) — remove dependence on a human admin                                                                                                   | todo              | —      | S      |
| TE-18 | Alerts: generate only for Builder tier; stop hidden AI spend for Free/Pro who can't see the bell                                                                                                    | done (2026-07-20) | Claude | S      |
| TE-19 | Dead-UI fixes: 2 dead upgrade buttons, footer legal links, click-to-open export menu (touch), comment relative timestamps, FilterBar top-16 stickiness, Tailwind literal classes in PricingSection  | todo              | —      | M      |
| TE-20 | `updateIdea` must also sync the Weekly Best list (fold into TE-10 hook split)                                                                                                                       | todo              | —      | S      |
| TE-21 | Promise/copy reconciliation: saves wording, dead digest weekly toggle, co-founder button, X/Twitter signal claims, PRD digest + validation-toolkit tier corrections (next-steps cap moved to TE-25) | todo              | —      | M      |

**TE-18 note:** shipped as a side effect of TE-13 — `alerts.ts` now 403s below Builder tier, so `useAlerts`'s per-signed-in-user generation attempt can no longer trigger AI spend for Free/Pro (it just gets a harmless rejected call). The client still fires that doomed request rather than skipping it client-side; leaving that micro-optimization out of scope here.

## Next — P1 (wave 3): free-tier value ladder

Decision + full rationale: [Free-Tier Value Ladder (DECISIONS.md, 2026-07-10)](../DECISIONS.md). Sequencing: all of these gates are cosmetic until TE-12 (rules) and TE-13 (server tier guards) ship — implement TE-23…TE-26 on top of TE-13's `requireTier` helper.

| ID    | Task                                                                                                               | Status | Owner | Effort |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ------ | ----- | ------ |
| TE-22 | Basic-vs-Full VC analysis: lock unfair advantage, revenue model & market dynamics behind a visible upsell for Free | todo   | —     | M      |
| TE-23 | Market Evidence becomes Pro+: server gate in `evidence.ts` + locked teaser button for Free                         | todo   | —     | S      |
| TE-24 | CSV export becomes Pro+: gate the FilterBar export option, match the PDF-only Free promise                         | todo   | —     | S      |
| TE-25 | Enforce Pro next-steps cap of 7 using the existing (currently dead) `TIER_LIMITS.roadmapSteps` constant            | todo   | —     | S      |
| TE-26 | Comments tiering: Free read-only, Pro+ can post — rules + UI state with inline upgrade prompt                      | todo   | —     | M      |

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
| TE-33 | Merge code+docs workflow (update BACKLOG/CHANGELOG inline, single commit)          | todo              | —      | S      |
| TE-35 | Auto-verify deployments (smoke-test key routes post-Vercel push)                   | todo              | —      | M      |
| TE-36 | Shard E2E tests by feature area (parallel Playwright execution)                    | todo              | —      | M      |
| TE-37 | Optimize Vitest threading (enable parallel test execution)                         | todo              | —      | S      |

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
| TE-04 | Signal observability: per-source counts in `qualityStats`, `signalsDegraded` flag, admin alert at zero                            | todo   | —     | S      |
| TE-05 | Signal citation verification: match `trendSources` against the signal snapshot, `signalVerified` flag (measure-first, don't drop) | todo   | —     | M      |
| TE-06 | Resilient signal fetching: Reddit RSS fallback, Firestore-shared 1 h cache, real failure logging                                  | todo   | —     | M      |
| TE-07 | Generation lock hardening: 10-min TTL, runId ownership check, unlock in `finally`                                                 | todo   | —     | S      |

**TE-04 user story:** As the product owner, I want every generation to record how many live signals it used — and an alert at zero — so I know my core differentiator actually ran.

**TE-05 user story:** As a user evaluating an idea, I want its cited trend sources to provably match signals that existed at generation time, so grounding is verifiable, not model self-assertion.

**TE-06 user story:** As the product owner, I want signal fetching to survive Reddit's datacenter-IP blocking and share one cache across instances, so production generations are consistently grounded.

**TE-07 user story:** As the product owner, I want exactly one generation run per day regardless of request races, so a slow run can never double AI spend.

Sequencing note: do TE-04 before TE-06 — observability first tells us how bad the Reddit problem actually is.

## Later — P2: prove the business

| ID    | Task                                                                                                                        | Status | Owner | Effort |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ------ |
| TE-08 | Stripe monetization: checkout + webhook as sole writer of `users/{uid}.tier`; Pro/Builder monthly only                      | todo   | —     | L      |
| TE-09 | Product analytics: `logEvent()` service + 5 events (`tab_view`, `idea_save`, `quota_hit`, `upgrade_click`, `evidence_view`) | todo   | —     | M      |

**TE-08 user story:** As a free user who hit my quota, I want to upgrade to Pro with a card in under a minute — and as the owner, I finally learn whether anyone pays, which gates the entire Wave 2 roadmap.
⚠ Expand into its own plan before executing; needs a new top-level function for the webhook — verify the Vercel Hobby 12-function count first.

**TE-09 user story:** As the product owner, I want to see which tabs get used and where users hit walls, so I can prioritize from evidence instead of intuition. Runs well in parallel with TE-08 — `quota_hit`/`upgrade_click` are the Stripe conversion funnel.

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

| ID    | Task                                                                                                        | Shipped    | Commits          |
| ----- | ----------------------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| TE-32 | Parallelize AI handler pipeline: pre-fetch embeddings in parallel with generation batches                   | 2026-07-21 | c63cf5c          |
| TE-29 | Dedup observability: per-run drop count + 0.75–0.85 near-miss distribution in qualityStats                  | 2026-07-21 | 288f826          |
| TE-34 | Pre-load memory manifest (hot files, key patterns, line ranges)                                             | 2026-07-21 | d6e7060          |
| TE-28 | Tighten semantic dedup: lower threshold 0.85 → 0.80, embed headline+pitch+marketSize+revenueSkeleton        | 2026-07-21 | 9e96561          |
| TE-27 | Extend dedup window to 14 days + enrich prompt with headline + pitch per recent idea                        | 2026-07-21 | b46310b          |
| TE-15 | Anonymous lead capture: serverless endpoint accepts form submissions, stores in Firestore with server auth  | 2026-07-21 | (this commit)    |
| TE-14 | Honest waitlist flow: replace fake tier upgrades with "Join Waitlist" modal, remove deceptive UI state      | 2026-07-21 | a6a6a14          |
| TE-13 | Server-side auth + tier gates on all 8 previously-ungated generate endpoints                                | 2026-07-20 | (this commit)    |
| TE-18 | Alerts stop generating (and spending AI budget) for Free/Pro — side effect of TE-13's Builder gate          | 2026-07-20 | (this commit)    |
| TE-12 | Production Firestore rules: per-collection least-privilege security (prevent self-upgrade, quota tampering) | 2026-07-20 | 6fd7159          |
| TE-01 | Restrict daily generation trigger to authed users + today's date only                                       | 2026-07-08 | (this commit)    |
| TE-02 | Firestore-backed per-IP daily limit on daily generation (found the old limiter was dead code, never called) | 2026-07-08 | (this commit)    |
| —     | Project tracking system (this file, CHANGELOG, doc map, CLAUDE.md sync)                                     | 2026-07-08 | (this commit)    |
| —     | Pain-point audit + remediation plan                                                                         | 2026-07-08 | (this commit)    |
| —     | DECISIONS.md cross-machine decision log                                                                     | 2026-07-08 | 985347f          |
| —     | `/api/generate/*` consolidation into dispatch catch-all (Vercel Hobby 12-fn limit)                          | 2026-07-08 | 210be12, 85ab8dc |
| —     | Custom requirement feed (Builder, 1 gen/24 h, peek/restore)                                                 | 2026-07-03 | 44ec85c, b5436d8 |
| —     | Quality Engine Wave 1: critic pipeline, semantic dedup, evidence grounding, prediction tracking             | 2026-07-03 | 5608d81          |
| —     | CI pipeline + component tests                                                                               | 2026-05-21 | 39f18be          |
| —     | Self-learning prompt pipeline (AI critique + user reactions)                                                | 2026-05-20 | 491b7 series     |
