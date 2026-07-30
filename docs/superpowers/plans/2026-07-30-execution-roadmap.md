# Execution Roadmap — Subscriber Growth and Must-Have Value

**Date:** 2026-07-30  
**Status:** Adopted sequencing for `claude/merge-subscriber-growth-branches`; implementation not started  
**Canonical product model:** [One Complete Free Idea strategy](2026-07-30-one-complete-free-idea-strategy.md)  
**Cross-agent status:** [Project handoff](../../PROJECT_HANDOFF.md)

This roadmap replaces the earlier sequence that centered on a locked ten-card Free feed, a one-time evidence sample, and an immediate reverse trial. The new sequence first proves one complete daily evaluation, then sells breadth and recurring workflows.

---

## 1. Rules that control the order

1. **Repair known reliability debt before trusting funnel data.** The daily-generation test suite and anonymous read path must be verified.
2. **Server-authoritative access before presentation.** Free must receive one full featured idea from the server, not all paid data hidden by the client.
3. **Quality before quantity.** A weak idea is not published merely to satisfy 10/25/35 counts.
4. **Complete value before upgrade pressure.** The featured free idea contains no locks or inline paywalls.
5. **Measure the complete-free-idea funnel before adding trials or large retention infrastructure.**
6. **Personal triggers before notifications.** Radar/change detection precedes push and personalized digest work.
7. **Execution and user-owned state are the retention moat.** Build them after activation and conversion behaviour confirms the need.

---

## 2. Critical path

Legend: **Gate** means do not proceed until the condition is true. `∥` means the work can run in parallel.

| # | Stage | Work | Result / gate | Effort |
| --- | --- | --- | --- | --- |
| 1 | **0 · Stabilize** | Repair TE-46 daily-generation tests and narrow programming-error masking | Generation, quality, signal, and tier behaviour have trustworthy tests | S |
| 2 | 0 · Stabilize | Verify anonymous cached daily read in a real signed-out browser and API test | Anonymous users can receive the designated daily payload without triggering generation | S |
| 3 | **0 · Observe** | Extend funnel instrumentation for anonymous and signed-in journeys | Landing → featured idea → source → save/sign-in → more requested → upgrade → checkout is measurable | M |
| 4 | **1 · Define contract** | Specify anonymous/Free/Pro/Builder response shapes and low-quality-day behaviour | One testable entitlement contract, no client-only assumptions | S |
| 5 | 1 · Define contract | Add structured signal-provenance schema or remove unsupported quantitative claims | Active UI and designs make only verifiable claims | M |
| 6 | **2 · Tier-v2 backend** | Add deterministic `featuredIdeaId` and hard publishing threshold | Daily generation identifies one qualified featured idea and can publish a variable qualified count | M |
| 7 | 2 · Tier-v2 backend | Implement server-side daily-read projection | Anonymous/Free receive one full idea; Pro/Builder receive the qualified paid set | M |
| 8 | 2 · Tier-v2 backend | Precompute/cache featured evidence and lock arbitrary evidence generation by entitlement | Complete Free evidence works without exposing paid calls or uncontrolled cost | M |
| 9 | **3 · Tier-v2 frontend** | Build one complete Idea of the Day, including honest empty/loading/error states | No blurred or locked sections inside the free idea | M |
| 10 | 3 · Tier-v2 frontend | Add post-idea and intent-preserving upgrade surfaces | Upgrade is triggered by “more ideas” or a new workflow, not missing paragraphs | M |
| 11 | 3 · Tier-v2 frontend | Reframe pricing as Discover / Evaluate / Execute | Tier promises match the PRD and implementation | S |
| 12 | 3 · Tier-v2 frontend | Remove or quarantine stale locked-feed and evidence-sample behaviour | No active path contradicts the new free promise | M |
| 13 | **4 · Verify** | Unit, integration, and mobile E2E tests for all tier and auth states | `npm run check` and targeted test suites pass; full user journey is exercised | M |
| — | **★ DECISION GATE** | Read meaningful tier-v2 cohorts | Re-rank subsequent work using observed activation, request-more, checkout, and retention behaviour | — |
| 14 | **5A · Trust** | Quality/diversity improvements and structured source provenance | The complete sample is consistently credible and non-repetitive | M–L |
| 15 | 5A · Trust | Define prediction outcome review and grading before publishing a track record | Public credibility claims have a writer, reviewer, methodology, and misses | M |
| 16 | **5B · Personal value** | Founder profile and personalized ranking | Paid feed and monitoring answer “for me,” not only “generally interesting” | L |
| 17 | 5B · Personal value | My Thesis radar vertical slice: follow → detect change → explain → open | First recurring must-have workflow exists end to end | L |
| 18 | 5B · Personal value | Saved-idea change detection | Saved items accrue new value instead of dead-ending | M |
| 19 | 5B · Personal value | Personal Today view aggregating existing and new state | Paid users open on their work and changes, not a generic feed | L |
| 20 | **5C · Re-engagement** | Personalized digest and web/native push | Messages are triggered by radar or saved changes; never generic broadcasts | M |
| 21 | **5D · Retention moat** | Tracked validation experiments and portfolio | User evidence and decisions accrue in the product | L |
| 22 | 5D · Retention moat | What I’m building, roadmap progress, accountability, and ship-log | Builder becomes a persistent execution workspace | L |
| 23 | **5E · Churn learning** | Cancellation reason capture and suitable save options | Churn creates structured data and appropriate recovery paths | S–M |
| 24 | **Later experiment** | Reverse trial, tested separately | Only after tier-v2 baseline; isolated cohort and economics | M |
| 25 | **Last** | Genuine co-founder discovery and contact journey | Only after sufficient builder density, privacy design, and real user demand | L |

---

## 3. First implementation milestone

The first milestone is a complete, deployable vertical slice—not a collection of mock components.

### Included

- stable featured-idea selection;
- server projection for anonymous/Free/Pro/Builder;
- complete free evidence and analysis;
- honest zero-qualified-idea state;
- one mobile-first Idea of the Day screen;
- post-idea upgrade module;
- Discover/Evaluate/Execute pricing copy;
- funnel events;
- automated contract and user-journey tests.

### Excluded

- reverse trial;
- push notifications;
- generic digest expansion;
- public hit-rate claims;
- large Today dashboard;
- co-founder matching;
- cosmetic signal percentages not supported by source data.

---

## 4. Decision gate interpretation

After enough real traffic exists to avoid reacting to isolated sessions:

- **Low featured-idea viewing or scroll depth:** repair first-run presentation, latency, mobile layout, or idea quality.
- **Deep evaluation but few requests for more:** paid differentiation is unclear; strengthen breadth, monitoring, personalization, and workflow messaging.
- **Many requests for more but weak checkout starts:** examine price, trust, plan composition, or contextual upgrade copy.
- **Checkout starts but weak completion:** examine Stripe journey, billing confidence, payment errors, and plan selection.
- **Healthy conversion but weak day-7/30 return:** prioritize radar, saved changes, validation, Today view, and execution state.
- **Healthy retention without large workspace features:** avoid unnecessary engineering; improve the proven loop instead.

---

## 5. Parallel quality lane

The following can run alongside tier-v2 work but must not destabilize the critical path:

- intra-day and cross-day semantic diversity;
- source normalization and provenance;
- strict quality threshold and variable publish count;
- performance/cost monitoring for featured evidence;
- correction of the current `founderFit` naming mismatch before personalization;
- replacement of generic digest content with personal triggers only after the trigger model exists.

---

## 6. Documentation and continuation rule

Every implementation milestone updates in the same change:

- `docs/PROJECT_HANDOFF.md` for current state and next action;
- `docs/BACKLOG.md` for task status;
- `DECISIONS.md` for material decisions;
- `PRD.md` when the promised product changes;
- `CHANGELOG.md` only when implementation ships.

Work remains on `claude/merge-subscriber-growth-branches`. Do not push or merge to `main` without explicit owner approval.
