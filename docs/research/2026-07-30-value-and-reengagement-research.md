# Value, Must-Have & Re-Engagement Research

**Date:** 2026-07-30
**Author:** Product (agent-run target-user research)
**Status:** Findings + proposed Wave 6 work items (TE-60…TE-68) — for review, changes no code
**Companion docs:** [user research findings](2026-07-30-user-research-findings.md) (the friction walkthrough) · [subscriber-growth strategy](../superpowers/plans/2026-07-30-subscriber-growth-redesign.md) (Wave 5 thesis) · [funnel playbook](../superpowers/plans/2026-07-30-funnel-strategy-playbook.md) · [redesign concepts](../design/2026-07-30-redesign-concepts.md)

---

## Why this doc exists (and how it differs from Wave 5)

The user asked four questions:

1. **What value should be _added_, and how presented, to make the app interesting, useful, must-have?**
2. **People visited the site once or installed the app but barely use it — what would make them not want to miss it?**
3. **People try it but don't pay.**
4. **People pay, then churn.**

Wave 5 (TE-49…59) already attacks Q3 and Q4 — but it says of itself, twice and in writing: _"No feature in this plan is invented — all exist in the codebase and are re-sequenced, not added,"_ and _"A redesign amplifies value; it does not create it… the biggest risk isn't the UI — it's whether the underlying ideas are consistently good and personally relevant."_ (strategy §5).

So Wave 5 is a **repackaging** of existing value. Questions 1 and 2 are asking for the thing Wave 5 deliberately excluded: **new value**, and a **reason to return** that a repackage can't manufacture. That is what this doc researches. For Q3/Q4 it does not restate Wave 5 — it adds the target-user depth and the few net-new levers Wave 5 left on the table.

**Method & honesty:** same as the companion findings doc — a structured, persona-driven walkthrough of the current build with `file:line` grounding, not moderated sessions with real humans. Persona quotes name a real user-type's reaction to a real state; they are not transcripts. Everything here is a **hypothesis to validate** against TE-49 funnel data, not a measured result.

**One correction carried in from the code (matters for Q1/Q4):** `Idea.founderFit` is a **quality-triage enum** (`'keeper' | 'salvageable' | 'cut'`, `types.ts:75`), _not_ a match to the user's skills. TE-56's premise ("tune ordering via existing `founderFit`") is therefore only half-right: `buyer`/`firstWedge` are matchable idea attributes, but real founder-fit needs a **new `users/{uid}.founderProfile`**, not reuse of `founderFit`. Flagged again under TE-60/TE-56 below.

---

## The core diagnosis behind Q1: this is _content_, and content is nice-to-have

Every target user, asked "would you miss this if it vanished?", gives the same shape of answer:

> _"I'd be a little sad, but no — I'd just prompt ChatGPT, or read Trends.vc, or a newsletter."_ — the nice-to-have verdict, in one sentence.

An AI idea feed is **content you consume in bursts and abandon** — structurally the same as a newsletter. Must-have products are not content; they are **tools embedded in a recurring job**, with two properties content never has:

1. **Accrued personal state** — something that is _mine_ and grows with use (a portfolio, a thesis, tracked experiments, build progress).
2. **Switching cost** — leaving means _losing_ that state or an ongoing service (live monitoring of my space, my accountability streak, my network on an idea).

Trend Equity has the raw materials for both and uses almost none of them for the user:

| Raw material already in the codebase | Currently serves                      | Could become (must-have)                               |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------ |
| `signals.ts` live momentum fetch     | the _global_ daily generation         | **my** always-on radar on **my** spaces (Pillar 1)     |
| `validation-toolkit` generation      | throwaway copy, regenerated each time | a **tracked experiment** with outcomes (Pillar 2)      |
| `fullActionPlan.roadmap[].isDone`    | a checkbox inside one card            | a cross-idea **build log + accountability** (Pillar 3) |
| `idea_stats` / `idea_reactions`      | invisible counters                    | **social proof** + real co-founder matching (Pillar 4) |
| `prediction-tracker.ts`              | server-only, unseen                   | public **track record** (Wave 5 TE-57)                 |

**The reframe Wave 5 named but did not build:** move the user from **reader** to **operator**. The strategy doc calls the product a "conviction-and-execution engine" — but nothing in Wave 5 gives the user an execution _surface that accrues_. That surface is the must-have. Everything below is in service of it.

---

## Q1 — What value to add, and how to present it

Four value pillars, each scored **must-have vs nice-to-have** against the persona who'd pay for it. Scoring rule: must-have = recurring utility + accrued state + switching cost; nice-to-have = episodic content.

### Pillar 1 — "My Thesis" radar: live monitoring of the spaces I care about ★ highest-leverage

**JTBD (P2 serial founder, P3 investor):** _"Be my always-on radar for the 1–3 spaces I actually care about — tell me when something moves, so I don't have to check."_

Today `signals.ts` fetches live momentum (Product Hunt / HN / Trends _this week_) but spends it entirely on the _global_ feed. Let the user **declare a thesis** (a space, a keyword, or "ideas like this one") and monitor _their_ signal, generating a personal alert when it spikes, when a new matching idea publishes, or when a saved idea's market moves.

- **Score: MUST-HAVE** for P2/P3. Recurring ("check my radar"), personal (mine), and losing it means losing a service, not a document.
- > _"THIS is the thing I'd pay for. I don't want ten random ideas — I want to know the moment MY corner of the market moves. That's a job I do manually every week."_ (P2)
- **It is also the engine of Q2** — it gives every notification a legitimate, personal reason to exist.
- **Presentation:** a **Radar** home module + a "Follow" affordance on ideas and categories; delivery via digest/push (Q2). This is the single feature most likely to flip the "would you miss it?" answer.

### Pillar 2 — Validation-in-the-loop: idea → tracked traction

**JTBD (P1 aspiring, P2 serial):** _"Don't just tell me it's good — help me prove it, and remember what I found."_

The validation toolkit already _generates_ landing copy and interview scripts, but the output is disposable and regenerated every time. Turn it into a **tracked experiment** attached to a saved idea: create an experiment, log outcomes (signups, interview notes, a plain go/no-go verdict), and see status across all my ideas — a small **validation portfolio**.

- **Score: MUST-HAVE-ish.** It's workflow + accrued state; abandoning it on cancel is a real loss (Q4). It also completes the thesis's own "track if it worked" promise, which today only exists server-side about the _platform's_ predictions, never the _user's_ actions.
- > _"If my interview notes and landing-page results lived here next to the idea, I'd never move them to a Notion doc — and I'd keep coming back to update them."_ (P1)
- **Presentation:** an **Experiments** section on saved ideas + a portfolio roll-up on the home surface.

### Pillar 3 — Build accountability + ship-log

**JTBD (P1, the founder who quits by week 3):** _"Keep me moving. Make quitting feel like a loss."_

Builder roadmaps live inside a single card. Promote progress into a persistent **"What I'm building"** view (Wave 5 TE-58 starts this), add a lightweight **weekly ship-log check-in**, and an **ethical streak tied to completing steps**, not merely opening the app.

- **Score: nice-to-have alone → must-have when paired with Pillar 4 (someone's watching).** Accountability without an audience decays.
- > _"A streak for \_opening_ an app is a dark pattern I ignore. A streak for _shipping a step_ — and my co-builders seeing it — that I'd protect."\_ (P1)
- **Presentation:** the home surface's "building" module; a weekly check-in prompt (push/digest, Q2).

### Pillar 4 — Real social proof + working co-founder matching

**JTBD (all):** _"Am I the only one who sees this? Who else is building it?"_

`idea_stats`/`idea_reactions` already record engagement but it's invisible; the **"Find co-founder" button is cosmetic** (toggles a local flag, no matching — user-research U10). Make proof real: show genuine _"N looking · N building"_ on cards, and turn `seekingPartner` into an **opt-in builders list** with a contact path.

- **Score: nice-to-have → network-effect must-have** as density grows; higher build risk, so stage it later and honestly (don't fake counts — a fabricated "12 building" destroys the trust the whole product sells).
- **Presentation:** a proof line on the card header; a "builders on this idea" drawer.

### Pillar 0 — the honest prerequisite: quality & personal relevance

None of Pillars 1–4 survive a feed that feels **repetitive or irrelevant** — the strategy doc's stated churn root, and still-open TE-30/TE-31 (intra-day diversity, right-sized publish count). **Must-have is gated on the ideas being consistently good and personally on-target.** No amount of workspace scaffolding rescues weak output. This is a dependency, not a competitor, to everything above.

### The presentation spine (the "how" of Q1)

The highest-leverage _presentation_ change is one move that makes all four pillars legible:

> **Stop opening on a generic feed. Open on a personal "Today" home** that shows _my_ state — radar moves, experiments in progress, what I'm building, my streak, and what changed on my saved ideas — with the daily feed as **one module**, not the whole app.

This converts "a feed I sometimes visit" into "a dashboard I check." It is also, not coincidentally, the answer to Q2.

---

## Q2 — Visited/installed but dormant: the "don't want to miss" layer

**New persona — P4 · Sam, the installed-then-dormant user.** Saw a Product Hunt post, installed the Android build, opened it twice, hasn't returned in three weeks.

**Why Sam stopped — the one-sentence diagnosis:** _the app never gives Sam a personal, time-sensitive reason that only it can give._ "10 new ideas today" is the identical value proposition as day 1 — it's not **news about Sam**. There is also **no push channel at all**: `@capacitor/push-notifications` is not installed (only `@capacitor/core`/`android`), and the Resend email digest is **generic**, not personal.

> _"It's a nice idea a day. But 'a nice idea a day' is exactly what my inbox already has twelve of. Nothing in it is about me or urgent, so 'later' became 'never.'"_ (P4)

The re-engagement layer must be **personal, time-sensitive, and loss-framed**, and it rides directly on Pillar 1:

| Trigger (only personal ones — never generic "10 new ideas")                                              | Source                        |
| -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| _"Your space (AI compliance) just spiked +240% on Product Hunt."_                                        | Pillar 1 radar + `signals.ts` |
| _"An idea you saved gained new market evidence."_                                                        | saved ideas + `evidence.ts`   |
| _"You're 2 steps from shipping [idea]."_                                                                 | Pillar 3 roadmap progress     |
| _"3 builders joined the idea you're building."_                                                          | Pillar 4                      |
| Weekly personal recap: _"You missed 6 ideas that fit you; 2 are in your radar — here's the one to see."_ | founder-fit + radar           |

**Delivery:**

- **Native + web push** — a real net-new build (Capacitor push plugin + FCM; permission UX; token storage). PRD §7 lists "native push" as future roadmap; this is where it earns its place.
- **Personalized digest** — extend the existing Resend pipeline from generic to personal.
- **Ethical re-entry** — reward return, never punish absence; a returning-user "here's what changed in your spaces while you were away" re-onboard beats a guilt streak.

**Hard guardrail (learned from the personas):** notification quality _is_ trust, and this product sells trust. **Gate push behind a personal hook** — the user has declared a thesis or saved an idea — so the first notification is always _about them_. A generic broadcast push would burn the channel and the brand in one tap. Do not ship push before Pillar 1 gives it something personal to say.

---

## Q3 — They try it but don't pay (depth + net-new)

Wave 5 already lands the core conversion work: contextual paywall (TE-53), one-time evidence sample (TE-54), job-based pricing (TE-55), and the dead-CTA defect (TE-59). Not restated. Target-user research adds two **net-new** levers and one honest warning:

1. **Reverse trial — 7 days of full Pro, then drop to Free (net-new, TE-67).** TE-54 samples _one idea's_ evidence. But P1's aha is **breadth** — "evidence on _everything_, the custom feed, the full experience" — which one locked idea can't convey. A time-boxed full-Pro trial lets the whole value land, then paywalls. Reverse trials routinely out-convert feature-list pages and single-item samples for breadth-value products.
   - > _"One unlocked idea tells me the feature exists. A week of the real thing tells me whether it fits how I work. Only the second one makes me pull out a card."_ (P1)
2. **Annual + "founding member" pricing (net-new, part of TE-67).** The pricing grid shows monthly only. An annual option (and an early-adopter founding rate) lowers effective price and raises commitment — and annual plans are themselves a churn defense (Q4).
3. **Honest warning — free may over-deliver.** Free currently shows the _full_ VC analysis and all next steps (audit §3), so **Evidence is carrying nearly the entire conversion argument alone** — which is exactly why the TE-59 dead button is so costly. Rebalancing what's free vs paid is a deliberate product decision to make _with_ TE-49 data, not drift into.

---

## Q4 — They pay, then churn (depth + net-new)

Wave 5 covers founder-fit (TE-56), track record (TE-57), habit loop (TE-58). Target-user research adds:

1. **Cancellation exit-reason capture + save offer (net-new, TE-68).** The funnel playbook itself notes exit-reason capture "is worth adding to the portal return path" and isn't built. At cancel, ask _why_ (one tap) and offer a **save**: pause, downgrade-to-free-keeping-your-radar, or a discount. Cheap, and it turns the loudest signal in the business into data instead of silence.
2. **Pillars 2 & 3 are the structural churn fix.** Founder-fit and a track record are amplifiers; **switching cost** is the retainer. A subscriber with tracked validation experiments (Pillar 2) and live build progress (Pillar 3) experiences cancellation as _abandoning their own work_ — the single strongest anti-churn force, and one Wave 5 doesn't create.
3. **The founder-fit correction (refines TE-56).** As noted up top, `Idea.founderFit` is idea-quality triage, not skill-fit. Personalization must add `users/{uid}.founderProfile` (skills/budget/time) and match it against `buyer`/`firstWedge` + `costEffort`. Without this, TE-56 will quietly sort on the wrong field.
4. **Honest root cause (unchanged from strategy §5):** if paid users return often and still cancel, the problem is idea **quality/relevance or price/scope**, not engagement scaffolding — the answer is TE-30/31 and packaging, not more features. Exit-reason capture (TE-68) is what tells us which.

---

## Proposed Wave 6 work items (TE-60 … TE-68)

Net-new value + re-engagement — the layer Wave 5 excluded by design. Filed to `docs/BACKLOG.md`. **Sequencing is deliberately gated:** none of this precedes Wave 5's activation/conversion fixes or TE-49 measurement — you don't build a workspace for users who bounce in five seconds. Effort: S/M/L.

| ID        | Item                                                                                                                                                                                                                                                          | Serves              | Effort | Depends on                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------ | ------------------------------ |
| **TE-60** | **"Today" personal home surface** — app opens on a dashboard of _my_ state (radar, experiments, building, streak, saved-idea deltas); the daily feed becomes one module. v1 can aggregate existing state (saves, roadmap progress) before the pillars land.   | Q1 presentation, Q2 | L      | TE-49; pairs with TE-58        |
| **TE-61** | **"My Thesis" radar + live monitoring** — follow spaces/keywords/ideas; server monitors `signals.ts` for the user's thesis; emits personal alerts (spike / new match / saved-idea market move). New `users/{uid}` follow state + `firestore.rules` allowlist. | Q1 (must-have), Q2  | L      | TE-49                          |
| **TE-62** | **Native + web push** — add `@capacitor/push-notifications` + FCM (Android + web), permission UX, token storage, delivery pipeline. **Gated on TE-61** so the first push is personal, never generic.                                                          | Q2                  | M      | TE-61                          |
| **TE-63** | **Personalized re-engagement digest** — extend the Resend digest + push from generic to personal (radar + founder-fit + "you missed"); tier- and consent-aware recipients.                                                                                    | Q2                  | M      | TE-61, (TE-56 for fit)         |
| **TE-64** | **Validation-in-the-loop** — turn validation-toolkit output into a tracked experiment on a saved idea (status, outcomes, notes) + a validation portfolio view.                                                                                                | Q1 (must-have), Q4  | L      | — (builds on existing toolkit) |
| **TE-65** | **Build accountability & ship-log** — cross-idea "What I'm building", ethical streak tied to _completed roadmap steps_, weekly check-in. Extends TE-58 from a resurfacing strip into an accountability loop.                                                  | Q1, Q4              | M      | TE-58                          |
| **TE-66** | **Real social proof + co-founder matching** — show genuine "N looking · N building" from `idea_stats`/`idea_reactions`; convert cosmetic `seekingPartner` into an opt-in builders list with contact. Never fabricate counts.                                  | Q1, Q4              | M      | —                              |
| **TE-67** | **Reverse trial + annual pricing** — 7-day full-Pro trial that drops to Free; annual + founding-member plan options in `PricingSection`. Server-enforced trial state (same discipline as tier — never client-written).                                        | Q3                  | M      | Wave 5 conversion (TE-53/54)   |
| **TE-68** | **Cancellation exit-reason capture + save offer** — one-tap reason + pause/downgrade-keeping-radar/discount in the portal return path; writes to an analytics collection.                                                                                     | Q4                  | S      | Stripe portal (shipped)        |

**Cross-references to keep the plan coherent:**

- **TE-56 refinement (not a new ticket):** add `users/{uid}.founderProfile`; `Idea.founderFit` is triage, not skill-fit — match on `buyer`/`firstWedge`/`costEffort` instead.
- **TE-58 ↔ TE-60/TE-65:** TE-58's "roadmap-progress resurfacing" is the seed; TE-60 gives it a home, TE-65 gives it accountability. Build TE-58 first, then extend.
- **TE-30/TE-31 (existing, open):** the quality/anti-repetition prerequisite (Pillar 0). No Wave 6 item is worth shipping over a feed that feels repetitive.

---

## What would change my mind (kill criteria for this research)

Stated plainly so this isn't an unfalsifiable wish-list:

- **If TE-49 shows healthy day-2 return already**, then the app is _not_ perceived as disposable content and Q1/Q2's premise is wrong — deprioritize the workspace pillars and focus on conversion (Q3).
- **If activation is the dominant leak** (bounce in the first screen, per the companion findings doc), then **Wave 5 must finish before any Wave 6 item** — a workspace for users who never activate is wasted engineering. This is why every TE-60+ item is gated on TE-49 and on Wave 5.
- **If paid users churn while returning often**, the cause is idea quality/price (TE-30/31 + packaging), and Pillars 1–4 are lipstick. TE-68's exit-reasons settle this cheaply — which is why it's the smallest and the earliest of the Q4 items.

---

## Recommended next step

1. **Ship TE-49 (funnel observability) and Wave 5 activation/conversion first.** Everything here is a hypothesis until the funnel is visible and the front door works.
2. **Validate the must-have hypothesis with 5 real users** using the test plan in the companion findings doc §6, adding two prompts: _"Would you miss this if it vanished? What would you replace it with?"_ (tests the content-vs-tool thesis) and _"Which of these would make you keep it on your phone: a radar on your space, tracked validation, or a build streak?"_ (ranks the pillars from the user's mouth).
3. **Then build Wave 6 in dependency order:** TE-68 (cheap churn signal) and TE-61→TE-62 (radar → push) are the highest value-per-effort; TE-60 (home) is the presentation spine that makes the rest legible.

The full cross-wave order — where these items sit relative to Wave 5, the TE-59 defect, and the TE-30/31 quality lane, and behind which decision gate — is in the [execution roadmap](../superpowers/plans/2026-07-30-execution-roadmap.md).

---

_Method note: persona findings trace to cited on-screen states and data-model fields in the current build; quotes are persona-voiced interpretations, not real transcripts. No code was changed. Treat every item as a hypothesis to validate against TE-49 data, not as measured behaviour._
