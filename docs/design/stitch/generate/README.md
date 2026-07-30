# Regenerating the Stitch designs

These scripts regenerate the mobile screens in [Google Stitch](https://stitch.withgoogle.com)
from the exact prompts used, so the designs can be reproduced or extended from
any device with any tool. The prompts are the source of truth for what each
screen contains — read them alongside the [screen design plan](../../2026-07-30-mobile-screens.md).

## Setup (any machine)

```bash
npm install @google/stitch-sdk       # in a scratch dir, not the app package.json
export STITCH_API_KEY=…              # your Stitch API key — NEVER commit it
```

The scripts read the key from `STITCH_API_KEY` only. No key is hard-coded, and
none should ever be committed to this repo.

## Scripts

| File | Generates | Notes |
| --- | --- | --- |
| `01-home-screens.mjs` | The 3 first-run home states | Creates a **new** project |
| `02-full-product-screens.mjs` | The 8 full-product screens | Reuses the existing project id → shared design system |
| `retry-single.mjs` | One screen (retry template) | Stitch occasionally returns a transient "service unavailable"; re-run |

```bash
node 01-home-screens.mjs          # writes result.json + downloads DESIGN.md
node 02-full-product-screens.mjs  # writes result2.json (screen ids + image urls)
```

`02-…` reuses project `projects/13591160038311824941` so every screen shares the
generated design system. To start clean, run `01-…` first and paste the new
project id into `02-…`'s `PROJECT_ID`.

## Retrieving the rendered assets

`screen.getImage()` / `screen.getHtml()` and `project.downloadAssets(dir)` return
the rendered PNG/HTML — but the bytes stream from `contribution.usercontent.google.com`
and `lh3.googleusercontent.com`. **Claude Code's web sandbox egress policy blocks
those two hosts** (403 on CONNECT), so from that environment only `DESIGN.md`
(served from the allowed `stitch.googleapis.com`) can be pulled in. From a normal
machine the downloads work; or open the project in the Stitch web app to
view/export. See [`../README.md`](../README.md) for the current screen ids.
