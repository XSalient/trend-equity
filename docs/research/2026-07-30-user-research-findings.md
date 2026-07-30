# User Research — Findings & Journey Maps

**Date:** 2026-07-30
**Author:** Product (agent-run walkthrough)
**Status:** Findings for review — feeds the growth redesign, changes no code
**Companion docs:** [funnel strategy playbook](../superpowers/plans/2026-07-30-funnel-strategy-playbook.md) (the code-derived hypotheses) · [redesign concepts](../design/2026-07-30-redesign-concepts.md) (the proposed screens) · [UI/feature/tier audit](../audits/2026-07-08-ui-feature-tier-audit.md) (the engineering sweep)

---

## Method — read this first (honesty note)

This is a **structured expert walkthrough**, not a moderated study with recruited humans. I role-played three personas drawn from PRD §2 and drove every task through the **actual current build**, citing `file:line` for each observed state so findings are reproducible, not asserted. The "quotes" below are persona-voiced interpretations of a real on-screen state — they are a way of naming the friction a user of that type would hit, **not transcripts of real people**.

Why this framing matters, and why it is still worth doing:

- The funnel playbook is explicit that its A/B/C priorities are "a hypothesis derived from reading code, not a finding from data," because **TE-09 analytics cannot observe signed-out visitors at all** (playbook §0). So there is currently _no_ user-side evidence for the redesign — only code inference.
- This walkthrough is the cheapest possible next step: it converts "the code has a dead button" into "here is the moment a founder gives up, and what they were trying to do." It **validates or challenges** each hypothesis from the user's side.
- It is **not** a substitute for the real thing. The single highest-value follow-up is still TE-49 (make the anonymous funnel observable) plus 5 unmoderated sessions with real founders. A concrete test plan is in §6.

**Environment caveat:** several findings below depend on the anonymous/first-run path, which is currently broken at the data layer (audit §1.5 — anonymous users cannot read the daily feed). Where a finding is blocked by that, I say so; it changes _which_ friction a real user hits first.

---

## Personas (recruited-style, mapped to PRD §2)

| #      | Persona                                          | PRD segment                     | Primary job                                                                                  | Tier they'd land on             |
| ------ | ------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- |
| **P1** | **Maya — the nights-and-weekends side-hustler**  | Side-hustler / aspiring founder | "Show me one idea I could actually start with $2k and evenings, and convince me it's real."  | Anonymous → Free → (target) Pro |
| **P2** | **Dev-Raj — the technical serial founder**       | Serial founder                  | "I can build anything. I need conviction, evidence, and a plan — fast. Don't waste my time." | Free → (target) Builder         |
| **P3** | **Lena — the fund scout / corporate innovation** | Investor / corp innovation      | "Give me dealflow signal and white-space I can bring to a partner meeting."                  | `/enterprise` visitor           |

P1 is the **primary** persona for this study — she is the free→paid funnel the redesign is built to win, and the segment the business monetises first.

---

## 1. P1 · Maya — the side-hustler (primary)

**Scenario:** Saw the app on a founder Slack. Opens it on her phone during a commute, signed out.

### Task 1 — "What is this? Show me it's worth my time." → ❌ Failed at the door

- **Anonymous landing is empty.** Signed out, `useIdeas.fetchDaily` reads `daily_generations/{today}` directly from Firestore, which rules deny to anonymous users; she sees the empty state: a pulsing refresh icon, **"Daily Feed Coming"**, and the badge **"SCANNING LIVE SIGNALS"** (`IdeaFeed.tsx:108–150`, audit §1.5). There is no idea, no example, no product.
  - > _"I clicked a link that promised startup ideas and there are… none. Is it broken? Is it my connection?"_ — She has no way to tell an empty product from a broken one.
- **The one sentence that would save the visit is jargon.** Even when the feed loads (signed-in), the intro reads: _"…scored across five investability dimensions by our VC engine… Decision support, not inspiration."_ (`App.tsx:280–288`, problem **A1**). The hero says **"Today's Top 10 Opportunities"** — a quantity, not a value (`App.tsx:341–345`, **A2**).
  - > _"'Five investability dimensions' — I'm a designer who wants a side business. I don't talk like this. I still don't know what I get."_
- **Verdict:** For the primary persona, the product **fails its first five seconds twice** — once at the data layer (empty), once at the copy layer (jargon). This is strong user-side confirmation of Campaign A and specifically of **A5**: locks/paywalls are irrelevant because she never reached value at all.

### Task 2 — "Okay I signed in. Is any of this actually real?" → ⚠️ Partial

- **The cards are genuinely good, and _over_-deliver.** Signed in as free, each card shows the full VC analysis — pitch, stats, justification, revenue model, market size, competitors (`IdeaCard.tsx`, audit §3 "Analysis" row notes free gets _more_ than the promised "basic"). Maya is impressed by depth.
  - > _"Oh — this is meaty. There's a real revenue model and named competitors. Now I'm interested."_
- **But the proof is buried.** The live signal — the one thing that separates this from asking ChatGPT — is hidden behind the **"View VC Analysis & Sources"** expander, inside `trendSources` (`IdeaCard.tsx:268–274`, problem **A4**). Nothing on the card's first impression says _why now_ or _where the signal came from_.
  - > _"If it doesn't tell me why THIS idea THIS week, it's just a prettier chatbot."_
- **Finding:** the moat exists in the data but is not in the eyeline. Confirms **A4 / A-3 (SignalRibbon, TE-52)** from the user side.

### Task 3 — "This one's interesting. Is the market real?" → ❌ Failed (dead end)

This is the study's sharpest moment and it lands exactly where the playbook predicted.

- Maya taps the **Evidence** button to check the market. On free it is a **disabled, 50%-opacity grey button** (`IdeaCard.tsx:277–284`). Nothing happens.
- The only path onward is a tooltip revealed by `group-hover/evidence` containing an **"Upgrade →"** link — but the tooltip container carries `pointer-events-none` and hover doesn't exist on her phone (`IdeaCard.tsx:285–296`, problems **B1 + B2**).
  - > _"I tapped 'Evidence.' Nothing. No message, no upgrade screen, nothing. I assumed the app was buggy and closed it."_
- **Verdict — this is the single most damaging moment in the funnel for the primary persona.** It is a **defect, not a design debate** (filed as **TE-59**): the highest-intent action a free user can take — "prove it to me" — is a physically unreachable control on the platform the PRD calls its future (mobile). She converts nowhere because she can't even ask.
- Compounding it: the teaser **shows nothing of what's behind the lock** (a grey button, not blurred real data — **B4**), so even if it worked, it would create no desire.

### Task 4 — "Fine, let me save the two I liked and come back." → ⚠️ Partial

- Saving works and feels good (optimistic toggle, confirm-on-remove overlay, `IdeaCard.tsx:176–232`). Saves are the one thing that _accrues_.
- **But the limit surprises her and the wording is wrong.** The badge says `5` saves; the copy elsewhere calls it "5 saved ideas / month" (PRD §3). In reality it's **5 concurrent** — deleting one frees a slot, there is no monthly reset (audit §3 "Saves" row). More importantly, hitting the limit and several other gates **teleport her to the pricing grid** via `setActiveTab('pro')` (`App.tsx:262, 473–477`, `IdeaFeed.tsx:97,197`, problem **B3**).
  - > _"I was mid-thought on an idea and suddenly I'm staring at a pricing table. What was I even doing?"_
- **Finding:** saves are a genuine retention hook that currently **dead-ends** (**C3**) — nothing ever pulls her back to them — and every upgrade nudge is a context-losing teleport (**B3**).

### Task 5 — "Is Pro worth $9?" → ⚠️ Unconvinced

- The pricing page is competent but compares **features, not situations** — three columns of checkmarks (`PricingSection`, problem **B6**). Maya can't tell which column _is her_.
  - > _"Discover vs Pro vs Builder… I don't know which one is 'a person like me.' I'll 'think about it,'" (i.e., never)._
- She has **never experienced the paid aha** (evidence) because Task 3 was a dead end (**B5**). She is being asked to buy a feeling she was never allowed to sample.

### P1 journey map (emotional arc)

```
Curious → Confused (empty) → Impressed (cards) → Excited (taps Evidence)
   → 💥 Frustrated (dead button) → Distracted (teleported to pricing)
   → Unconvinced (feature-grid) → Leaves, doesn't return
```

**The two cliffs are Task 1 (empty/jargon) and Task 3 (dead Evidence button).** Everything the redesign proposes for Maya is downstream of fixing those two.

---

## 2. P2 · Dev-Raj — the technical serial founder

**Scenario:** Signed in, evaluating whether to pay for Builder. Fast, skeptical, high standards.

### What worked (report the wins honestly)

- **Custom Idea Analysis is the best-built surface in the app.** Input → loading → result, a live usage badge, real monthly quota, save-to-custom with its own limit (audit §"Saved tab", enforced server-side per audit §3). Dev-Raj trusts it immediately.
  - > _"This one feels like a real product. Quotas, states, it doesn't lie to me."_
- **The full 10-step roadmap with add/remove/toggle-done custom steps** is exactly the execution surface a builder wants (`IdeaCard.tsx:137–174`).
- **Evidence, once unlocked, renders real grounded source links** — the thing Maya never got to see is genuinely good for paid users (audit §"Idea card" Evidence row).

### Where he loses trust

- **"Find co-founder" is cosmetic.** As a Builder he sees a **"Find co-founder"** button; it only toggles a local `seekingPartner` flag — no matching, no persistence for unsaved ideas, and the pricing page implies it's a real Builder feature though the PRD lists co-founder matching as _future roadmap_ (`IdeaCard.tsx:473–488`, audit §2.4).
  - > _"I clicked 'Find co-founder' and it just… highlighted itself. If this is fake, what else here is fake?"_ — one dead feature taxes trust in all the real ones.
- **His Builder value is trapped per-idea.** Roadmap progress lives _inside_ a card. There is no "what I'm building" view aggregating `fullActionPlan.roadmap[].isDone` across ideas (problem **C5**). Nothing makes cancelling feel like a loss.
  - > _"I've made progress on three roadmaps and there's no home for it. When my renewal hits, I'll feel like I'm paying for a feed I've already read."_
- **The scores ask for trust the app never earns.** Every card leads with a 1–10 Potential Score, but `prediction-tracker.ts` already records publish-time snapshots for 6-month grading and **none of it is surfaced** (problem **C4**, `idea_predictions`). The evidence that the scores deserve money exists and is invisible.
  - > _"You scored this 8.7. Based on what track record? Show me last quarter's 8s and what happened."_
- **"My Latest Idea" is promised and missing.** PRD §4.3b says his most recent custom analysis is "surfaced in the Saved tab." It is written to `user_latest_idea/{uid}` server-side but **never rendered** (audit §"Saved tab"). A promised persistence that silently doesn't exist.

### P2 verdict

Dev-Raj would pay for Builder **on the strength of Analyze-My-Idea and the roadmap alone** — but the cosmetic co-founder button and the invisible track record cap his conviction, and the per-card (not cumulative) value model makes month-2 churn likely. Strong user-side confirmation of **C4** and **C5**.

---

## 3. P3 · Lena — the fund scout (`/enterprise`)

**Scenario:** Followed the footer "Enterprise" link, wants to request access for her fund.

- The `/enterprise` page positions well (dealflow intelligence, sector monitoring, white-space) and the message lands for her segment (PRD §4.8).
- **The lead form is broken for exactly her.** Submission is a client-side `addDoc(collection(db,'enterprise_leads'))`, but rules require `request.auth != null` and enterprise visitors are **not signed in** — every anonymous submission fails permission-denied (`EnterpriseLanding.tsx:130`, audit §1.4).
  - > _"I filled in my fund's details, hit submit, and… I genuinely can't tell if it went through. I won't chase it."_
- **Finding:** the entire B2B funnel captures **nothing** from its intended audience. This is a silent revenue leak with zero user feedback — the worst kind. Highest-severity finding for P3.

---

## 4. Consolidated findings — ranked by user impact

Severity = impact on _the user's ability to get value or convert_, from the persona sessions above. "Addressed by" links each to existing planning so this doc slots in rather than forking.

| #   | Finding (user's words)                                                  | Persona | Severity             | Root cause (evidence)                                                          | Addressed by                                              |
| --- | ----------------------------------------------------------------------- | ------- | -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| U1  | "I tapped Evidence and nothing happened — I thought it was broken."     | P1      | 🔴 Blocker           | Dead CTA: `pointer-events-none` + hover-only on touch (`IdeaCard.tsx:277–298`) | **TE-59** (B-0) — ship alone                              |
| U2  | "There were no ideas at all when I landed."                             | P1      | 🔴 Blocker           | Anonymous can't read daily feed (audit §1.5)                                   | **TE-16** (anon read path) — prerequisite for A-1/A-2     |
| U3  | "I don't know what this is or which plan is me."                        | P1      | 🟠 Major             | Jargon intro + quantity hero + feature-grid pricing (A1/A2/B6)                 | **TE-50** (WelcomeHero), **TE-55** (job-based pricing)    |
| U4  | "It's just a prettier chatbot — why now, why real?"                     | P1, P2  | 🟠 Major             | Live signal + evidence buried behind expand (A4)                               | **TE-52** (SignalRibbon), **TE-53** (blurred real teaser) |
| U5  | "Suddenly I'm on a pricing page — what was I doing?"                    | P1      | 🟠 Major             | Every gate `setActiveTab('pro')` teleports (B3)                                | **TE-53** (contextual UpgradePrompt)                      |
| U6  | "I'm asked to buy a feeling I was never allowed to sample."             | P1      | 🟠 Major             | No taste of paid aha anywhere (B5)                                             | **TE-54** (one free evidence sample)                      |
| U7  | "I filled in my fund details and don't know if it sent."                | P3      | 🔴 Blocker (B2B)     | Anon enterprise lead write denied by rules (audit §1.4)                        | **TE-15** (serverless lead capture)                       |
| U8  | "You scored this 8.7 — based on what track record?"                     | P2      | 🟠 Major             | `prediction-tracker` data never surfaced (C4)                                  | **TE-57** (TrackRecord)                                   |
| U9  | "I've made roadmap progress with no home; renewal will feel like loss." | P2      | 🟠 Major             | Builder value per-card, not cumulative (C5)                                    | **TE-58** (BuildProgress)                                 |
| U10 | "I clicked Find co-founder and it just highlighted itself."             | P2      | 🟡 Minor (trust tax) | Cosmetic toggle, sold as a feature (audit §2.4)                                | **TE-21** (remove / mark coming-soon)                     |
| U11 | "It says 5 saves a month but deleting one gives it back."               | P1      | 🟡 Minor             | Copy says monthly; behaviour is concurrent (audit §3)                          | **TE-21** (reconcile copy)                                |
| U12 | "My saved ideas just sit there — nothing brings me back."               | P1, P2  | 🟠 Major             | Saves dead-end (C3)                                                            | **TE-58** (saved-idea resurfacing)                        |
| U13 | "Nothing here is mine — same feed as everyone."                         | P1, P2  | 🟠 Major             | `founderFit`/`buyer`/`firstWedge` unused (C1)                                  | **TE-56** (FounderFitSetup)                               |
| U14 | "My last analysis was 'saved' but I can't find it."                     | P2      | 🟡 Minor             | `user_latest_idea` written, never rendered (audit §"Saved tab")                | **TE-21** (surface it or drop the promise)                |
| U15 | "It claims signals from X/Twitter — I didn't see any."                  | P1, P2  | 🟡 Minor             | Copy claims X; real sources are GTrends/PH/Reddit/HN/TC (audit §3)             | **TE-21** (copy truth)                                    |

**Every U-finding maps to an already-planned ticket.** The research did not surface a _new_ workstream — it independently confirmed the redesign's diagnosis from the user's side and **re-ranked** it: U1 and U2 (P1) and U7 (P3) are the three that stop a user cold and should precede all polish.

### Where the research _challenges_ the plan (not just confirms it)

Honest dissent, so this isn't a rubber-stamp:

1. **A-2 "give one idea away fully" (TE-51) is being sequenced 7th, but it may be the cheapest fix for the _first_ cliff.** P1's Task 1 fails because there is _nothing_ to see anonymously. A single fully-unlocked hero idea is both the activation moment (A5) _and_ the anonymous-preview content (U2). Consider pulling TE-51 forward to ride on the TE-16 anon-read work, rather than treating them as separate items 5 and 7.
2. **The playbook worries most about churn (Campaign C) as "the one a redesign can't fake."** The walkthrough suggests the earlier leak is bigger _for the primary persona_: Maya never gets far enough to churn — she bounces at Task 1/Task 3. C-work matters for P2 (Dev-Raj, who _does_ reach value), but for the volume segment, **A + the B-0 defect are where the users actually are.** This matches the playbook's own kill-criterion for Campaign A but is worth stating from the user side.
3. **Free tier over-delivers analysis depth (full VC analysis, all next steps) — audit §3.** Users love it (P1 Task 2), but it weakens the Pro pitch: if the analysis is already complete for free, "Evidence" is carrying the entire conversion argument alone — which makes the U1 dead-button defect even more costly. Worth a deliberate product decision, not drift.

---

## 5. What's genuinely good (don't regress these)

Research that only lists problems is untrustworthy. These delighted the personas and must survive the redesign:

- **Analyze-My-Idea** — real quotas, honest states, save-to-custom. The model every other surface should copy (P2).
- **Card depth** — named competitors, revenue model, market size make ideas feel researched, not generated (P1).
- **Evidence _once unlocked_** — real grounded source links; the paid aha is real, which is why gating it behind a dead button is such a waste (P2).
- **The roadmap editor** — add/remove/complete custom steps is a genuine execution tool (P2).
- **Save interaction** — optimistic toggle + confirm-on-remove feels considered (P1).
- **Accessibility baseline** — ARIA tablist/tab/tabpanel is correctly wired (`App.tsx:363–457`).

---

## 6. Recommended next step — validate with real humans (cheap, this week)

This walkthrough is inference, not data. To convert it into evidence:

1. **Ship TE-49 first (funnel observability).** Until signed-out events are captured, we are blind to the exact cliff (Task 1) this study says is biggest. Everything else is guessing at magnitude.
2. **Unblock the anonymous path (TE-16) before any test** — otherwise every remote tester hits U2 and the session ends at "it's empty," teaching us nothing past the first screen.
3. **5 unmoderated sessions, 15 min each** (Marvel/Maze or just a recorded screenshare), recruiting to the P1 profile (aspiring/side-hustler, mobile). Tasks, each a pass/fail:
   - T1: "In one sentence, what does this app do and who is it for?" _(tests A1/A2 copy)_
   - T2: "Find one idea you'd actually consider, and tell me why you believe it's real." _(tests A4 signal visibility + U1 evidence)_
   - T3: "You want proof this market exists. Do whatever you'd do next." _(the U1 dead-button moment — watch where they tap)_
   - T4: "Decide if you'd pay, and for which plan." _(tests B6 pricing + B5 no-taste)_
4. **1–2 sessions with a P2-profile builder** on Analyze-My-Idea → roadmap → "where's my progress?" _(tests C5/C4)._
5. **Instrument the enterprise form end-to-end** and confirm a test submission actually lands before spending on P3 outreach _(U7)._

**Success metric for the redesign, stated as a user outcome:** a first-time mobile visitor can answer "what is this, is it real, and which plan is me?" and reach the evidence-taste moment **without hitting a dead control or a teleport.** Today, per this walkthrough, they cannot.

---

_Method note: all persona findings trace to a cited on-screen state in the current build; quotes are persona-voiced interpretations of those states, not real transcripts. No code was changed. This document is qualitative and should be treated as hypotheses to test (§6), not as measured behaviour._
