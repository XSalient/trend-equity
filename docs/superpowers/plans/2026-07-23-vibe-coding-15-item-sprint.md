# Vibe-Coding Sprint: 15 Remaining Items (TE-25 → TE-11)

**Goal:** Ship all P1 + P2 items in one coherent flow without breaking stride. This plan enables rapid iteration while keeping you unblocked at decision points.

**Timeline:** 3 weeks, ~5 hours focused work, parallel tracks. Quality via ruthless scoping + measured iteration, not exhaustion.

---

## How This Plan Works

- **Flow units** (not sprints): Groups of 2–3 related items that feel good to ship together
- **No ceremony**: Each unit is standalone; pick the next one when you're ready
- **Decision tree at each step**: "What's my next move?" answered by this doc
- **Live feedback loop**: Deploy, measure, iterate (not waterfall)
- **Vibe-coding friendly**: Loose structure, tight scope per unit

---

## The Big Picture: Three Parallel Flows

You're not going 1→2→3. You're weaving three themes:

```
THEME A (Value)         THEME B (Observability)    THEME C (DevX)
├─ TE-25 (1.5h)        ├─ TE-04 (1.5h)            ├─ TE-35 (2h)
├─ TE-26 (2h)          ├─ TE-09 (2h, parallel)    ├─ TE-36 (2h)
└─ Done ✓              └─ TE-04/09 merge ✓         └─ TE-37 (1.5h)

THEME D (Signal Guard)       THEME E (Diversity Tune)    THEME F (Tech Debt)
├─ TE-05 (1.5h)             ├─ TE-30 (2h)               ├─ TE-10 (1.5h)
├─ TE-06 (1.5h)             ├─ TE-31 (1.5h)             └─ TE-11 (0.5h)
├─ TE-07 (1h)               └─ Done ✓
└─ Done ✓
```

**Pick any flow when you're ready. Don't wait for one to finish before starting another.**

---

## Flow A: Tier Gates (TE-25, TE-26) — 3.5 hours

**Why together?** Same pattern (`requireTier`), same testing strategy, same deployment risk (low).

### TE-25: Enforce Pro next-steps cap (1.5h)

**What:** Use existing `TIER_LIMITS.roadmapSteps` constant to slice Next Steps (Free=3, Pro=7, Builder=10).

**Entry point:** `src/components/idea/IdeaCardActionSteps.tsx`

**Acceptance:**

- Free sees 3 steps
- Pro sees 7 steps with "Upgrade to Builder for full roadmap" note when truncated
- Builder sees all 10
- No new DB queries (use constant)

**Testing:** E2E only (open idea, scroll to steps, verify count by tier). No unit test needed; constant is static.

**Commit message:**

```
feat(ui): TE-25 Pro next-steps cap (7 vs Free 3)

- Use TIER_LIMITS.roadmapSteps to slice IdeaCardActionSteps
- Pro shows "Upgrade to Builder for full roadmap" when truncated
- Free cap already enforced in constants

Closes TE-25
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

**Done when:** Live on production, E2E passes, BACKLOG + CHANGELOG updated.

---

### TE-26: Comments tiering — Free read-only, Pro+ post (2h)

**What:** Disable comment input for Free tier; show "Posting is a Pro feature" inline prompt. Firestore rules allow comment `create` only for pro/builder (reuse TE-12's pattern).

**Entry points:**

- `src/components/idea/IdeaComments.tsx` (UI disable + prompt)
- `firestore.rules` (server-side enforce)

**Acceptance:**

- Free: reads all comments, input disabled, tooltip prompt visible
- Pro/Builder: can post
- Rules enforce server-side (direct API calls from Free still 403)
- No new data fetching

**Testing:** E2E (sign in as Free, try to post comment, see prompt; sign in as Pro, post succeeds). Firestore rules tested by existing integration tests (no new test needed, just verify `allow create` for pro/builder tier).

**Commit message:**

```
feat(ui+rules): TE-26 Comments: Free read-only, Pro+ post

- Disable comment input for Free tier with inline prompt
- Firestore rules allow comment create for pro/builder only
- Existing free-authored comments remain readable

Closes TE-26
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

**Done when:** Live, E2E passes, tier gates visible in browser, rules tested.

---

### After Flow A

**Update together:**

1. Move TE-25 and TE-26 to "Recently shipped" in `BACKLOG.md`
2. Add both to `CHANGELOG.md` with commit hashes
3. Single commit: `docs: update BACKLOG + CHANGELOG for TE-25/26`

**Deploy:** `git push origin main` → Vercel auto-deploys. Check live in ~2 min.

**Next decision:**

- If TE-04 observability data exists, start Flow D (Signal Guard)
- Else, start Flow B (Observability) so Flow D can use the data

---

## Flow B: Observability (TE-04, TE-09 in parallel) — 3.5 hours

**Why together?** Both write metrics; same Firestore transaction pattern; measure signal health + user funnel in one coherent picture.

### TE-04: Signal observability (1.5h)

**What:** Per-run signal count + degradation flag in `qualityStats`. Alert at zero signals.

**Entry points:**

- `api/_lib/signals.ts` → `getMarketSignals()` returns `{ signals, sourceCount }`
- `api/_handlers/daily.ts` → writes `qualityStats.signals = { sourceCount, degraded: false/true }`

**Acceptance:**

- Every generation logs how many signal sources ran
- If sourceCount = 0, set `degraded: true` and log admin alert
- Visible in `daily_generations` doc (browser DevTools Firestore tab)
- No user-facing UI change yet

**Testing:** Unit test (mock `getMarketSignals` returning 0 sources, verify `degraded: true`). Live spot-check: run daily generation, open Firestore, see `qualityStats` doc with counts.

**Commit message:**

```
feat(backend): TE-04 Signal observability

- qualityStats tracks sourceCount per run + degraded flag
- Admin alert logged if zero signals detected
- Visible in daily_generations_history for analysis

Closes TE-04
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-09: Product analytics (2h, parallel with TE-04)

**What:** `logEvent()` service + 5 core events (`tab_view`, `idea_save`, `quota_hit`, `upgrade_click`, `evidence_view`).

**Entry points:**

- New file: `src/services/analyticsService.ts` with `logEvent(name, context?)`
- Existing hooks: `useIdeas`, `useAuth`, tab click handlers (add 1-liner calls)
- New Firestore collection: `user_analytics/{uid}_{date}` (writes batch events)

**Acceptance:**

- 5 events fire on their respective user actions
- Events batch-write to Firestore with timestamp + user context
- No UI change; silent logging
- Works offline (events queue, sync when online if needed)

**Testing:** Unit test (mock Firestore writes, verify event shape). Live check: perform actions (save idea, click upgrade), open Firestore `user_analytics`, see events.

**Commit message:**

```
feat(analytics): TE-09 Core event logging (5 events)

- logEvent() service for batch writes to user_analytics
- Tracks tab_view, idea_save, quota_hit, upgrade_click, evidence_view
- Enables funnel analysis: save → quota_hit → upgrade_click

Closes TE-09
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### After Flow B

**Update together in one commit:**

1. Move TE-04, TE-09 to "Recently shipped" in `BACKLOG.md`
2. Add both to `CHANGELOG.md`
3. Commit: `docs: update BACKLOG + CHANGELOG for TE-04/09`

**Deploy:** `git push origin main`.

**Next decision:**

- TE-04 data now exists; start Flow D (Signal Guard) to use it
- OR continue Flow C (DevX) in parallel — both are independent

---

## Flow C: Test Infrastructure (TE-35, TE-36, TE-37) — 5.5 hours

**Why together?** Pure DevX; all three reduce future story cycle time. Can ship anytime, don't block features.

**Effort:** TE-35 (2h) + TE-36 (2h) + TE-37 (1.5h). Can overlap.

### TE-35: Smoke-test auto-verification (2h)

**What:** <10 critical routes auto-tested post-deploy. Catch regressions before you notice them.

**Entry points:**

- New file: `tests/smoke.spec.ts` (Playwright)
- Update `package.json`: `npm run test:smoke`
- Optional: hook in Vercel deployment webhook (low priority, skip if over-scoped)

**Routes to test:**

1. App loads (no errors in console)
2. Daily feed renders
3. Save/unsave an idea (auth required)
4. Tier gate visible (Free sees lock icon)
5. Pricing page loads
6. Comment section visible
7. Sign out works

**Acceptance:**

- `npm run test:smoke` passes in <30s
- Catches 90% of regressions (entry points, not exhaustive)
- No flakiness; runs deterministically

**Testing:** Run it locally. Passes before push.

**Commit message:**

```
test: TE-35 Smoke-test suite (7 critical routes)

- Catches regressions in <30s post-deploy
- Covers app load, feed render, auth, tier gates
- Run via npm run test:smoke before declaring live

Closes TE-35
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-36: Parallelize E2E tests (2h)

**What:** Shard existing Playwright tests by feature so they run in parallel (4 workers). Reduce ~5 min → ~2 min.

**Entry points:**

- `playwright.config.ts` → enable workers
- `tests/e2e/` → no test changes, just config

**Acceptance:**

- `npm run test:e2e` runs 4 tests in parallel
- No flakiness (tests are isolated by user/data)
- Snapshots still committed correctly

**Testing:** Run `npm run test:e2e`, see worker logs, verify all pass.

**Commit message:**

```
test: TE-36 Parallelize E2E tests (4 workers)

- Reduces E2E suite from ~5 min to ~2 min
- Tests isolated by user/snapshot data
- No flakiness regression

Closes TE-36
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-37: Optimize Vitest threading (1.5h)

**What:** Enable parallel threads in `vitest.config.ts`. Reduce ~2 min → ~1 min for unit tests.

**Entry points:**

- `vitest.config.ts` → add `threads: true, maxThreads: 4`

**Acceptance:**

- `npm run test:unit` runs in parallel
- No race conditions (tests don't share state)
- Watch mode still works

**Testing:** Run `npm run test:unit`, verify all pass. Check watch mode.

**Commit message:**

```
test: TE-37 Enable Vitest parallel execution

- Reduces unit tests from ~2 min to ~1 min
- No race conditions or shared state issues

Closes TE-37
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### After Flow C

**Single commit for all three:**

```bash
# Stage all test changes
git add tests/ playwright.config.ts vitest.config.ts

# Commit with all three in message
git commit -m "test: TE-35/36/37 Test infra optimization

- TE-35: Smoke-test suite (7 critical routes, <30s)
- TE-36: Parallelize E2E (4 workers, ~5min → ~2min)
- TE-37: Parallelize unit tests (~2min → ~1min)

Closes TE-35, TE-36, TE-37
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

**Then update docs in separate commit:**

```bash
git add BACKLOG.md CHANGELOG.md
git commit -m "docs: update BACKLOG + CHANGELOG for TE-35/36/37"
```

**No deploy needed yet** (pure DevX changes; benefits future stories, not users).

---

## Flow D: Signal Hardening (TE-05, TE-06, TE-07) — 4 hours

**Why together?** All touch `signals.ts` + `daily.ts`. Same testing strategy (mock external APIs). TE-04 data informs whether to even do TE-06 (if signals are reliable, maybe skip Redis cache).

**Prerequisite:** TE-04 observability data exists (run 1 daily generation to populate `qualityStats`).

### TE-05: Signal citation verification (1.5h)

**What:** Match reported `trendSources` in idea against the actual signal snapshot used at generation time. Add `signalVerified` flag.

**Entry points:**

- `api/_lib/signals.ts` → `getMarketSignals()` returns full signal objects + timestamp
- `api/_handlers/daily.ts` → pass signal snapshot to `generateWithAI()`
- `api/_lib/ai-provider.ts` → in `normalizeAIResponse()`, verify cited sources exist in snapshot

**Acceptance:**

- Idea includes `signalVerified: true/false`
- If `false`, idea gets disclaimer: "Sources cited may have changed"
- No functional change (measure first, don't drop ideas)
- Visible in DevTools Firestore

**Testing:** Unit test (mock signals, verify match). Live check: see `signalVerified` in a generated idea.

**Commit message:**

```
feat(backend): TE-05 Signal citation verification

- Verify trendSources match the signal snapshot at generation time
- Add signalVerified flag (measure first, no drops)
- Include signal snapshot in generation request

Closes TE-05
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-06: Resilient signal fetching (1.5h)

**What:** Add Reddit RSS fallback if datacenter IP gets blocked. Firestore-shared 1-hour cache so instances don't re-fetch.

**Entry points:**

- `api/_lib/signals.ts` → `getMarketSignals()` → Redis cache (or Firestore kv-style collection)
- Add `fetchRedditRSS()` fallback if main API fails

**Acceptance:**

- If Reddit API fails, fall back to RSS feed (lower freshness, but works)
- 1-hour cache shared across instances (one instance populates, all read)
- Real failure logging to Firestore `signal_failures` collection
- No user-facing change

**Testing:** Unit test (mock Reddit down, verify fallback fires). Live: if you can block Reddit, verify fallback works. Otherwise, trust the mock.

**Commit message:**

```
feat(backend): TE-06 Resilient signal fetching

- Add Reddit RSS fallback if primary API fails
- Firestore cache (1h) shared across instances
- Log failures for observability (TE-04 integration)

Closes TE-06
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-07: Generation lock hardening (1h)

**What:** Add 10-min TTL to locks; verify runId ownership; unlock in `finally` block.

**Entry points:**

- `api/_lib/cache.ts` or new `locks.ts` → `acquireLock()`, `releaseLock()`
- `api/_handlers/daily.ts` → wrap generation in try/finally

**Acceptance:**

- Locks expire after 10 min (prevent dead locks)
- Only the process that acquired a lock can release it (ownership check)
- `finally` block always releases (even if generation crashes)
- No concurrent duplicate generations possible

**Testing:** Unit test (mock slow generation + timeout, verify lock auto-expires and second call succeeds). Integration test (simulate crash mid-generation, verify lock cleanup).

**Commit message:**

```
feat(backend): TE-07 Generation lock hardening

- 10-min TTL on locks (prevent deadlock)
- Ownership check (only acquirer can release)
- Guaranteed cleanup via try/finally block

Closes TE-07
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### After Flow D

**Single commit for all three:**

```bash
git add api/
git commit -m "feat(backend): TE-05/06/07 Signal hardening

- TE-05: Citation verification (signalVerified flag)
- TE-06: Resilient fetching (Reddit RSS fallback + shared cache)
- TE-07: Lock hardening (TTL + ownership + finally cleanup)

Closes TE-05, TE-06, TE-07
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

**Update docs:**

```bash
git add BACKLOG.md CHANGELOG.md
git commit -m "docs: update BACKLOG + CHANGELOG for TE-05/06/07"
```

**Deploy:** `git push origin main`.

---

## Flow E: Diversity Tuning (TE-30, TE-31) — 3.5 hours

**Why together?** TE-29 (observability) already shipped. TE-30 is structural (diversity guard), TE-31 is tuning (volume adjust). Ship both, then measure.

**Prerequisite:** TE-29 data exists (check `daily_generations_history` for `qualityStats.dedup`).

### TE-30: Intra-day diversity guard (2h)

**What:** After critic ranking, ensure no more than K ideas from a tight similarity cluster publish in one day.

**Entry points:**

- `api/_handlers/daily.ts` → after critic ranking, add diversity pass
- `api/_lib/embeddings.ts` → new `diversityFilter()` function

**Acceptance:**

- Published set has max 2–3 ideas per tight cluster (configurable `K`)
- Remaining slots backfilled from next-best distinct candidate
- `qualityStats.diversity = { clustersDropped, backfilled }`
- Feed spans distinct problem spaces instead of echoes of one trend

**Testing:** Unit test (mock embeddings, verify clustering + filter). Live: check `qualityStats.diversity` after a generation run.

**Commit message:**

```
feat(backend): TE-30 Intra-day diversity guard

- Cluster similar ideas after critic ranking
- Max 2–3 per cluster to ensure breadth
- Backfill from next-best distinct candidates
- Log clustering stats for measurement

Closes TE-30
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-31: Right-size daily volume (1.5h)

**What:** Review TE-29 + TE-30 data; adjust `PUBLISH_COUNT` (35) and/or `CANDIDATES_PER_BATCH` based on measured diversity.

**Entry points:**

- `.env` → `PUBLISH_COUNT`, `CANDIDATES_PER_BATCH` (if low quality data exists)
- `api/_handlers/daily.ts` → constants at top

**Acceptance:**

- Data-driven tuning (not guessing)
- New constants set in `.env.example`
- Decision recorded in `DECISIONS.md`
- Feed quality measured at scale

**Testing:** Live A/B (run 3 days with new volume, compare `qualityStats` against prior week).

**Commit message:**

```
feat: TE-31 Right-size daily volume

- PUBLISH_COUNT adjusted to 30 (from 35) based on TE-29/30 data
- Reduces filler padding; improves quality perception
- Decision logged in DECISIONS.md

Closes TE-31
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### After Flow E

**Single commit:**

```bash
git add api/ .env .env.example
git commit -m "feat: TE-30/31 Diversity tuning

- TE-30: Intra-day clustering guard (max 2–3 per cluster)
- TE-31: Volume right-sized to 30 based on quality data

Closes TE-30, TE-31
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

**Update docs + decision:**

```bash
git add BACKLOG.md CHANGELOG.md DECISIONS.md
git commit -m "docs: update BACKLOG + CHANGELOG + DECISIONS for TE-30/31"
```

**Deploy:** `git push origin main`.

---

## Flow F: Tech Debt (TE-10, TE-11) — 2 hours

**Why separate?** Cleanup work; no new features. Do this when you need a breather or after shipping value flows.

### TE-10: Split useIdeas.ts (1.5h)

**What:** `useIdeas.ts` (~20 KB) → `useDailyFeed`, `useIdeaMutations`, `useCustomFeed` (single `updateIdea` path).

**Entry points:**

- `src/hooks/useIdeas.ts` → split into 3 files in `src/hooks/`
- Update imports in all tabs

**Acceptance:**

- Each hook ~6–8 KB (reasonable size)
- Single `updateIdea()` exported from all three (no duplication)
- All tabs use the same update path (fixes stale-idea bugs)
- Tests still pass

**Testing:** E2E only (update idea in one tab, verify it updates everywhere). No unit tests needed; it's a refactor of existing code.

**Commit message:**

```
refactor: TE-10 Split useIdeas into focused hooks

- useDailyFeed: daily_generations + reactions
- useIdeaMutations: single updateIdea path shared by all
- useCustomFeed: user_latest_idea + analyze logic

Eliminates stale-idea bugs from multiple update paths

Closes TE-10
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### TE-11: Clean tracked debug files (0.5h)

**What:** Remove `tmp/probe_models*.ts` and `tmp/probe_results.txt` from git; add `tmp/` to `.gitignore`.

**Entry points:**

- `.gitignore` → add `tmp/`
- `git rm --cached tmp/probe_*` → remove from tracking

**Acceptance:**

- `tmp/` not in git anymore
- `git status` shows tmp/ as untracked (if you keep it locally)
- Repo contains only intentional code

**Commit message:**

```
chore: TE-11 Remove tracked debug files

- git rm --cached tmp/probe_models.ts, tmp/probe_results.txt
- Add tmp/ to .gitignore
- Cleanup: repo now contains only committed code

Closes TE-11
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

### After Flow F

**Single commit:**

```bash
git add src/hooks/ .gitignore
git commit -m "refactor+chore: TE-10/11 Code cleanup

- TE-10: Split useIdeas into useDailyFeed/useMutations/useCustomFeed
- TE-11: Remove tracked debug files, add tmp/ to .gitignore

Closes TE-10, TE-11
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

**Update docs:**

```bash
git add BACKLOG.md CHANGELOG.md
git commit -m "docs: update BACKLOG + CHANGELOG for TE-10/11"
```

**No deploy needed** (internal refactor, safe anytime).

---

## Vibe-Coding Decision Tree

**"What do I ship next?"**

```
Start here:
├─ If you want to feel immediate user impact → Flow A (TE-25/26)
├─ If you want data for future decisions → Flow B (TE-04/09)
├─ If you want to speed up future work → Flow C (TE-35/36/37)
├─ If Flow A is done + TE-04 data exists → Flow D (TE-05/06/07)
├─ If TE-04/29 data exists → Flow E (TE-30/31)
└─ If you need a mental break → Flow F (TE-10/11)

"I'm stuck on Flow X"
├─ Deployment failed? Check Vercel logs → re-push with `git push origin main -f` only if you broke main
├─ Test flaky? Run it 3x locally → if flaky everywhere, it's a real bug; investigate
├─ Bored with this flow? Jump to another → come back to it later (all are independent)
└─ Over-scoped? Cut acceptance criteria → ship MVP, add polish in a follow-up TE

"Everything is done"
├─ TE-08 (Stripe) needs its own large plan → schedule for next week
├─ TE-34 (memory manifest) already shipped → you have the hot files list
└─ Ship a small fix? → use same workflow (plan, code, test, push, verify)
```

---

## Reality Check: What Could Go Wrong

| Risk                                    | Mitigation                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Test flakiness slows you down           | Run E2E locally 2x before pushing; use `test:e2e:ui` for debugging            |
| Firestore rules break something         | Test rules locally in emulator (`npm run emulator`) before prod change        |
| Vercel deployment takes 5+ min          | Normal; grab coffee. Verify smoke tests post-deploy.                          |
| You change your mind mid-flow           | Fine. Commit what you have, switch flows, come back later. Git has your back. |
| TE-04 shows signals are broken          | Fix it before TE-05/06/07 (can be quick, or punt to next cycle).              |
| One flow takes 2x longer than estimated | That's ok; flows are independent. Others still ship on schedule.              |

---

## Success Metrics (How You Know You're Done)

- [ ] TE-25/26: Live on production, tier gates visible
- [ ] TE-04/09: Firestore has signal counts + analytics events
- [ ] TE-35/36/37: All tests pass in parallel; future stories are 30% faster
- [ ] TE-05/06/07: Signals resilient; `signalVerified` visible in Firestore
- [ ] TE-30/31: Feed spans distinct problem spaces; volume tuned to data
- [ ] TE-10/11: Single `updateIdea` path shared; git is clean

**All 15 items done:** 15 rows in "Recently shipped", 15 CHANGELOG entries, `git log` shows clean commits with proper co-author lines.

---

## After All 15 Are Shipped

1. Update `DECISIONS.md` with any decisions made along the way (especially TE-31 volume tuning)
2. Review `docs/BACKLOG.md` — TE-08 (Stripe) is next; it needs its own plan
3. Consider a "post-sprint" review: measure user impact of TE-25/26/30 (did tier gates move conversion?)
4. Take a break. Seriously. 15 items is a sprint.

---

## Running This Plan

**Week 1 (Mon–Wed):**

- Monday morning: Start Flow A (TE-25/26), ship by EOD Tuesday
- Tuesday afternoon: Start Flow B (TE-04 parallel with TE-09)
- Wednesday: Finish Flow B, push to prod, start Flow C if you want

**Week 1–2 (Thu–Mon):**

- Flow C in parallel (test infra ships whenever ready)
- Flow D starts Wed once TE-04 data exists
- End of weekend: TE-04/09/05/06/07 live

**Week 2–3 (Tue–Fri):**

- Flow E: measure TE-29 data, tune TE-30/31
- Flow F: cleanup TE-10/11 when you need mental breathing room
- End of week 3: all 15 shipped

**Not a hard timeline; vibe-coding means you flow between them.**

---

## TL;DR

Ship 15 items in one coherent vibe by:

1. **Pick a flow** (A, B, C, D, E, F)
2. **Code, test, commit, push** (30 min to 2 hours each item)
3. **Move to next flow** when done or bored
4. **Update BACKLOG/CHANGELOG in batches** (3-4 items per docs commit)
5. **Measure impact** (TE-04/09 data informs TE-30/31)
6. **Celebrate when all 15 are live** 🚀

No sprints, no standups, no daily syncs. Just flow.
