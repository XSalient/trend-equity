# Agent & Generation Pipeline Performance Optimization Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce agent story completion time from ~30 min to ~15 min by eliminating redundant discovery, parallelizing independent backend operations, and streamlining the post-story workflow. This unlocks faster iteration velocity and improves context efficiency.

**Architecture:**

- Backend: Parallelize AI handler pipeline operations (`generateWithAI`, `semanticDedup`, `fetchEvidence` can run in parallel where independent)
- Agent workflow: Merge documentation updates into code-writing phase, pre-load hot-file context
- Testing: Enable parallel E2E test sharding, parallelize Vitest runs
- Deployment: Auto-verify key routes after Vercel push without manual browser testing

**Tech Stack:** TypeScript, Vercel, Firebase, Vitest, Playwright, Git workflow

**Context:** This epic is data-driven by the 2026-07-21 agent profiling analysis. See [issue analysis](../../BACKLOG.md) for detailed bottleneck breakdown.

---

## Task Summary

| #   | Task                                                           | Priority | Effort | Time saved    |
| --- | -------------------------------------------------------------- | -------- | ------ | ------------- |
| 1   | Parallelize AI handler pipeline (Promise.all dedup + evidence) | P1       | M      | 5–6s/call     |
| 2   | Merge docs+code workflow (update BACKLOG/CHANGELOG inline)     | P1       | S      | 2 min/story   |
| 3   | Pre-load memory manifest for hot files & patterns              | P1       | S      | 3–4 min/story |
| 4   | Auto-verify deployments (smoke-test key routes post-push)      | P1       | M      | 2 min/story   |
| 5   | Shard E2E tests by feature area (parallel Playwright)          | P2       | M      | 2–3 min/story |
| 6   | Optimize Vitest threading (enable parallel test execution)     | P2       | S      | 1–2 min/story |

---

## Task 1: Parallelize AI Handler Pipeline

**User story:** As an agent executing generation requests, I want the AI handler to fetch embeddings and market signals in parallel with the main generation call, so that independent operations don't serialize and add latency unnecessarily.

**Current behavior:**

```ts
const aiResult = await generateWithAI(...);        // 8s
const deduped = await semanticDedupeCandidates(aiResult); // 2s (waits for aiResult)
const evidence = await fetchEvidence(aiResult);   // 2–3s (waits for aiResult)
```

**Total:** ~12–13s. Only the final 2s is necessary waiting.

**Target behavior:**

```ts
const [aiResult, priorEmbeddings, signals] = await Promise.all([
  generateWithAI(...),         // 8s (in parallel)
  getRecentEmbeddings(),       // 1.5s (in parallel)
  getMarketSignals(),          // 1s (in parallel)
]);
const deduped = await semanticDedupeCandidates(aiResult, priorEmbeddings); // 2s
const evidence = await fetchEvidence(aiResult, signals);  // 1s (cached signals)
```

**Total:** ~10–11s. Saves 2–3s per call by pre-fetching independent data.

**Files:**

- Modify: `api/_lib/ai-provider.ts` (if handler logic is centralized)
- Modify: `api/_handlers/daily.ts` (or wherever `generateWithAI` is called)
- Modify: `api/_handlers/analyze-idea.ts` (same pattern)
- Test: Add parallel execution tests to `tests/unit/api/daily.test.ts`

**Acceptance criteria:**

- [ ] Pre-fetch `getRecentEmbeddings()` and `getMarketSignals()` in parallel with `generateWithAI()` using `Promise.all()`.
- [ ] Pass pre-fetched embeddings to `semanticDedupeCandidates()` instead of fetching inside.
- [ ] Pass pre-fetched signals to `fetchEvidence()` to avoid redundant network calls.
- [ ] Unit tests confirm all three Promise.all branches execute concurrently (mock with delays).
- [ ] Live handler response time improves by 2–3s (measure via deployment logs before/after).
- [ ] No functional change to dedupe or evidence output — only optimization of fetch ordering.

**Steps:**

- [ ] **Step 1:** Review current handler flow in `daily.ts` and `analyze-idea.ts`; map which operations are independent.
- [ ] **Step 2:** Write unit test cases for parallel execution (mock `generateWithAI`, `getRecentEmbeddings`, `getMarketSignals` with artificial delays).
- [ ] **Step 3:** Refactor handlers to use `Promise.all([...])` for independent pre-fetches.
- [ ] **Step 4:** Run `npm run test:unit` — ensure new tests pass and existing tests still pass.
- [ ] **Step 5:** Deploy to staging; monitor logs for response time delta.
- [ ] **Step 6:** Commit: `perf(api): parallelize embeddings and signals fetch in AI handlers`

---

## Task 2: Merge Docs+Code Workflow

**User story:** As an agent, I want to update BACKLOG.md, CHANGELOG.md, and DECISIONS.md in the same edit session as code, so I don't have a separate "docs update" step and can stage all changes in a single commit.

**Current workflow (serialized):**

1. Write code + tests (3–5 min)
2. Commit code
3. Update BACKLOG.md (mark done) — new edit session (1 min)
4. Update CHANGELOG.md (add entry) — new edit session (1 min)
5. Update DECISIONS.md (if decision made) — new edit session (optional)
6. Commit docs separately or amend (adds friction)

**Target workflow (merged):**

1. Write code + tests (3–5 min)
2. Update BACKLOG.md, CHANGELOG.md, DECISIONS.md in same session (2 min, parallel edits)
3. Single commit with all changes (code + docs together)

**Files:**

- Modify: `docs/BACKLOG.md` (on story completion)
- Modify: `CHANGELOG.md` (on story completion)
- Modify: `DECISIONS.md` (if decision made)
- Update: `.claude/projects/*/memory/workflow_post_story_checklist.md` (reorder steps)

**Acceptance criteria:**

- [ ] Memory workflow checklist is reordered to "update docs + code in same session, then commit once".
- [ ] Agent can open BACKLOG/CHANGELOG/DECISIONS in parallel edits without sequential context switches.
- [ ] Single commit includes all changes (code + docs) with proper message format.
- [ ] No intermediate "docs commit" — all changes staged together via `git add -A`.

**Steps:**

- [ ] **Step 1:** Update `memory/workflow_post_story_checklist.md` to reflect merged workflow (docs updates happen during code phase, not after).
- [ ] **Step 2:** Reorder the checklist sections: code+docs (parallel) → single commit → npm check → push.
- [ ] **Step 3:** Document that DECISIONS.md is updated immediately when a decision is made (not batched at the end).
- [ ] **Step 4:** Commit: `docs: TE-2X merge code+docs workflow into single session`

---

## Task 3: Pre-load Memory Manifest for Hot Files & Patterns

**User story:** As an agent starting a new session, I want a memory manifest that lists the hot files, key patterns, and their offsets, so I don't re-read architecture docs every session.

**Current flow (redundant discovery):**

1. Agent reads CLAUDE.md architecture section (15–20 lines)
2. Agent reads `src/types.ts` (understanding shared types)
3. Agent reads `api/_lib/ai-provider.ts` (understanding AI layer)
4. Agent reads handler pattern from `daily.ts` or `analyze-idea.ts`
5. Agent reads tier-checking pattern from `auth.ts`

**Target flow (pre-loaded):**

1. Agent loads memory manifest at session start (list of key files + line ranges)
2. Agent uses exact line ranges when referencing patterns
3. Saves ~3–4 min per story via cached context

**Files:**

- Create: `.claude/projects/*/memory/hot_files_manifest.md` (new memory file)
- Update: `MEMORY.md` to index the manifest

**Acceptance criteria:**

- [ ] Memory manifest lists 8–10 hot files (CLAUDE.md, types.ts, ai-provider.ts, daily.ts, analyze-idea.ts, auth.ts, cache.ts, usage.ts, tier-config.ts).
- [ ] Each entry includes file path + key line ranges (e.g., "types.ts:1–50 = shared interfaces; types.ts:80–120 = Idea shape").
- [ ] Manifest includes 3–4 key patterns (Handler structure, AI provider call signature, Tier lookup, Firestore transaction pattern).
- [ ] Memory is tagged with `type: reference` so it's loaded automatically at session start.
- [ ] Update workflow: when a hot file changes significantly, the memory is updated in the same commit (not forgotten).

**Steps:**

- [ ] **Step 1:** Identify the 8–10 most-referenced files across recent agent sessions (look at git log for frequently-edited paths).
- [ ] **Step 2:** For each file, extract key ranges: interfaces, exports, pattern examples.
- [ ] **Step 3:** Create memory file with frontmatter + structured list.
- [ ] **Step 4:** Update MEMORY.md index.
- [ ] **Step 5:** Add a rule to CLAUDE.md: "When hot files change, update hot_files_manifest.md in the same commit."
- [ ] **Step 6:** Commit: `docs: TE-3X pre-load memory manifest for hot files and patterns`

---

## Task 4: Auto-Verify Deployments (Smoke Test Post-Push)

**User story:** As an agent, I want key routes auto-verified after a Vercel deployment, so I don't spend 2 min manually checking the live site in a browser.

**Current flow (manual, slow):**

1. `git push` → Vercel starts deploy
2. Wait ~2 min for build
3. Manually navigate to `https://trend-equity.vercel.app` in browser
4. Manually click through key features (feed, save, tier gate, auth)
5. Report "live and working"

**Target flow (automated):**

1. `git push` → Vercel starts deploy
2. Deployment webhook or cron triggers smoke test
3. Test hits key endpoints: `GET /`, `GET /api/status`, `POST /api/generate/daily` (with mock), tier gates
4. Results posted to a summary; agent reports "verified" with logs
5. Saves manual verification time

**Files:**

- Create: `tests/e2e/smoke-test.spec.ts` (new Playwright test suite — short, fast, critical paths only)
- Create: `api/webhooks/deploy-complete.ts` (optional: triggered by Vercel deployment event, if needed; low priority)
- Update: `.github/workflows/` or `vercel.json` (optional: trigger smoke test post-deploy)

**Acceptance criteria:**

- [ ] Smoke test suite is <10 test cases, <30s total runtime.
- [ ] Covers: app loads, daily feed renders, save idea works (client-side), auth flow visible, tier gate button visible.
- [ ] Can be run manually via `npm run test:smoke` or triggered auto-post-deploy (optional).
- [ ] Agent can run this locally before declaring "live and working", or it runs auto and reports status.
- [ ] Does NOT require actual login or full feature testing — just UI presence + happy-path navigation.

**Steps:**

- [ ] **Step 1:** Create `tests/e2e/smoke-test.spec.ts` with 5–8 fast test cases (no authentication, no data writes).
- [ ] **Step 2:** Define smoke-test npm script: `npm run test:smoke` → runs only `smoke-test.spec.ts`.
- [ ] **Step 3:** Run locally before deploy to establish baseline.
- [ ] **Step 4:** After agent pushes, agent runs `npm run test:smoke` against production URL.
- [ ] **Step 5:** (Optional) Wire Vercel deployment webhook to auto-trigger test (low priority; manual run is acceptable first).
- [ ] **Step 6:** Commit: `test: TE-4X add smoke-test suite for post-deploy verification`

---

## Task 5: Shard E2E Tests by Feature Area (Parallel Playwright)

**User story:** As an agent running tests before merge, I want E2E tests to run in parallel by feature area, so the full test suite finishes in ~2 min instead of ~5 min.

**Current behavior:**

- Playwright runs tests **sequentially** (per CLAUDE.md: "sequential (non-parallel)").
- All tests share one state (serial baseline prevents flakiness).
- Total runtime: ~5 min.

**Target behavior:**

- Shard tests by feature: `feed.spec.ts`, `auth.spec.ts`, `tier-gates.spec.ts`, `saves.spec.ts` run in parallel.
- Each shard gets its own database/auth state (isolated via unique test user or snapshot reset).
- Total runtime: ~2–3 min (3–4 shards running at once).

**Files:**

- Reorganize: `tests/e2e/*.spec.ts` (group by feature, not sequential)
- Modify: `playwright.config.ts` (enable workers, set `fullyParallel: false` per feature group or `true` if isolated)
- Create: `tests/e2e/fixtures/` (shared setup/teardown for isolated test state)

**Acceptance criteria:**

- [ ] E2E tests are organized by feature: `tests/e2e/feed.spec.ts`, `tests/e2e/auth.spec.ts`, `tests/e2e/saves.spec.ts`, etc.
- [ ] Playwright config enables `workers: 3–4` (or auto-detect).
- [ ] Tests can run in parallel without flakiness (use isolated test users, not shared state).
- [ ] `npm run test:e2e` completes in 2–3 min (down from 5 min).
- [ ] Snapshots are still committed and compared correctly.
- [ ] No test flakiness regression (all tests pass consistently).

**Steps:**

- [ ] **Step 1:** Audit current `tests/e2e/*.spec.ts` files; categorize by feature.
- [ ] **Step 2:** Create `tests/e2e/fixtures/` folder with shared setup (auth context, test user, database isolation).
- [ ] **Step 3:** Update `playwright.config.ts`: enable `workers` (default or 3–4), set `fullyParallel` based on test isolation strategy.
- [ ] **Step 4:** Run `npm run test:e2e` — should be 2–3 min. If flaky, add isolation (unique test user IDs per shard).
- [ ] **Step 5:** Commit: `test: TE-5X shard E2E tests by feature for parallel execution`

---

## Task 6: Optimize Vitest Threading

**User story:** As an agent running unit tests, I want Vitest to use multiple worker threads, so `npm run test:unit` finishes in ~1 min instead of ~2 min.

**Current behavior:**

- Vitest uses **Node environment** (from CLAUDE.md).
- Default is single-threaded (sequential test files).
- Runtime: ~2 min for 290 tests.

**Target behavior:**

- Enable Vitest workers (4 threads by default, auto-detect CPU count).
- Tests run in parallel across files.
- Runtime: ~1 min.

**Files:**

- Modify: `vitest.config.ts` (enable workers, set pool size)

**Acceptance criteria:**

- [ ] `vitest.config.ts` sets `test.threads: true` and `test.maxThreads: 4` (or auto).
- [ ] `npm run test:unit` completes in ~1–1.5 min (down from ~2 min).
- [ ] All tests pass (no race conditions or shared state issues).
- [ ] Watch mode still works: `npm run test:unit:watch`.

**Steps:**

- [ ] **Step 1:** Read current `vitest.config.ts`; check if threading is enabled.
- [ ] **Step 2:** If not, add/enable: `test: { threads: true, maxThreads: 4 }`.
- [ ] **Step 3:** Run `npm run test:unit` — should be faster. If flaky, reduce maxThreads or isolate shared state.
- [ ] **Step 4:** Run `npm run test:unit:watch` to confirm watch mode works.
- [ ] **Step 5:** Commit: `test: TE-6X enable Vitest threading for parallel test execution`

---

## Rollout Schedule

**Week 1 (July 21–25):**

- TE-29 (parallelize AI pipeline)
- TE-30 (merge docs+code workflow)
- TE-31 (pre-load memory manifest)

**Week 2 (July 28–Aug 1):**

- TE-32 (auto-verify deployments)
- TE-33 (shard E2E tests)
- TE-34 (Vitest threading)

**Expected impact:**

- Agent story time: 30 min → 15 min (50% reduction)
- Test run time: 5 min → 3 min
- Generation latency: 12s → 9s per call
- Context reuse efficiency: +40% (fewer re-reads via pre-load memory)

---

## Related Decisions & Context

- **2026-07-08 pain-point remediation plan:** Previous optimization batch focused on security/cost; this batch focuses on velocity.
- **2026-07-21 agent profiling:** Data-driven analysis identified serialized workflow, redundant discovery, and parallel-capable backend ops as top 3 bottlenecks.
- **Memory system:** Pre-loaded memory manifest is part of the broader [[project_memory_caching]] strategy.
