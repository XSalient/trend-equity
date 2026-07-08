# Pain-Point Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 8 and 9 are large — expand each into its own detailed plan before executing.

**Goal:** Close the cost-abuse holes in the daily generation endpoint, make the "grounded in live signals" claim verifiable and observable, and unblock willingness-to-pay learning — the three pain-point clusters identified in the 2026-07-08 audit.

**Architecture:** All backend changes stay inside the existing dispatch pattern (`api/generate/dispatch.ts` → `api/_handlers/*`, shared logic in `api/_lib/`). No new top-level `api/**` functions except the Stripe webhook (Task 8), which must be counted against the Vercel Hobby 12-function limit. Firestore remains the only cross-instance state store.

**Tech Stack:** TypeScript, Vercel serverless, Firebase Admin (Firestore), Gemini via `ai-provider.ts`, Vitest for unit tests.

**Priority legend:** P0 = stop the bleeding (this week) · P1 = protect the differentiator · P2 = prove the business · P3 = code health

---

## Task Summary

| #   | Task                                     | Priority | Effort | Pain point addressed                             |
| --- | ---------------------------------------- | -------- | ------ | ------------------------------------------------ |
| 1   | Lock down daily generation trigger       | P0       | S      | Anonymous/arbitrary-date cost abuse              |
| 2   | Firestore-backed IP rate limiting        | P0       | S      | In-memory limit is per-instance, effectively off |
| 3   | Fix CLAUDE.md drift                      | P0       | S      | Stale docs mislead every agent session           |
| 4   | Signal observability in qualityStats     | P1       | S      | Silent signal degradation                        |
| 5   | Signal citation verification             | P1       | M      | "Grounded" claim is on the honor system          |
| 6   | Resilient signal fetching + shared cache | P1       | M      | Reddit blocks datacenter IPs; per-instance cache |
| 7   | Generation lock hardening                | P1       | S      | 5-min lock TTL can double-spend                  |
| 8   | Stripe monetization                      | P2       | L      | No willingness-to-pay data                       |
| 9   | Product analytics events                 | P2       | M      | No visibility into real user pain                |
| 10  | Split `useIdeas.ts`                      | P3       | M      | 20 KB hook, recurring list-sync bugs             |

---

### Task 1: Lock down daily generation trigger

**User story:** As the product owner, I want the expensive AI generation path to be triggerable only by authenticated users and only for today's date, so that an attacker cannot burn my Gemini budget by POSTing arbitrary dates anonymously.

**Files:**

- Modify: `api/_handlers/daily.ts` (guards after the singleton check, ~line 64)
- Test: `tests/unit/daily-guards.test.ts` (create)

**Acceptance criteria:**

- Requesting a date that already has a `daily_generations` doc returns it unchanged (past-date reads keep working, any auth state).
- Requesting an **uncached** date that is not the server's `getToday()` returns `404 { error: 'No generation exists for that date.' }` — it must never trigger generation.
- Requesting an uncached **today** without authentication returns `401 { error: 'Sign in to load today's feed.' }`.
- Authenticated request for uncached today proceeds to generation (current behavior).
- Admin `refresh` behavior is unchanged.

- [ ] **Step 1:** Write failing unit tests for the four cases above (mock `getAdminDb`, `getAuthContext`).
- [ ] **Step 2:** Run `npm run test:unit -- daily-guards` — expect 4 failures.
- [ ] **Step 3:** In `daily.ts`, after the singleton check and before the lock, add:
  ```ts
  // Generation may only be triggered for today's date, by a signed-in user.
  if (today !== getToday()) {
    return res.status(404).json({ error: 'No generation exists for that date.' });
  }
  if (!uid) {
    return res.status(401).json({ error: "Sign in to load today's feed." });
  }
  ```
- [ ] **Step 4:** Run tests — expect PASS. Verify locally with `npm run dev:mock` that an anonymous first load of today shows the sign-in message instead of generating.
- [ ] **Step 5:** Commit: `fix(api): restrict daily generation trigger to authed users and today's date`

---

### Task 2: Firestore-backed IP rate limiting

**User story:** As the product owner, I want request limits enforced across all serverless instances, so that cold starts and instance fan-out cannot be used to bypass the per-IP cap.

**Files:**

- Modify: `api/_lib/usage.ts` (add `checkAndIncrementIpLimit`)
- Modify: `api/_handlers/daily.ts` (replace `_ipCounts` Map, lines 19–32)
- Test: `tests/unit/ip-limit.test.ts` (create)

**Acceptance criteria:**

- Counter lives in Firestore `api_usage/ip_{sha256(ip).slice(0,16)}_{date}` (hashed — never store raw IPs).
- Uses the same check-before-increment transaction pattern as `checkAndIncrementUsage`.
- Applied only on the generation-trigger path (cached reads stay cheap).
- The in-memory `_ipCounts` Map is deleted.
- Fail-open on Firestore errors is retained but logs a `[usage] fail-open` warning so occurrences are countable in logs (accepted risk, now visible).

- [ ] **Step 1:** Write failing test: 6th call for same hashed IP/date returns `allowed: false`; different date resets.
- [ ] **Step 2:** Implement `checkAndIncrementIpLimit(ip: string, limit = 5)` in `usage.ts`, reusing the transaction body of `checkAndIncrementUsage`.
- [ ] **Step 3:** In `daily.ts`, call it right before the lock step; return `429` when denied. Remove the Map and `checkIpRateLimit`.
- [ ] **Step 4:** Run `npm run test:unit` — all pass.
- [ ] **Step 5:** Commit: `fix(api): move IP rate limiting to Firestore so it survives instances`

---

### Task 3: Fix CLAUDE.md drift

**User story:** As a developer who builds with AI agents, I want CLAUDE.md to describe the codebase as it actually is, so that every future agent session starts from truth instead of confidently wrong context.

**Files:**

- Modify: `CLAUDE.md`

**Acceptance criteria — corrections applied:**

- `cache.ts` documented as Firestore-backed (`api_cache`, 24 h TTL), not in-memory.
- `rate-limiter.ts` reference removed; quota logic documented as `usage.ts` (daily + monthly Firestore counters) plus the Task 2 IP limiter.
- Daily generation trigger policy documented per Task 1 (authed users trigger today's initial run; admins only for refresh) — replacing the incorrect "only builder tier can trigger".
- New `api/_lib/` modules get one line each: `signals.ts`, `quality-engine.ts`, `embeddings.ts`, `prompt-optimizer.ts`, `evidence.ts`, `prediction-tracker.ts`, `idea-quality.ts`, `tier-config.ts`.
- Firestore table gains `api_cache`, `api_usage`, `daily_generations_history`, `idea_embeddings` (verify collection name in `embeddings.ts` before writing).

- [ ] **Step 1:** Read `embeddings.ts`, `prompt-optimizer.ts`, `quality-engine.ts` headers to confirm collection names and one-line descriptions.
- [ ] **Step 2:** Apply the edits above. Do this task **after** Tasks 1–2 so the documented policy matches shipped code.
- [ ] **Step 3:** Commit: `docs: sync CLAUDE.md with actual backend architecture`

---

### Task 4: Signal observability in qualityStats

**User story:** As the product owner, I want every daily generation to record how many live signals it was grounded in — and to alert me when that number is zero — so I know whether my core differentiator actually ran.

**Files:**

- Modify: `api/_handlers/daily.ts` (qualityStats assembly, ~line 203)
- Modify: `api/_lib/signals.ts` (export a `countSignals(signals)` helper)
- Test: `tests/unit/signals-observability.test.ts` (create)

**Acceptance criteria:**

- `finalData.qualityStats.signals = { google, productHunt, reddit, hn, techCrunch, total, sourcesCached, fetchedAt }`.
- When `total === 0`: the daily doc gets `signalsDegraded: true`, and an alert doc is written to `user_alerts` targeted at the admin uid (reuse the existing alert shape from `api/_handlers/alerts.ts`).
- Generation still proceeds when degraded (availability over purity), but the condition is never silent.

- [ ] **Step 1:** Write failing test: given a mocked zero-signal `fetchLiveSignals`, the stored doc has `signalsDegraded: true` and an alert write occurs.
- [ ] **Step 2:** Implement `countSignals` in `signals.ts`; wire counts + flag + alert into `daily.ts`.
- [ ] **Step 3:** Run `npm run test:unit` — pass.
- [ ] **Step 4:** Commit: `feat(api): record per-source signal counts and alert on degraded generation`

---

### Task 5: Signal citation verification

**User story:** As a user evaluating an idea, I want its cited trend sources to provably match signals that existed at generation time, so that "grounded in real signals" is a verifiable claim and not model self-assertion.

**Files:**

- Modify: `api/_lib/idea-quality.ts` (add `verifySignalCitations`)
- Modify: `api/_handlers/daily.ts` (call after `critiqueAndRank`; persist signal snapshot)
- Test: `tests/unit/verify-citations.test.ts` (create)

**Acceptance criteria:**

- The full `LiveSignals` snapshot is persisted with the run in `daily_generations_history` (not the public doc — keep payload small).
- `verifySignalCitations(ideas, signals)` marks each idea `signalVerified: boolean` using normalized token-overlap (≥ 2 significant shared tokens, ≥ 4 chars, stopwords removed) between each `trendSources` entry and the flattened signal list.
- `qualityStats.citationVerifiedCount` records how many published ideas verified.
- **Measure-first policy:** unverified ideas are flagged, not dropped. Revisit dropping after 2 weeks of data.
- (Follow-up UI slice, separate commit: "Verified signal" badge on `IdeaCard` when `signalVerified === true`.)

- [ ] **Step 1:** Write failing tests: idea citing "AI tutoring for nurses" verifies against signal `"Ask HN: AI tutoring for nursing exams (312 pts)"`; idea citing an absent trend gets `signalVerified: false`; empty-signal runs mark all ideas unverified without throwing.
- [ ] **Step 2:** Implement the matcher in `idea-quality.ts` (pure function, no I/O — trivially testable).
- [ ] **Step 3:** Wire into `daily.ts` after the critic; add snapshot to the history doc write.
- [ ] **Step 4:** Run `npm run test:unit` — pass. Run one `npm run dev:live` generation and eyeball the verification rate in the history doc.
- [ ] **Step 5:** Commit: `feat(api): verify idea trend citations against the live signal snapshot`

---

### Task 6: Resilient signal fetching + shared cache

**User story:** As the product owner, I want signal fetching to survive Reddit's datacenter-IP blocking and to share one cache across serverless instances, so production generations are consistently grounded and external APIs aren't hammered.

**Files:**

- Modify: `api/_lib/signals.ts`
- Modify: `api/_lib/cache.ts` (accept optional TTL in `getCached`/`setCached`)
- Test: `tests/unit/signals-fallback.test.ts` (create)

**Acceptance criteria:**

- Each fetcher logs failures with URL + HTTP status (`console.warn('[signals] reddit failed: 403')`) instead of swallowing silently.
- Reddit: when the JSON endpoint returns non-OK, fall back to the RSS feed `https://www.reddit.com/r/SaaS+startups+Entrepreneur+smallbusiness/hot/.rss` parsed with the existing `extractRssItems` (titles only — upvote filter is lost in fallback; acceptable).
- Cross-instance cache: `fetchLiveSignals` reads/writes Firestore key `api_cache/live_signals` with a 1-hour TTL (via the new TTL parameter). The in-memory `_cache` stays as an L1 in front of it.
- All existing behavior (Promise.allSettled isolation, only-cache-when-nonempty) preserved; `[DEBUG]` log noise removed while in there.

- [ ] **Step 1:** Write failing tests for the TTL parameter on `getCached` and for the Reddit JSON→RSS fallback (mock `fetch`).
- [ ] **Step 2:** Add `ttlMs` param to `cache.ts` functions (default stays 24 h).
- [ ] **Step 3:** Implement fallback + Firestore L2 cache + failure logging in `signals.ts`.
- [ ] **Step 4:** Run `npm run test:unit` — pass.
- [ ] **Step 5:** Commit: `feat(api): reddit RSS fallback and cross-instance signal cache`

---

### Task 7: Generation lock hardening

**User story:** As the product owner, I want exactly one generation run per day no matter how requests race, so that a slow run can never double my AI spend.

**Files:**

- Modify: `api/_handlers/daily.ts` (lock block, lines 77–90 and the catch)
- Test: `tests/unit/daily-lock.test.ts` (create)

**Acceptance criteria:**

- Lock staleness window raised from 5 to 10 minutes (Vercel max duration is 300 s, so a genuinely dead run frees within 10 min; a live run can no longer be overtaken).
- Lock deletion moved to a `finally` block — one code path for success and failure (the duplicated unlock in `catch` is removed).
- Each run writes a `runId` into the lock; before the final `docRef.set`, the run re-reads the lock and aborts persisting if another run now owns it (last-line defense against double-publish).

- [ ] **Step 1:** Write failing test: a lock 6 minutes old blocks a second run (today it steals it).
- [ ] **Step 2:** Implement TTL change, `runId` ownership check, and `finally` unlock.
- [ ] **Step 3:** Run `npm run test:unit` — pass.
- [ ] **Step 4:** Commit: `fix(api): harden daily generation lock against slow-run races`

---

### Task 8: Stripe monetization (expand into its own plan before executing)

**User story:** As a free user who just hit my daily quota, I want to upgrade to Pro with a card in under a minute, so I can keep working — and as the owner, I finally learn whether anyone pays, which gates the entire Wave 2 roadmap.

**Files (outline):**

- Create: `api/_handlers/billing.ts` (checkout-session + customer-portal creation, routed through the existing dispatch map)
- Create: `api/stripe-webhook.ts` (**new top-level function** — Stripe needs a raw-body endpoint outside the JSON dispatch path; verify current function count stays ≤ 12 before starting)
- Modify: `api/generate/dispatch.ts` (add `billing` map entry), `vercel.json` (webhook route)
- Modify: `src/hooks/useTier.ts`, quota-hit UI states (upgrade CTA)
- Test: `tests/unit/billing-webhook.test.ts`

**Scope decisions locked in now:**

- Products: Pro monthly + Builder monthly only. No annual, no trials, no coupons at launch (YAGNI).
- Webhook (`checkout.session.completed`, `customer.subscription.deleted`) is the **only** writer of `users/{uid}.tier` — the client never sets tier, consistent with the existing server-side tier lookup in `auth.ts`.
- Signature verification via `stripe.webhooks.constructEvent` with the raw body; reject on failure.
- Cancellation → tier reverts to `free` on `subscription.deleted`.

**Acceptance criteria:** a real test-mode card upgrades a free account to Pro without redeploy; cancellation downgrades within one webhook delivery; `firestore.rules` still block client-side tier writes.

- [ ] **Step 1:** Confirm deployed function count has headroom for one more (`api/` top-level files + dispatch).
- [ ] **Step 2:** Expand this task into `docs/superpowers/plans/2026-XX-XX-stripe-integration.md` with full TDD steps, then execute that plan.

---

### Task 9: Product analytics events

**User story:** As the product owner, I want to see which tabs users open, what they save, and where they hit quota walls, so I can prioritize from evidence instead of intuition — and answer "what are my app's pain points" from data next time.

**Files:**

- Create: `src/services/analytics.ts` (single `logEvent(name, props)` — fire-and-forget `addDoc` to Firestore `analytics_events`, silently no-ops on failure, never blocks UI)
- Modify: `App.tsx` (tab-switch events), `src/hooks/useIdeaActions.ts` (save/unsave), quota-hit UI paths (limit-reached events), upgrade CTA (click event, feeds Task 8 conversion funnel)
- Modify: `firestore.rules` (authenticated users may **create** `analytics_events`; no read/update/delete from clients)
- Test: `tests/unit/analytics.test.ts` (event shape; no-throw on write failure)

**Acceptance criteria:**

- Event doc shape: `{ uid, event, props, tier, at: serverTimestamp() }` — no free-text PII in `props`.
- Five events instrumented: `tab_view`, `idea_save`, `quota_hit`, `upgrade_click`, `evidence_view`.
- A failed analytics write is invisible to the user (verified by test).
- Reading/aggregating stays out of scope — query via Firebase console until volume justifies an admin view (YAGNI).

- [ ] **Step 1:** Write failing tests for event shape and failure-swallowing.
- [ ] **Step 2:** Implement `analytics.ts`; instrument the five call sites; update `firestore.rules`.
- [ ] **Step 3:** `npm run test:unit` + `npm run dev:mock`, click through tabs, confirm event docs appear.
- [ ] **Step 4:** Commit: `feat: minimal product analytics events`

---

### Task 10: Split `useIdeas.ts`

**User story:** As the developer of this app, I want idea state management decomposed into focused hooks with a single shared update path, so the "updated idea in one list, stale in another" bug class stops recurring.

**Files:**

- Modify: `src/hooks/useIdeas.ts` (becomes a thin composition/orchestration hook)
- Create: `src/hooks/useDailyFeed.ts`, `src/hooks/useIdeaMutations.ts`, `src/hooks/useCustomFeed.ts`
- Test: extend E2E coverage (`tests/e2e/`) for the save→update→visible-everywhere flow rather than unit-testing hook internals (per project testing guidance)

**Acceptance criteria:**

- `updateIdea` lives **only** in `useIdeaMutations` and updates every idea list (daily, saved, custom, latest) — the invariant from the custom-feed memory note, now enforced structurally.
- Each new hook < 300 lines; public API of `useIdeas` unchanged for consumers (`App.tsx` and tabs compile without edits, or with mechanical import changes only).
- `npm run check` and both test suites pass; manual smoke test of save/refresh/peek-restore flows in `dev:mock`.

- [ ] **Step 1:** Read current `useIdeas.ts` fully and map its responsibilities to the three hooks before moving code.
- [ ] **Step 2:** Extract in three commits (one per hook), running `npm run check` + E2E after each.
- [ ] **Step 3:** Final commit: `refactor: split useIdeas into focused hooks with single updateIdea path`

---

## Sequencing

1. **Week 1 (P0):** Tasks 1 → 2 → 3 (3 is last so docs match shipped behavior). Independent of everything else; ship immediately.
2. **Week 2 (P1):** Task 4 → 6 → 5 (observability first — it tells you how bad the Reddit problem actually is before you fix it; verification last since it builds on the snapshot). Task 7 anytime, it's independent.
3. **Weeks 3–4 (P2):** Task 8 expanded into its own plan and executed. Task 9 can run in parallel — its `upgrade_click`/`quota_hit` events are exactly the funnel Stripe needs on day one.
4. **Whenever between waves (P3):** Task 10 — pick it up before the next feature that touches idea lists, not during the Stripe push.

**Explicitly deferred (unchanged decisions):** app-store signal mining (lagging indicator, scraping burden), multi-signal pipeline expansion, personalization — all gated on Stripe evidence per the positioning strategy.
