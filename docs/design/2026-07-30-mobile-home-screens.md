# Mobile Home Screen Designs — three concepts, one per funnel stage

**Date:** 2026-07-30
**Status:** Proposed (design plan — nothing built, nothing merged)
**Companion docs:** [user research findings](../research/2026-07-30-user-research-findings.md) (the persona walkthroughs) · [value & re-engagement research](../research/2026-07-30-value-and-reengagement-research.md) (Q1/Q2 net-new value) · [redesign concepts](2026-07-30-redesign-concepts.md) (the component-level sketches) · [execution roadmap](../superpowers/plans/2026-07-30-execution-roadmap.md) (sequencing)
**Generated visual reference:** all three concepts below were generated as real mobile UI with **Google Stitch** (Gemini 3 Pro) — see [`stitch/README.md`](stitch/README.md) for the project/screen ids and how to open or export them, and [`stitch/DESIGN.md`](stitch/DESIGN.md) for the generated design system (Archivo Narrow + Geist, with the emerald / cyan-evidence / amber-coral-signal accents preserved as briefed).

These are **three home-screen designs for the mobile app**, each optimised for the dominant job a user has _at a particular point in the funnel_. They are not three competing visual themes to pick one from — they are the **same home surface rendered for three user states**, because the research is unambiguous that the mobile home fails different users in different ways:

- **The anonymous first-run visitor** bounces in the first five seconds (findings U1/U2/U3/U4).
- **The free signed-in user** reaches value but can't convert without being teleported to a pricing grid (U5/U6).
- **The paying subscriber** consumes the feed like a newsletter and churns because nothing is _theirs_ (U8/U9/U12/U13; value research Q4).

One home component, three states. Everything below composes components already planned in the [redesign concepts](2026-07-30-redesign-concepts.md) — nothing here is a net-new invention beyond what the roadmap already tracks.

---

## What "the home page" is today (the baseline these replace)

`App.tsx` renders one home for everyone: a black italic hero reading **"Today's Top 10 Opportunities"** (`App.tsx:341–345`) over a jargon intro — _"scored across five investability dimensions by our VC engine… Decision support, not inspiration."_ (`App.tsx:280–288`) — above `IdeaFeed`. Signed-out visitors see an empty **"Daily Feed Coming"** state because the anonymous read path is broken (findings U2). The home is identical whether you are a first-time anonymous visitor or a two-month Builder subscriber. That single-state home is the thing all three designs below break apart.

---

## Design principles carried in (from redesign-concepts §0)

Each screen obeys the six principles, but each **leads** with the ones that move its stage's problem:

| Screen                        | Leads with                                               | Because the job is                         |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| 1 · First-Run Home            | _Value before locks_ · _Lead with what an LLM can't say_ | Prove it's real in 5 seconds               |
| 2 · Free Signed-In Home       | _Convert in place_ · _Every claim is provable_           | Sample the aha, convert without a teleport |
| 3 · Subscriber Home ("Today") | _Make progress visible_ · _State is legible_             | Make leaving feel like a loss              |

Visual language is unchanged from the current build: zinc-950 canvas, emerald-500 primary, black italic uppercase display type. Two semantic accents from the redesign concepts are used consistently across all three screens: a **warm "heat" accent** (amber→coral) for live momentum/signal, and a **cool accent** reserved for verified evidence, so proof reads differently from promotion.

---

## Screen 1 — First-Run Home (anonymous / first session) · Activation

**Primary persona:** P1 Maya, mobile, signed out, arrived from a founder Slack link.
**Job:** _"What is this, and is it actually real — before I decide to care."_
**Attacks:** U1 (dead evidence CTA), U2 (empty landing), U3 (jargon/quantity hero), U4 (moat buried).
**Composes:** `WelcomeHero` (TE-50) · `SignalRibbon` (TE-52) · one fully-unlocked hero idea (TE-51) · blurred-real locked cards (TE-53/B-2).

```
┌───────────────────────────────┐
│ ☰  TREND EQUITY          Sign in│  ← sign-in is present, never blocking
├───────────────────────────────┤
│                               │
│  Ten startup ideas every      │  ← WelcomeHero (TE-50): plain language,
│  morning — grounded in live   │    value not quantity. No "investability
│  market signals, checked      │    dimensions."
│  against real evidence.       │
│                               │
│  So you build on proof,       │  ← the differentiator, stated
│  not a chatbot's guess.       │
│                               │
│  ● Product Hunt ● HN ● Trends │  ← real signal sources (truth, not "X")
│                               │
│  ▁▁▁▁▁ See today's ideas ↓    │  Free · no card
├───────────────────────────────┤
│ ▲ TRENDING · PH +340% · HN    │  ← SignalRibbon (TE-52), warm heat accent
│   Audit-ready compliance      │
│   copilot for fintechs   [8.7]│
│  ───────────────────────────  │
│   Full pitch · VC analysis ·  │  ← THE HERO IDEA (TE-51): one card,
│   market evidence · sources   │    fully unlocked, nothing blurred
│   ✦ One full idea, unlocked.  │
│     Every idea has this depth.│
├───────────────────────────────┤
│ ▲ TRENDING · Reddit climbing  │
│   Rural pharmacy robotics [8.2]│
│   ░░ $3.1B market · 14% CAGR ░│  ← card 2+: blurred REAL data (TE-53/B-2),
│   ░░ Vanta, Drata price for ░░│    not a grey button. Legible through blur.
│        🔒 See the proof — Pro │
└───────────────────────────────┘
```

**Why this order.** The hero copy answers "what is this" in words a founder says out loud; the SignalRibbon answers "why now / why real" _above the fold on every card_; the one unlocked hero idea lets desire form from a real taste before any lock appears (principle 1). Locks only appear on card 2+, and even there they blur **genuine** truncated data — the contrast between card 1 (complete) and card 2 (blurred-real) _is_ the pitch.

**States (principle 6 — all designed, not just the happy path):**

- **Anonymous read path healthy** → as drawn.
- **Anon read path still thin** (roadmap Stage 0 gate open) → the hero idea is server-generated for the daily hero only, so the screen is never empty; the "Daily Feed Coming" empty state is retired for first-run.
- **Returning signed-in visitor** → `WelcomeHero` collapses to a one-line date/count header (`localStorage` "seen" flag); they are not re-sold.
- **Signal absent** → SignalRibbon degrades to neutral "Signal: —", never fabricated.

---

## Screen 2 — Free Signed-In Home (activated, not yet paying) · Conversion

**Primary persona:** P1 Maya after sign-in; secondary P2 Dev-Raj evaluating.
**Job:** _"I'm interested. Let me feel the paid aha and decide — without losing my place."_
**Attacks:** U5 (pricing-grid teleport), U6 (buying an unsampled feeling), and the TE-59 dead-CTA defect at its source.
**Composes:** `SignalRibbon` on every card · `UpgradePrompt` contextual sheet (TE-53) · one-time evidence **Sample** (TE-54) · a slim `TodayDelta` strip seeded for signed-in users (TE-58).

```
┌───────────────────────────────┐
│ ☰  TREND EQUITY         ● Free │
├───────────────────────────────┤
│ ✦ 10 new today · you saved 2  │  ← TodayDelta (TE-58) seed: a reason to
│   ▸ 1 has fresh evidence      │    return that isn't "10 new ideas"
├───────────────────────────────┤
│ ▲ TRENDING · PH +340%         │
│   Compliance copilot     [8.7]│
│   [ pitch · VC analysis ]     │  ← free already gets full analysis (audit §3)
│  ───────────────────────────  │
│   ░░ $3.1B market · 14% CAGR ░│  ← blurred-real evidence teaser
│   [ 🔍 Evidence · Pro ]        │  ← ACTIVE button (TE-59 fix); tap opens ↓
│   [ ♡ Save ]  [ ⋯ ]           │
└───────────────────────────────┘
        tap "Evidence" opens a SHEET
        in place — never a tab switch:
┌───────────────────────────────┐
│                          [ × ] │
│  🔒 See if this market is real │  ← headline = the thing they reached for
│                               │    (parameterised: reason='evidence')
│  Market Evidence gives you:   │
│   ✓ Real market size + sources│
│   ✓ Who the competitors are   │
│   ✓ Why now — the timing proof│
│                               │
│  [ Sample it free on this idea ]│ ← TE-54: one-time taste while unused
│  [ Start Pro · $9/mo ]        │
│  Already building? Builder →  │
└───────────────────────────────┘
```

**Why this shape.** The home stays put; conversion happens in a bottom sheet framed around the exact thing the user tapped (principle 2). The free user gets to **sample** the real evidence once (principle 1 → desire from a taste, not a grey wall), so the pricing decision is made _after_ the aha, not before it. The Evidence control is a live, tappable button on touch — the TE-59 defect (a `pointer-events-none`, hover-only tooltip) is designed out at the source.

**States:**

- **Sample allowance unused** → sheet shows "Sample it free on this idea"; server-enforced one-shot (`users/{uid}.evidenceSampleUsedOn`), never a client flag.
- **Allowance spent** → primary becomes "You've seen it. Unlock everywhere → Pro."
- **`tierLoading`** (between sign-in and first Firestore tier snapshot) → CTAs disabled, per the TE-45 rule; no plan action fires before tier is read.
- **Anonymous fallthrough** (if reached signed-out) → primary CTA is "Sign in to continue," then resumes the intent via `pendingIntent` (TE-44).

---

## Screen 3 — Subscriber Home, "Today" (Pro / Builder returning) · Retention

**Primary persona:** P2 Dev-Raj (Builder) and the paid P1 who converted; also P4 Sam, the installed-then-dormant user.
**Job:** _"Show me what's mine and what changed — make quitting feel like abandoning my own work."_
**Attacks:** U8 (invisible track record), U9 (Builder value trapped per-card), U12 (saves dead-end), U13 (nothing is personal); value-research Q1/Q2/Q4 (content → tool; personal reason to return; switching cost).
**Composes:** the "Today" personal home spine (TE-60) · `TodayDelta` + streak (TE-58) · `BuildProgress` (TE-58) · `TrackRecord` link (TE-57) · "My Thesis" radar module (TE-61, Wave 6). The daily feed becomes **one module**, not the whole app.

```
┌───────────────────────────────┐
│ ☰  TODAY              ● Builder│  ← opens on MY state, not a generic feed
├───────────────────────────────┤
│ Good morning, Dev-Raj         │
│ ✦ 10 new · 3 fit you · 🔥 6-day│  ← TodayDelta + ethical streak (return,
│   ▸ 2 saved ideas moved →     │    never spend/open)
├───────────────────────────────┤
│ 📡 YOUR RADAR                 │  ← My Thesis radar (TE-61): the must-have.
│  AI compliance  ▲ +240% on PH │    Personal, time-sensitive, loss-framed.
│  Dev tooling    ▬ quiet       │
│  [ + Follow a space ]         │
├───────────────────────────────┤
│ 🛠 WHAT YOU'RE BUILDING        │  ← BuildProgress (TE-58): progress lifted
│  Compliance copilot           │    OUT of the card into a persistent view.
│   ███████░░░ 7/10  Next: MVP  │    This is the switching cost.
│  Rural pharmacy robotics      │
│   ██░░░░░░░░ 2/10             │
├───────────────────────────────┤
│ 📊 OUR TRACK RECORD           │  ← TrackRecord (TE-57): scores earn trust.
│  8+ ideas, 6mo on: 7/10 moved │    Shows misses too — honesty is the point.
│  [ See how we grade → ]       │
├───────────────────────────────┤
│ 🗞 TODAY'S FEED         See all│  ← the feed is now ONE module, collapsed
│  ▲ Compliance copilot   [8.7] │
│  ▲ Rural pharmacy        [8.2]│
│  ▸ 8 more ↓                   │
└───────────────────────────────┘
```

**Why this is the retention screen.** The value research is blunt: an AI idea feed is _content_, and content is nice-to-have — you'd "just prompt ChatGPT." Must-have products have **accrued personal state** and **switching cost**. This home leads with three surfaces that are _mine_ and _grow with use_ — a radar on my spaces, my build progress, a track record that makes my scores trustworthy — and demotes the generic feed to one module. That is the move from **reader to operator**. It is also the engine of re-engagement (Q2): every one of these modules can emit a _personal, time-sensitive_ notification ("your space spiked +240%"), which is the only kind the research permits shipping.

**States:**

- **Pro (not Builder)** → "What you're building" hides Builder-only roadmap; radar + track record + feed remain.
- **New subscriber, no accrued state yet** → radar shows "Follow your first space," BuildProgress shows "Start a roadmap from any idea"; the screen onboards rather than showing empty modules.
- **Dormant returning user (P4)** → a "here's what changed in your spaces while you were away" re-entry banner replaces the greeting; reward return, never punish absence.
- **Radar/Wave-6 not yet shipped** → TE-60 v1 aggregates only existing state (saves, roadmap progress, deltas); the radar module is hidden until TE-61 lands, so the screen degrades cleanly to what the current data model already supports.

---

## How the three screens relate (one component, three states)

```
        ┌──────────────┐   sign in    ┌──────────────────┐  subscribe   ┌───────────────────┐
Visitor │ 1 First-Run  │ ───────────▶ │ 2 Free Signed-In │ ───────────▶ │ 3 Subscriber Today│
 lands  │  (activate)  │              │   (convert)      │              │    (retain)       │
        └──────────────┘              └──────────────────┘              └───────────────────┘
         value before locks            convert in place                 make progress visible
         U1·U2·U3·U4                    U5·U6 · TE-59                     U8·U9·U12·U13 · Q1/Q2/Q4
```

The `Home` container renders one of the three compositions based on `useTier().hasAccount` and `tier`. This mirrors the payments discipline (`docs/PAYMENTS.md`): `tier` is an entitlement read from the Firestore snapshot, `tierLoading` gates any plan action, and no screen ever mutates tier client-side.

## Build order (design-side, follows the execution roadmap)

The screens are deliberately staged so nothing precedes the funnel-observability and defect gates:

1. **Screen 1** rides Stage 1 activation — `TE-59` (fix, first) → `TE-52` SignalRibbon → `TE-50` WelcomeHero → `TE-51` hero idea. Cheap, high-certainty.
2. **Screen 2** rides Stage 2 conversion — `TE-53` UpgradePrompt + blurred teaser → `TE-54` sample. Reuses Screen 1's SignalRibbon.
3. **Screen 3** is gated on the **★ decision gate**: build it only if TE-49 funnel data shows the biggest leak is retention/value, not activation. Its Wave-6 modules (radar, TE-61) are gated again behind TE-60 v1 and a non-repetitive feed (TE-30/31, Pillar 0).

## Honest limits

- **These are compositions of planned components, not a new visual system.** The value is in _which_ surfaces lead at _which_ user state, not in new pixels.
- **Screen 3 assumes the feed quality is real.** No radar or streak retains a user bored of repetitive ideas (TE-30/31). Screen 3 should not ship over an unfixed Pillar 0.
- **ASCII is intent, not spec.** Spacing, motion, and exact type are a build/design-tool step. A rendered mobile board accompanies this doc for visual reference.
- **Every state above must be built, not just the happy path** (principle 6) — the state lists are part of the design, not footnotes.
