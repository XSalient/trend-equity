# UI, Feature & Tier-Promise Audit — 2026-07-08

Full sweep of every tab, button, expand/collapse, hidden/shown state, link, and tier-gated promise, cross-referenced against PRD.md, the pricing page, and the actual server-side enforcement. Read-only audit — no code was changed.

**Scope reviewed:** all of `src/` (App shell, Header, 6 tabs, IdeaCard + 8 sub-components, 4 toolkit sections, FilterBar, PricingSection, 3 modals, AlertsPanel, IdeaComments, EnterpriseLanding, all 15 hooks/services), `api/` (all 12 handlers + admin + track + usage), `firestore.rules`, `vercel.json`, PRD.md.

**Severity legend:** 🔴 Critical (security/revenue/broken promise) · 🟠 Major (broken flow or misleading UX) · 🟡 Minor (polish, drift, dead UI)

---

## 1. Critical findings (🔴)

### 1.1 Firestore rules are wide open — any signed-in user can write anything

[firestore.rules](../../firestore.rules) is a single dev-mode rule: `allow read, write: if request.auth != null` on `/{document=**}`, with a `TODO: Tighten before production`. Consequences for any signed-in user (browser console is enough):

- **Self-upgrade to Builder, permanently:** write `users/{uid}.tier = 'builder'`. The server (`auth.ts`) trusts this field, so every paid server feature unlocks. This defeats the entire "server never trusts client tier" design — the client can't _send_ tier, but it can _write_ it.
- **Reset own quotas:** delete/edit own `api_usage` docs → unlimited AI calls.
- **Tamper with the product itself:** write to `daily_generations` (change everyone's feed), `app_config/tier_limits` (change tier quotas globally), `config`/`prompt_history` (poison the self-learning prompt loop), `weeklyBest`, other users' `user_saves`, `user_alerts`, `comments` (edit/delete anyone's), `te100_submissions` (self-approve fields), `api_keys`.
- Code comments in `useTier.ts` claim "client-side Firestore write is blocked by updated security rules" — **false**; nothing is blocked.

**This is the single highest-priority fix in the project.** Per-collection rules: user-owned docs writable only by owner and only safe fields; server-only collections (generations, config, usage, predictions, keys) client-read-only or no client access.

### 1.2 Paid AI features have no server-side tier gate — and most accept anonymous callers

Only 2 of 12 generate endpoints check tier (`analyze-idea`, `custom-feed`). Confirmed by reading every handler:

| Endpoint                          | Promised tier   | Server tier check      | Anonymous allowed? | Quota if anonymous |
| --------------------------------- | --------------- | ---------------------- | ------------------ | ------------------ |
| `vetting` (Expert Vetting)        | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `build-me` (Build with Me)        | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `action-plan` (10+ step roadmap)  | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `radar` (Weekly Trend Radar)      | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `futurecasting`                   | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `validation` (Validation Toolkit) | Pro+            | ❌ none                | ✅ yes             | ❌ none            |
| `explain` (VC Deep Dive)          | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `alerts`                          | Builder         | ❌ none                | ✅ yes             | ❌ none            |
| `evidence`                        | (all signed-in) | n/a                    | ❌ 401             | n/a                |
| `analyze-idea`                    | Pro+            | ✅ 403 for free        | ❌ 401             | n/a                |
| `custom-feed`                     | Pro+            | ✅ 403 for free        | ❌ 401             | n/a                |
| `daily`                           | n/a             | ✅ (TE-01, 2026-07-08) | cached reads only  | n/a                |

Two distinct holes: (a) **entitlement** — a free user (or curl script) gets every Builder feature by calling the endpoint directly; the only gate is hidden buttons in the UI; (b) **cost** — `checkAndIncrementUsage` runs only `if (uid)`, so unauthenticated callers skip quotas entirely on 8 AI endpoints. Daily-per-feature caching softens repeat costs for shared cache keys (radar), but per-idea endpoints (vetting/build/plan) cache per idea id — an attacker just varies the id.

**Fix pattern:** require auth on all generate endpoints; add a `requireTier(authCtx, 'builder' | 'pro')` guard matching the promise table in §3.

### 1.3 "Upgrade" takes no payment and silently reverts — fake tier changes

The pricing page shows $9/mo and $19/mo with working UPGRADE buttons, but `useTier.handleUpgrade` just flips local React state and toasts _"Reload will revert until payment is connected."_ No Stripe (tracked as TE-08). Two resulting broken experiences:

- A free user clicks UPGRADE TO PRO → UI shows Pro everywhere → server still sees `free` → custom feed and analyze-idea return 403 ("Pro plan required") while the header says PRO. The app contradicts itself.
- `upgradeToBuilder` toasts "Builder tier unlocked for this session" — a claim of a purchase that never happened.

Until Stripe ships, upgrade buttons should lead to a waitlist/contact state, not simulate a tier change.

### 1.4 Enterprise lead capture is broken for its entire audience

[EnterpriseLanding.tsx:130](../../src/pages/EnterpriseLanding.tsx) writes leads via client `addDoc(collection(db,'enterprise_leads'))`. The rules require `request.auth != null` — but `/enterprise` visitors (VCs, corp-dev teams) are **not signed in**. Every anonymous lead submission fails with permission-denied. The B2B funnel promised in PRD §4.8 captures nothing from logged-out visitors. Fix: route through a serverless endpoint (Admin SDK write), or explicitly allow create-only on that collection.

### 1.5 Logged-out visitors see an empty app

`useIdeas.fetchDaily` reads `daily_generations/{today}` directly from Firestore on the client; rules deny anonymous reads (docs don't set `public == true`). A logged-out visitor gets "Failed to load today's ideas" / eternal "Curation in Progress" — there is no anonymous preview of the product at all, while the UI (save tooltips, sign-in prompts on reactions) is clearly designed for browsing-then-signing-up. Either mark the daily doc readable (`public: true` + rules path) or serve reads via the API.

---

## 2. Major findings (🟠)

### 2.1 No automated daily generation — the product's core loop depends on a human

Nothing schedules the daily feed. The only cron (`vercel.json`) fires `/api/admin` at 07:00 UTC for the **email digest**, which reads today's `daily_generations` — a doc that only exists if an admin manually pressed "Trigger Generation" before 07:00. Miss it and: no feed for anyone + digest sends "No ideas available". Add a generation cron (before the digest cron) or trigger generation inside the digest cron when the doc is missing.

### 2.2 Alerts: AI-generated for every user, shown only to Builder

- `useAlerts` runs for **every signed-in user** and, when the user has no alerts, silently calls the `alerts` AI endpoint and writes generated alerts — but the bell icon is Builder-only (`Header.tsx`). Free/Pro users pay the AI cost for alerts they can never open.
- The alerts themselves are Gemini-invented "notifications", not the PRD-promised "system updates, trend shifts, or community replies". The feature is a simulation of notifications.

### 2.3 Email digest: half-real, promises oversold

- The **daily** digest genuinely works (Resend + cron in `api/admin.ts`) — PRD's "backend delivery in development" is stale.
- The **Weekly Trend Radar** toggle in the Digest tab ("Every Sunday at 6:00 PM") saves `radarOn` that no code reads. Promised, configurable, never delivered.
- The digest cron doesn't filter recipients by tier — anyone who gets a `user_digest_prefs` doc written (open rules!) receives the "Pro" digest.
- `EmailDigestTab.handleSave` has `try/finally` with no `catch` — a rules failure becomes an unhandled rejection with no user feedback.

### 2.4 Dead / broken interactive elements

| Element                            | Location                                                                 | Problem                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Upgrade for more features" button | [IdeaCardToolkit.tsx:211](../../src/components/IdeaCardToolkit.tsx)      | **No onClick** — does nothing for every Free/Pro user on every card                                                                                                                                     |
| "Upgrade Now" teaser button        | [FilterBar.tsx:620](../../src/components/FilterBar.tsx)                  | **No onClick** — dead button in the free-tier filters teaser                                                                                                                                            |
| Privacy / Terms / Contact links    | [App.tsx:502-510](../../src/App.tsx)                                     | `href="#"` — dead links; no legal pages exist (a real compliance gap once payments launch)                                                                                                              |
| Export dropdown on idea cards      | [IdeaCardHeader.tsx:49-84](../../src/components/idea/IdeaCardHeader.tsx) | Opens on **hover only** (`group-hover`), trigger button has no onClick — unusable on touch devices despite "Mobile-First & Native (Capacitor)" being a PRD pillar                                       |
| Comment timestamps                 | [IdeaComments.tsx:109](../../src/components/idea/IdeaComments.tsx)       | Every comment shows literal "JUST NOW" forever (no relative-time rendering)                                                                                                                             |
| "Find co-founder" button           | [IdeaCard.tsx:441](../../src/components/IdeaCard.tsx)                    | Toggles a local flag only; no matching, no persistence for unsaved ideas, visible to all tiers though the pricing page sells it as a Builder feature; PRD lists co-founder matching as _future roadmap_ |

### 2.5 Tailwind dynamic class names won't compile

[PricingSection.tsx:363,370](../../src/components/PricingSection.tsx) builds class names at runtime: `text-${showcaseColor}-500/70` and `md:grid-cols-${n}`. Tailwind v4 statically scans source for literal class names — these are never generated, so the showcase heading color and the responsive grid columns silently don't apply. Replace with a literal class lookup map.

### 2.6 `updateIdea` doesn't sync the Weekly Best list

`useIdeas.updateIdea` syncs saves, the daily feed, and the custom feed — but **not** `weeklyBest` state (owned by a different hook). Generating vetting/evidence/roadmap on a Weekly Best card updates nothing visible unless the idea is also saved; the result appears lost. This is the exact bug class the repo's own memory note warns about ("updateIdea must sync every idea list").

### 2.7 Sticky FilterBar collides with sticky Header

Header is `sticky top-0 z-50 h-16`; FilterBar is `sticky top-0 z-40`. When scrolled, the FilterBar pins underneath the header (same top offset, lower z-index) and is obscured. FilterBar should pin at `top-16`.

---

## 3. Tier promises vs. reality (the careful audit)

Sources of promises: PRD §3 table, PricingSection cards/showcase, FilterBar copy, README tier table. "Server" = enforced server-side; "Client" = only hidden/disabled in UI.

| Promise                                                               | Free | Pro | Builder | Reality & gaps                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | ---- | --- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily ideas 10/25/35                                                  | ✅   | ✅  | ✅      | Client-side slice only (`IdeaFeed` `.slice(0, TIER_LIMITS[tier].dailyIdeas)`); full 35 ideas are in the Firestore doc and localStorage cache any user can read. Acceptable UX gate, but not a real one.                                                                    |
| Saves: 5/month (Free), unlimited (Pro+)                               | ⚠️   | ✅  | ✅      | Client check only, and it's **5 concurrent, not 5 per month** — deleting a save frees a slot; no monthly reset exists. Rules don't enforce any limit. Semantics mismatch with pricing copy.                                                                                |
| Custom Idea Analysis 0/5/20 per month                                 | ✅   | ✅  | ✅      | **Properly enforced server-side** (403 free, monthly transaction quota, Firestore-configurable). Model implementation — the pattern the other endpoints should copy.                                                                                                       |
| Custom Requirement Feed (locked/keyword/NL)                           | ✅   | ✅  | ✅      | **Properly enforced server-side** (403 free, 24 h cache, pro keyword normalization). UI lock/peek/restore all work.                                                                                                                                                        |
| Exporting: PDF (Free) / +Notion/GDocs (Pro+)                          | ⚠️   | ✅  | ✅      | Client-gated menu correct — but list-level **CSV export is available to Free** via FilterBar while PRD grants Free "PDF Pitch Deck" only. Free gets more than promised (deliberate?). Clipboard exports use blocking `alert()` for success/failure.                        |
| Analysis: "Basic" (Free) vs "Full VC" (Pro+)                          | ⚠️   | ✅  | ✅      | **No basic/full distinction exists.** Every tier sees the complete VC analysis (justification, unfair advantage, revenue model, market size, competitors, regulatory, trend sources). Free receives more than promised — an intentional-looking but undocumented giveaway. |
| Next Steps: 3 / 7 / 10+                                               | ✅   | ⚠️  | ⚠️      | Free correctly sliced to 3. **Pro gets ALL steps, not 7** — `TIER_LIMITS.roadmapSteps` (3/7/10) is defined and never used anywhere. Builder's "10+ roadmap" is the separate Full Action Plan (works, Builder-only in UI, but see §1.2 for server gap).                     |
| Weekly Best (Pro+)                                                    | ✅   | ✅  | ✅      | Tab hidden for free; hook refuses free. But it's a **client-side aggregation** of last 7 days' `daily_generations` — any authed free user can read those docs directly (open rules). Note: the documented `weeklyBest/**` collection is unused; docs drift.                |
| Weekly Trend Radar (Builder)                                          | ✅   | ✅  | ⚠️      | UI tab Builder-only ✅; server endpoint ungated ❌ (§1.2).                                                                                                                                                                                                                 |
| Futurecasting (Builder)                                               | ✅   | ✅  | ⚠️      | Same as Radar.                                                                                                                                                                                                                                                             |
| Email Digest (Pro+)                                                   | ✅   | ⚠️  | ⚠️      | Daily digest real; weekly radar digest is a dead toggle; no tier check at send time (§2.3).                                                                                                                                                                                |
| Expert Vetting (Builder)                                              | ✅   | ✅  | ⚠️      | UI Builder-only ✅; server ungated ❌.                                                                                                                                                                                                                                     |
| Build with Me (Builder)                                               | ✅   | ✅  | ⚠️      | UI Builder-only ✅; server ungated ❌.                                                                                                                                                                                                                                     |
| Validation Toolkit (Pro+)                                             | ✅   | ✅  | ✅      | UI Pro+ ✅; server ungated ❌. (PRD §4.5 lists it under Builder-specific while the pricing page sells it at Pro — the code follows the pricing page; PRD needs an update.)                                                                                                 |
| TE-100 Submission (Builder)                                           | ⚠️   | ⚠️  | ✅      | Modal only reachable from Builder showcase, but submission is a raw client `addDoc` — **any signed-in tier can submit** via console (open rules). Browse list is public-curated (fine).                                                                                    |
| API Access (Builder)                                                  | ✅   | ✅  | ✅      | **Properly enforced** — `api/admin.ts` requires Builder tier for key generation. One gap: the key doc snapshots `tier` at creation and never re-checks, so a downgraded user's key keeps Builder access indefinitely.                                                      |
| Alerts (Builder)                                                      | ⚠️   | ⚠️  | ⚠️      | Bell UI Builder-only, but alerts are generated & written for every tier (§2.2), and they're synthetic.                                                                                                                                                                     |
| Community: read-only (Free) / post & reply (Pro) / priority (Builder) | ❌   | ❌  | ❌      | **None of the tiering exists.** Flat comments, any signed-in user posts, no replies, no priority threads. Anonymous users can't read comments at all (rules), contradicting "Free: read-only".                                                                             |
| Enterprise: lead capture                                              | —    | —   | —       | Broken for anonymous visitors (§1.4).                                                                                                                                                                                                                                      |
| "Signal sources: HN, Reddit, X, industry reports" (PRD §4.1)          | —    | —   | —       | Actual sources: Google Trends, Product Hunt, Reddit, HN, TechCrunch. **No X/Twitter.** App.tsx loading copy also claims "signals from Google, X, and Reddit". Marketing/reality drift.                                                                                     |

---

## 4. Full UI surface inventory

Status: ✅ works as intended · ⚠️ works with caveats · ❌ broken/dead.

### App shell & navigation

| Element                                                                                    | Status | Notes                                                                |
| ------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------- |
| Tab bar (Daily Feed / Saved / Weekly Best / Radar / Futurecasting / Digest / Plan-Upgrade) | ✅     | Correct tier-conditional rendering; proper ARIA tablist/tab/tabpanel |
| Header: logo, date                                                                         | ✅     |                                                                      |
| Header: admin regenerate button                                                            | ✅     | Admin-only, spinner state correct                                    |
| Header: alerts bell + unread dot                                                           | ⚠️     | Builder-only UI; cost/synthetic issues §2.2                          |
| Header: logout / sign-in, tier crown → Plan tab                                            | ✅     |                                                                      |
| Auth error toast (dismissable, auto-hide)                                                  | ✅     |                                                                      |
| Ideas error retry pill (`fetchDaily(true)`)                                                | ✅     |                                                                      |
| Tier notification toast                                                                    | ⚠️     | Announces fake upgrades (§1.3)                                       |
| Footer disclaimer                                                                          | ✅     |                                                                      |
| Footer: Enterprise link                                                                    | ✅     |                                                                      |
| Footer: Privacy/Terms/Contact                                                              | ❌     | `href="#"` (§2.4)                                                    |
| Full-page generation loader                                                                | ⚠️     | Copy claims "Google, X, and Reddit" signals — X isn't a source       |

### Daily Feed tab

| Element                                                                 | Status | Notes                                                                                                                       |
| ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Skeleton on load                                                        | ✅     |                                                                                                                             |
| Empty state (admin: trigger button / non-admin: "curation in progress") | ⚠️     | Fine when signed in; for signed-out users it's the permanent state (§1.5); non-admins have no path to a missing feed (§2.1) |
| Tier slice + "Show N extra opportunities" expander                      | ✅     | Groups beyond the first 10; hidden while filters active — sensible                                                          |
| Custom-feed partial/empty status banners                                | ✅     | Distinguishes complete/partial/empty per PRD                                                                                |
| Free-tier "Unlock N more ideas" CTA → pricing                           | ✅     |                                                                                                                             |
| FilterBar: filter toggle chips (6 groups)                               | ✅     | Free sees lock icons; clicks route to upgrade — good                                                                        |
| FilterBar: sort dropdown, reset, result count                           | ✅     | "Newest First" option is a no-op comparator (falls to 0) — sorts nothing                                                    |
| FilterBar: Export CSV/PDF dropdown                                      | ⚠️     | Available to Free (exceeds promise); exports only the tier-sliced list — fine                                               |
| FilterBar: custom requirement input + Generate/toggle                   | ✅     | Pro one-keyword truncation, Builder textarea, 24 h lock with hours-remaining tooltip — all correct                          |
| FilterBar: free teaser "Upgrade Now"                                    | ❌     | Dead button (§2.4)                                                                                                          |
| FilterBar stickiness                                                    | ⚠️     | Collides with header (§2.7)                                                                                                 |
| "Emerging Markets" filter disabled for Pro                              | 🟡     | Undocumented Builder-only gate; sparkles icon with no explanation                                                           |

### Idea card (all feeds)

| Element                                                                       | Status      | Notes                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category tags, heat badge                                                     | ⚠️          | Mojibake guard patches bad `heatBadge` to "Early Bird" — symptom of an encoding issue upstream                                                                 |
| Save / unsave + confirm overlay                                               | ✅          | Signed-out tooltip prompts sign-in                                                                                                                             |
| Export dropdown                                                               | ❌ on touch | Hover-only (§2.4); tier gating inside is correct                                                                                                               |
| Pitch, stats row, quality panel                                               | ✅          | Quality panel: admin publish/narrow/reject buttons write via client (works only due to open rules — will break when rules are fixed; should go through an API) |
| "View VC Analysis & Sources" expand/collapse                                  | ✅          |                                                                                                                                                                |
| Evidence button (all signed-in tiers)                                         | ✅          | Server requires auth ✅; results render with real grounded source links; admin-only refresh                                                                    |
| Build Pack / Expert Vetting buttons (Builder UI)                              | ⚠️          | Work, but server ungated (§1.2); vetting result rendered with strengths/weaknesses/mitigation/pivots                                                           |
| Next Steps slice                                                              | ⚠️          | Free=3 ✅; Pro shows all, not 7 (§3)                                                                                                                           |
| Validation Toolkit (Pro+) / Progress Tracker (Builder)                        | ✅ UI       | Server ungated                                                                                                                                                 |
| Full roadmap: generate, toggle done, remove, add custom step, explain section | ✅          | Custom-step add/remove/done all wired correctly                                                                                                                |
| "Upgrade for more features" (Free/Pro)                                        | ❌          | Dead button (§2.4)                                                                                                                                             |
| Find co-founder toggle                                                        | ❌          | Cosmetic only (§2.4)                                                                                                                                           |
| Reactions 👍👎🔨                                                              | ✅          | Sign-in gated; feeds prompt optimizer                                                                                                                          |
| Comments thread                                                               | ⚠️          | Post/delete-own work; "JUST NOW" timestamps (§2.4); no tier gating vs PRD promise; anonymous can't read                                                        |

### Saved tab

| Element                                                                                                                    | Status | Notes                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom Ideas section + count/limit badge                                                                                   | ✅     | Free sees upgrade lock — correct                                                                                                               |
| "Analyze My Idea" button + modal (input→loading→result phases, usage badge, monthly-limit lock, save-to-custom with limit) | ✅     | The best-built feature surface in the app; quotas real                                                                                         |
| Daily Feed Collection section                                                                                              | ✅     |                                                                                                                                                |
| "My Latest Idea" slot (PRD §4.3b "surfaced in Saved tab")                                                                  | ❌     | Not rendered — `user_latest_idea` is written server-side but the Saved tab never reads/displays it. Promised persistence is invisible to users |

### Weekly Best / Radar / Futurecasting / Digest tabs

| Element                                                                                    | Status | Notes                                                                          |
| ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| Weekly Best: auto-fetch, refresh, recurrence badges, error/empty states                    | ✅     | Client-side aggregation caveat (§3); updateIdea sync gap (§2.6)                |
| Radar: fetch on tab open, refresh icon, error+retry, trends/opportunity areas              | ✅ UI  | Refresh icon not disabled while loading (double-fire possible); server ungated |
| Futurecasting: horizon select (2027/2030/2035), refresh, predictions with probability bars | ✅ UI  | Server ungated                                                                 |
| Digest: toggles, save, signed-out gate                                                     | ⚠️     | Weekly toggle dead; no catch on save (§2.3)                                    |

### Pricing / Plan tab & modals

| Element                                                                 | Status | Notes                                           |
| ----------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| Three plan cards, current-plan badges, select-to-preview showcase       | ⚠️     | Dynamic Tailwind classes broken (§2.5)          |
| Upgrade buttons                                                         | ❌     | Fake upgrades (§1.3)                            |
| Downgrade + confirmation modal listing lost features                    | ✅     | Well built — but downgrades the fake local tier |
| Enterprise banner → /enterprise                                         | ✅     |                                                 |
| TE100 modal: browse curated list, submit form, auth gate, reset-on-open | ✅     | Submission tier ungated at rules level (§3)     |
| API Access modal: auto-generate key, copy, error+retry                  | ✅     | Builder-gated server-side ✅                    |
| AlertsPanel: list, mark-read                                            | ✅     | Content synthetic (§2.2)                        |

### Enterprise landing (`/enterprise`)

| Element   | Status | Notes                             |
| --------- | ------ | --------------------------------- |
| Lead form | ❌     | Anonymous submission fails (§1.4) |
| Back link | ✅     |                                   |

---

## 5. Recommended actions (proposed backlog additions)

Priority order within the security wave, then UX:

1. **TE-12 (🔴)** Production Firestore rules: per-collection least-privilege (§1.1). Biggest single risk; blocks nothing else.
2. **TE-13 (🔴)** Server-side tier gates + auth requirement on all generate endpoints (§1.2). Copy the `analyze-idea` pattern.
3. **TE-14 (🔴)** Replace fake upgrade flow with honest pre-Stripe state (waitlist CTA); remove "unlocked for this session" toast (§1.3). Superseded properly by TE-08 (Stripe).
4. **TE-15 (🔴)** Fix enterprise lead capture via serverless endpoint (§1.4).
5. **TE-16 (🟠)** Anonymous read path for the daily feed (public flag + rules, or API read) (§1.5).
6. **TE-17 (🟠)** Cron for daily generation before the digest cron (§2.1).
7. **TE-18 (🟠)** Alerts: generate only for Builder; stop hidden AI spend for Free/Pro (§2.2).
8. **TE-19 (🟠)** Dead-UI fixes: two dead upgrade buttons, footer legal links (add real pages), click-to-open export menu (touch), comment relative timestamps, FilterBar `top-16`, Tailwind literal classes in PricingSection (§2.4, §2.5, §2.7).
9. **TE-20 (🟠)** Weekly Best list sync in `updateIdea` (§2.6) — fold into TE-10's hook split.
10. **TE-21 (🟡)** Promise/copy reconciliation: Pro next-steps (enforce 7 or promise "all"), saves "per month" wording, digest weekly toggle (ship or remove), co-founder button (remove or mark coming-soon), X/Twitter removed from signal claims, PRD §4.5 validation-toolkit tier, "My Latest Idea" surfaced in Saved tab or promise removed, PRD digest status updated (daily digest is live).

**Explicitly fine / no action:** analyze-idea and custom-feed enforcement (exemplary), API-key Builder gate, downgrade confirmation UX, ARIA tab semantics, custom-feed peek/restore, admin-only refresh gates on vetting/evidence/validation/build/roadmap refresh buttons.

---

_Method note: all findings are from direct source reading (files cited inline). Dynamic behaviors flagged as "likely" (FilterBar sticky overlap, Tailwind purge) were inferred from code, not observed in a browser — verify visually before/while fixing._
