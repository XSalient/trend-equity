# Design workstream — subscriber-growth redesign

**Branch:** `claude/subscriber-growth-redesign-x5fipt`
**Status:** design plans + generated concepts committed; no app code changed, nothing merged.
**Purpose of this file:** a single entry point so the design work can be picked up from **any device with any AI tool** — everything below is in the repo (or reproducible from it), not in a session scratchpad.

---

## What's here (read in this order)

| # | Doc | What it is |
| --- | --- | --- |
| 1 | [`../research/2026-07-30-user-research-findings.md`](../research/2026-07-30-user-research-findings.md) | The user-side evidence (persona walkthroughs, findings U1–U15) |
| 2 | [`../research/2026-07-30-value-and-reengagement-research.md`](../research/2026-07-30-value-and-reengagement-research.md) | Net-new value + re-engagement (Q1/Q2/Q4, Wave 6 items) |
| 3 | [`2026-07-30-redesign-concepts.md`](2026-07-30-redesign-concepts.md) | Component-level concepts (A/B/C campaigns) |
| 4 | [`2026-07-30-mobile-home-screens.md`](2026-07-30-mobile-home-screens.md) | First pass — the 3 home states (activation / conversion / retention) |
| 5 | [`2026-07-30-mobile-screens.md`](2026-07-30-mobile-screens.md) | **Current plan** — 8 full-product screens, user-journey-first |
| 6 | [`stitch/DESIGN.md`](stitch/DESIGN.md) | The generated design system (tokens, type, components) |
| 7 | [`stitch/README.md`](stitch/README.md) | Stitch project + all screen ids (view/export) |
| 8 | [`stitch/generate/`](stitch/generate/) | The scripts + exact prompts to reproduce every screen |

> **Note on doc 4 vs 5:** doc 5 is the current, broader plan (whole product). Doc 4
> is kept because its three home *states* (anonymous / free / subscriber) are more
> detailed than doc 5's single "Daily Feed" entry — they're complementary, not
> duplicates.

## Generated designs (Google Stitch, Gemini 3 Pro)

- **Project:** `projects/13591160038311824941` — one project, so all 11 screens
  share the design system in `stitch/DESIGN.md`. Open it in the Stitch web app
  (signed in as the API-key owner) to view, edit, or export.
- **Screen ids:** in [`stitch/README.md`](stitch/README.md).
- **Reproduce / extend:** [`stitch/generate/`](stitch/generate/) — `STITCH_API_KEY` in env, `node 02-full-product-screens.mjs`.

## Viewable mockup boards (Claude artifacts)

High-fidelity HTML boards, useful when the Stitch pixels can't be pulled into a
sandbox (see egress note below). These are session artifacts, not repo files —
re-render from the plan docs if the links expire:

- Full-product set (8 screens): `claude.ai/code/artifact/90d1b567-551f-477f-ab36-2a479f9af1b7`
- Home states (3 screens): `claude.ai/code/artifact/34038a2d-0a21-420a-8049-1b2aaa8f5284`

## Known environment limitation

Stitch streams rendered HTML/PNG from `contribution.usercontent.google.com` and
`lh3.googleusercontent.com`. **Claude Code's web sandbox blocks those two hosts**
(egress-policy 403 on CONNECT), so from that environment only the design-system
spec (`DESIGN.md`, from the allowed `stitch.googleapis.com`) can be retrieved.
From a normal machine the SDK downloads work; or export from the Stitch web app.

---

## Status & what's next

**Done**
- Research (findings + value/re-engagement) and component concepts.
- Two screen plans: 3 home states + 8 full-product screens.
- All 11 screens generated in Stitch (shared design system) + scripts/prompts committed.

**Open / next**
- Decide the reference of record: Stitch project vs the HTML boards.
- Deepen unhappy states (empty / loading / `tierLoading` / anonymous) per screen — plans currently show mostly the happy path.
- Type decision: adopt the Stitch pairing (Archivo Narrow + Geist) or keep the current system stack.
- Onboarding / founder-fit (TE-56) screen once that ticket is built (deliberately out of the developed-only set today).
- When building: the plans map each screen to its components and roadmap tickets — start from doc 5's tables.

## How to continue from any device / tool

1. `git checkout claude/subscriber-growth-redesign-x5fipt`
2. Read this file, then docs 5, 6, 7 above.
3. To regenerate or add screens: `docs/design/stitch/generate/` (needs `STITCH_API_KEY`).
4. To re-render a viewable board: the plan docs contain the full per-screen content; rebuild the HTML from them.
