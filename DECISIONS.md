# Project Decisions

This file documents key architectural and product decisions for the Trend-Equity project. Committed to git so all team members and machines have access.

For ongoing context and details, see `CLAUDE.md` and the per-session memory system in `.claude/projects/J--Repositories-trend-equity/memory/`.

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

## Positioning Strategy — Active

**Decision:** Reposition Trend-Equity as an "opportunity intelligence platform" (not just an idea feed). Log prediction accuracy early as evidence of value.

**Status:** In progress. Defer multi-signal ML pipeline until Stripe proves customers will pay for premium intelligence features.

**Next phase:** Stripe integration (Wave 2).
