# One Complete Free Idea — Product and Migration Strategy

**Date:** 2026-07-30  
**Status:** Adopted for `claude/merge-subscriber-growth-branches`; not implemented  
**Owner decision:** Free users should be able to evaluate one idea completely before paying.  
**Supersedes:** the earlier assumption that Free receives 10 partially locked cards plus a one-time evidence sample.

---

## 1. Decision

Trend Equity will use a **complete sample, paid breadth and workflow** model:

- **Free / Discover:** one complete Idea of the Day, with no paywalls inside that idea.
- **Pro / Evaluate:** all qualified opportunities plus repeatable evaluation and monitoring tools.
- **Builder / Execute:** the execution, validation, accountability, and advanced-intelligence workspace.

The upgrade boundary moves from “unlock the missing paragraphs in this idea” to:

- see all qualified opportunities;
- analyze a user-supplied idea;
- follow a thesis or market;
- receive meaningful changes and alerts;
- start a tracked validation experiment;
- create and manage a full build roadmap;
- use advanced intelligence, exports, and API-oriented tools.

This makes the free promise easy to understand and lets a prospective subscriber judge the actual quality of the product before paying.

---

## 2. Why this is stronger than the previous model

The existing model gives Free ten cards while withholding the most persuasive parts of each card. That produces three problems:

1. **Quantity without conviction.** The user can browse many ideas but cannot verify whether any one deserves attention.
2. **The product appears evasive.** A user sees locks before they have experienced a complete result.
3. **Paid value is defined as hidden text.** This is vulnerable to substitution by a general AI prompt and creates weak recurring value.

The new model provides a credible proof sample while protecting the recurring value:

- Free proves quality.
- Pro sells continuous discovery, repeatable evaluation, and personalization.
- Builder sells progress, execution, and accumulated user state.

The recurring subscription is therefore justified by an ongoing job, not by access to a single concealed answer.

---

## 3. Canonical tier promises

### Discover — Free

**Promise:** “Evaluate one real opportunity completely before deciding whether Trend Equity is worth paying for.”

Includes:

- one complete Idea of the Day;
- live-signal context with honest source provenance;
- complete VC analysis;
- market evidence and source links;
- market size, competitors, regulation, revenue model, and risks;
- a concise starter action plan;
- limited saves and PDF/share capability after sign-in;
- read-only public discussion and reactions where already supported.

Does not include:

- the rest of the daily qualified set;
- custom idea analysis;
- custom requirement feeds;
- continuous thesis monitoring;
- personalized radar and alerts;
- advanced exports;
- tracked validation experiments;
- full build roadmap customization;
- advanced intelligence and API access.

### Evaluate — Pro

**Promise:** “Continuously find and evaluate the opportunities most relevant to you.”

Target capabilities:

- all opportunities that pass the daily quality threshold;
- custom idea analysis with a monthly quota;
- unlimited saves;
- advanced exports;
- validation toolkit generation;
- posting in discussions;
- personalized ranking and founder-fit when implemented;
- saved-idea changes, thesis radar, and monitoring as those vertical slices ship;
- Weekly Best and the appropriate intelligence digest.

### Execute — Builder

**Promise:** “Turn a chosen opportunity into validated, accountable execution.”

Target capabilities:

- everything in Pro;
- full and customizable roadmap;
- expert vetting and deep-dive support;
- tracked experiments and validation portfolio;
- build packs, starter-repository prompts, and progress tracking;
- cross-idea “What I’m building” workspace;
- accountability and ship-log features;
- advanced radar, futurecasting, TE100, and API-oriented access.

Builder is not merely Pro with more cards. It is a different job: execution.

---

## 4. Idea completeness contract

The free idea must be complete enough to support a genuine go/no-go evaluation. It includes the following product sections when data is available:

1. Why-now signal and provenance.
2. Headline and one-sentence pitch.
3. Potential score and its justification.
4. Cost/effort and timing.
5. Unfair advantage or realistic moat.
6. Revenue model.
7. Market size.
8. Competitor landscape.
9. Regulatory or structural risks.
10. Search-grounded evidence and source links.
11. Expert-vetting verdict only if the product can support it honestly and consistently.
12. Immediate starter steps.

No section within the featured free idea may be blurred, disabled, or converted into an inline paywall.

The starter steps do not have to expose Builder’s complete execution workspace. A concise “what to test next” section is a complete evaluation output; roadmap customization, tracking, build packs, and deep dives remain paid workflows.

---

## 5. Feed and quality policy

### 5.1 Featured free idea

Each daily generation stores a stable `featuredIdeaId`, selected from candidates that pass the quality threshold. The default selector should be deterministic and explainable, for example:

1. passing quality gate;
2. sufficient source provenance;
3. highest final score;
4. diversity or safety tie-breakers;
5. stable idea ID tie-breaker.

Do not choose a different free idea per browser unless a later experiment explicitly approves personalization. A shared designated idea improves cacheability, support, analytics interpretation, and word-of-mouth.

### 5.2 Paid daily set

Pro and Builder receive the **qualified daily set**, not a guaranteed marketing count. The initial implementation can retain a maximum cap for cost and UI reasons, but copy should say “all qualified opportunities today,” not “25” or “35.”

### 5.3 No fail-open publishing promise

The current quality engine can fall back to top-ranked candidates when too few pass. That behaviour must not be used to satisfy a public quantity promise. Before tier v2 launches, define and enforce an honest low-volume state:

- one passing idea: publish it as the free idea and show it in paid;
- several passing ideas: publish all up to the configured cap;
- zero passing ideas: display “No opportunity met our publishing standard today” and preserve yesterday’s library/workspace separately.

---

## 6. Signal integrity contract

The redesign concepts currently show claims such as `Product Hunt +340%`. The present signal ingestion is not sufficient to make that claim reliably.

A quantitative ribbon may only render when the data model contains:

- source name;
- canonical URL or source identifier;
- observed timestamp;
- metric name;
- current value;
- comparison value and comparison window;
- calculated delta;
- confidence or data-quality state.

Until this structured model exists, display factual provenance without a fabricated delta, for example:

- `Observed on Product Hunt · 30 Jul 2026`
- `Trending query found in Google Trends · Netherlands`
- `Discussed on Hacker News · source available`

A generic LLM can generate persuasive language. Trend Equity’s advantage depends on verifiable evidence, so unsupported numerical decoration is worse than no number.

---

## 7. Conversion model

### 7.1 Where upgrade prompts belong

The free idea itself is uninterrupted. An upgrade prompt may appear:

- after the complete idea;
- when the user taps “See all qualified ideas”;
- when the user submits a custom idea;
- when the user follows a thesis or asks for alerts;
- when the user starts validation tracking;
- when the user opens a Builder roadmap or build pack.

### 7.2 Upgrade message examples

After the free idea:

> You have evaluated today’s featured opportunity. Pro gives you every qualified opportunity today, custom idea analysis, and monitoring as markets change.

At a thesis/radar action:

> Follow this market and receive meaningful changes instead of checking it manually.

At a Builder action:

> Turn this evaluation into a tracked validation plan and build roadmap.

The message must name the job the user requested. Do not teleport the user to an unrelated pricing page without preserving context.

### 7.3 Reverse trial

Do not bundle a reverse trial into the first tier-v2 release. First measure the complete-free-idea funnel. A 7-day Pro trial can be tested later as an isolated experiment with its own cohort, cancellation behaviour, costs, and guardrails.

---

## 8. Retention model

The free sample solves acquisition trust; it does not solve churn. Paid retention must be built around accumulated state and recurring changes:

1. **My Thesis radar:** markets, keywords, and ideas the user follows.
2. **Saved-idea changes:** new evidence, signal movement, competitor changes, or risk changes.
3. **Tracked validation:** experiments, interview notes, evidence, and go/no-go decisions.
4. **What I’m building:** persistent roadmap progress across ideas.
5. **Personal Today view:** what changed, what needs action, and what progressed.
6. **Honest subscription recovery:** cancellation reasons, pause/downgrade paths, and retained read access to user-owned work where economically sensible.

Push notifications and email digests are delivery channels, not value. They ship only after a personal trigger exists.

---

## 9. Technical migration

### Phase A — Contract and observability

1. Define API response contracts for anonymous, Free, Pro, and Builder.
2. Add funnel events that work anonymously where privacy rules permit.
3. Define the featured-idea selector and low-quality-day state.
4. Replace unsupported signal copy in active design specifications.

### Phase B — Server-authoritative access

1. Add `featuredIdeaId` and publishing metadata to the daily generation document.
2. Add a server-side daily-read projection:
   - anonymous/Free: one complete featured idea;
   - Pro/Builder: qualified paid set;
   - admin refresh and generation rules unchanged.
3. Ensure the free idea’s evidence payload is precomputed in the daily document or served through a featured-only cached path.
4. Never return paid ideas to a free client and rely on client hiding.
5. Add unit tests for all tiers, cached/uncached paths, malformed data, and zero-qualified-idea days.

### Phase C — Frontend vertical slice

1. Create the free Idea of the Day surface.
2. Remove locks from that idea.
3. Remove or bypass the existing free evidence gate for the designated idea.
4. Add post-idea upgrade module and intent-preserving contextual prompts.
5. Update pricing to the Discover/Evaluate/Execute promises.
6. Add loading, error, signed-out, signed-in, and low-quality-day states.
7. Add mobile E2E coverage.

### Phase D — Paid differentiation

1. Personal ranking and founder profile.
2. My Thesis radar vertical slice.
3. Saved-idea change detection.
4. Personal digest/push based on those triggers.
5. Validation workspace and build accountability.

---

## 10. Analytics and decision gate

### Primary behavioural events

- `landing_viewed`
- `featured_idea_viewed`
- `featured_idea_section_reached`
- `evidence_source_opened`
- `save_attempted`
- `sign_in_started`
- `sign_in_completed`
- `more_ideas_requested`
- `custom_analysis_requested`
- `upgrade_prompt_viewed`
- `checkout_started`
- `checkout_completed`
- `day2_return`
- `day7_return`

Do not drop all anonymous activation events merely because there is no user ID. Use a privacy-respecting session identifier or aggregate server event where appropriate.

### Decision gate after launch

Read the first meaningful cohorts before starting the largest retention work:

- If users do not reach or engage with the complete idea, fix activation and presentation.
- If they engage deeply but do not request more, improve differentiation and upgrade jobs.
- If they request more but do not pay, test price, plan composition, trust, or checkout friction.
- If they pay but do not return, prioritize radar, saved changes, validation, and personal workspace.

---

## 11. Acceptance criteria

The tier-v2 launch is not complete until:

- anonymous and signed-in Free users can access exactly one complete designated idea;
- no locked or blurred section appears inside that idea;
- free clients cannot retrieve the full paid set through the normal API;
- Pro and Builder can retrieve the qualified paid set;
- a zero-qualified-idea day is handled honestly;
- signal copy contains no unsupported numerical deltas;
- pricing and onboarding describe the new promises consistently;
- upgrade prompts preserve the triggering context;
- automated tests cover tier response contracts and mobile user journeys;
- canonical docs, backlog, decisions, and handoff agree;
- nothing is merged to `main` without owner review and approval.
