# Project Decisions

This file documents key architectural and product decisions for the Trend-Equity project. Committed to git so all team members and machines have access.

For ongoing context and details, see `CLAUDE.md` and the per-session memory system in `.claude/projects/J--Repositories-trend-equity/memory/`.

---

## Free-Tier Value Ladder — Adopted (2026-07-10)

**Decision:** Restructure tier boundaries so each tier has one clear job: **Free = discover** (see that real, scored opportunities exist), **Pro = evaluate** (get the full diligence picture), **Builder = execute** (get the build/validate/track machinery). The 2026-07-08 audit showed Free currently receives _more_ than the PRD promises in four places — those giveaways are reclaimed as Pro value rather than inventing new restrictions.

**The ladder (target state):**

| Capability                        | Free (discover)                                                   | Pro (evaluate)                                                          | Builder (execute)      |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| Daily ideas                       | 10                                                                | 25                                                                      | 35                     |
| Idea card content                 | Headline, pitch, score, category, VC justification, trend sources | + Unfair advantage, revenue model, market size, competitors, regulatory | same as Pro            |
| Market Evidence (search-grounded) | ❌ locked teaser                                                  | ✅                                                                      | ✅                     |
| Next steps                        | 3                                                                 | 7                                                                       | Full 10+ roadmap suite |
| Saves                             | 5                                                                 | Unlimited                                                               | Unlimited              |
| Export                            | PDF only                                                          | + CSV, Notion/GDocs                                                     | + CSV, Notion/GDocs    |
| Comments                          | Read-only                                                         | Post                                                                    | Post (priority later)  |
| Reactions (👍👎🔨)                | ✅ kept free                                                      | ✅                                                                      | ✅                     |

**Rationale per change:**

1. **Full VC analysis → Pro (TE-22).** PRD always promised Free "Basic VC Analysis"; code ships the full block to everyone. Gating unfair advantage / revenue model / market dynamics behind a _visible locked section_ is the single strongest daily upsell surface — Free users see exactly what they're missing on every card.
2. **Market Evidence → Pro (TE-23).** It's the most expensive feature per call (two-step Google-grounded generation) and the core "opportunity intelligence" differentiator, currently free to every signed-in user. Free keeps a locked "Evidence" button as the teaser.
3. **CSV export → Pro (TE-24).** PRD promised Free PDF-only; CSV bulk export is an analyst/power-user feature that belongs with paying tiers.
4. **Pro next-steps capped at 7 (TE-25).** The unused `roadmapSteps` constant (3/7/10) finally gets enforced, restoring the 3 → 7 → full-roadmap progression that makes Builder's roadmap suite feel like a real step up.
5. **Comments: Free read-only (TE-26).** Matches the PRD community ladder; posting becomes a Pro perk. Reactions stay free for all — they feed the prompt optimizer and we want maximum signal volume.

**Deliberately NOT limited:** daily feed access (top-of-funnel), reactions (training signal), PDF export (shareability = marketing), the 10-idea count (already decided), saves-count semantics (5 concurrent stays; renaming to "5 saved ideas" in copy is part of TE-21).

**Considered and parked — time-delayed free feed** (Pro sees today's feed at publish, Free at noon): strong perceived-value lever but complicates the singleton daily doc, hurts top-of-funnel first impressions, and is hard to message honestly. Revisit only if post-Stripe conversion data shows the current ladder isn't converting.

**Sequencing constraint:** every gate here is _fake_ until TE-12 (Firestore rules) and TE-13 (server-side tier guards) land — a console user can bypass any client gate today. TE-23/24/25/26 must ride on or after TE-13; TE-22 is content-display gating (data is in a shared doc) and is honest client-side gating only after TE-12 stops free users from reading everything anyway.

---

## TE-01 / TE-02 Shipped — P0 Cost & Abuse Hardening (2026-07-08)

**Decision:** Ship both P0 items from the remediation plan together, same day: (1) daily generation triggerable only by signed-in users for today's date, cached reads unaffected; (2) per-IP daily cap moved from an in-memory `Map` to a Firestore transaction (`checkAndIncrementIpLimit`, hashed IPs, same check-before-increment pattern as `usage.ts`).

**Finding during implementation:** the old `checkIpRateLimit` function in `api/_handlers/daily.ts` was defined but never called — confirmed via ESLint's `no-unused-vars` warning and a repo-wide grep. The daily generation endpoint had **zero** IP-based abuse protection in production before this fix, not merely a weak per-instance one as originally assessed in the 2026-07-08 audit.

**Design call — IP limit skipped on admin refresh:** the per-IP cap only applies to the initial (non-refresh) generation trigger. Refresh is already gated to admins, a small trusted set; capping it too would risk an admin locking themselves out during legitimate same-day re-runs for no abuse-prevention benefit.

**Status:** Shipped, TDD (9 new tests across `tests/unit/api/daily.test.ts` and `tests/unit/lib/usage.test.ts`), full suite green (290/290), `npm run check` clean (0 errors).

---

## Project Tracking System — Adopted (2026-07-08)

**Decision:** All work items, decisions, and shipped changes are tracked in-repo so every developer and every AI agent on every machine sees the same state.

**The system:**

| File                       | Holds                                                      | Update when                         |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `docs/BACKLOG.md`          | All tasks with `TE-NN` ids, statuses, owners, user stories | Starting or finishing any work item |
| `CHANGELOG.md`             | What shipped, when, with commit hashes                     | Same commit that ships a change     |
| `DECISIONS.md` (this file) | Product/architecture decisions + rationale                 | The moment a decision is made       |
| `PRD.md`                   | What the product is (tiers, features)                      | Feature scope changes               |
| `docs/superpowers/plans/`  | Detailed implementation plans for large tasks              | Before executing L-effort tasks     |
| `CLAUDE.md`                | How to work in this codebase (canonical agent guide)       | Architecture reality changes        |

**Rationale:** Context previously lived in per-machine AI memory files, stale CLAUDE.md sections, and individual developers' heads — causing exactly the "unaware of already-made changes" confusion this replaces. Git is the only store all machines share.

**Rule:** `AGENTS.md` is a pointer to `CLAUDE.md`, never a copy — one canonical agent guide, zero drift.

---

## App-Store Signal Mining — Deferred (2026-07-08)

**Decision:** Do not add Google Play / iOS App Store signals to the generation pipeline now.

**Rationale:**

- Neither store has an official API for market-research access; community scrapers are brittle, rate-limited, and ToS-gray — high maintenance for a solo project.
- App-store data is a **lagging** indicator (reflects markets formed 1–2 years ago), weak for trend discovery, which is the core promise. The live pipeline already covers leading indicators (Google Trends, Product Hunt, Reddit, HN, TechCrunch via `api/_lib/signals.ts`).
- Vercel Hobby constraints (function count, no durable workers) make ingestion pipelines awkward.

**Salvageable piece (post-Stripe):** app-store review mining as per-idea _validation_ evidence ("underserved incumbents with bad reviews"), attached to the evidence layer — not as a discovery source.

---

## Pain-Point Remediation Plan — Adopted (2026-07-08)

**Decision:** Adopt the 10-task remediation backlog from the 2026-07-08 audit (`docs/superpowers/plans/2026-07-08-pain-point-remediation.md`), sequenced P0 → P3.

**Priorities and rationale:**

- **P0 — cost/abuse (TE-01…03):** the daily generation endpoint is triggerable anonymously for arbitrary client-supplied dates, and the in-memory IP limit doesn't survive serverless instances. Direct Gemini-spend exposure; fix first.
- **P1 — signal trust (TE-04…07):** signal fetching degrades silently and idea→signal citations are unverified, so the "grounded in live signals" differentiator is currently unprovable. Observability before fixes; verification is flag-only for 2 weeks before any dropping (measure-first).
- **P2 — business proof (TE-08, TE-09):** Stripe + minimal analytics. Stripe webhook is the **sole** writer of `users/{uid}.tier`. Monthly Pro/Builder only at launch — no annual, trials, or coupons.
- **P3 — code health (TE-10, TE-11):** `useIdeas.ts` split, repo cleanup.

**Explicitly not in scope:** app-store signals, multi-signal expansion, personalization — all gated on Stripe evidence per the positioning strategy below.

---

## Growth Guides Feature — Parked (2026-07-08)

**Decision:** Do not implement business-growth guides or integrations with acquire.com / trustmrr.com.

**Rationale:**

- **Audience mismatch:** acquire.com and TrustMRR serve founders with revenue-stage businesses. Trend-Equity users are at the idea stage and would have left the app before reaching that stage.
- **No real integration:** Neither platform has a usable public API. "Integration" would degrade into static link-outs and commodity AI-generated guides.
- **Strategic conflict:** Positioning decision is to differentiate on opportunity intelligence and defer expansion until Stripe proves willingness to pay. Stripe has not yet shipped.
- **Surface redundancy:** Builder tier already ships four AI packs per idea (validation toolkit, roadmap, build pack, progress tracker). Adding a fifth would dilute focus.

**Salvageable piece (Wave 2, post-Stripe):**
If the Wave 2 evidence layer is prioritized, consider adding a single AI-estimated "exit signal" line to idea analysis — comparable exit ranges by niche (acquire.com-style multiples). Must be clearly labeled as an estimate.

---

## Vercel Hobby Function Limit (2026-07-02)

**Decision:** Consolidate `/api/generate/*` endpoints into a single catch-all function to stay under the 12-function Vercel Hobby plan limit.

**Status:** Implemented. See commit 85ab8dc ("Fix 405 on /api/generate/\* by dropping bracket dynamic-segment routing") and 210be12 ("Consolidate api/generate endpoints into a single catch-all function").

**Pattern:** New generation endpoints are added as handler files in `api/_handlers/` with a map entry in `api/generate/dispatch.ts`, never as top-level `api/**/*.ts` files.

---

## Quality Engine Wave 1 — Shipped (2026-07-02)

**Decision:** Ship critic pipeline, semantic deduplication, and analytics in Wave 1. Defer personalization and evidence layer to Wave 2.

**Status:** Complete. See commits 44ec85c–5608d81.

**Wave 2 scope:** Evidence layer (exit signals, comparable comps), personalization (user signals, favorite sectors), Stripe billing integration.

---

## Custom Idea Feature — Deployed (Pro/Builder)

**Decision:** Implement custom idea analysis on Pro and Builder tiers with monthly quotas, "My Latest Idea" slot, and 3-section Saved Ideas tab.

**Status:** Deployed. Configuration stored in Firestore; admin config via internal tools.

**Key pattern:** `updateIdea()` must sync every idea list (feed, saves, latest). Never wire `onClick={handler}` for `(refresh?: boolean)` handlers — use explicit wrapper functions instead.

---

## Custom Requirement Feed — Deployed (Builder)

**Decision:** Implement a custom requirement feed feature for Builder tier with 1 generation per 24 hours, server-side caching, and peek/restore flow.

**Status:** Deployed.

**Key pattern:** Server caches AI results for 24 hours. Peek lets users review without consuming the 24h cache. Restore requires explicit confirmation.

---

## TE-15: Anonymous Enterprise Lead Capture — Deployed (2026-07-21)

**Decision:** Accept anonymous enterprise lead submissions via a serverless endpoint instead of direct Firestore writes (which fail the TE-12 security rules for unauthenticated users).

**Implementation:**

- New endpoint: `POST /api/enterprise-lead` (standalone serverless function, not part of `/api/generate/*` dispatch)
- Validates required fields: `firstName`, `email`, `company`, `role`; optional `lastName`, `message`
- Rate limiting: 5 submissions per IP per hour (Firestore-backed via `api_usage` collection)
- Writes to `enterprise_leads` collection with server credentials (Admin SDK bypasses rules)
- Adds server metadata: `createdAt`, `source: 'enterprise_landing'`, IP hash
- Frontend (`EnterpriseLanding.tsx`): removed forced authentication flow, now calls serverless endpoint

**Why not external services (StaticForms)?** Retains data ownership (Firestore, not third-party), enables future integrations (CRM sync, automation), and simplifies the data model. A serverless endpoint is zero-cost under Vercel's Hobby plan and keeps the lead pipeline internal.

**Rules:** Firestore rules unchanged — `enterprise_leads` collection still shows `allow create: if request.auth != null` (client-side restriction), but Admin SDK writes bypass this. The rule prevents accidental client-side writes while allowing the server-side handler to work.

**Testing:** Rate-limit transaction pattern tested via analogous `checkAndIncrementIpLimit` in `api/_lib/usage.ts`; handler tested locally before deploy.

---

## Agent & Generation Pipeline Performance Epic — Planned (2026-07-21)

**Decision:** Adopt a 6-story performance optimization epic (TE-32 through TE-37) targeting 50% reduction in agent story completion time (30 min → 15 min).

**Root causes (ranked by impact):**

1. Sequential backend AI operations (5–6s waste) — Promise.all for parallel pre-fetches (TE-32)
2. Redundant discovery per session (3–4 min waste) — Pre-load memory manifest of hot files (TE-34)
3. Serialized post-story workflow (2 min waste) — Merge docs+code updates into single session (TE-33)
4. Manual deployment verification (2 min waste) — Smoke-test suite for auto-verify (TE-35)
5. Sequential test execution (2–3 min waste) — Shard E2E tests, enable Vitest threading (TE-36, TE-37)

**Impact projection:** 10–15 min savings per story.

**Rollout:** Two phases. Week 1: TE-32/33/34 (high ROI, ~7–9 min saved). Week 2: TE-35/36/37 (test infrastructure, ~2–3 min saved, amortized over many stories).

**Rationale:** Agent velocity directly impacts project iteration speed. With 15+ stories remaining before Wave 2 (Stripe + evidence layer) ships, even a 2 min/story improvement compounds to 30+ hours saved over the roadmap. TE-32 (backend parallelization) is a quality improvement regardless; TE-34 (memory manifest) reduces cognitive load for all agentic work; TE-33 (workflow merge) removes friction.

**Out of scope:** Code generation, prompt-engineering optimizations, model upgrades (these are Wave 2 priorities).

**Detailed plan:** [`docs/superpowers/plans/2026-07-21-agent-performance-optimization.md`](docs/superpowers/plans/2026-07-21-agent-performance-optimization.md)

---

## Positioning Strategy — Active

**Decision:** Reposition Trend-Equity as an "opportunity intelligence platform" (not just an idea feed). Log prediction accuracy early as evidence of value.

**Status:** In progress. Defer multi-signal ML pipeline until Stripe proves customers will pay for premium intelligence features.

**Next phase:** Stripe integration (Wave 2).
