# Trend Equity — Cross-Agent Project Handoff

**Last updated:** 2026-07-30  
**Working branch:** `claude/merge-subscriber-growth-branches`  
**Base branch:** `main`  
**Main-branch rule:** do not push, merge, or retarget work to `main` without explicit owner approval.

This is the first file any developer or AI agent should read when continuing the subscriber-growth work from another device, editor, cloud environment, or mobile session.

---

## 1. Current status

The working branch combines the subscriber-growth research, funnel strategy, mobile design work, and two small robustness fixes from several earlier branches.

At the start of this consolidation the branch was **13 commits ahead of `main`**. Most of the branch is documentation and design material. The only product-code changes already present are:

- `api/_handlers/analyze-idea.ts`: normalizes malformed array fields returned by the AI provider.
- `src/components/idea/IdeaCardAnalysis.tsx`: safely renders structured trend-source values.

**The subscriber-growth redesign itself is not implemented yet.** No tier-v2 code, new home screen, radar, paywall redesign, or retention workspace should be described as shipped.

---

## 2. Canonical read order

Read these files in order before making changes:

1. `docs/PROJECT_HANDOFF.md` — current branch state and non-negotiable rules.
2. `docs/superpowers/plans/2026-07-30-one-complete-free-idea-strategy.md` — adopted product model and technical migration plan.
3. `PRD.md` — target product requirements and tier promises.
4. `DECISIONS.md` — historical product and architecture decisions.
5. `docs/superpowers/plans/2026-07-30-execution-roadmap.md` — current implementation order and decision gates.
6. `docs/design/README.md` — design status and which generated assets are stale.
7. `CLAUDE.md` — repository architecture, testing, billing, and development rules. Despite the filename, it applies to every AI agent and developer.

Older subscriber-growth research remains useful evidence, but where it conflicts with the files above, the files above win.

---

## 3. Adopted product direction for this branch

### Positioning

Trend Equity is not primarily an AI idea feed. It is a **personal opportunity-radar and execution system**:

> Monitor markets the user cares about, detect meaningful movement, verify opportunities with current evidence, and help the user validate and execute the right one.

### Free experience

Free and anonymous visitors receive **one complete Idea of the Day**.

“Complete” means a complete evaluation of that idea:

- live-signal context and provenance;
- headline, pitch, score, cost/effort, and timing;
- full VC analysis;
- market size, competitors, regulatory risks, and revenue model;
- search-grounded market evidence with real source links;
- immediate starter next steps;
- save/share when signed in.

There are **no blurred sections, disabled evidence controls, or inline paywalls inside the free idea**.

Paid workflows remain separate. A free user does not automatically receive custom idea analysis, continuous monitoring, thesis radar, advanced exports, validation experiments, expert vetting, full build packs, or cross-idea execution workspaces.

### Paid experience

- **Pro / Evaluate:** all qualified daily opportunities, custom idea analysis, unlimited saves, advanced exports, personalized evaluation and monitoring features as they are implemented.
- **Builder / Execute:** everything in Pro plus full roadmaps, tracked validation, build packs, expert vetting, progress/accountability, advanced intelligence, and API-oriented tools.

Builder should not be sold as “more feed items than Pro.” It should be sold as the execution workspace.

### Quality promise

Do not promise a fixed 10/25/35 quantity in new marketing copy. Paid users should receive **all opportunities that pass the quality standard that day**. Quality determines quantity.

Existing constants still use 10/25/35 and remain implementation reality until the tier-v2 migration ships. Do not confuse the target requirement with current code.

---

## 4. Decisions that supersede earlier redesign assumptions

The following previous assumptions are no longer canonical:

- Free sees 10 ideas with locked sections.
- Free sees a second blurred card after the unlocked hero card.
- Market Evidence is sampled once through a one-shot allowance.
- A reverse trial and an evidence sample launch together.
- Signal ribbons may display percentages such as `+340%` without structured historical metrics.
- A public hit rate can be shown from publish-time snapshots alone.

Replacement rules:

1. One complete free idea replaces both the locked feed and the one-time evidence sample.
2. Upgrade prompts appear when the user asks for **more breadth or a new workflow**: see all qualified ideas, follow a market, analyze a custom idea, start validation, or build a roadmap.
3. Signal claims require structured provenance and measured values. Until then, use honest labels such as `Observed on Product Hunt · 30 Jul 2026`.
4. Prediction snapshots are not a track record. Public hit-rate claims require a defined grading workflow and reviewed outcomes.
5. Reverse trials remain a later isolated experiment, not part of the initial tier-v2 launch.

---

## 5. Technical invariants for the one-free-idea implementation

These are acceptance requirements, not optional implementation suggestions:

1. **Server-side projection:** free clients receive exactly one full idea. Do not send all paid ideas to the browser and hide them with CSS or array slicing.
2. **Deterministic selection:** the daily document stores or derives a stable `featuredIdeaId`; every free visitor sees the same designated idea for that day unless a deliberate personalized-free experiment is approved later.
3. **Evidence is precomputed or cached:** free access to the featured idea must not allow arbitrary calls to the paid evidence endpoint for other ideas.
4. **No lowered quality threshold:** if no idea passes the quality gate, show an honest unavailable state rather than publishing a weak idea to satisfy a count.
5. **Anonymous and signed-in Free share content entitlement:** signing in adds persistence and identity-dependent actions; it does not unlock additional daily ideas.
6. **Tier is server truth:** `users/{uid}.tier` remains server-written. Client code never grants a plan or trial.
7. **No fake signal metrics:** source names, timestamps, URLs, metric names, values, and deltas must be distinguishable fields.
8. **No fake product capabilities:** remove or label cosmetic features such as the current co-founder toggle until the underlying journey exists.

---

## 6. Workstream status

| Work package | Status | Notes |
| --- | --- | --- |
| Branch merge review | Done | Merged branch analyzed against current code and prior plans. |
| Product model consolidation | Done | One complete free evaluation adopted for this branch. |
| PRD and execution-plan update | Done in documentation | Code still uses the old tier limits. |
| Design reconciliation | In progress | Existing Stitch screens predate tier v2 and must not be implemented unchanged. |
| Funnel instrumentation | Todo | Anonymous journey and paywall events still need a coherent path. |
| Tier-v2 vertical slice | Todo | Server projection, featured idea, UI, pricing copy, tests. |
| Structured signal provenance | Todo | Required before quantitative SignalRibbon claims. |
| Hard quality publishing gate | Todo | Variable publish count; no fail-open marketing promise. |
| Radar vertical slice | Gated | Build after tier-v2 activation/conversion baseline. |
| Validation and build workspace | Gated | Build after retention data supports the investment. |
| Main-branch merge | Blocked | Requires explicit owner approval after review and validation. |

---

## 7. Immediate next implementation slice

Implement the smallest end-to-end tier-v2 slice before building the large dashboard:

1. Add a stable featured-idea field or selector to the daily-generation result.
2. Return one full idea to anonymous/Free requests and the qualified paid set to Pro/Builder.
3. Render one complete Idea of the Day with no locks.
4. Place a clean post-idea upgrade module offering `See all qualified ideas` and `Analyze my idea`.
5. Update pricing copy to Discover / Evaluate / Execute using the new promises.
6. Add tests for every anonymous/Free/Pro/Builder response and UI state.
7. Instrument landing → idea viewed → source opened → save/sign-in → upgrade surface → checkout.
8. Run `npm run check`, relevant unit tests, and Playwright mobile smoke coverage.

Do not start the large Today dashboard, push notifications, or co-founder matching before this vertical slice produces measurable behaviour.

---

## 8. Continuation protocol for any AI agent or developer

1. Confirm the current branch before editing: `git branch --show-current`.
2. Never assume `main` is the target. This work remains on `claude/merge-subscriber-growth-branches` until the owner approves otherwise.
3. Read the canonical files listed in section 2.
4. State which work package is being started and which files will change.
5. Update in-repo status and decisions in the same commit as the change.
6. Prefer complete vertical slices with tests over disconnected UI scaffolding.
7. Run the relevant checks and report actual results; do not mark work complete from code inspection alone.
8. Push the current feature branch. Do not push directly to `main`.
9. Leave a concise handoff in this file when a material decision, blocker, or implementation milestone changes.

---

## 9. Known operational blockers

- `docs/BACKLOG.md` still contains several earlier Wave 5/6 assumptions. Use the new strategy and execution roadmap before implementing those rows; reconcile ticket wording when the first tier-v2 implementation begins.
- The committed Stitch screen IDs are historical visual references. They contain the old locked-free-feed model and unsupported quantitative examples. Reuse visual tokens, not product behaviour.
- The existing public track-record proposal has no outcome-grading workflow yet.
- Android paid distribution needs a billing architecture decision covering Play Billing versus any eligible alternative billing path before native subscription launch.
