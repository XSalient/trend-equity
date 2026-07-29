# Project Decisions

This file documents key architectural and product decisions for the Trend-Equity project. Committed to git so all team members and machines have access.

For ongoing context and details, see `CLAUDE.md` and the per-session memory system in `.claude/projects/J--Repositories-trend-equity/memory/`.

---

## Upgrades Bill Immediately, Downgrades Wait for the Period End — Adopted (2026-07-29)

**Decision:** a mid-cycle paid→paid plan change is asymmetric, and deliberately so.

- **Upgrade (pro → builder):** immediate. Stripe credits the unused days on the old plan, prices the new plan for those same days, charges the net difference on the spot, and unlocks the features now. The billing anchor does not move.
- **Downgrade (builder → pro):** scheduled for the period end. Nothing is charged or refunded; the user keeps the tier they paid for until it lapses, then the cheaper plan renews.

Both are properties of the **portal configuration** (`proration_behavior: always_invoice`, `schedule_at_period_end.conditions: [decreasing_item_amount]`), applied by `npm run stripe:configure-portal` — not of anything the app sends per-session.

**Rationale (TE-47):** the asymmetry follows from who is owed what. On an upgrade the user is asking for more and the money is owed now; making them wait for the next invoice means giving away the difference. On a downgrade they have already paid for the current period, and applying it immediately would revoke access they own — a refund-shaped problem we would then have to solve badly. Deferring costs nothing and is the honest reading of "I want to spend less _next_ month".

The lifecycle plan had specified `create_prorations`, which sounds like the middle ground and is in fact neither: it books the credit and charge onto the next invoice, so an upgrade takes no payment at switch time and the user gets the higher tier free until renewal. There is no configuration that makes both directions immediate and correct — the asymmetry is not a compromise.

**Corollary — a scheduled change is state the UI must show.** A period-end downgrade leaves the current price live and hangs the new one off a subscription schedule, so the subscription object alone reports no change at all. `pendingTier`/`pendingTierDate` are read from the schedule and written on every `customer.subscription.updated`, including as `null` — clearing them is how a reversal in the portal propagates. `tier` stays the current entitlement throughout; "what you can do now" and "what happens next" are separate fields, for the same reason entitlement and plan identity are (below).

---

## A Hand-Off to a Third Party Is Not a Completed Journey — Adopted (2026-07-29)

**Decision:** any control that hands the user to an external system states which screen they land on and what they see there. "Stripe handles it" is not an implementation. Concretely: `POST /api/portal` takes a `targetTier` and deep-links via `flow_data`; a bare session that opens the portal homepage is a fallback for when we cannot resolve the flow, never the plan.

**Rationale (TE-47):** the pro→builder branch was one line — `if (activePlan === 'pro') void openPortal()` — and it satisfied the only rule it was written against (never create a second Checkout for a live subscriber). It was reviewed as correct because that rule is genuinely the important one. But it dropped the user on a billing overview page with no indication of what they had just asked for, having pressed a button labelled "Upgrade now", and the portal itself was configured to do the wrong thing in both directions once they found the switcher. Every individual assertion in the code and in `docs/PAYMENTS.md` was true; the journey did not exist.

**Corollary — a routing hint is not a grant.** `targetTier` comes from the client, so it decides only which screen opens. The tier is re-read from Firestore server-side, the flow is discarded unless it describes a real transition from that tier, and every unresolvable case degrades to the portal homepage instead of erroring. This keeps the one rule intact: `users/{uid}.tier` is still written only by the webhook.

**Test corollary — assert the journey, not the call.** `portal.test.ts` asserted `sessions.create` was called with exactly `{customer, return_url}` and passed for the entire life of the defect; `PricingSection.test.tsx` asserted the Builder click reached `/api/portal` and never inspected the body. Both encoded "the call happens". A test that pins an incomplete behaviour is worse than no test, because it reports the gap as covered.

---

## Entitlement and Plan Identity Are Different Values — Adopted (2026-07-29)

**Decision:** `useTier().tier` answers "what may this visitor do" and is `'free'` for anonymous visitors. It must never be used to answer "what plan is this person on." Any UI that names, badges or claims a plan reads `hasAccount` alongside it and renders _no plan_ when there is no account.

```tsx
// entitlement — correct for anonymous visitors, unchanged everywhere
const isFree = tier === 'free';

// identity — nothing may claim a plan without an account
const activePlan = hasAccount ? tier : null;
```

**Rationale:** TE-44 shipped a pricing page telling logged-out visitors they were "on" the Free plan, because `useTier(null)` returns `'free'` and the pricing tab consumed it as `currentPlan`. `Header.tsx` had drawn its badge inside `{user && …}` from the start, so the same fact was rendered two contradictory ways. Collapsing the two meanings into one string makes that divergence the default outcome — each new plan-facing surface has to remember the guard, and the failure is silent when it doesn't.

Making `tier` nullable was the alternative and was rejected: it forces a null check into every `tier === 'free'` gate and `TIER_LIMITS[tier]` lookup for no behavioral gain, since anonymous visitors genuinely _should_ get free-tier limits. The narrow flag keeps the invasive change out of ~15 call sites.

**Corollary — a locked-out CTA is a lost signup.** The Free card's only control used to be a disabled `CURRENT PLAN` button, and the paid cards offered `UPGRADE NOW` into a Checkout that could only 401. Every plan a signed-out visitor can see must have a live CTA that starts sign-in, and the plan they picked is carried through the sign-in so the flow resumes rather than restarts. The resume is guarded on the freshly-read server tier still being `free` — the no-Checkout-for-live-subscribers rule above outranks the convenience.

**Dev note:** `?mockTier=` stands in for a signed-in member of that tier, so it sets `hasAccount: true`. `useTier` is the only place that knows the mock is active.

---

## "Tier Not Read Yet" Is a Third State, and Plan Actions Must Wait For It — Adopted (2026-07-29)

**Decision:** `useTier` exposes `tierLoading`, true between sign-in and the first Firestore snapshot. Every control that changes a plan — Checkout, portal hand-off, downgrade confirm, and the TE-44 post-sign-in resume — is inert while it is true. Feature gates keep reading `tier` and do **not** wait: rendering a free-tier feed for a moment is harmless, offering a subscriber a new subscription is not.

**Rationale (TE-45):** `tier` initialised to `'free'` while `hasAccount` flipped true immediately, so "signed in and genuinely on Free" and "signed in, tier unknown" were the same value. A Pro member landing on the pricing tab was therefore offered `UPGRADE NOW`, and the modal that opened was built for a free user. Defaulting the unknown state to the _least_ entitled value is right for gates and wrong for anything transactional — the two need different defaults, so the loading state has to be visible to callers.

---

## A Selection Must Be Clamped to What Is On Offer — Adopted (2026-07-29)

**Decision:** When a component both derives the set of valid options and holds the current selection, the selection is clamped at render (`options.includes(picked) ? picked : options[0] ?? null`) rather than synced by effect. A CTA may never name — or transact on — a value absent from the options it was rendered beside.

```tsx
const tierOptions = userTier === 'free' ? ['pro', 'builder'] : [];
const selectedTier = tierOptions.includes(picked) ? picked : (tierOptions[0] ?? null);
// selectedTier === null ⇒ no Checkout CTA exists to be wrong
```

**Rationale (TE-45):** `StripeCheckoutModal` derived `tierOptions` from `userTier` but kept an independent `useState('pro')`, and shipped a Builder-only card list under an "Upgrade to Pro" button that the API rejects. Clamping makes the broken combination unrepresentable; an effect that re-syncs state would still render one frame of it, and adds a second source of truth.

**Corollary — Checkout is free → paid only, so a subscriber is offered no tier at all.** The empty-options branch is not an error state to be avoided; it is the correct rendering for anyone with a live subscription, and it hands off to the Customer Portal (`docs/PAYMENTS.md`). The clicked plan is passed in as `initialTier` — a modal that recomputes the user's intent will eventually recompute it wrong.

---

## Account-Scoped State Must Be Cleared, Not Just Unsubscribed — Adopted (2026-07-29)

**Decision:** Any hook holding data scoped to `users/{uid}` clears that state at the **top of the effect body**, before the auth guard — not in the cleanup function, and not only in an `if (!user)` branch.

```ts
useEffect(() => {
  setUserSaves([]); // ← unconditional reset first
  if (!user) return; // ← then the guard
  const unsub = onSnapshot(q, ...);
  return () => unsub(); // ← cleanup detaches the listener; it does NOT clear data
}, [user]);
```

**Rationale:** TE-43 shipped a signed-out app still rendering the previous account's saved ideas. The effects all early-returned on `user === null`, which unsubscribes but leaves the delivered data in React state. Three properties make the reset-first form the right default:

1. **It covers the account switch, not just sign-out.** Firebase can go A → B without a `null` in between, so an `if (!user)` branch alone still leaks A's data into B's session.
2. **It's free on mount.** With a module-level `DEFAULT_FILTERS` constant used as both the `useState` initial value and the reset value, the first call is an `Object.is` bail-out — no extra render.
3. **The failure is silent.** Nothing errors; the wrong data just renders. The blast radius went past display: account A's filters were written into account B's user document by the debounced save effect.

**Non-goal:** this is not a security boundary. Firestore rules correctly authorized every one of those reads at the time they happened, and rules cannot express "forget what you already read." Client state lifetime is the only place this can be fixed.

**Corollary — tier-gated views:** losing an entitlement must drop the gated **payload**, not just hide the tab button. `activeTab` falls back to the daily feed when the tier no longer permits it, and `weeklyRadar` / `futurecasting` / `weeklyBest` / `customFeed` are cleared on the downgrade.

**Reference implementations:** `useAlerts.ts` and `useTier.ts` already did this before TE-43 — the bug was inconsistency across hooks, which is exactly the argument for finishing [TE-10](docs/BACKLOG.md) (splitting `useIdeas.ts`).

---

## Free-Tier Value Ladder — Adopted (2026-07-10)

**Decision:** Restructure tier boundaries so each tier has one clear job: **Free = discover** (see that real, scored opportunities exist), **Pro = evaluate** (get the full diligence picture), **Builder = execute** (get the build/validate/track machinery). The 2026-07-08 audit showed Free currently receives _more_ than the PRD promises in four places — those giveaways are reclaimed as Pro value rather than inventing new restrictions.

**The ladder (target state):**

| Capability                        | Free (discover)                                                   | Pro (evaluate)                                                          | Builder (execute)      |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| Daily ideas                       | 10                                                                | 25                                                                      | 35                     |
| Idea card content                 | Headline, pitch, score, category, VC justification, trend sources | + Unfair advantage, revenue model, market size, competitors, regulatory | same as Pro            |
| Market Evidence (search-grounded) | ❌ locked teaser                                                  | ✅                                                                      | ✅                     |
| Next steps                        | 3                                                                 | 7                                                                       | Full 10+ roadmap suite |
| Saves                             | 5                                                                 | Unlimited                                                               | Unlimited              |
| Export                            | PDF only                                                          | + CSV, Notion/GDocs                                                     | + CSV, Notion/GDocs    |
| Comments                          | Read-only                                                         | Post                                                                    | Post (priority later)  |
| Reactions (👍👎🔨)                | ✅ kept free                                                      | ✅                                                                      | ✅                     |

**Rationale per change:**

1. **Full VC analysis → Pro (TE-22).** PRD always promised Free "Basic VC Analysis"; code ships the full block to everyone. Gating unfair advantage / revenue model / market dynamics behind a _visible locked section_ is the single strongest daily upsell surface — Free users see exactly what they're missing on every card.
2. **Market Evidence → Pro (TE-23).** It's the most expensive feature per call (two-step Google-grounded generation) and the core "opportunity intelligence" differentiator, currently free to every signed-in user. Free keeps a locked "Evidence" button as the teaser.
3. **CSV export → Pro (TE-24).** PRD promised Free PDF-only; CSV bulk export is an analyst/power-user feature that belongs with paying tiers.
4. **Pro next-steps capped at 7 (TE-25).** The unused `roadmapSteps` constant (3/7/10) finally gets enforced, restoring the 3 → 7 → full-roadmap progression that makes Builder's roadmap suite feel like a real step up.
5. **Comments: Free read-only (TE-26).** Matches the PRD community ladder; posting becomes a Pro perk. Reactions stay free for all — they feed the prompt optimizer and we want maximum signal volume.

**Deliberately NOT limited:** daily feed access (top-of-funnel), reactions (training signal), PDF export (shareability = marketing), the 10-idea count (already decided), saves-count semantics (5 concurrent stays; renaming to "5 saved ideas" in copy is part of TE-21).

**Considered and parked — time-delayed free feed** (Pro sees today's feed at publish, Free at noon): strong perceived-value lever but complicates the singleton daily doc, hurts top-of-funnel first impressions, and is hard to message honestly. Revisit only if post-Stripe conversion data shows the current ladder isn't converting.

**Sequencing constraint:** every gate here is _fake_ until TE-12 (Firestore rules) and TE-13 (server-side tier guards) land — a console user can bypass any client gate today. TE-23/24/25/26 must ride on or after TE-13; TE-22 is content-display gating (data is in a shared doc) and is honest client-side gating only after TE-12 stops free users from reading everything anyway.

---

## TE-01 / TE-02 Shipped — P0 Cost & Abuse Hardening (2026-07-08)

**Decision:** Ship both P0 items from the remediation plan together, same day: (1) daily generation triggerable only by signed-in users for today's date, cached reads unaffected; (2) per-IP daily cap moved from an in-memory `Map` to a Firestore transaction (`checkAndIncrementIpLimit`, hashed IPs, same check-before-increment pattern as `usage.ts`).

**Finding during implementation:** the old `checkIpRateLimit` function in `api/_handlers/daily.ts` was defined but never called — confirmed via ESLint's `no-unused-vars` warning and a repo-wide grep. The daily generation endpoint had **zero** IP-based abuse protection in production before this fix, not merely a weak per-instance one as originally assessed in the 2026-07-08 audit.

**Design call — IP limit skipped on admin refresh:** the per-IP cap only applies to the initial (non-refresh) generation trigger. Refresh is already gated to admins, a small trusted set; capping it too would risk an admin locking themselves out during legitimate same-day re-runs for no abuse-prevention benefit.

**Status:** Shipped, TDD (9 new tests across `tests/unit/api/daily.test.ts` and `tests/unit/lib/usage.test.ts`), full suite green (290/290), `npm run check` clean (0 errors).

---

## Project Tracking System — Adopted (2026-07-08)

**Decision:** All work items, decisions, and shipped changes are tracked in-repo so every developer and every AI agent on every machine sees the same state.

**The system:**

| File                       | Holds                                                      | Update when                         |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `docs/BACKLOG.md`          | All tasks with `TE-NN` ids, statuses, owners, user stories | Starting or finishing any work item |
| `CHANGELOG.md`             | What shipped, when, with commit hashes                     | Same commit that ships a change     |
| `DECISIONS.md` (this file) | Product/architecture decisions + rationale                 | The moment a decision is made       |
| `PRD.md`                   | What the product is (tiers, features)                      | Feature scope changes               |
| `docs/superpowers/plans/`  | Detailed implementation plans for large tasks              | Before executing L-effort tasks     |
| `CLAUDE.md`                | How to work in this codebase (canonical agent guide)       | Architecture reality changes        |

**Rationale:** Context previously lived in per-machine AI memory files, stale CLAUDE.md sections, and individual developers' heads — causing exactly the "unaware of already-made changes" confusion this replaces. Git is the only store all machines share.

**Rule:** `AGENTS.md` is a pointer to `CLAUDE.md`, never a copy — one canonical agent guide, zero drift.

---

## App-Store Signal Mining — Deferred (2026-07-08)

**Decision:** Do not add Google Play / iOS App Store signals to the generation pipeline now.

**Rationale:**

- Neither store has an official API for market-research access; community scrapers are brittle, rate-limited, and ToS-gray — high maintenance for a solo project.
- App-store data is a **lagging** indicator (reflects markets formed 1–2 years ago), weak for trend discovery, which is the core promise. The live pipeline already covers leading indicators (Google Trends, Product Hunt, Reddit, HN, TechCrunch via `api/_lib/signals.ts`).
- Vercel Hobby constraints (function count, no durable workers) make ingestion pipelines awkward.

**Salvageable piece (post-Stripe):** app-store review mining as per-idea _validation_ evidence ("underserved incumbents with bad reviews"), attached to the evidence layer — not as a discovery source.

---

## Pain-Point Remediation Plan — Adopted (2026-07-08)

**Decision:** Adopt the 10-task remediation backlog from the 2026-07-08 audit (`docs/superpowers/plans/2026-07-08-pain-point-remediation.md`), sequenced P0 → P3.

**Priorities and rationale:**

- **P0 — cost/abuse (TE-01…03):** the daily generation endpoint is triggerable anonymously for arbitrary client-supplied dates, and the in-memory IP limit doesn't survive serverless instances. Direct Gemini-spend exposure; fix first.
- **P1 — signal trust (TE-04…07):** signal fetching degrades silently and idea→signal citations are unverified, so the "grounded in live signals" differentiator is currently unprovable. Observability before fixes; verification is flag-only for 2 weeks before any dropping (measure-first).
- **P2 — business proof (TE-08, TE-09):** Stripe + minimal analytics. Stripe webhook is the **sole** writer of `users/{uid}.tier`. Monthly Pro/Builder only at launch — no annual, trials, or coupons.
- **P3 — code health (TE-10, TE-11):** `useIdeas.ts` split, repo cleanup.

**Explicitly not in scope:** app-store signals, multi-signal expansion, personalization — all gated on Stripe evidence per the positioning strategy below.

---

## Growth Guides Feature — Parked (2026-07-08)

**Decision:** Do not implement business-growth guides or integrations with acquire.com / trustmrr.com.

**Rationale:**

- **Audience mismatch:** acquire.com and TrustMRR serve founders with revenue-stage businesses. Trend-Equity users are at the idea stage and would have left the app before reaching that stage.
- **No real integration:** Neither platform has a usable public API. "Integration" would degrade into static link-outs and commodity AI-generated guides.
- **Strategic conflict:** Positioning decision is to differentiate on opportunity intelligence and defer expansion until Stripe proves willingness to pay. Stripe has not yet shipped.
- **Surface redundancy:** Builder tier already ships four AI packs per idea (validation toolkit, roadmap, build pack, progress tracker). Adding a fifth would dilute focus.

**Salvageable piece (Wave 2, post-Stripe):**
If the Wave 2 evidence layer is prioritized, consider adding a single AI-estimated "exit signal" line to idea analysis — comparable exit ranges by niche (acquire.com-style multiples). Must be clearly labeled as an estimate.

---

## Vercel Hobby Function Limit (2026-07-02)

**Decision:** Consolidate `/api/generate/*` endpoints into a single catch-all function to stay under the 12-function Vercel Hobby plan limit.

**Status:** Implemented. See commit 85ab8dc ("Fix 405 on /api/generate/\* by dropping bracket dynamic-segment routing") and 210be12 ("Consolidate api/generate endpoints into a single catch-all function").

**Pattern:** New generation endpoints are added as handler files in `api/_handlers/` with a map entry in `api/generate/dispatch.ts`, never as top-level `api/**/*.ts` files.

---

## Quality Engine Wave 1 — Shipped (2026-07-02)

**Decision:** Ship critic pipeline, semantic deduplication, and analytics in Wave 1. Defer personalization and evidence layer to Wave 2.

**Status:** Complete. See commits 44ec85c–5608d81.

**Wave 2 scope:** Evidence layer (exit signals, comparable comps), personalization (user signals, favorite sectors), Stripe billing integration.

---

## Custom Idea Feature — Deployed (Pro/Builder)

**Decision:** Implement custom idea analysis on Pro and Builder tiers with monthly quotas, "My Latest Idea" slot, and 3-section Saved Ideas tab.

**Status:** Deployed. Configuration stored in Firestore; admin config via internal tools.

**Key pattern:** `updateIdea()` must sync every idea list (feed, saves, latest). Never wire `onClick={handler}` for `(refresh?: boolean)` handlers — use explicit wrapper functions instead.

---

## Custom Requirement Feed — Deployed (Builder)

**Decision:** Implement a custom requirement feed feature for Builder tier with 1 generation per 24 hours, server-side caching, and peek/restore flow.

**Status:** Deployed.

**Key pattern:** Server caches AI results for 24 hours. Peek lets users review without consuming the 24h cache. Restore requires explicit confirmation.

---

## TE-15: Anonymous Enterprise Lead Capture — Deployed (2026-07-21)

**Decision:** Accept anonymous enterprise lead submissions via a serverless endpoint instead of direct Firestore writes (which fail the TE-12 security rules for unauthenticated users).

**Implementation:**

- New endpoint: `POST /api/enterprise-lead` (standalone serverless function, not part of `/api/generate/*` dispatch)
- Validates required fields: `firstName`, `email`, `company`, `role`; optional `lastName`, `message`
- Rate limiting: 5 submissions per IP per hour (Firestore-backed via `api_usage` collection)
- Writes to `enterprise_leads` collection with server credentials (Admin SDK bypasses rules)
- Adds server metadata: `createdAt`, `source: 'enterprise_landing'`, IP hash
- Frontend (`EnterpriseLanding.tsx`): removed forced authentication flow, now calls serverless endpoint

**Why not external services (StaticForms)?** Retains data ownership (Firestore, not third-party), enables future integrations (CRM sync, automation), and simplifies the data model. A serverless endpoint is zero-cost under Vercel's Hobby plan and keeps the lead pipeline internal.

**Rules:** Firestore rules unchanged — `enterprise_leads` collection still shows `allow create: if request.auth != null` (client-side restriction), but Admin SDK writes bypass this. The rule prevents accidental client-side writes while allowing the server-side handler to work.

**Testing:** Rate-limit transaction pattern tested via analogous `checkAndIncrementIpLimit` in `api/_lib/usage.ts`; handler tested locally before deploy.

---

## Agent & Generation Pipeline Performance Epic — Planned (2026-07-21)

**Decision:** Adopt a 6-story performance optimization epic (TE-32 through TE-37) targeting 50% reduction in agent story completion time (30 min → 15 min).

**Root causes (ranked by impact):**

1. Sequential backend AI operations (5–6s waste) — Promise.all for parallel pre-fetches (TE-32)
2. Redundant discovery per session (3–4 min waste) — Pre-load memory manifest of hot files (TE-34)
3. Serialized post-story workflow (2 min waste) — Merge docs+code updates into single session (TE-33)
4. Manual deployment verification (2 min waste) — Smoke-test suite for auto-verify (TE-35)
5. Sequential test execution (2–3 min waste) — Shard E2E tests, enable Vitest threading (TE-36, TE-37)

**Impact projection:** 10–15 min savings per story.

**Rollout:** Two phases. Week 1: TE-32/33/34 (high ROI, ~7–9 min saved). Week 2: TE-35/36/37 (test infrastructure, ~2–3 min saved, amortized over many stories).

**Rationale:** Agent velocity directly impacts project iteration speed. With 15+ stories remaining before Wave 2 (Stripe + evidence layer) ships, even a 2 min/story improvement compounds to 30+ hours saved over the roadmap. TE-32 (backend parallelization) is a quality improvement regardless; TE-34 (memory manifest) reduces cognitive load for all agentic work; TE-33 (workflow merge) removes friction.

**Out of scope:** Code generation, prompt-engineering optimizations, model upgrades (these are Wave 2 priorities).

**Detailed plan:** [`docs/superpowers/plans/2026-07-21-agent-performance-optimization.md`](docs/superpowers/plans/2026-07-21-agent-performance-optimization.md)

---

## Positioning Strategy — Active

**Decision:** Reposition Trend-Equity as an "opportunity intelligence platform" (not just an idea feed). Log prediction accuracy early as evidence of value.

**Status:** In progress. Defer multi-signal ML pipeline until Stripe proves customers will pay for premium intelligence features.

**Next phase:** Stripe integration (Wave 2).

---

## TE-08: Stripe Monetization — Phase 1 In Progress (2026-07-23)

**Decision:** Implement Stripe checkout flow as sole tier writer. Phase 1 delivers checkout + webhook foundation. Phase 2 adds subscription expiry downgrade logic.

**Architecture:**

- **Checkout endpoint** (`/api/checkout.ts`): Authenticated users (free/pro) request checkout session → Stripe creates session → return URL → redirect to Stripe checkout page
- **Webhook** (`/api/webhook/stripe.ts`): Stripe posts `checkout.session.completed` event → verify signature → atomic Firestore transaction: `users/{uid}.tier = pro|builder`, `proEndDate = now + 30 days`
- **UI** (`StripeCheckoutModal`): Modal shows pricing side-by-side → user selects tier → clicks button → checkout handler → redirect to Stripe
- **Security**: Firebase token required on checkout endpoint; Stripe signature verification on webhook; Firestore transaction ensures single tier write per session

**Pricing:** Pro $9/month, Builder $19/month (recurring). Must configure Stripe price IDs in .env before deploying.

**Phase 1 (Shipped 2026-07-23):**

- Checkout endpoint (create session, return URL, rate limiting)
- Webhook handler (event processing, atomic tier updates)
- StripeCheckoutModal component (pricing display, checkout trigger)
- PricingSection integration (replace waitlist with checkout)
- Unit tests (7 checkout, 4 webhook scenarios)

**Phase 2 (Planned):**

- Subscription expiry: cron/endpoint to downgrade `proEndDate < now` → tier = free
- Refund handling: webhook listener for charge disputes
- Subscription management: allow users to cancel/upgrade within app

**Vercel Functions:** 8 total (safe under 12-function Hobby limit). Added: checkout + webhook/stripe.

**Required Setup (before deploy):**

1. Create Stripe products: Pro ($9/mo), Builder ($19/mo)
2. Set env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_BUILDER, STRIPE_WEBHOOK_SECRET
3. Register webhook endpoint in Stripe Dashboard (checkout.session.completed event)

**Testing:**

- Local: Use Stripe test keys, test card 4242 4242 4242 4242
- Stripe CLI: `stripe listen --forward-to localhost:3001/api/webhook/stripe` for local webhook testing

---

## TE-08: Provisioning is idempotent and dual-path (2026-07-28)

**Context:** Phase 1 shipped with the webhook as the sole tier writer. In practice the webhook could not work — its signature check ran against a body that had already been consumed — and no webhook endpoint was registered, so no payment ever granted a tier.

**Decision:** Keep the webhook as the source of truth, but add a second provisioning path: `GET /api/checkout?session_id=…`, called when the user returns from Stripe. Both paths call one function, `provisionSubscription()`, which dedups on the Stripe session id.

**Rationale:**

- Checkout works before a webhook endpoint exists — important for sandbox testing and for the first production deploy.
- The return path gives immediate UI feedback; the webhook covers users who close the tab, plus renewals and cancellations.
- A single idempotent writer means the two paths racing is a no-op, not a double grant.

**Security:** The verify path retrieves the session from Stripe and requires `session.metadata.uid === authCtx.uid`, so a leaked session id cannot be redeemed by another account. Tier is still never read from the client.

**Consequences:** `stripe_transactions/{sessionId}` is now the idempotency ledger (previously `{uid}_{timestamp}`, which could not dedup). Tier writes use `set(merge: true)` so a user with no Firestore document can still be upgraded.

**Rejected:** trusting the `?checkout=success` query parameter alone — it is client-controlled and would let anyone self-upgrade.

---

## TE-08 Phase 2: Subscription Lifecycle Architecture — Adopted (2026-07-29)

**Context:** A lifecycle audit (triggered by a live bug: a "downgraded" Builder test user got `"User already has this tier or higher"` on re-upgrade) found the root cause plus five architectural gaps. Root cause: `handleDowngrade` in `useTier.ts` was client-side-only `setTier()` — Firestore still said `builder`, and the server correctly blocked the checkout. Gaps: no real cancel/downgrade path; paid↔paid switches broken (Builder→Pro hard-blocked, Pro→Builder would create a second subscription and double-bill); `proEndDate` written but never enforced or displayed; `proEndDate` always "now + 30d" instead of Stripe's real period end; `invoice.payment_failed` / `customer.subscription.updated` unhandled.

**Decisions:**

1. **Client tier mutation is deleted, permanently.** `handleUpgrade` / `handleDowngrade` / `upgradeToBuilder` are removed from `useTier`. Tier flows one way: Stripe → server → Firestore → `onSnapshot` → UI. This extends TE-14's rule (no fake upgrades) to downgrades.
2. **Stripe Customer Portal is the only cancel / plan-switch / billing-management surface** (`POST /api/portal`, 9th Vercel function, budget 9/12). We do not rebuild invoices, card forms, or cancel dialogs in-app. Checkout is only for free → paid; a live subscriber hitting checkout gets a 409 + portal redirect (prevents double subscriptions).
3. **Downgrades take effect at period end, never immediately.** Portal cancel sets `cancel_at_period_end`; the user keeps what they paid for until `proEndDate` (anchored to the subscription start date); `customer.subscription.deleted` then triggers `downgradeToFree()`. `customer.subscription.updated` mirrors `cancelAtPeriodEnd`/status/plan-switches onto the user doc but never writes `tier: 'free'`.
4. **Failed renewals warn, they don't revoke.** `invoice.payment_failed` → `subscriptionStatus: 'past_due'` + a `user_alerts` doc (dedup on invoice id). Stripe dunning gets its chance; access ends via deletion or the backstop.
5. **`proEndDate` + 3-day grace is enforced in `getAuthContext`** as the missed-webhook backstop — no cron (both Vercel Hobby cron slots are already taken by generation + digest; the auth path reads the user doc anyway, so the check is free). Manual admin grants (no `proEndDate`) never expire.
6. **`stripe_transactions` is the internal audit ledger, not the user-facing history.** Checkout rows (id = session id, `type: 'checkout'`) and renewal rows (id = invoice id, `type: 'renewal'`); doc ids double as idempotency keys. Users see invoices/receipts in the portal.
7. **Provisioning uses Stripe's real `current_period_end`** (retrieved from the subscription at checkout time) instead of the hardcoded 30-day fallback.

**Rejected:** custom in-app billing UI (portal does it better, for free); a cron-based expiry sweep (no cron slots; per-request check is sufficient); immediate downgrades or refund-on-cancel (industry norm is period-end); handling refund/dispute webhooks now (deferred until there are real customers — manual dashboard handling suffices).

**Docs:** canonical lifecycle reference in [`docs/PAYMENTS.md`](docs/PAYMENTS.md); implementation plan in [`docs/superpowers/plans/2026-07-29-stripe-subscription-lifecycle.md`](docs/superpowers/plans/2026-07-29-stripe-subscription-lifecycle.md); stories TE-38…TE-42 in the backlog (supersede the old TE-08b placeholder).

**Implementation notes (2026-07-29, shipped).** All seven points above shipped as designed. Four things surfaced during implementation that the plan did not anticipate:

1. **Firestore rules were a bigger hole than the plan assumed.** The plan's Task 10 only asked us to _confirm_ billing fields were unwritable. They were not: the TE-12 allowlist covered `tier`/`role`/`apiAccess` but none of the six billing fields. A client-writable `proEndDate` would have defeated the TE-41 backstop outright, and a client-writable `stripeCustomerId` would have let any user open another customer's billing portal through `POST /api/portal`. Both are now denied.
2. **The rules test suite had never executed.** `describe.skipIf(!testEnv)` is evaluated at collection time, before `beforeEach` assigns `testEnv`, so all 79 tests always skipped — which is why the gap above went unnoticed since TE-12. Rule: **never gate `skipIf` on a variable assigned in a hook**; gate on the environment (`FIRESTORE_EMULATOR_HOST`).
3. **`diff` is a method, not a property.** `request.resource.data.diff.delta` raised an evaluation error on every update. In `users/` it failed closed (denying safe-field updates too), but in `user_alerts/` it meant no user could ever mark an alert as read — which would have silently broken the TE-40 payment-failure alert we were shipping in the same phase. Correct form: `diff(resource.data).affectedKeys()`.
4. **The unit test runner was broken.** `npm run test:unit` passed `--workers=4`, which does not exist in Vitest 2, so the command had been failing immediately; the default `forks` pool additionally hangs on Node 25. Fixed with `--pool=threads`. Worth noting because it means the pre-existing 13 `daily.test.ts` failures had gone unobserved.

**Still open:** the live Stripe sandbox run (plan Task 10 Step 2). Test keys are in `.env` and the endpoints smoke-test correctly locally, but the portal → `subscription.updated` → tier-change loop has only been verified via unit tests. The Stripe dashboard also needs the Customer Portal configured (period-end cancellation, plan switching across both prices) and the webhook subscribed to `customer.subscription.updated` + `invoice.payment_failed`.
