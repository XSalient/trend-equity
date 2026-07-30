# Funnel Strategy Playbook — three problems, three campaigns

**Date:** 2026-07-30
**Status:** Proposed (for review — nothing adopted, nothing merged)
**Companion docs:** [subscriber-growth redesign strategy](2026-07-30-subscriber-growth-redesign.md) (the thesis) · [redesign design concepts](../../design/2026-07-30-redesign-concepts.md) (the screens)

This playbook targets the three stated problems as three separate campaigns, each with its own root-cause evidence, hypotheses, tactics, and kill criteria:

1. **People don't use it** → activation
2. **People try it but don't pay** → conversion
3. **People pay then churn** → retention

---

## 0. The measurement problem that comes first

**We cannot currently see problem 1 at all.**

`src/services/analyticsService.ts:57`:

```ts
export async function logEvent(name: string, context?: Record<string, any>) {
  if (!auth.currentUser) {
    console.debug('[analytics] No user authenticated, skipping event:', name);
    return; // ← every anonymous event is dropped
  }
```

Every event from a signed-out visitor is discarded. Since problem 1 is _entirely_ about people who have not signed in, the product has **zero visibility into its own top of funnel**. TE-09 shipped analytics that structurally cannot observe activation.

There are two parallel telemetry systems, and only one survives sign-out:

| System                       | Transport                        | Anonymous? | Scope                                                     |
| ---------------------------- | -------------------------------- | ---------- | --------------------------------------------------------- |
| `analyticsService.logEvent`  | Firestore `user_analytics`       | ❌ dropped | Product events (`tab_view`, `upgrade_click`, `quota_hit`) |
| `trackingService.trackEvent` | `POST /api/track` (`sendBeacon`) | ✅ works   | Idea-scoped only (`impression`, `expand`, `save`, …)      |

So anonymous _idea impressions_ are visible; anonymous _journeys_ are not. Nobody can currently answer "how many people landed and never opened an idea?"

**Secondary defect:** `flushQueue` loops `await addDoc(...)` per event — one round-trip each, despite the "Batch write events" comment. It is a queue, not a batch. Low priority, but it will bite at volume.

**Consequence for this playbook:** every priority below is a _hypothesis derived from reading code_, not a finding from data. Campaign A's first move is making the funnel observable. Until then, ranking between the three problems is judgement, not evidence.

**Partial user-side check (still not real data):** a persona walkthrough of the current build — [user research findings](../../research/2026-07-30-user-research-findings.md) — independently confirms A1/A2/A4/A5, B1/B2/B3/B5/B6, C1/C3/C4/C5 from the user's seat and re-ranks the cliffs (the dead Evidence button TE-59 and the empty anonymous landing TE-16 stop the primary persona before any C-work matters). It is an expert walkthrough, not moderated sessions — it sharpens the hypotheses but does not replace TE-49.

---

## Campaign A — "People don't use it" (activation)

### What we believe is happening

An anonymous visitor lands on the app and is given a tab UI, a wall of ideas, and no explanation of what makes this different from asking an LLM for startup ideas.

**Code-grounded causes:**

| #   | Cause                                                                                                                                                                                                | Evidence                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| A1  | **The intro is written for us, not for them.** "…scored across five investability dimensions by our VC engine… Decision support, not inspiration."                                                   | `App.tsx` `getDynamicIntro()`               |
| A2  | **The hero states a quantity, not a value.** "TODAY'S TOP 10 OPPORTUNITIES" answers neither "what is this?" nor "why is it better than free?"                                                        | `App.tsx` main heading                      |
| A3  | **No first-run.** A new visitor and a 200-day user see the identical screen. There is no aha choreography, no guided first idea.                                                                     | `App.tsx` tab shell                         |
| A4  | **The differentiator is buried.** Live signals — the one thing an LLM cannot produce — are inside `trendSources` behind an expand, not in the first impression.                                      | `IdeaCard` → "View VC Analysis & Sources"   |
| A5  | **The best content is locked from the best-motivated visitor.** A brand-new visitor sees locked panels before they have any reason to want them. Locks before desire read as "paywall," not "value." | `IdeaCardAnalysis`, `LockedAnalysisSection` |

### Strategy: earn 60 seconds, then prove the differentiator

The goal of the first minute is **one honest, complete demonstration** — not maximum coverage of the feature list.

| Tactic                                                                                                                                                                                                           | What it does                   | Ticket |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| **A-1 · Say what it is in one human sentence.** Replace the VC-jargon intro with plain language naming the differentiator: grounded in live signals, evidence-checked, so you're not betting on a hallucination. | Fixes A1/A2                    | TE-50  |
| **A-2 · Give one idea away completely.** One fully-unlocked idea — signal, evidence, citations, analysis — before any lock is shown. "This is what every idea looks like inside."                                | Fixes A5 — desire before locks | TE-51  |
| **A-3 · Lead every card with _why now_.** Put the live signal in the first line of the card, not behind an expand. This is the single most defensible thing the product knows.                                   | Fixes A4                       | TE-52  |
| **A-4 · Make the first minute observable.** Anonymous-safe event capture, so the drop-off between land → scroll → open → expand is a number rather than a guess.                                                 | Fixes §0                       | TE-49  |

### How we'll know

| Question                           | Metric                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Do they get past the first screen? | % of landings that scroll past the hero                                          |
| Do they engage an idea?            | % that open/expand ≥1 idea (already partly visible via `trackEvent` impressions) |
| Do they reach the differentiator?  | % that view evidence or sources                                                  |
| Do they come back unprompted?      | day-2 return rate for anonymous visitors                                         |

### What would disprove this campaign

If anonymous visitors already open ideas at a healthy rate and simply never return, activation is **not** the leak — the problem is value/retention (Campaign C) and this campaign should be deprioritised. TE-49 answers this within days.

---

## Campaign B — "They try it but don't pay" (conversion)

### What we believe is happening

The product gates the right things (TE-22…TE-26 did that work correctly), but the _moment of conversion_ is mishandled: users are moved away from what they wanted, and in one critical case the upgrade path does not function at all.

**Code-grounded causes:**

| #   | Cause                                                                                                                                                                                                                                                        | Evidence                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| B1  | **The primary Pro upsell CTA is physically unclickable.** The free-tier Evidence tooltip container carries `pointer-events-none`; the "Upgrade →" `<button>` is nested inside it and never re-enables pointer events. The click cannot land — on any device. | `IdeaCard.tsx:285–296`                                                                      |
| B2  | **…and on touch it never even appears.** The same tooltip is revealed only by `group-hover/evidence`. Touch devices have no hover, so mobile users get a greyed-out `disabled` button with no explanation and no path. Mobile is the stated future platform. | `IdeaCard.tsx:277–298`                                                                      |
| B3  | **Upgrades teleport users away from their intent.** Every gate is `setActiveTab('pro')` — the user is removed from the idea they cared about and dropped on a pricing grid. Context, and momentum, are lost.                                                 | `App.tsx` (`onExportCSV`, `onUpgradeNeeded`, `toggleSave` overflow), `IdeaCard` `onUpgrade` |
| B4  | **The teaser creates no desire.** The free Evidence control is a `disabled`, 50 %-opacity button. It shows nothing of what is behind it. Contrast `LockedAnalysisSection`, which blurs _real_ content — the better pattern, used elsewhere.                  | `IdeaCard.tsx:278–284` vs `LockedAnalysisSection.tsx`                                       |
| B5  | **Users are asked to buy something they have never experienced.** No sampling of the paid aha anywhere in the funnel.                                                                                                                                        | Tier gates throughout                                                                       |
| B6  | **Pricing compares features, not situations.** The page answers "what do I get?" but never "which one is me?"                                                                                                                                                | `PricingSection`                                                                            |

> **B1/B2 are not design problems — they are a defect.** This is the same bug class as TE-19 ("2 dead upgrade buttons") and TE-45 (`checkoutTier` never passed): _a value with a writer and no reachable reader_, which `CLAUDE.md` §2.2 names as the recurring failure mode. It is filed separately as **TE-59** and should ship regardless of whether the rest of this playbook is adopted.

### Strategy: convert at peak intent, in place, after a taste

| Tactic                                                                                                                                                                                                            | What it does | Ticket |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| **B-1 · Fix the dead CTA first.** Make the free-tier evidence upgrade path reachable by tap and click. Everything else in this campaign is measured against a working baseline.                                   | Fixes B1/B2  | TE-59  |
| **B-2 · Contextual paywall.** Replace `setActiveTab('pro')` with an in-place prompt naming the specific thing the user just reached for. The user never leaves the idea.                                          | Fixes B3     | TE-53  |
| **B-3 · Blur real content, not grey buttons.** Extend the `LockedAnalysisSection` pattern to evidence: show a real number/competitor peeking through the blur. Visible absence sells; a disabled button does not. | Fixes B4     | TE-53  |
| **B-4 · One free taste of the paid aha.** Fully unlock Market Evidence on exactly one idea, once per account. Then paywall. Sampling converts better than describing.                                             | Fixes B5     | TE-54  |
| **B-5 · Job-based pricing.** Frame the tiers as Discover / Evaluate / Execute — a self-identification, not a feature-count comparison. Same features, same prices.                                                | Fixes B6     | TE-55  |

### How we'll know

| Question                       | Metric                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Can they even reach the offer? | paywall-shown events per free session (expect a step change from TE-59 alone)        |
| Does the offer land?           | paywall shown → checkout started                                                     |
| Does the taste work?           | conversion rate of users who consumed the free evidence sample vs. those who did not |
| Which tier do they pick?       | Pro vs. Builder split at checkout                                                    |

### Sequencing note

**TE-59 must ship before anything else in this campaign is evaluated.** Any conversion measurement taken while the primary CTA is dead describes a broken baseline, and would make every subsequent change look better than it is.

### What would disprove this campaign

If paywalls are shown often and checkout-start rates are still near zero after TE-59, the problem is not the _moment_ but the _offer_ — price, or perceived value of Pro. That points at Campaign C's value work, not more paywall design.

---

## Campaign C — "They pay then churn" (retention)

### What we believe is happening

Churn after payment is the most serious of the three, because it is the one problem a redesign cannot fake. It means the delivered value did not match the promise that converted them.

**Code-grounded causes:**

| #   | Cause                                                                                                                                                                                                                                                                                                 | Evidence                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| C1  | **Nothing is personal.** Every subscriber sees the identical feed. `Idea.founderFit`, `buyer`, `firstWedge` exist in the data model and are unused for ordering or filtering. Personalization has been parked since 2026-07-02 pending "Stripe proves willingness to pay" — Stripe has since shipped. | `types.ts`, `DECISIONS.md` parked table              |
| C2  | **No daily payoff.** The feed refreshes, but nothing says what changed, and nothing accrues. There is no reason to open the app on day 9 that was not equally true on day 2.                                                                                                                          | no streak/delta surface                              |
| C3  | **Saves are a dead end.** `user_saves` collects ideas and never pulls the user back to them.                                                                                                                                                                                                          | `SavedIdeasTab`                                      |
| C4  | **The trust asset is invisible.** `prediction-tracker.ts` records publish-time score snapshots specifically for 6-month accuracy grading — the exact evidence that the scores deserve money — and none of it is surfaced anywhere.                                                                    | `api/_lib/prediction-tracker.ts`, `idea_predictions` |
| C5  | **Builder's value is per-idea, not cumulative.** Roadmap progress lives inside a card. A Builder subscriber has no view of "what I am building," which is the thing that would make cancelling feel like a loss.                                                                                      | `ProgressSection`, `fullActionPlan`                  |
| C6  | **Repetition risk is real and known.** TE-30/TE-31 (intra-day diversity guard, right-sized publish count) are still `todo`. A subscriber who feels "I've seen this idea before" is a subscriber who cancels.                                                                                          | `BACKLOG.md` wave 4                                  |

### Strategy: make the value personal, cumulative, and provable

| Tactic                                                                                                                                                                | What it does   | Ticket              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------- |
| **C-1 · Founder-fit.** Capture skills / budget / time once; tune ordering and surface "why this fits you" using existing fields. Turns a generic feed into _my_ feed. | Fixes C1       | TE-56               |
| **C-2 · Show the track record.** Surface prediction-tracker outcomes as an honest hit-rate view — including misses. Trust in the score is trust in the subscription.  | Fixes C4       | TE-57               |
| **C-3 · Daily payoff + accrual.** "What changed since yesterday," a light streak, saved-idea resurfacing, and Builder roadmap progress promoted out of the card.      | Fixes C2/C3/C5 | TE-58               |
| **C-4 · Protect perceived quality.** Finish TE-30/TE-31. No retention surface survives a feed that feels repetitive.                                                  | Fixes C6       | TE-30/31 (existing) |

### How we'll know

| Question                     | Metric                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Do they come back?           | day-7 / day-30 return rate, paid cohort                                               |
| Do they survive billing?     | subscription survival past first renewal (`stripe_transactions` + subscription state) |
| Does personalization matter? | return rate of users who completed founder-fit vs. those who skipped                  |
| Do they trust the scores?    | track-record view visits; source clicks per paid session                              |

### What would disprove this campaign

If paid users return frequently and still cancel, the problem is **price or scope**, not engagement — and the answer is packaging (annual, cheaper entry tier, or narrowing Builder), not more features. Exit-reason capture at cancellation would settle this cheaply and is worth adding to the portal return path.

---

## Cross-campaign sequencing

```
TE-49  Make the funnel observable          ── unblocks all ranking
TE-59  Fix the dead upgrade CTA            ── unblocks conversion measurement
  │
  ├── Campaign A (TE-50, 51, 52)   activation
  ├── Campaign B (TE-53, 54, 55)   conversion
  └── Campaign C (TE-56, 57, 58)   retention  ← + TE-30/31 quality debt
```

Two things are unconditional: **TE-49** (you cannot prioritise what you cannot see) and **TE-59** (a defect on the primary upsell path is not a design question). Everything after that should be re-ranked once one week of real funnel data exists.

**Recommended first slice if only one thing ships:** TE-49 + TE-59 together. Small, independent, and between them they convert this entire playbook from hypothesis into measurement.

---

## Risks and honest limits

- **This is inferred from source code, not from users.** No user research, session recordings, or funnel data informed it. Treat the campaign structure as sound and the within-campaign ranking as provisional.
- **A redesign amplifies value; it cannot create it.** If Campaign C is the dominant leak, the fix lives in idea quality and personal fit (and TE-30/31), not in any screen.
- **Three campaigns at once is how none of them ship.** Sequence them. The measurement spine (TE-49) is what makes it safe to work on one at a time.
- **Beware improving a broken baseline.** Conversion metrics gathered before TE-59 are not a baseline; they are a bug report.
