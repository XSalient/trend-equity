# Google Stitch — generated mobile home screens (run manifest)

**Date:** 2026-07-30
**Tool:** [Google Stitch](https://stitch.withgoogle.com) via `@google/stitch-sdk` (MCP → `stitch.googleapis.com`), model `GEMINI_3_PRO`, device `MOBILE`
**Companion:** [mobile home-screen design plan](../2026-07-30-mobile-home-screens.md) — the three concepts these screens render.

The three home-screen concepts in the design plan were generated as real UI in Stitch. This file is the manifest so the screens can be opened, viewed, and exported. The generated design system is in [`DESIGN.md`](DESIGN.md) alongside this file.

## Project & screens

**Project:** `projects/13591160038311824941`

| Screen | Funnel stage | Stitch screen id | Gen time |
| --- | --- | --- | --- |
| 1 · First-Run Home | Activation | `projects/13591160038311824941/screens/989ae7cf42744ed08a4053e994975980` | 68s |
| 2 · Free Signed-In Home | Conversion | `projects/13591160038311824941/screens/e4c26dd4984443d3942592696145e666` | 49s |
| 3 · Subscriber "Today" | Retention | `projects/13591160038311824941/screens/b8a3d43590b74e5eb7a429579432205a` | 77s |

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
