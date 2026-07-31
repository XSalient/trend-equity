# Tier V2 — Implementation Tracker

**Branch:** `claude/merge-subscriber-growth-branches`  
**Target:** one complete Free Idea of the Day; paid breadth, monitoring, and execution  
**Status:** planning consolidated; implementation not started  
**Do not modify `main` without explicit owner approval.**

This tracker is intentionally compact so any AI agent, editor, or mobile session can understand the next actionable work without reconstructing the research history.

## Status legend

- `todo` — approved scope, not started
- `in progress` — active work; owner/agent and branch must be recorded
- `blocked` — cannot progress until named dependency is resolved
- `done` — implemented and validated on this branch
- `parked` — deliberately excluded from the current sequence

## Milestones

| ID     | Milestone                                                                    | Status  | Owner         | Dependencies                            | Completion evidence                                                             |
| ------ | ---------------------------------------------------------------------------- | ------- | ------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| TV2-01 | Repair daily-generation tests and programming-error masking                  | todo    | —             | None                                    | Targeted unit suite passes and failure modes are distinguishable                |
| TV2-02 | Verify anonymous cached daily read end to end                                | todo    | —             | TV2-01 recommended                      | Signed-out API/browser test receives cached daily content without generating    |
| TV2-03 | Define and test tier-v2 API response contracts                               | todo    | —             | TV2-01                                  | Contract tests for anonymous, Free, Pro, Builder, admin, and zero-qualified day |
| TV2-04 | Add privacy-respecting anonymous funnel measurement                          | todo    | —             | Analytics design                        | Landing and featured-idea journey is measurable without an account              |
| TV2-05 | Add structured signal provenance or neutralize unsupported claims            | todo    | —             | Signal audit                            | No active UI displays invented or untraceable deltas                            |
| TV2-06 | Add deterministic `featuredIdeaId` and hard publishing threshold             | todo    | —             | TV2-03                                  | Daily document records stable featured idea; zero-passing day supported         |
| TV2-07 | Implement server-authoritative daily projection                              | todo    | —             | TV2-03, TV2-06                          | Free receives exactly one full idea; paid tiers receive qualified set           |
| TV2-08 | Precompute/cache featured evidence safely                                    | todo    | —             | TV2-06, evidence architecture           | Featured evidence works for Free without arbitrary paid evidence access         |
| TV2-09 | Build complete mobile-first Idea of the Day UI                               | todo    | —             | TV2-07, TV2-08                          | No locks inside featured idea; loading/error/empty states covered               |
| TV2-10 | Add post-idea and contextual upgrade journeys                                | todo    | —             | TV2-09                                  | Context preserved for more ideas, custom analysis, radar, validation, roadmap   |
| TV2-11 | Update pricing implementation to Discover/Evaluate/Execute                   | todo    | —             | TV2-07                                  | UI promises exactly match `PRD.md` and server behaviour                         |
| TV2-12 | Remove stale locked-free-feed paths and one-time evidence sample assumptions | todo    | —             | TV2-09, TV2-10                          | No active route contradicts one-complete-free-idea promise                      |
| TV2-13 | Complete unit, integration, mobile E2E, lint, type, and format validation    | todo    | —             | TV2-01…12                               | Actual command output recorded; failing checks resolved or explicitly blocked   |
| TV2-14 | Read first meaningful cohort and decide next investment                      | blocked | Product owner | TV2-13 + sufficient real traffic        | Written decision: activation, conversion, retention, or quality priority        |
| TV2-15 | My Thesis radar vertical slice                                               | blocked | —             | TV2-14 prioritizes personal value       | Follow → change detection → explanation → open works end to end                 |
| TV2-16 | Saved-idea changes and personal Today view                                   | blocked | —             | TV2-14/15                               | Returning paid user sees accrued personal state and changes                     |
| TV2-17 | Tracked validation and What I’m Building workspace                           | blocked | —             | TV2-14 supports retention investment    | User experiments, decisions, and build progress persist                         |
| TV2-18 | Personalized digest and push                                                 | blocked | —             | TV2-15/16 personal triggers             | No generic broadcasts; consent and delivery verified                            |
| TV2-19 | Cancellation reason and suitable save flow                                   | todo    | —             | Billing review                          | Structured churn reason captured; exit remains easy and honest                  |
| TV2-20 | Reverse-trial experiment                                                     | parked  | —             | Stable tier-v2 baseline                 | Isolated cohort, cost, conversion, refund, and retention comparison             |
| TV2-21 | Genuine co-founder matching                                                  | parked  | —             | Demonstrated builder density and demand | Privacy, discovery, opt-in list, and contact journey exist                      |

## Current next action

Start **TV2-01**, then **TV2-02**. Do not begin the large dashboard or notification work first.

## Before starting a milestone

1. Confirm current branch is `claude/merge-subscriber-growth-branches`.
2. Read `docs/PROJECT_HANDOFF.md`.
3. Read the milestone’s relevant code, existing tests, `PRD.md`, and decisions.
4. Change the tracker row to `in progress`, add the owner/agent, and commit it with the first implementation change.
5. Enumerate the full state matrix before writing code.

## Before marking a milestone done

1. Validate the complete user journey, not merely a function call.
2. Run relevant tests and `npm run check`.
3. Update this tracker, `docs/PROJECT_HANDOFF.md`, and `docs/BACKLOG.md`.
4. Update `DECISIONS.md` if a material decision changed.
5. Add `CHANGELOG.md` only for implemented/shipped behaviour, not planning documents.
6. Push only the current feature branch.

## Known conflicts to avoid

- `src/constants.ts` still says 10/25/35 ideas. This is current implementation, not the target promise.
- Existing free analysis and evidence gates reflect the old model.
- Existing Stitch screens contain a locked second card and unsupported numerical examples.
- `Idea.founderFit` is a quality-triage field, not a user-skill match.
- Prediction snapshots do not constitute a public hit rate.
- The current generic digest is not personalization.
- The current co-founder toggle is not matching.
