# Subscriber-Growth Redesign Strategy

**Date:** 2026-07-30
**Status:** Proposed (awaiting review)
**Goal:** Redesign the product experience so it delivers value a free LLM cannot, and converts + retains paying subscribers across web and (eventually) native mobile.
**Scope:** Whole funnel — activation, conversion, retention — treated as one system.

---

## 0. The thesis: stop selling "ideas"

In 2026, _"AI gives you startup ideas"_ is free and everywhere. Anyone can prompt ChatGPT for ten ideas in five seconds. **A prettier idea feed will not move subscriptions.** The only thing worth paying for is what a free prompt cannot produce:

| Defensible value                                                           | Already built in                                      | The sentence a subscriber says                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Ideas grounded in **live momentum** (Product Hunt, HN, Trends _this week_) | `api/_lib/signals.ts`                                 | "This is moving right now — it's not hallucinated."      |
| **Verifiable evidence** with clickable sources                             | `api/_lib/evidence.ts`                                | "I can check the market is real before I bet on it."     |
| **Curation** — the slop is filtered out                                    | `api/_lib/quality-engine.ts`                          | "I see 10 high-conviction ideas, not 100 mediocre ones." |
| The full loop: idea → **build** → **track if it worked**                   | roadmap/build packs, `api/_lib/prediction-tracker.ts` | "It holds me accountable and proves its own hit rate."   |

**Reframe:** Trend Equity is not an idea generator. It's a **conviction-and-execution engine** — it turns market noise into a founder's next move, grounded and verified. Every redesign decision below serves that one reframe.

---

## 1. Funnel diagnosis (grounded in the current build)

The subscriber problem bites at all three stages. Each has a concrete, code-level cause today.

### 1a. Activation — "people don't use it"

- **No value moment before the feed.** `App.tsx` drops an anonymous visitor straight onto a tab UI with the intro: _"…scored across five investability dimensions by our VC engine… Decision support, not inspiration."_ That is abstract and internal-facing; it never says, in human terms, what this is or why it beats a free prompt.
- **The hero is generic.** _"TODAY'S TOP 10 OPPORTUNITIES"_ doesn't answer "why should I care?" or "why is this different?"
- **No guided path.** Everything is a homogeneous tab (`Daily Feed / Saved / Pricing`). There's no first-run, no aha choreography.
- **Likely outcome:** high bounce — the first screen fails the "what is this + why is it better than free" test in the first 5 seconds.

### 1b. Conversion — "they try it but don't pay"

- **Upsell = a tab switch.** Every gate calls `setActiveTab('pro')` (save-limit, CSV export, upgrade CTA). The user is teleported to a pricing grid, _away from_ the thing they wanted. There is **no contextual paywall** at the moment of desire.
- **The strongest feature converts diffusely.** Market Evidence — the one true "ChatGPT can't do this" moment — is gated, but the pitch for it is a feature line on a pricing tab, not an in-context payoff.
- **Pricing is a feature grid, not a decision.** `PricingSection` compares columns of features rather than answering "which one is me?"
- **No sampling.** A free user never _feels_ the paid aha; they only read about it.

### 1c. Retention — "they pay, then churn"

- **No reason to return daily.** The feed refreshes, but there's no personalization, no streak, no "what changed since yesterday." Once the novelty fades, the habit isn't there.
- **Saved ideas are a graveyard.** Saving has no follow-through loop pulling the user back.
- **Trust is invisible.** `prediction-tracker.ts` records publish-time score snapshots for 6-month accuracy grading — the exact data that would prove the scores are worth paying for — and none of it is surfaced.
- **Churn is the loudest signal of all:** if people cancel after paying, it usually means the _core value_ (idea quality + personal fit) isn't landing. No UI change fixes that — see the honest caveats in §5.

---

## 2. The redesign, by funnel stage

Each move is concrete, ties to existing code, and states the subscriber behavior it targets.

### Stage A — Activation: reach the aha in under 60 seconds

1. **A real first-run value moment.** Before (or above) the feed, one plain-language screen: _"Ten startup opportunities every morning — grounded in live market signals and backed by real evidence, so you're not betting on a hallucination."_ Replaces the "five investability dimensions" jargon. (`App.tsx` intro, new lightweight onboarding.)
2. **Lead with ONE fully-unlocked hero idea.** Instead of ten half-locked cards, give a new/anonymous visitor a single _complete_ idea — signal, evidence, the works — as a taste: "this is what every idea looks like inside." (`IdeaFeed`, `IdeaCard`.)
3. **Make the signal visceral, up top.** Each card leads with _why now_ — "▲ trending on Product Hunt this week" — the one thing a static LLM cannot know. (`IdeaCardHeader`, `signals.ts` data already present.)

### Stage B — Conversion: make "why pay" undeniable, in context

4. **Contextual paywalls at the moment of desire.** Replace `setActiveTab('pro')` with an in-context modal triggered by the specific action (tap Evidence, hit save limit, want the roadmap), framed around exactly what the user reached for. (New `UpgradePrompt` component; wire into the existing gate call-sites.)
5. **Market Evidence as the hero Pro feature.** The locked teaser shows a real number peeking through ("$3.1B market · 14% CAGR…"), and the paywall headline answers the question they just asked: _"See if it's real."_ (`IdeaCardEvidence`, `LockedAnalysisSection`.)
6. **One-time evidence sample.** Let a free user fully unlock evidence on **one** idea, once — feel the aha, then paywall the rest. Sampling the core value converts far better than describing it. (Server: a per-user one-shot flag; client: the paywall respects it.)
7. **Job-based pricing.** Reframe the three tiers as **Discover (Free) / Evaluate (Pro) / Execute (Builder)** — a "which one is me?" decision, not a feature-count grid. Keep the exact same features and prices; change the framing. (`PricingSection`.)

### Stage C — Retention: a reason to return, and trust that compounds

8. **Founder-fit personalization.** A short onboarding (skills, budget, time horizon) tunes the feed: "ideas for a solo dev with $5k and weekends" beats a generic list decisively — and it's already latent in the data model (`Idea.founderFit`, `buyer`, `firstWedge`). This is the strongest single retention lever _and_ a real reason to pay.
9. **Surface the track record.** Turn `prediction-tracker` data into a visible "our hit rate" — "6 months ago we scored this 8.7; here's what happened." Trust in the score is trust in the subscription.
10. **A habit loop.** "What changed since yesterday," a light streak, and Builder roadmap progress ("3/10 steps into X") so opening the app has a daily payoff. (`ProgressSection` exists; extend.)

---

## 3. Sequencing — and why this order

You cannot fix conversion or retention while activation is broken and the funnel is unmeasured. Order is not negotiable:

- **Phase 0 — See the funnel (days, not weeks).** Confirm `analyticsService.logEvent` captures the real drop-offs: `land → first_idea_opened → evidence_teaser_tapped → paywall_shown → checkout_started → checkout_completed → day2_return`. You already log `tab_view` and `upgrade_click`; fill the gaps. **Fixing a funnel you can't see is guessing** — this phase decides whether §2's priorities are right.
- **Phase 1 — Activation** (Moves 1–3). Cheapest work, unblocks everything downstream. If people don't activate, nothing else matters.
- **Phase 2 — Conversion** (Moves 4–7). The contextual paywall + evidence sample is the highest-leverage pair; job-based pricing is nearly free.
- **Phase 3 — Retention** (Moves 8–10). Most engineering; do it once activation/conversion prove the value is landing.

---

## 4. How we'll know it worked

| Stage      | Metric                                                               | Instrument                         |
| ---------- | -------------------------------------------------------------------- | ---------------------------------- |
| Activation | % of new visitors who open ≥1 idea; % who reach evidence teaser      | `logEvent`                         |
| Conversion | free→paid rate; % of paywall views → checkout started                | `logEvent` + `stripe_transactions` |
| Retention  | day-7 / day-30 return rate; subscription survival past first renewal | `logEvent` + subscription state    |
| Trust      | evidence "view source" clicks per paid session                       | `logEvent`                         |

Target-setting waits for Phase 0 baselines — no vanity numbers before we can measure them.

---

## 5. Honest caveats (do not skip)

- **This is inferred from code, not from data.** Priorities in §2 may reorder once Phase 0 shows where the biggest leak actually is. Treat the sequencing as the commitment; treat the specific move-ranking as a hypothesis.
- **A redesign amplifies value; it does not create it.** The biggest risk to subscriptions isn't the UI — it's whether the underlying ideas are _consistently_ good and _personally_ relevant enough to beat a free prompt. `quality-engine.ts` and founder-fit matter more than any pixel.
- **Churn is a value signal, not a design bug.** If retention is the worst leak, no paywall or animation fixes it — it means the core output isn't landing, and the fix lives in idea quality/fit (Moves 8–9), not decoration.
- **Don't over-build tiers before signal.** Resist adding tier features until data shows which value people actually pay for. Two honest tiers beat five speculative ones.

---

## 6. Backlog items (filed in `docs/BACKLOG.md`, wave 5)

Filed as **TE-49 … TE-58** — status `todo`, sequenced by phase:

- **Phase 0 — instrument:** TE-49 complete funnel instrumentation (activation + paywall + return events, on top of TE-09).
- **Phase 1 — activate:** TE-50 first-run value moment · TE-51 hero-idea taste · TE-52 why-now signal prominence.
- **Phase 2 — convert:** TE-53 `UpgradePrompt` contextual paywall · TE-54 one-time evidence sample · TE-55 job-based pricing reframe.
- **Phase 3 — retain:** TE-56 founder-fit onboarding + feed tuning (un-parks the 2026-07-02 personalization item) · TE-57 public track-record view · TE-58 habit/streak loop.

Nothing here is adopted in `DECISIONS.md` yet — this plan is `Proposed`, and the reframe becomes a recorded decision only once Phase 0 data backs it or you accept it outright.

**Follow-on (Wave 6, net-new value):** this plan deliberately invents nothing — it re-sequences existing features. The question of what value to _add_ to make the app must-have, and how to re-engage dormant installed users, is researched separately in [value, must-have & re-engagement research](../../research/2026-07-30-value-and-reengagement-research.md) (filed as TE-60…TE-68). That wave is gated behind this one: a workspace built for users who don't activate is wasted engineering.

---

_Grounds: `App.tsx`, `PricingSection.tsx`, `IdeaCard_`components,`constants.ts` (`TIER_LIMITS`), `PRD.md`, and the value-ladder decision in `DECISIONS.md` (Free = discover, Pro = evaluate, Builder = execute). No feature in this plan is invented — all exist in the codebase and are re-sequenced, not added.\*
