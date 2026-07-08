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

| Item                                                    | Decision date | Revisit when                                                  |
| ------------------------------------------------------- | ------------- | ------------------------------------------------------------- |
| App-store signal mining (Google Play / iOS reviews)     | 2026-07-08    | Post-Stripe, as per-idea _validation_ evidence, not discovery |
| Growth guides / acquire.com / trustmrr.com integrations | 2026-07-08    | Post-Stripe, only if Wave 2 evidence layer ships              |
| Multi-signal ML pipeline expansion                      | 2026-07-02    | Stripe proves willingness to pay                              |
| Personalization (favorite sectors, user signals)        | 2026-07-02    | Stripe proves willingness to pay                              |

## Recently shipped

| ID    | Task                                                                                                        | Shipped    | Commits          |
| ----- | ----------------------------------------------------------------------------------------------------------- | ---------- | ---------------- |
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
