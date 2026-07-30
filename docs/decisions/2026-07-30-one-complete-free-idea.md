# Decision: One Complete Free Idea, Paid Breadth and Workflow

**Date:** 2026-07-30  
**Status:** Adopted for `claude/merge-subscriber-growth-branches`  
**Implementation status:** Not started  
**Main branch:** Unchanged; do not merge without explicit owner approval

## Context

The existing product and the first subscriber-growth redesign used a partially locked Free experience:

- Free was promised ten daily ideas.
- Important sections such as full analysis and Market Evidence were locked.
- The redesign added one unlocked hero card, followed by blurred cards and a one-time evidence sample.

The product owner wants Free users to be able to discover and judge one idea completely before paying. The earlier model also defined recurring paid value too heavily as access to concealed content rather than an ongoing job.

## Decision

Adopt a **complete sample, paid breadth and workflow** model:

- **Discover — Free:** one complete Idea of the Day, with no locks or paywalls inside that idea.
- **Evaluate — Pro:** all opportunities that pass the daily quality standard, plus repeatable evaluation, custom analysis, personalization, and monitoring as those capabilities ship.
- **Execute — Builder:** everything in Pro plus validation, roadmaps, build packs, progress/accountability, and advanced intelligence.

The free idea includes the complete evaluation when data is available: signal provenance, score and rationale, full VC analysis, revenue model, moat, market size, competitors, regulatory risks, search-grounded evidence and source links, and concise starter next steps.

Paid upgrade prompts begin when the user asks for more breadth or a recurring workflow, such as:

- all qualified daily opportunities;
- custom idea analysis;
- following a thesis or receiving meaningful changes;
- tracked validation;
- full roadmap and build execution;
- advanced exports or intelligence.

## Consequences

1. The earlier 10/25/35 partially locked tier promise is superseded as a target product requirement.
2. New marketing copy must not guarantee a fixed daily quantity. Quality determines quantity, subject to an operational cap.
3. A zero-qualified-idea day is displayed honestly; the quality engine must not publish weak candidates merely to meet a number.
4. The daily API needs a server-authoritative projection:
   - anonymous/Free: one complete designated idea;
   - Pro/Builder: qualified paid set.
5. The full paid set must not be sent to a Free browser and hidden client-side.
6. Featured evidence must be precomputed or safely cached so Free access does not expose arbitrary paid evidence generation.
7. The one-time evidence sample is removed from the initial plan because the complete featured idea already provides the proof sample.
8. Reverse trial remains a later isolated experiment after the tier-v2 baseline is measured.
9. Existing Stitch screens remain visual references but cannot be implemented unchanged.
10. Unsupported numerical signal claims are prohibited until the source model contains the required measured values and comparison window.
11. Builder is positioned as execution, not merely a larger feed.

## Superseded records

The section **“Free-Tier Value Ladder — Adopted (2026-07-10)”** in `DECISIONS.md` remains historical documentation of the previous model, but is superseded for future implementation by this decision.

The following earlier proposed items also require reinterpretation or replacement:

- TE-51: becomes the complete Free Idea of the Day, not an unlocked card followed by a locked Free feed.
- TE-53: contextual prompts remain, but they sell more ideas or a new workflow rather than missing sections within the featured idea.
- TE-54: one-time evidence sample is superseded.
- TE-55: Discover/Evaluate/Execute framing remains, with updated promises.
- TE-59: the old Free evidence CTA defect becomes obsolete on the featured idea; any remaining gated evidence controls outside the featured entitlement must still be accessible and usable.
- TE-67: reverse trial is deferred until after the new baseline.

Backlog wording should be reconciled when tier-v2 implementation begins rather than silently implementing the old ticket descriptions.

## Canonical references

- `docs/PROJECT_HANDOFF.md`
- `docs/TIER_V2_TRACKER.md`
- `docs/superpowers/plans/2026-07-30-one-complete-free-idea-strategy.md`
- `docs/superpowers/plans/2026-07-30-execution-roadmap.md`
- `PRD.md`

## Validation required before implementation is considered complete

- Tier-specific server contract tests.
- Anonymous and signed-in Free mobile journey tests.
- Proof that Free clients receive exactly one complete idea and cannot retrieve the paid set through the normal path.
- Honest zero-qualified-idea behaviour.
- No unsupported signal delta copy.
- Pricing and upgrade copy aligned with the implemented capabilities.
- Relevant unit/integration/E2E tests and `npm run check` passing.
