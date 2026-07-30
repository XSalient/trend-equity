# Google Stitch — generated mobile home screens (run manifest)

**Date:** 2026-07-30
**Tool:** [Google Stitch](https://stitch.withgoogle.com) via `@google/stitch-sdk` (MCP → `stitch.googleapis.com`), model `GEMINI_3_PRO`, device `MOBILE`
**Companion:** [mobile home-screen design plan](../2026-07-30-mobile-home-screens.md) — the three concepts these screens render.

The screen concepts in the design plans were generated as real UI in Stitch. This file is the manifest so the screens can be opened, viewed, and exported. The generated design system is in [`DESIGN.md`](DESIGN.md) alongside this file. All screens live in **one project**, so they share that design system.

## Project & screens

**Project:** `projects/13591160038311824941`

### Full-product screen set (mobile) — [design plan](../2026-07-30-mobile-screens.md)

| Screen                  | Arc      | Stitch screen id                               |
| ----------------------- | -------- | ---------------------------------------------- |
| 1 · Daily Feed          | Discover | `.../screens/a72121df00b845dd9350cdd76d6608cd` |
| 2 · Idea Detail         | Evaluate | `.../screens/2212963c089148bbbf68b93a5ac5a44f` |
| 3 · Analyze My Idea     | Evaluate | `.../screens/7489d814f3a64367bdfaf7d92744f0e7` |
| 4 · Saved / Library     | Retain   | `.../screens/82da85a623f0439facc3a61c2a56c837` |
| 5 · Today dashboard     | Retain   | `.../screens/67649552121d4f29856c27eac235dc8e` |
| 6 · Market Intelligence | Retain   | `.../screens/020059cb4f6643e887f1dd040bd1e4ad` |
| 7 · Pricing & Upgrade   | Convert  | `.../screens/db002927f1c648f8ae6904a30ddd5474` |
| 8 · Enterprise          | Grow     | `.../screens/f23dc8240ae84b298cf656156ba1f3d9` |

### First-run home states (earlier pass) — [design plan](../2026-07-30-mobile-home-screens.md)

| Screen              | Funnel stage | Stitch screen id                               |
| ------------------- | ------------ | ---------------------------------------------- |
| First-Run Home      | Activation   | `.../screens/989ae7cf42744ed08a4053e994975980` |
| Free Signed-In Home | Conversion   | `.../screens/e4c26dd4984443d3942592696145e666` |
| Subscriber "Today"  | Retention    | `.../screens/b8a3d43590b74e5eb7a429579432205a` |

Open the project in the Stitch web app (signed in as the account that owns the API key) to view, tweak, or export each screen's HTML/CSS and screenshot.

## Viewing / exporting the rendered assets

The SDK exposes the rendered HTML and screenshot as download URLs
(`screen.getHtml()` / `screen.getImage()`), and `project.downloadAssets(dir)`
writes them self-contained. Both route the actual bytes through
`contribution.usercontent.google.com` and `lh3.googleusercontent.com`.

**Those two hosts are blocked by this session's egress policy** (gateway
answers 403 to CONNECT — a policy denial, not an auth failure). So the
rendered HTML and PNG screenshots could not be pulled into the repo from this
environment. Only the design-system spec (served from the allowed
`stitch.googleapis.com`) came through — that is `DESIGN.md`.

To get the pixels into the repo, either:

1. **Open the project in the Stitch web app** and export each screen, or
2. **Allowlist those two hosts** for the session's egress policy, then re-run
   the generator (`scripts` below) — `downloadAssets()` will then write
   `*.html` + screenshots locally.

## Reproducing the run

The generator script and the exact per-screen prompts used are in the session
scratchpad (`scratchpad/stitch/generate.mjs`), not committed (it takes the API
key from the `STITCH_API_KEY` env var — never hard-coded, never committed).
Prompts are derived verbatim from the three concepts in the companion design
plan; each pins the dark zinc theme, the emerald / cyan-evidence / amber-coral-signal
accent semantics, and the concept's specific modules.

## What Stitch chose (worth carrying back)

Given the accent semantics from the brief, Gemini's design system (`DESIGN.md`)
landed on choices worth noting against the current app:

- **Type:** _Archivo Narrow_ (heavy/italic display — "newsroom urgency") + _Geist_
  (body/data). The current app uses a system stack; this is a concrete pairing
  to evaluate.
- **Accents preserved exactly as briefed:** emerald `#10b981` primary, cyan
  `#22d3ee` reserved for verified evidence, an amber→coral gradient reserved for
  live market signal, `#27272a` structural borders.
- **Explicit "no blur / no frosted glass"** — matte, flat, terminal-like depth
  via tonal layering. (Note: this contradicts the design plan's blurred-real
  evidence teaser — a deliberate reconciliation to make when building.)
