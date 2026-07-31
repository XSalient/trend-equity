# Design Workstream — Subscriber Growth Redesign

**Working branch:** `claude/merge-subscriber-growth-branches`  
**Status:** historical concepts generated; product behaviour requires tier-v2 redesign before implementation  
**Cross-agent entry point:** [`../PROJECT_HANDOFF.md`](../PROJECT_HANDOFF.md)

This directory contains research-derived screen plans and Google Stitch outputs. It is reproducible and useful as a visual reference, but it is **not a final product specification**. The owner has adopted a new Free model after these screens were generated: one complete Idea of the Day with no locks inside it.

---

## Canonical read order

1. [`../PROJECT_HANDOFF.md`](../PROJECT_HANDOFF.md) — current branch status and continuation rules.
2. [`../superpowers/plans/2026-07-30-one-complete-free-idea-strategy.md`](../superpowers/plans/2026-07-30-one-complete-free-idea-strategy.md) — current product model.
3. [`../../PRD.md`](../../PRD.md) — tier promises and requirements.
4. [`../superpowers/plans/2026-07-30-execution-roadmap.md`](../superpowers/plans/2026-07-30-execution-roadmap.md) — build order.
5. This directory’s concept and generated-design documents.

Where an older design conflicts with the first four files, the older design must be revised rather than implemented literally.

---

## What is available

| Artifact                                                                                                                 | Purpose                                          | Current status                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| [`../research/2026-07-30-user-research-findings.md`](../research/2026-07-30-user-research-findings.md)                   | Expert persona walkthroughs and product findings | Useful hypotheses; not moderated user research                     |
| [`../research/2026-07-30-value-and-reengagement-research.md`](../research/2026-07-30-value-and-reengagement-research.md) | Must-have value and re-engagement reasoning      | Useful strategic input                                             |
| [`2026-07-30-redesign-concepts.md`](2026-07-30-redesign-concepts.md)                                                     | Component and campaign concepts                  | Requires tier-v2 reconciliation                                    |
| [`2026-07-30-mobile-home-screens.md`](2026-07-30-mobile-home-screens.md)                                                 | Three home states                                | Free state is stale; subscriber state remains directionally useful |
| [`2026-07-30-mobile-screens.md`](2026-07-30-mobile-screens.md)                                                           | Whole-product mobile screen plan                 | Daily Feed and Pricing screens require revision                    |
| [`stitch/DESIGN.md`](stitch/DESIGN.md)                                                                                   | Visual tokens, type, color, component direction  | Reusable visual reference                                          |
| [`stitch/README.md`](stitch/README.md)                                                                                   | Stitch project and screen IDs                    | Historical run manifest                                            |
| [`stitch/generate/`](stitch/generate/)                                                                                   | Exact generation scripts/prompts                 | Reproducible, but prompts contain stale tier behaviour             |

---

## Adopted design behaviour

### Anonymous and Free home

The primary home surface is one complete **Idea of the Day**:

1. Plain-language value statement.
2. Honest signal provenance.
3. Complete idea evaluation.
4. Verified evidence and source links.
5. Starter next actions.
6. Save/share or sign-in actions where relevant.
7. A clean post-idea module offering paid breadth or a new workflow.

The screen must not show:

- a second blurred card as the main conversion mechanism;
- locked sections within the featured idea;
- a one-time “sample evidence” allowance;
- unsupported momentum percentages;
- “10 free ideas” copy.

### Pro and Builder home

The subscriber Today direction remains useful: personal radar, saved changes, what the user is building, validation state, and a smaller daily-feed module. It remains future work and must follow the tier-v2 activation/conversion slice and decision gate.

### Pricing

Use the job-based framing:

- **Discover — Free:** one complete daily opportunity.
- **Evaluate — Pro:** all qualified opportunities and repeatable evaluation/monitoring.
- **Execute — Builder:** validation, roadmap, build, accountability, and advanced intelligence.

Do not describe Builder primarily as a larger daily idea count.

---

## Visual system that remains valid

The generated visual system can be reused after accessibility and bundle impact are checked:

- near-black `#09090b` background;
- zinc `#18181b` surfaces and `#27272a` structural borders;
- emerald `#10b981` for primary actions and growth;
- cyan `#22d3ee` only for verified evidence/citations;
- amber-to-coral only for live market signal;
- matte tonal layering rather than glass effects;
- strong display hierarchy with calm body/data typography.

The Archivo Narrow + Geist pairing is a proposal, not an adopted dependency decision. The system font stack remains valid until font performance, licensing/distribution, and visual consistency are reviewed.

---

## Required next design work

Before production implementation, create a revised tier-v2 screen set covering:

1. Anonymous first visit with one complete featured idea.
2. Signed-in Free state with the same content entitlement plus save/persistence.
3. Post-idea upgrade module: see all qualified ideas / analyze my idea.
4. Pro daily set and contextual paid workflow entry points.
5. Builder execution workspace entry point.
6. Zero-qualified-idea day.
7. Loading, error, offline, evidence-unavailable, and `tierLoading` states.
8. Mobile billing handoff state once Android billing architecture is decided.

The first production design target is the complete Idea-of-the-Day vertical slice, not the full Today dashboard.

---

## Stitch project

- Project: `projects/13591160038311824941`
- Existing screen IDs: [`stitch/README.md`](stitch/README.md)
- Generation scripts: [`stitch/generate/`](stitch/generate/)
- Environment: `STITCH_API_KEY` must be supplied through environment configuration and never committed.

The existing screen IDs are historical references. Generate new screen IDs for tier-v2 revisions instead of silently overwriting the old manifest; this preserves design history and makes comparisons possible.

---

## Continuation from any tool or device

1. Check out `claude/merge-subscriber-growth-branches`.
2. Read `docs/PROJECT_HANDOFF.md` and the one-complete-free-idea strategy.
3. Treat existing screens as visual references, not behaviour requirements.
4. Record new generated screen IDs and prompts in-repo.
5. Update this file’s status when the revised tier-v2 screen set is created.
6. Do not merge or push changes to `main` without explicit owner approval.
