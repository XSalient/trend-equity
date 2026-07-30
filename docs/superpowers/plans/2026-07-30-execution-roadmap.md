# Execution Roadmap — what to do, in what order (all waves)

**Date:** 2026-07-30
**Status:** Proposed sequencing — single source of order across the defect fix, quality debt, Wave 5 (repackage) and Wave 6 (net-new value)
**Companion docs:** [funnel playbook](2026-07-30-funnel-strategy-playbook.md) · [Wave 5 strategy](2026-07-30-subscriber-growth-redesign.md) · [Wave 6 value & re-engagement research](../../research/2026-07-30-value-and-reengagement-research.md) · [redesign concepts](../../design/2026-07-30-redesign-concepts.md) · [user research findings](../../research/2026-07-30-user-research-findings.md)

This doc exists because ordering was previously **scattered** across four docs (Wave 5 phases, Wave 6 dependency column, the redesign build-order table, the funnel sequencing note). This is the one place that says, end to end, _do this, then this, and here's the gate where you re-decide._

---

## The two rules that fix the order

1. **You can't fix a funnel you can't see, and you can't measure against a broken control.** So the defect fix (TE-59) and instrumentation (TE-49) come before everything — any conversion number taken before them is a lie.
2. **Value before scaffolding.** Wave 5 _repackages_ existing value; Wave 6 _adds_ new value. Neither survives a feed that feels repetitive (TE-30/31) or a visitor who bounces in five seconds (activation). So the order is: **fix → see → activate → convert → DECIDE from data → retain/add-value.** The decision gate is load-bearing; the stages after it are re-ranked by what TE-49 shows, not by this doc's guesses.

---

## The critical path (one list, in order)

Legend — **Gate** = do not proceed past until true. Effort S/M/L. "∥" = can run in parallel.

| #   | Stage                                      | Item                                                                                        | Why here / gate                                                                                                                                                                                                       | Effort |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **0 · Fix**                                | **TE-59** — reachable Evidence upgrade CTA (defect)                                         | Ships alone, first. It's the primary persona's dead end (findings U1) and a broken baseline for every conversion metric.                                                                                              | S      |
| 2   | **0 · See**                                | **TE-49** — funnel instrumentation (land→open→teaser→paywall→checkout→day2)                 | Decides whether the rest of this order is right. Everything downstream is a hypothesis until this reports.                                                                                                            | S      |
| 3   | **0 · Verify**                             | **Gate: confirm TE-16 anon read path actually works**                                       | Backlog says TE-16 shipped, but findings U2 still saw an empty anonymous landing. Activation (step 4–6) is pointless if a logged-out visitor sees nothing. **Reproduce in a real signed-out browser before Stage 1.** | S      |
| 4   | **1 · Activate**                           | **TE-52** — why-now SignalRibbon on every card                                              | Cheapest activation win; surfaces the one thing an LLM can't say. Do first in the stage.                                                                                                                              | S      |
| 5   | 1 · Activate                               | **TE-50** — plain-language WelcomeHero (kill the "five investability dimensions" jargon)    | Fixes the first five seconds (findings U3).                                                                                                                                                                           | S      |
| 6   | 1 · Activate                               | **TE-51** — one fully-unlocked hero idea for anon visitors                                  | Needs the anon evidence payload (depends on step 3). Doubles as the anonymous _preview_ — pull forward if step 3 shows the landing is still thin.                                                                     | M      |
| 7   | **2 · Convert**                            | **TE-53** — `UpgradePrompt` contextual paywall + blurred-real teaser                        | Core conversion surface; replaces every `setActiveTab('pro')` teleport (findings U5).                                                                                                                                 | M      |
| 8   | 2 · Convert                                | **TE-54** — one-time evidence sample (taste the aha)                                        | Rides on TE-53.                                                                                                                                                                                                       | M      |
| 9   | 2 · Convert                                | **TE-55** — job-based pricing (Discover/Evaluate/Execute)                                   | Copy/layout only; nearly free. ∥ with TE-54.                                                                                                                                                                          | S      |
| 10  | 2 · Convert                                | **TE-67** — reverse trial (7-day full Pro) + annual pricing                                 | Net-new (Wave 6). Samples _breadth_ where TE-54 samples one idea. After TE-53/54 give a baseline.                                                                                                                     | M      |
| —   | **★ GATE**                                 | **Read TE-49 data. Where is the biggest leak — activation, conversion, or retention?**      | **Re-rank everything below by the answer.** Kill criteria in the Wave 6 research doc. If day-2 return is already healthy, deprioritise the value pillars; if activation still leaks, loop back to Stage 1.            | —      |
| 11  | **3 · Retain (trust)**                     | **TE-57** — public track record from `prediction-tracker`                                   | Trust in the score is trust in the subscription (findings U8). Also an acquisition asset.                                                                                                                             | M      |
| 12  | 3 · Retain                                 | **TE-68** — cancellation exit-reason + save offer                                           | Cheapest churn instrument; turns the loudest signal into data. Pull earlier if churn is already visible.                                                                                                              | S      |
| 13  | 3 · Retain                                 | **TE-56** — founder-fit onboarding + feed tuning **(with the `founderProfile` correction)** | `Idea.founderFit` is triage, not skill-fit — add `users/{uid}.founderProfile`, match on `buyer`/`firstWedge`/`costEffort`. Largest Wave 5 item.                                                                       | L      |
| 14  | 3 · Retain                                 | **TE-58** — habit loop ("what changed" + streak + roadmap resurfacing)                      | Seed for TE-60/TE-65 below.                                                                                                                                                                                           | M      |
| —   | **Quality lane (parallel, gates Stage 4)** | **TE-30 / TE-31** — intra-day diversity + right-sized publish count                         | Pillar 0. Run alongside Stages 1–3; **must be healthy before Stage 4** — no must-have workspace survives a repetitive feed.                                                                                           | M+S    |
| 15  | **4 · Add value (must-have)**              | **TE-60** — "Today" personal home (presentation spine)                                      | Makes every pillar legible; v1 aggregates existing state (saves, roadmap progress). Gated on the ★ gate favouring retention/value.                                                                                    | L      |
| 16  | 4 · Add value                              | **TE-61** — "My Thesis" radar + live monitoring                                             | The single highest-leverage must-have; also the engine that gives push a personal reason to exist.                                                                                                                    | L      |
| 17  | 4 · Add value                              | **TE-62** — native + web push                                                               | **Gated on TE-61** so the first push is personal, never a generic broadcast.                                                                                                                                          | M      |
| 18  | 4 · Add value                              | **TE-63** — personalized re-engagement digest                                               | Extends the Resend digest; ∥ with TE-62. Uses TE-56 fit + TE-61 radar.                                                                                                                                                | M      |
| 19  | 4 · Add value                              | **TE-64** — validation-in-the-loop (tracked experiments)                                    | Switching-cost / churn defense; builds on the existing toolkit. ∥ with the radar chain.                                                                                                                               | L      |
| 20  | 4 · Add value                              | **TE-65** — build accountability + ship-log                                                 | Extends TE-58 into an accountability loop.                                                                                                                                                                            | M      |
| 21  | 4 · Add value                              | **TE-66** — real social proof + co-founder matching                                         | Last: network effects need density, and fabricated counts would break trust. Highest risk.                                                                                                                            | M      |

---

## Why this order and not another

- **Stage 0 is non-negotiable and first.** The funnel playbook, the findings doc, and the Wave 6 research all independently land on "fix TE-59, ship TE-49, before anything." Three docs, one conclusion.
- **Activation before conversion.** You cannot convert a visitor who never reached value — findings show the primary persona bounces at the door, not at the paywall.
- **Conversion before the big retention/value bets.** Retention (Wave 5 Phase 3) and must-have value (Wave 6) are the most engineering. Spend it only after activation+conversion prove the value is landing and the ★ gate says retention/value is the real leak.
- **The ★ gate is the point of the whole plan.** Everything before it is cheap and near-certain. Everything after it is expensive and data-dependent. The plan's job is to get you to that gate fast and honest, then let the data — not this table — rank Stages 3–4.
- **Quality (TE-30/31) runs in parallel and gates Stage 4** rather than sitting in the serial line, because it's pipeline work independent of the funnel UI, but the value pillars are worthless on top of a repetitive feed.

---

## Fastest path to signal (if you only do six things)

For a resource-constrained sprint, this subset reaches a measured decision with minimum spend:

**TE-59 → TE-49 → TE-52 → TE-50 → TE-53 → (read data).**

That is: fix the dead button, turn on measurement, make the moat visible, say what the app is in plain words, convert in place — then let the funnel tell you whether to invest in conversion depth (TE-54/55/67) or jump to retention/value (Stage 3–4). Everything else is sequenced but should wait for that first read.

---

_All effort/ordering is a proposal, not a commitment past the ★ gate. Item definitions and user stories live in [`docs/BACKLOG.md`](../../BACKLOG.md); this doc only orders them._
