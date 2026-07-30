# Redesign Design Concepts — activation, conversion, retention

**Date:** 2026-07-30
**Status:** Proposed (for review — nothing built, nothing merged)
**Companion docs:** [funnel strategy playbook](../superpowers/plans/2026-07-30-funnel-strategy-playbook.md) (the why) · [subscriber-growth strategy](../superpowers/plans/2026-07-30-subscriber-growth-redesign.md) (the thesis) · [user research findings](../research/2026-07-30-user-research-findings.md) (the user-side evidence — persona walkthroughs validating A/B/C from the user's seat)
**Visual companion:** the rendered mobile board covers the hero, feed, locked detail, contextual paywall, Pro evidence, Builder execution, and pricing screens — this doc specifies them in build terms and adds the retention screens the board didn't cover.

These are **design concepts**, not final visuals — enough for a build to start or a design tool to render accurately, with real copy, real states, and the component each maps to. Each concept names the campaign, the problem it attacks, and its ticket.

---

## 0. Design principles for this redesign

Six rules every screen below obeys. They exist because the goal is _subscriptions_, and each principle is a lever on one of the three problems.

1. **Value before locks.** Never show a paywall to someone who has not yet felt the value. Desire is manufactured by a real taste, not by a grey button. _(activation, conversion)_
2. **Convert in place.** A user who wants something is converted where they are, framed around that thing — never teleported to a pricing grid. _(conversion)_
3. **Lead with what an LLM can't say.** The live signal and the cited evidence are the product's only true moat. They go first, not behind an expand. _(activation, retention)_
4. **Every claim is provable.** Scores link to a track record; evidence links to sources. Trust is the thing that survives a renewal date. _(retention)_
5. **Make progress visible.** The user should always be able to see what they've accrued — saved ideas, roadmap progress, a streak — so leaving feels like a loss. _(retention)_
6. **State is legible.** Locked, sampling, unlocked, loading, empty — every gated surface has a designed state for each, not just the happy path. _(all)_

**Visual language (kept deliberately light — this redesign is about value, not rebranding).** The current zinc-950 + emerald system is competent; the concepts below keep it. Two small shifts carry weight: (a) reserve one _cool_ accent for "verified/evidence" so proof reads differently from promotion, and (b) give the live signal a warm "heat" treatment so momentum reads as momentum. These are semantic accents, not a palette change.

---

## Campaign A — Activation concepts

### A-1 · First-run value moment — `WelcomeHero`

**Problem:** A1/A2 — the intro is VC jargon; the hero states a quantity, not a value. **Ticket:** TE-50.

**Concept.** Replace the `getDynamicIntro()` paragraph and the "TODAY'S TOP 10 OPPORTUNITIES" heading (for first-time / anonymous visitors only) with a compact value block above the feed.

```
┌──────────────────────────────────────────────┐
│  TREND EQUITY                                  │
│                                                │
│  Ten startup ideas every morning —             │  ← headline, plain language
│  grounded in live market signals,              │
│  checked against real evidence.                │
│                                                │
│  So you're building on proof,                  │  ← the differentiator, stated
│  not a chatbot's guess.                        │
│                                                │
│  ● Product Hunt  ● Hacker News  ● Google Trends │  ← where signals come from
│                                                │
│  [ See today's ideas ↓ ]   Free · no card      │
└──────────────────────────────────────────────┘
```

**States.** First-time/anonymous → full hero. Returning signed-in user → collapses to a one-line date/count header (they don't need re-selling). Persist "seen" in `localStorage` so it doesn't nag.
**Copy rule.** No word a founder wouldn't use out loud. "Investability dimensions" → "checked against real evidence."
**Maps to.** `App.tsx` intro block; new `WelcomeHero` component gated on a first-run flag.

### A-2 · The hero idea — one card given away whole

**Problem:** A5 — locks appear before desire. **Ticket:** TE-51.

**Concept.** The first card in the feed for a new/anonymous visitor renders **fully unlocked** — signal ribbon, full analysis, market evidence with live sources, all next steps — with a quiet label:

```
┌──────────────────────────────────────────────┐
│  ▲ TRENDING · Product Hunt, this week   [8.7]  │  ← why-now ribbon (A-3) + score
│  Audit-ready compliance copilot for fintechs   │
│  ────────────────────────────────────────────  │
│  [ full pitch, VC analysis, evidence, sources ] │  ← nothing blurred
│                                                │
│  ✦ This is one full idea, unlocked.            │  ← honest framing
│    Every idea has this depth inside.           │
└──────────────────────────────────────────────┘
```

Cards 2..N revert to the tiered locked view. The contrast _is_ the pitch: "card 1 was complete; here's what the rest hold."
**Rule.** Give away depth on _one_ idea, not a shallow taste on all — depth is what an LLM can't match.
**Maps to.** `IdeaFeed` (render first card with a `previewFull` prop); `IdeaCard` honours it by ignoring `isFree` gates for that instance only. **Server note:** the full payload for one idea must be sendable to anonymous users — confirm the anonymous read path (TE-16) exposes evidence for the designated hero idea, or generate it server-side for the daily hero only.

### A-3 · Why-now signal ribbon — `SignalRibbon`

**Problem:** A4 — the differentiator is buried behind an expand. **Ticket:** TE-52.

**Concept.** A slim ribbon at the very top of every card, above the headline, showing the live signal that surfaced the idea:

```
▲ TRENDING · Product Hunt +340% · Hacker News front page
```

- Warm "heat" accent (amber→coral), distinct from the emerald UI and the cool evidence accent.
- Sourced from `idea.trendSources` / the signal snapshot; degrade gracefully to a neutral "Signal: —" when absent (don't fabricate).
- Tapping it scrolls to / expands the sources section (existing content, promoted).

**Maps to.** `IdeaCardHeader` (new top row) or a dedicated `SignalRibbon` rendered by `IdeaCard` before the header.

---

## Campaign B — Conversion concepts

### B-0 · Fix the dead upgrade CTA (defect, ships alone)

**Problem:** B1/B2 — the free-tier Evidence "Upgrade →" button is unclickable (`pointer-events-none` on the container) and hover-only (invisible on touch). **Ticket:** TE-59.

**Concept.** The free-tier Evidence control stops being a disabled grey button with a hover tooltip. It becomes an **active** button that opens the contextual paywall (B-1) on click/tap:

```
Before:  [ 🔍 Evidence ]  (disabled, 50% opacity, hover-only tooltip w/ dead link)
After:   [ 🔍 Evidence · Pro ]  (active; tap → UpgradePrompt about evidence)
```

No tooltip dependency, no `pointer-events-none`, works on touch. This is a correctness fix; it should not wait for the rest of the campaign.
**Maps to.** `IdeaCard.tsx:277–298`.

### B-1 · Contextual paywall — `UpgradePrompt`

**Problem:** B3 — `setActiveTab('pro')` teleports users away from intent. **Ticket:** TE-53.

**Concept.** One reusable modal/sheet, invoked at every gate, parameterised by the _thing the user reached for_. It never navigates away.

```
┌──────────────────────────────────────────────┐
│                        [×]                     │
│   🔒  See if this is real                      │  ← headline = the thing they wanted
│                                                │
│   Market Evidence gives you:                   │
│   ✓ Real market size, with sources             │
│   ✓ Who the competitors actually are           │
│   ✓ Why now — the timing evidence              │
│                                                │
│   [ Sample it free on this idea → ]  (if B-3)  │  ← taste path when available
│   [ Start Pro · $9/mo ]                         │
│   Already building? Builder →                  │  ← quiet cross-sell
└──────────────────────────────────────────────┘
```

**Parameterisation.** `reason: 'evidence' | 'save-limit' | 'roadmap' | 'csv' | 'custom-analysis' | 'comments'` → drives headline, bullet list, and which tier is primary. One component, six framings.
**States.** Anonymous → primary CTA is "Sign in to continue" then resumes intent (reuse TE-44 `pendingIntent`). Free signed-in → shown the offer. `tierLoading` → CTA disabled (TE-45 rule).
**Rule.** The modal is presentation only — it calls the same checkout/portal paths; it never mutates tier (`docs/PAYMENTS.md`).
**Maps to.** New `UpgradePrompt`; replace `onUpgrade` / `setActiveTab('pro')` call-sites in `App.tsx`, `IdeaCard`, `IdeaCardAnalysis`, `FilterBar`, `SavedIdeasTab`.

### B-2 · Evidence teaser — blur real content, not a grey button

**Problem:** B4 — the teaser shows nothing of what's behind it. **Ticket:** TE-53 (with B-1).

**Concept.** Apply the existing `LockedAnalysisSection` blur pattern to evidence: render a _real_ (server-provided, truncated) evidence snippet behind the blur so a number and a competitor name are legible through it.

```
┌──────────────────────────────────────────────┐
│ ░░ $3.1B market · 14% CAGR ░░░░░░░░░░░░         │  ← real data, blurred
│ ░░ Vanta, Drata price for Series B+ ░░░░        │
│         ┌─────────────────────────┐            │
│         │ 🔒 Market Evidence       │            │
│         │ See the proof — Pro →    │            │  ← opens UpgradePrompt(evidence)
│         └─────────────────────────┘            │
└──────────────────────────────────────────────┘
```

**Rule.** The blurred text must be genuine (a short server-sent teaser), never lorem — a fake blur that unlocks to different content destroys trust. Send a ~2-line `evidenceTeaser` for free tier; withhold the full `evidence` object.
**Maps to.** `IdeaCardEvidence` free-state; `LockedAnalysisSection` (reused); server `evidence.ts` returns a teaser for free tier instead of a bare 403.

### B-3 · One free taste — evidence sample

**Problem:** B5 — users buy something they've never experienced. **Ticket:** TE-54.

**Concept.** A free account may fully unlock Market Evidence on **one** idea, once. The `UpgradePrompt` grows a primary "Sample it free on this idea" button while the allowance is unused; after it's spent, that button is gone and the prompt is upgrade-only, with a callback: _"You've seen how Evidence works. Unlock it everywhere with Pro."_

```
Allowance unused:   [ Sample it free on this idea → ]   [ Start Pro · $9/mo ]
Allowance spent:    "You've seen it. Unlock everywhere → "  [ Start Pro · $9/mo ]
```

**State + integrity.** One-shot flag lives server-side on `users/{uid}` (e.g. `evidenceSampleUsedOn: ideaId`), enforced in `evidence.ts` — never a client flag (same discipline as tier). Firestore rules must deny client writes to it (`CLAUDE.md` §2.3).
**Maps to.** `evidence.ts` (allowance check + grant), `users/{uid}` field + `firestore.rules` allowlist, `UpgradePrompt` (button state).

### B-4 · Job-based pricing — `PricingSection` reframe

**Problem:** B6 — pricing compares features, not situations. **Ticket:** TE-55.

**Concept.** Reframe the three columns around the user's job. Same features, same prices; the header and one line of framing change, and the recommended tier is anchored.

```
   DISCOVER            EVALUATE  ★ popular      EXECUTE
   Free                Pro · $9/mo              Builder · $19/mo
   "See what's         "Know if it's real       "Go build it."
    out there."         before you commit."
   ─────────           ─────────                ─────────
   10 ideas/day        Everything in Discover   Everything in Evaluate
   Save 5              + Market Evidence         + Full roadmaps
   Scores & signals    + Full VC analysis        + Build-with-me
                       + 25/day · 5 analyses     + Futurecasting
   [ Start free ]      [ Start Pro ]            [ Go Builder ]
```

**Rules.** "Everything in X, plus" makes Builder read as +$10, not a fresh decision. The card the user _clicked to get here_ is pre-highlighted (carry the reason through). Anonymous → every CTA starts sign-in and resumes (TE-44).
**Maps to.** `PricingSection` (copy + layout; the "Everything in X" grouping; anchor state).

---

## Campaign C — Retention concepts

### C-1 · Founder-fit onboarding — `FounderFitSetup`

**Problem:** C1 — nothing is personal; `founderFit`/`buyer`/`firstWedge` are unused. **Ticket:** TE-56.

**Concept.** A one-time, three-question, skippable setup (post-signup or first paid session), stored on the user doc and used to _order and annotate_ the feed — not to hide ideas.

```
┌──────────────────────────────────────────────┐
│  Let's tune your feed  (30 seconds, skippable) │
│                                                │
│  What can you build?    [ Software ][ Physical ]│
│                         [ Service ][ Any ]      │
│  Budget to start?       [ <$1k ][ $1–10k ][ 10k+ ]│
│  Time you have?         [ Nights ][ Part-time ][ Full ]│
│                                                │
│  [ Tune my feed ]              Skip for now    │
└──────────────────────────────────────────────┘
```

**Feed effect.** Ideas matching the profile sort up and gain a "Fits you" chip explaining _why_ ("Software · nights-and-weekends · low capital"). Non-matches remain visible (breadth matters). Matching uses `costEffort`, `founderFit`, `buyer`, `firstWedge`.
**Rule.** Personalize ordering, never censor the feed — a founder should still stumble on the wildcard. Store profile server-side; it's not sensitive but it _is_ account state (clear on sign-out per TE-43).
**Maps to.** New `FounderFitSetup`; `users/{uid}.founderProfile`; feed sort in `useIdeas` / `getFilteredIdeas`; a `FitChip` on `IdeaCard`.

### C-2 · Track record — `TrackRecord` view

**Problem:** C4 — the trust asset (`prediction-tracker`) is invisible. **Ticket:** TE-57.

**Concept.** A dedicated, honest scoreboard reading `idea_predictions`: past ideas, their publish-time scores, and what actually happened — **including misses**. Honesty is the point; a perfect record reads as fake.

```
┌──────────────────────────────────────────────┐
│  Our track record            Updated monthly   │
│                                                │
│  Ideas scored 8+, 6 months on:                 │
│  ●●●●●●●○○○   7/10 have real traction           │  ← plain, not a hype number
│                                                │
│  ✓ Compliance copilot (8.7)  → seed raised     │
│  ✓ Rural pharmacy robotics (8.2) → 2 competitors│
│  ✗ Driveway bike repair (7.9) → no movement yet │  ← show the miss
│                                                │
│  We grade every prediction. [ How this works ] │
└──────────────────────────────────────────────┘
```

**Placement.** Linked from pricing ("why trust the scores?"), from the score badge on cards, and as a public marketing surface. Being public makes it an acquisition asset too (Campaign A).
**Rule.** Never hide misses; grade transparently. This is only credible if `prediction-tracker` has ≥6 months of data — if not, ship the framework and label it "first cohort grades: {date}."
**Maps to.** New `TrackRecord` tab/page; read `idea_predictions`; server aggregation (respect that these are server-only snapshots).

### C-3 · Daily payoff & accrual — `TodayDelta` + `BuildProgress`

**Problem:** C2/C3/C5 — no daily reason to return, saves are a dead end, Builder value is trapped per-card. **Ticket:** TE-58.

**Concept, two surfaces.**

**(a) `TodayDelta`** — a top-of-feed strip that makes "what changed" legible and starts a light streak:

```
  ✦ 10 new ideas today · 3 match your fit · 🔥 6-day streak
     2 ideas you saved gained new evidence →
```

**(b) `BuildProgress`** — a Builder-only surface promoting roadmap progress _out_ of the card into a persistent "what I'm building" view:

```
┌──────────────────────────────────────────────┐
│  What you're building                          │
│  Compliance copilot   ███████░░░  7/10 steps   │
│  Next: Ship evidence-collector MVP             │
│  ──                                            │
│  Rural pharmacy robotics  ██░░░░░░  2/10        │
└──────────────────────────────────────────────┘
```

**Rules.** Streaks reward _return_, never spend — no dark patterns. Saved-idea resurfacing must link to a genuine change (new evidence, competitor moved), not a nag. Builder progress aggregates existing `fullActionPlan.roadmap[].isDone`.
**Maps to.** `TodayDelta` on `IdeaFeed`; `BuildProgress` as a Builder view or `SavedIdeasTab` section; streak counter on `users/{uid}` (server-written on daily open).

---

## Build order (design-side)

Mirrors the playbook's ticket sequence — the two unconditional items are visual-cheap and unblock everything:

| Order | Concept                                | Ticket | Why first                                                    |
| ----- | -------------------------------------- | ------ | ------------------------------------------------------------ |
| 1     | B-0 dead-CTA fix                       | TE-59  | Defect; a working baseline before any conversion measurement |
| 2     | A-3 SignalRibbon                       | TE-52  | Cheapest activation win; surfaces the moat on every card     |
| 3     | A-1 WelcomeHero                        | TE-50  | Small; fixes the first 5 seconds                             |
| 4     | B-1/B-2 UpgradePrompt + blurred teaser | TE-53  | Core conversion surface                                      |
| 5     | B-3 evidence sample                    | TE-54  | Rides on the UpgradePrompt                                   |
| 6     | B-4 job-based pricing                  | TE-55  | Copy/layout only                                             |
| 7     | A-2 hero idea                          | TE-51  | Needs anonymous evidence payload                             |
| 8     | C-1 founder-fit                        | TE-56  | Largest; retention foundation                                |
| 9     | C-2 track record                       | TE-57  | Trust + acquisition asset                                    |
| 10    | C-3 daily payoff                       | TE-58  | Habit loop                                                   |

---

## Honest limits (design-side)

- **These concepts assume the value is real.** The prettiest `UpgradePrompt` cannot sell Evidence that isn't better than a free prompt, and no streak retains someone bored of the feed (see TE-30/31 quality debt).
- **ASCII sketches are intent, not spec.** Spacing, motion, and exact type are a build/design-tool step; the earlier rendered board is the closest visual reference.
- **Every gated surface needs its unhappy states designed** (empty, loading, error, anonymous, `tierLoading`) before it's "done" — principle 6. The sketches show the happy path only.
