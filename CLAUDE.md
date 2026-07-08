# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Vite (port 3000) + BFF server (port 3001), respects DEV_MOCK in .env
npm run dev:mock      # Force mock mode — no Gemini API calls
npm run dev:live      # Force real Gemini API

# Code quality (run before committing)
npm run check         # typecheck + eslint + prettier check
npm run eslint:fix    # Auto-fix lint issues
npm run format        # Reformat all files with Prettier

# Build
npm run build         # Vite production build → dist/
npm run clean:ports   # Kill processes on ports 3000, 3001, 3002

# Tests
npm run test:unit           # Vitest unit tests (tests/unit/**/*.test.ts)
npm run test:unit:watch     # Unit tests in watch mode
npm run test:e2e            # Playwright E2E tests
npm run test:e2e:ui         # Playwright with interactive UI
```

## Architecture

**Trend-Equity** is a React + Vite SPA with Vercel serverless backend. The app is an AI-powered startup idea feed using Google Gemini, with Firebase Auth and Firestore.

### Frontend (`src/`)

- **Framework:** React 19, Vite, TypeScript, Tailwind CSS v4, Lucide icons, Motion (Framer Motion fork)
- **State:** React hooks + context only — no Redux/Zustand
- **Routing:** Tab-based inside `App.tsx` (no React Router)
- **Entry:** `App.tsx` wires all top-level hooks and renders `<Header>`, `<AlertsPanel>`, and the active tab

Key source directories:

- `src/components/tabs/` — one component per app tab (IdeaFeed, SavedIdeas, WeeklyRadar, etc.)
- `src/components/idea/` — IdeaCard sub-components (analysis, toolkit, vetting, comments)
- `src/hooks/` — all data-fetching and state hooks (useAuth, useIdeas, useTier, etc.)
- `src/services/geminiService.ts` — API client; wraps all `/api/generate/*` fetch calls; attaches `Authorization: Bearer <firebase-token>` header
- `src/constants.ts` — `TIER_LIMITS` object and feature quotas; single source of truth for tier gates
- `src/types.ts` — shared TypeScript interfaces (`Idea`, `DailyGeneration`, etc.)

### Backend

**Local dev:** Express BFF in `server.ts` (port 3001). Vite proxies `/api/*` → port 3001.

**Production:** Vercel serverless functions. All `/api/generate/*` routes go through a single catch-all function `api/generate/dispatch.ts` that dispatches to handlers in `api/_handlers/` (underscore directories are not deployed as functions). A `vercel.json` rewrite maps `/api/generate/:feature` → `/api/generate/dispatch?feature=:feature` — a bracket dynamic-segment filename (`[feature].ts`) does NOT get registered as a routable path for this Vite (non-Next.js) project and silently 404s/falls through to the SPA. This keeps the deployment under the Vercel Hobby plan's 12-functions-per-deployment limit — add new generate endpoints as `api/_handlers/` files plus a map entry in the catch-all, never as new top-level `api/**/*.ts` files. The same handler code runs in both environments via thin shims.

Shared backend utilities live in `api/_lib/`:

- `ai-provider.ts` — Gemini client; `generateWithAI()` is the single entry point; `normalizeAIResponse()` handles schema deviations
- `auth.ts` — Firebase Admin token verification; always looks up tier from Firestore server-side (never trusts client-supplied tier)
- `usage.ts` — Firestore-backed daily + monthly quota counters (`api_usage`), check-before-increment transactions, fail-open on DB errors
- `cache.ts` — Firestore-backed 24-hour cache for AI results (`api_cache`) + recent-headline lookup for dedup
- `signals.ts` — live market signal fetcher (Google Trends, Product Hunt, Reddit, HN, TechCrunch), 1 h in-memory cache, formats the grounding block for generation prompts
- `quality-engine.ts` — critic model ranks overgenerated candidates; publishes top N
- `embeddings.ts` — semantic dedup of candidates vs past 30 days (`idea_embeddings`)
- `prompt-optimizer.ts` — self-learning prompt loop from reactions/comments (`prompt_history`, `config`)
- `evidence.ts` — per-idea market evidence via Google Search grounding (two-step: grounded research, then schema structuring)
- `prediction-tracker.ts` — publish-time score snapshots for 6-month accuracy grading (`idea_predictions`)
- `idea-quality.ts` — pre-critic quality gate and disclaimer cleanup
- `tier-config.ts` — tier feature limits read from Firestore `app_config`

### Auth & Tier System

- **Auth:** Firebase Authentication with Google Sign-In. Web (localhost + production) uses `signInWithPopup`; native Capacitor uses `signInWithRedirect`.
- **Token sync:** Client refreshes Firebase ID token every 50 min (tokens expire at 60 min); stored globally in `geminiService.ts`.
- **Tier:** Stored in Firestore `users/{uid}.tier`. The server always re-reads this from Firestore on each request — the client never sends tier in the request body.
- **Tier values:** `free` | `pro` | `builder`

### Firestore Collections

| Collection                                                               | Purpose                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `users/{uid}`                                                            | tier, role, timestamps                                                                             |
| `daily_generations/{date}`                                               | singleton daily idea set + generation metadata                                                     |
| `user_saves/{saveId}`                                                    | user-saved ideas (feed or custom)                                                                  |
| `user_latest_idea/{uid}`                                                 | most recent custom idea analysis (Pro/Builder)                                                     |
| `user_alerts/{alertId}`                                                  | user notifications                                                                                 |
| `comments/{commentId}`                                                   | public idea comments                                                                               |
| `locks/{lockId}`                                                         | distributed locks preventing concurrent AI generation                                              |
| `weeklyBest/**`                                                          | curated weekly ideas (Pro/Builder only)                                                            |
| `idea_predictions/{date}_{ideaId}`                                       | server-only publish-time score snapshots for prediction-accuracy grading (reviewed after 6 months) |
| `api_cache/{key}`                                                        | 24 h server-side cache of AI results                                                               |
| `api_usage/{uid}_{feature}_{period}`                                     | daily + monthly quota counters                                                                     |
| `daily_generations_history/{runId}`                                      | full run snapshots incl. rejected candidates (optimizer training signal)                           |
| `idea_embeddings/{date}`                                                 | published idea vectors for semantic dedup                                                          |
| `prompt_history`, `config`, `app_config`, `idea_reactions`, `idea_stats` | self-learning prompt loop + tier feature config                                                    |

Security rules are in `firestore.rules`; index definitions in `firestore.indexes.json`.

### API Patterns

- All generation endpoints are POST
- Rate limits enforced server-side: Firestore daily/monthly quotas (`usage.ts`); `daily.ts`'s per-IP daily cap is also Firestore-backed (`checkAndIncrementIpLimit`, hashed IPs) so it survives across serverless instances
- `api/_handlers/daily.ts` uses a singleton pattern: generates once per day, returns cached result on subsequent calls (any date, any auth state). Triggering a _new_ generation requires a signed-in user and only works for today's date — an uncached past/future date returns 404 rather than generating. Only admins can `refresh` (regenerate) an existing day's generation
- `DEV_MOCK=true` enables offline mock mode; the server guards `process.exit(1)` if this flag is set in production

### Testing

- **Unit tests:** Vitest, Node environment, coverage targets `api/**/*.ts` only (`tests/unit/`)
- **E2E tests:** Playwright, sequential (non-parallel), base URL `http://localhost:3000` (`tests/e2e/`)
- Snapshots stored in `tests/e2e/snapshots/` and committed to repo

### Deployment

- Frontend: Static `dist/` served from Vercel CDN
- Backend: Vercel serverless (`api/generate/dispatch.ts` catch-all, routed via `vercel.json` rewrite, + `api/_handlers/*.ts`)
- Secrets via Doppler (recommended) or Vercel env vars — see `.env.example`
- Routing rules in `vercel.json`: `/api/*` → serverless, `/*` → SPA (`index.html`)

## Project Tracking (required workflow)

All project state lives in-repo so every developer and agent on every machine sees the same thing:

| File                      | Holds                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/BACKLOG.md`         | All tasks (`TE-NN` ids, status, owner, user stories) — if it's not here, it isn't planned |
| `CHANGELOG.md`            | What shipped, when, with commit hashes                                                    |
| `DECISIONS.md`            | Product/architecture decisions + rationale                                                |
| `PRD.md`                  | Product spec (tiers, features, quotas)                                                    |
| `docs/superpowers/plans/` | Detailed implementation plans for large tasks                                             |

**Rules for every agent/developer:**

1. Before starting work, check `docs/BACKLOG.md` and `DECISIONS.md` — don't redo or contradict recorded decisions.
2. Starting a task → mark it `in progress` in the backlog (same commit as first change). Finishing → move to Recently shipped + add a CHANGELOG line in the shipping commit.
3. New decision made mid-task → record it in `DECISIONS.md` immediately.
4. `AGENTS.md` is a pointer to this file — never duplicate content there.

## Agent Rules

### 1. Workflow

- **Plan-Review-Fix**: Start with a concise high-level plan. Wait for explicit approval before major implementation. After execution, analyze logs/output and fix issues before declaring success.
- **Vertical Slice**: Implement complete, working end-to-end slices (UI + logic + data + tests) rather than horizontal layers.
- **Truman Show Principle**: Ground every claim in real evidence (logs, terminal, browser, test results). Never be sycophantic. Report problems clearly and objectively.
- **Component-First**: Prefer small, focused, reusable components. Aggressively reuse existing component patterns.

### 2. Context & Token Discipline

- **Minimal Verbiage**: No filler, no repeating instructions. Start directly with the plan, diff, or answer.
- **Edits Format**: Provide changes as precise Search & Replace blocks with sufficient unique context. Never rewrite entire files unless explicitly requested.
- **Lazy Loading**: Only read files when strictly necessary.
- **Local-First**: Always prefer existing codebase symbols and patterns. Do not hallucinate local APIs.

### 3. Tool & Environment Rules

- **No URL Guessing**: If a URL fails/404s once, report it. Do not try variations.
- **Auth Failures**: On 401/403 during external access → stop immediately, report, and ask for a fix.

### 4. Architecture & Quality

- **Separation of Concerns**: Business logic in services/hooks/server actions; components focus on rendering only.
- **Unified AI Layer**: All AI calls go through `api/_lib/ai-provider.ts` → `generateWithAI()`.
- **Boring Code Preferred**: Readable, explicit, maintainable over clever abstractions.
- **File Size**: Keep files < 300 lines. Suggest splitting proactively when exceeded.
- **No Hardcoding**: Never commit secrets or API keys. Use `.env` + proper loading.
- **Type Safety**: Maintain strong TypeScript types. Avoid `any`.
- **Lint & Format**: Follow project ESLint/Prettier rules (`npm run check`). Mention violations if found.

### 5. Testing & Reliability

- **Testing Approach**: Write tests for complex logic and AI integration. Prefer integration/component tests over fragile unit tests for UI slices.
- **Error Handling**: Robust error boundaries and user-friendly messages, especially for AI failures.

### 6. Additional Best Practices

- **Dependencies**: Conservative — justify every non-obvious package addition.
- **Performance**: Keep initial implementation simple. Optimize only when there is a measured need.
- **State Management**: Prioritize local component state. Use global state only when data must be shared across non-adjacent tree branches.
- **Refactoring**: Suggest cleanups when code is messy, but do not refactor unrelated areas without explicit approval.
- **Success Criteria**: Before marking a task complete, verify via logs, tests, and browser where applicable.
