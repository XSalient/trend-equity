# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

**Production:** Vercel serverless functions in `api/generate/*.ts`. Each file becomes a separate function. The same handler code runs in both environments via thin shims.

Shared backend utilities live in `api/_lib/`:

- `ai-provider.ts` — Gemini client; `generateWithAI()` is the single entry point; `normalizeAIResponse()` handles schema deviations
- `auth.ts` — Firebase Admin token verification; always looks up tier from Firestore server-side (never trusts client-supplied tier)
- `rate-limiter.ts` — In-memory rate limiting (global 200/15 min, per-feature limits)
- `cache.ts` — 24-hour in-memory cache for AI results

### Auth & Tier System

- **Auth:** Firebase Authentication with Google Sign-In. Web (localhost + production) uses `signInWithPopup`; native Capacitor uses `signInWithRedirect`.
- **Token sync:** Client refreshes Firebase ID token every 50 min (tokens expire at 60 min); stored globally in `geminiService.ts`.
- **Tier:** Stored in Firestore `users/{uid}.tier`. The server always re-reads this from Firestore on each request — the client never sends tier in the request body.
- **Tier values:** `free` | `pro` | `builder`

### Firestore Collections

| Collection                 | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `users/{uid}`              | tier, role, timestamps                                |
| `daily_generations/{date}` | singleton daily idea set + generation metadata        |
| `user_saves/{saveId}`      | user-saved ideas (feed or custom)                     |
| `user_latest_idea/{uid}`   | most recent custom idea analysis (Pro/Builder)        |
| `user_alerts/{alertId}`    | user notifications                                    |
| `comments/{commentId}`     | public idea comments                                  |
| `locks/{lockId}`           | distributed locks preventing concurrent AI generation |
| `weeklyBest/**`            | curated weekly ideas (Pro/Builder only)               |

Security rules are in `firestore.rules`; index definitions in `firestore.indexes.json`.

### API Patterns

- All generation endpoints are POST
- Rate limits enforced server-side (in-memory + Firestore for monthly quotas)
- `api/generate/daily.ts` uses a singleton pattern: generates once per day, returns cached result on subsequent calls; only `builder` tier can trigger generation
- `DEV_MOCK=true` enables offline mock mode; the server guards `process.exit(1)` if this flag is set in production

### Testing

- **Unit tests:** Vitest, Node environment, coverage targets `api/**/*.ts` only (`tests/unit/`)
- **E2E tests:** Playwright, sequential (non-parallel), base URL `http://localhost:3000` (`tests/e2e/`)
- Snapshots stored in `tests/e2e/snapshots/` and committed to repo

### Deployment

- Frontend: Static `dist/` served from Vercel CDN
- Backend: Vercel serverless (`api/generate/*.ts`)
- Secrets via Doppler (recommended) or Vercel env vars — see `.env.example`
- Routing rules in `vercel.json`: `/api/*` → serverless, `/*` → SPA (`index.html`)

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

## Imported Claude Cowork project instructions

Before making any irreversible changes, ask for the permissions.
