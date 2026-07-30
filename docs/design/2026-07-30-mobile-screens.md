# Mobile App Screen Designs — full product, user-first

**Date:** 2026-07-30
**Status:** Proposed (design plan — nothing built, nothing merged)
**Supersedes scope of:** [mobile home-screen designs](2026-07-30-mobile-home-screens.md) (that doc covered only the three home states; this covers the whole app)
**Companion docs:** [PRD](../../PRD.md) (the requirements) · [user research findings](../research/2026-07-30-user-research-findings.md) · [value & re-engagement research](../research/2026-07-30-value-and-reengagement-research.md) · [redesign concepts](2026-07-30-redesign-concepts.md) · [execution roadmap](../superpowers/plans/2026-07-30-execution-roadmap.md)
**Generated visual reference:** all screens below are generated as real mobile UI with **Google Stitch** (Gemini 3 Pro) in one project (consistent design system) — see [`stitch/`](stitch/).

The first pass covered three home-page states. The gap was twofold: it stopped at the front door (the app is much more than a feed), and the fidelity read as wireframe. This plan fixes both — it designs **the screens a user actually moves through across the whole product**, each around what the user wants to see _there_, and each mapped to a built requirement in the PRD.

---

## The principle: design the user's journey, not the sitemap

Users don't experience "tabs." They experience a job: _find something real, decide if it's worth my time, make it mine, and know when to act._ The eight screens below are grouped by that arc, not by the navigation.

| Arc stage | Screens | The user's question here |
| --- | --- | --- |
| **Discover & evaluate** | 1 Daily Feed · 2 Idea Detail · 3 Analyze My Idea | "What's out there, is it real, and what about _my_ idea?" |
| **Make it yours (retention)** | 4 Saved / Library · 5 Today dashboard · 6 Market Intelligence | "What's mine, what changed, and what's coming?" |
| **Convert & grow** | 7 Pricing & Upgrade · 8 Enterprise | "Which plan is me — and is this credible for my fund?" |

**Visual system (shared by every screen).** Dark-mode-first (PRD §6), near-black `#09090b` canvas, `#18181b` surfaces on hairline `#27272a` borders, emerald `#10b981` primary. Three semantic accents are used with discipline: **cyan `#22d3ee` only for verified evidence/citations**, an **amber→coral gradient only for live market signal**, and emerald for growth/primary. Depth is tonal layering, not shadow — a matte, terminal-grade calm. This is the design system Google Stitch settled on from the brief; it is captured in [`stitch/DESIGN.md`](stitch/DESIGN.md) (with an _Archivo Narrow + Geist_ type pairing to evaluate against the current system-font stack).

---

## 1 · Daily Feed — the front door

**Job:** answer "what's out there, why now" before the user has to think.
**What the user sees, in priority order:** a live-signal ribbon and the potential score _first_ (the two things an LLM can't fake), then the title and one-line pitch, then a compact meta row (cost/effort, market size, save). A keyword "refine" field is the custom-requirement feed; type chips scope the feed. The first card is visually richer to read as the featured idea.
**Why:** research U1–U4 — the moat (signal + score) was buried behind an expander; here it leads. Cost/effort and market size answer "is this for someone like me" at a glance.
**Built on:** PRD §4.1 Daily Feed, §4.2 Idea Cards, §4.3c Requirement Feed. Components: `IdeaFeed`, `IdeaCard`, `FilterBar`.

## 2 · Idea Detail — the deep dive

**Job:** everything the product promises, in one confident scroll, so the user believes it.
**What the user sees:** hero (signal ribbon, title, pitch, a stat row of Potential / Cost-Effort / Timing), then clearly separated sections — **VC Analysis** (justification + Unfair Advantage / Revenue Model / Market Dynamics sub-blocks), **Expert Vetting** (a verdict chip — High Conviction / Moderate / Pass — plus pivots), **Market Evidence** (cyan citation chips + grounded source links, styled as _proof_), **Execution Roadmap** (numbered 10-step checklist, first steps checked), **Validation Toolkit** (three template tiles), and a compact **Discussion** thread. Top-right: share + export-to-PDF.
**Why:** this is where trust is won or lost; evidence must read differently from promotion, and the roadmap must feel like a real tool.
**Built on:** PRD §4.2, §4.4 VC Analysis & Vetting, §4.5 Roadmap, §4.3d Toolkit, §4.6 Export, §4.7 Community. Components: `IdeaCardAnalysis`, `IdeaCardVetting`, `IdeaCardEvidence`, `IdeaCardActionSteps`, `IdeaCardToolkit`, `IdeaComments`.

## 3 · Analyze My Idea — bring your own

**Job:** turn the app from a feed you read into a tool you use on your own idea.
**What the user sees:** a title + subtitle, a live **monthly quota meter** ("Pro · 3 of 5 left"), a large idea input with a clear placeholder, an emerald Analyze button, and — below — a completed result card (score, why-it's-backable, revenue/market sub-blocks, vetting verdict, and Save / Open-full-analysis). A quiet note that analyses are saved.
**Why:** research names this the most-trusted surface precisely because it has honest states and real quotas — the model every other screen should copy.
**Built on:** PRD §4.3b Custom Idea Analysis (Pro 5 / Builder 20 per month), persistence to `user_latest_idea`. Component: `AnalyzeIdeaModal`.

## 4 · Saved / My Library — the accruing workspace

**Job:** make saving pay off, so returning has a reason and leaving is a loss.
**What the user sees:** a segmented control (Saved ideas · My analyses · Building). Saved ideas show a "new evidence" cyan badge when a saved idea's market moved. "Your latest analysis" surfaces the most recent custom result (which today is written but never rendered — audit gap). "What you're building" shows cross-idea roadmap progress bars with the next step.
**Why:** research U12 — saves currently dead-end; this turns them into an accruing library and gives Builder progress a home.
**Built on:** PRD §4.3b persistence, §4.5 plan customization. Components: `SavedIdeas`, roadmap progress from `fullActionPlan.roadmap[].isDone`.

## 5 · Today — the subscriber dashboard

**Job:** a paying user should open on _their_ state, not a generic feed.
**What the user sees:** a greeting + status line (new · fit · streak), then stacked modules — **Your radar** (followed spaces with momentum badges + Follow), **What you're building** (progress), **Our track record** (one honest credibility stat + "see how we grade, misses included"), and **Today's feed** collapsed to one small module.
**Why:** the value research's core finding — an idea feed is content (nice-to-have); a dashboard of personal, accruing state is a tool (must-have). This screen is the move from reader to operator.
**Built on:** Roadmap TE-57 (track record), TE-58 (progress + streak), TE-60/61 (home + radar). Feed remains one module.

## 6 · Market Intelligence — the flagship paid surface

**Job:** give serious users the macro view that justifies the top tier.
**What the user sees:** two panels. **Weekly Trend Radar** — emerging shift rows with a momentum sparkline, direction, and "why it matters." **Futurecasting** — three horizon cards (2027 / 2030 / 2035), each a bold prediction, short rationale, and impact tag.
**Why:** this is the reason a Builder renews; it must feel editorial and data-forward, not like more feed.
**Built on:** PRD §4.3 Weekly Radar, §4.5 Futurecasting. Components: `WeeklyRadar`, `Futurecasting` (also `WeeklyBest`, `EmailDigest` in the same intelligence family).

## 7 · Pricing & Upgrade — convert in place

**Job:** let the user find "the plan that is me," and convert without losing context.
**What the user sees:** three plans framed by job — **Discover** (Free · "See what's out there"), **Evaluate** (Pro $9 · "Know if it's real before you commit," marked _Most popular_ and anchored), **Execute** (Builder $19 · "Go build it") — each an "Everything in the previous plan, plus" grouping. Overlaid: a contextual **upgrade sheet** titled after the thing the user reached for, with a free "sample it on this idea" path and Start Pro.
**Why:** research U5/U6 — the pricing grid teleport lost intent, and users were asked to buy an unsampled feeling. Job framing + an in-place sheet + a taste fix both.
**Built on:** PRD §3 tiers. Roadmap TE-53 (UpgradePrompt), TE-54 (evidence sample), TE-55 (job-based pricing). Components: `PricingSection`, `StripeCheckoutModal`, new `UpgradePrompt`.

## 8 · Enterprise — the B2B cut

**Job:** make a fund scout or corporate innovation lead feel this is credible, and capture the lead.
**What the user sees:** a confident hero ("Deal-flow intelligence, before it's obvious"), three value rows (deal-flow intelligence · sector monitoring · white-space analysis), and a **Request access** form (fund/company, work email, role) with a submit button and a reassurance that a real person follows up.
**Why:** research U7 — the current form silently fails for anonymous visitors; the whole B2B funnel captures nothing. A restrained, corporate cut of the same system, with a form that confirms.
**Built on:** PRD §4.8 Enterprise landing & lead capture. Component: `EnterpriseLanding` (needs the serverless lead-capture fix, roadmap TE-15).

---

## Screens deliberately not in this set (and why)

Empty cells are findings, not oversights (Change-Impact rule):

- **Onboarding / Founder-fit setup** — proposed (TE-56), not yet built; folds into first-run once shipped. Kept out to stay on _developed_ requirements.
- **Sign-in** — a single provider (Google) popup; no bespoke screen needed.
- **Alerts panel** — an existing overlay (`AlertsPanel`), designed as a sheet off any screen rather than its own board entry.
- **Weekly Best / Email Digest** — same intelligence family as screen 6; represented by the Radar/Futurecasting panel to avoid a redundant board entry.

## Honest limits

- **Fidelity here is intent, not final spec** — spacing, motion, and final type (the Archivo Narrow + Geist question) are a build/design-tool step.
- **These screens assume the value is real** — no screen rescues a repetitive feed (TE-30/31) or evidence no better than a free prompt.
- **Every gated surface still needs its unhappy states** (empty / loading / `tierLoading` / anonymous) designed before "done."
