# Changelog

All notable changes to Trend-Equity. Newest first. Every shipped change gets a line here (same commit that ships it) — see [docs/BACKLOG.md](docs/BACKLOG.md) for the workflow.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/): **Added / Changed / Fixed / Docs**.

## Unreleased

### Docs

- Full UI/feature/tier-promise audit (`docs/audits/2026-07-08-ui-feature-tier-audit.md`): every button, expand/collapse, link, and tier gate cross-checked against PRD and server enforcement. Headline findings: dev-mode Firestore rules allow any signed-in user to write anything (incl. own tier); 8 of 12 AI endpoints have no tier gate and accept anonymous callers; upgrade flow is client-side simulation; enterprise lead capture fails for anonymous visitors. New backlog items TE-12…TE-21.

### Fixed

- **TE-01:** `api/_handlers/daily.ts` no longer lets anonymous callers trigger AI generation for arbitrary client-supplied dates — the initial generation trigger now requires a signed-in user and only fires for today's date. Cached reads are unaffected: any date, any auth state, still served from Firestore when present.
- **TE-02:** the per-IP daily cap on daily generation is now enforced via a Firestore transaction (`checkAndIncrementIpLimit` in `api/_lib/usage.ts`, hashed IPs) instead of an in-memory `Map`, so it survives across serverless instances. While implementing this we found the old limiter was never actually invoked anywhere — the endpoint had no IP protection at all in production.

### Docs

- Project tracking system: `docs/BACKLOG.md` (single task tracker), this changelog, decision-log workflow, doc map in README.
- Pain-point audit and remediation plan (`docs/superpowers/plans/2026-07-08-pain-point-remediation.md`) — 10 prioritized tasks with user stories.
- CLAUDE.md synced with actual backend architecture (Firestore-backed cache/quotas, signal pipeline modules, real generation-trigger policy); AGENTS.md now points to CLAUDE.md instead of duplicating it.

## 2026-07-08

### Changed

- Consolidated all `/api/generate/*` endpoints into a single catch-all function (`api/generate/dispatch.ts`) to stay under the Vercel Hobby 12-function limit (210be12).

### Fixed

- 405 on `/api/generate/*` in production: bracket dynamic-segment filenames (`[feature].ts`) don't register as routes in non-Next.js Vercel projects; replaced with a `vercel.json` rewrite (85ab8dc).

### Docs

- Added `DECISIONS.md` — cross-machine decision log (985347f).

## 2026-07-03

### Added

- **Custom requirement feed** (Builder tier): natural-language requirement → 5 tailored ideas, 1 generation per 24 h with server-side caching and peek/restore flow (44ec85c, b5436d8).
- **Quality Engine Wave 1** (5608d81): overgenerate-then-curate pipeline — 3 concurrent candidate batches, semantic dedup vs past 30 days (`embeddings.ts`), stronger critic model ranks and publishes top 35 (`quality-engine.ts`), live market signals grounding (`signals.ts`: Google Trends, Product Hunt, Reddit, HN, TechCrunch), per-idea evidence via Google Search grounding (`evidence.ts`), publish-time prediction snapshots for 6-month accuracy grading (`prediction-tracker.ts`).

## 2026-05-18 → 2026-05-22

### Added

- CI pipeline with component tests (39f18be).

### Fixed

- TypeScript errors blocking CI (4e09f04); visual bugs in loading states, vetting refresh, dynamic step count (381d5d5); vetting done button re-calling API (57887d7); Vercel ESM crashes (2b9a6ca, 758dd7d); `isAdmin` undefined in VC analysis (794c151).

### Changed

- Daily idea generation quality/diversity overhaul with concurrent batches (d22113c, 4341d08).

## 2026-05-20

### Added

- Self-learning prompt pipeline: AI critique + user reactions refine the generation prompt over time, with permanent prompt/run history in Firestore (491bfd7, 3cf1742).
- Admin CLI role manager (0eca0c9).

### Changed

- Admin role standardized to `role === 'admin'` as single source of truth; Builder tier decoupled from admin privileges; feed regeneration is admin-only across all UI surfaces (31b8300, dad0938, 54a59ba).

## 2026-05-04 → 2026-05-05

### Added

- Enterprise tier section in pricing UI (002afc2, ec8f4c3).
- Five product gap fixes (e51122c).

### Fixed

- Vercel login: switched web auth to `signInWithPopup`, forced local persistence (4ae6e97, d64bf17, 7eaab27); API CommonJS/ESM crashes on Vercel (bb846d7, ffea130); consolidated admin endpoints into `api/admin.ts` for the 12-function limit (63d086e).

---

_History before 2026-05-04 predates this changelog; see `git log`._
