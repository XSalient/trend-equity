# Trend-Equity

AI-powered startup idea platform. Surfaces high-conviction, VC-ready business opportunities daily using Google Gemini.

---

## IDE Setup (any editor)

This project uses **standard, IDE-agnostic tooling** — no vendor lock-in:

| Tool                                     | Purpose                            | Config file         |
| ---------------------------------------- | ---------------------------------- | ------------------- |
| [EditorConfig](https://editorconfig.org) | Indentation, line endings, charset | `.editorconfig`     |
| [Prettier](https://prettier.io)          | Code formatting                    | `.prettierrc`       |
| [ESLint](https://eslint.org)             | Linting & code quality             | `eslint.config.js`  |
| TypeScript                               | Type checking                      | `tsconfig.json`     |
| `.nvmrc`                                 | Pinned Node version                | `.nvmrc` (`22 LTS`) |

**VSCode / Cursor / Windsurf**: Open the repo, accept the "Install recommended extensions" prompt. Formatting and linting will work automatically on save. Settings are in `.vscode/settings.json` — all three editors read this file natively.

**JetBrains (WebStorm / IntelliJ)**: EditorConfig is built-in. Enable Prettier at _Preferences → Languages & Frameworks → JavaScript → Prettier_ (point to `node_modules/.bin/prettier`). Enable ESLint at _Preferences → Languages & Frameworks → JavaScript → ESLint → Automatic ESLint Configuration_.

**Zed**: EditorConfig is built-in. Add to `~/.config/zed/settings.json`: `"formatter": { "external": { "command": "prettier", "arguments": ["--stdin-filepath", "{buffer_path}"] } }`.

**First-time format of the whole codebase** (only needed once after adding Prettier to an existing project):

```bash
npm run format
```

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Daily Feed Generation & Self-Learning Pipeline](#daily-feed-generation--self-learning-pipeline)
3. [Admin Role Management](#admin-role-management)
4. [Environment Variables](#environment-variables)
5. [Dev Mode Switches](#dev-mode-switches)
6. [Commands Reference](#commands-reference)
7. [Production Deployment (Vercel)](#production-deployment-vercel)
8. [Security Checklist](#security-checklist)

---

## Quick Start

### With Doppler (recommended for teams)

```bash
# 1. Install Doppler CLI: https://docs.doppler.com/docs/install-cli
doppler login
doppler setup --project trend-equity --config dev

# 2. Install dependencies
npm install

# 3a. Start with mock AI data (no Gemini quota consumed)
doppler run -- npm run dev:mock

# 3b. OR start with the real Gemini API
doppler run -- npm run dev:live
```

### With a local .env file

```bash
# 1. Create your env file from the template
cp .env.example .env
# Edit .env — fill in GEMINI_API_KEY and Firebase vars

# 2. Install dependencies
npm install

# 3a. Start with mock AI data (no Gemini quota consumed)
npm run dev:mock

# 3b. OR start with the real Gemini API
npm run dev:live
```

The frontend runs at **http://localhost:3000** and the BFF server at **http://localhost:3001**.

---

## Daily Feed Generation & Self-Learning Pipeline

The daily feed generation architecture is designed for maximum speed, strict VC-grade quality, and continuous unsupervised and supervised learning.

### 1. Parallelized Batch Generation

To generate 35 high-conviction startup ideas without hitting output token limits or causing JSON truncation, the generation is divided into three concurrent, category-focused prompts:

- **Batch 1 (12 ideas):** Focuses on _Digital / SaaS / AI-SaaS_.
- **Batch 2 (12 ideas):** Focuses on _Service / Local / On-Demand_ and _Wildcard_.
- **Batch 3 (11 ideas):** Focuses on _Physical / Sustainable / Hardware_ and _Deep-Tech / Moonshot_.

This batching reduces the cold generation time from 2+ minutes to ~25 seconds.

### 2. Tier Feature Access

All features are gated by either **subscription tier** or **admin role** — never both simultaneously.

| Feature                             | Free  |           Pro            |             Builder             |        Admin        |
| ----------------------------------- | :---: | :----------------------: | :-----------------------------: | :-----------------: |
| Daily Feed (read, up to tier limit) | ✅ 10 |          ✅ 25           |              ✅ 35              |        ✅ 35        |
| Custom Requirement Feed             |  ❌   | 1 keyword / 24h, up to 5 | Natural language / 24h, up to 5 | Custom thesis feeds |
| Save ideas                          |  ✅   |            ✅            |               ✅                |         ✅          |
| Validation Toolkit, Email Digest    |  ❌   |            ✅            |               ✅                |         ✅          |
| Build with Me, Expert Vetting       |  ❌   |            ❌            |               ✅                |         ✅          |
| Weekly Trend Radar                  |  ❌   |            ❌            |               ✅                |         ✅          |
| Futurecasting Engine                |  ❌   |            ❌            |               ✅                |         ✅          |
| Alerts Bell                         |  ❌   |            ❌            |               ✅                |         ✅          |
| API Access, TE-100 Submission       |  ❌   |            ❌            |               ✅                |         ✅          |
| **Feed Regeneration (Refresh)**     |  ❌   |            ❌            |               ❌                |       ✅ only       |
| **Prompt Config Management**        |  ❌   |            ❌            |               ❌                |       ✅ only       |
| **User Role Management**            |  ❌   |            ❌            |               ❌                |       ✅ only       |

### 3. Dynamic Prompt Refiner (Self-Improving Loop)

Each daily generation run automatically triggers the self-learning pipeline:

- **Feedback Collection:** Gathers user reactions (`up`, `down`, `building`) and text comments on generated ideas from the past 7 days.
- **AI VC Self-Critique:** Runs an LLM-based Venture Capital Critic to critique the past 3 days of generated ideas, identifying cliché/repetitive patterns (like basic AI wrappers or unviable regulatory models) and weak moats.
- **Meta-Prompt Refinement:** Combines current prompts, user reactions, comments, and the AI critique to auto-generate a refined system prompt and quality block instruction set, saving it as the next active version in Firestore (`config/generation_prompt`).

### 4. Lineage & Version Logging

For logging, analysis, and auditing:

- **Prompt Snapshotting:** Writes every new optimized prompt to `prompt_history/v[version]` along with the critique reasons and feedback metadata.
- **Feed Run Archiving:** Saves each feed generation run snapshot in `daily_generations_history/[date]_[timestamp]` alongside the exact `promptVersion` used to generate it.

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example). Copy it to `.env` for local dev — `.env` is gitignored and will never be committed.

| Variable                       | Required   | Where to set                  | Notes                                                                         |
| ------------------------------ | ---------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `GEMINI_API_KEY`               | Yes        | `.env` / Doppler / Vercel     | AI API key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `DEV_MOCK`                     | Dev only   | `.env` / Doppler `dev` config | `true` bypasses Gemini. **Never set in prod.**                                |
| `APP_URL`                      | Yes (prod) | `.env` / Doppler / Vercel     | Public URL for CORS and OAuth callbacks                                       |
| `SYSTEM_PROMPT`                | No         | Doppler / Vercel              | Overrides the default Gemini system prompt                                    |
| `VITE_FIREBASE_*`              | Yes        | `.env` / Doppler / Vercel     | Firebase frontend config (safe to expose)                                     |
| `FIREBASE_PROJECT_ID`          | Yes        | `.env` / Doppler / Vercel     | Same value as `VITE_FIREBASE_PROJECT_ID`                                      |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes (prod) | Doppler `prd` / Vercel        | Full service account JSON as one line. **Highly sensitive.**                  |

> **`VITE_` prefix** — Variables prefixed `VITE_` are embedded into the browser bundle at build time. Only put non-sensitive, public Firebase config here. Never prefix secrets with `VITE_`.

---

## Dev Mode Switches

### Switch 1: `DEV_MOCK` — Bypass Gemini API

When your free-tier Gemini quota is exhausted (resets every 24 hours), enable mock mode to keep developing offline. All AI endpoints return realistic pre-written responses from `server.mocks.ts`.

| Command            | `DEV_MOCK`            | Gemini calls | Best for                                 |
| ------------------ | --------------------- | ------------ | ---------------------------------------- |
| `npm run dev:mock` | `true` (forced)       | Skipped      | Quota exhausted / offline / pure UI work |
| `npm run dev:live` | `false` (forced)      | Real API     | Testing actual AI output                 |
| `npm run dev`      | From `.env` / Doppler | Depends      | When you manage the flag yourself        |

`dev:mock` and `dev:live` use `cross-env` to inject the flag inline — they **override** whatever value is in `.env` or Doppler, so you never need to edit a file to switch modes.

**Production safety**: The server calls `process.exit(1)` if it detects `DEV_MOCK=true` alongside `NODE_ENV=production`. A mis-configured deploy fails loudly rather than silently serving fake data to real users.

---

### Switch 2: `mockTier` URL Parameter — Simulate Subscription Tiers

Simulate any subscription tier in the browser without a paid account:

```
http://localhost:3000/?mockTier=builder
http://localhost:3000/?mockTier=pro
http://localhost:3000/?mockTier=free
```

This only activates when `import.meta.env.DEV` is `true` (local Vite dev server). It is a no-op in production builds — there is nothing to disable.

---

## Commands Reference

### Starting & Stopping

```bash
# Start (choose one)
npm run dev           # Uses DEV_MOCK from .env or Doppler
npm run dev:mock      # Force mock mode  — no Gemini quota used
npm run dev:live      # Force live mode  — calls real Gemini API

# Restart aliases (same as the dev commands above)
npm run restart
npm run restart:mock
npm run restart:live

# Stop: press Ctrl+C — concurrently stops both Vite and the BFF server together
```

### Doppler variants (recommended)

```bash
doppler run -- npm run dev:mock   # Doppler injects secrets, mock mode forced
doppler run -- npm run dev:live   # Doppler injects secrets, live API forced
doppler run -- npm run dev        # Doppler injects secrets, DEV_MOCK from Doppler config
```

### Code Quality

```bash
# Run all checks at once (CI-equivalent — typecheck + ESLint + Prettier)
npm run check

# Individual checks
npm run typecheck     # TypeScript type-check only (no emit)
npm run eslint        # ESLint — reports errors and warnings
npm run format:check  # Prettier — reports formatting issues without changing files

# Auto-fix
npm run eslint:fix    # ESLint auto-fix where possible
npm run format        # Prettier — rewrites all files to match style rules
```

### Build & Preview

```bash
npm run build         # Production build → dist/
npm run preview       # Serve the production build locally
npm run clean         # Delete dist/
```

### Testing

```bash
npm run test          # Unit + E2E
npm run test:unit     # Vitest unit tests only
npm run test:e2e      # Playwright E2E tests only
```

### Sync Doppler → local .env (one-time or after secret rotation)

```bash
doppler secrets download --format env --no-backup > .env
```

### Push config changes to Doppler

```powershell
./scripts/doppler_sync.ps1
```

---

## Admin Role Management

Admin access is completely separate from the Builder subscription tier. Any number of users can be on the Builder tier, but only users with `role: "admin"` in their Firestore document can perform administrative actions (e.g., regenerating the daily feed).

**Single source of truth:** the `role` field in Firestore `users/{uid}`. No other field is used. No inconsistency is possible.

### CLI Commands

Make sure your `.env` has `FIREBASE_SERVICE_ACCOUNT_KEY` set, then:

```bash
# List all current admin users
npm run admin:list

# Grant admin role to a user (by their Google sign-in email)
npm run admin:grant -- your@email.com

# Revoke admin role from a user
npm run admin:revoke -- someone@email.com

# Show a user's current tier and role
npm run admin:info -- your@email.com
```

> The script uses the Firebase Admin SDK and requires `FIREBASE_SERVICE_ACCOUNT_KEY` in your `.env`. It **never** runs in the browser — it is a local operator tool only.

### What Admins Can Do

| Feature                    | How to access                                                |
| -------------------------- | ------------------------------------------------------------ |
| Regenerate daily feed      | Green `TRIGGER GENERATION` button in the Daily Feed tab      |
| View/edit active prompt    | Firestore → `config/generation_prompt`                       |
| View prompt history        | Firestore → `prompt_history/vN`                              |
| View feed run archive      | Firestore → `daily_generations_history`                      |
| Approve TE-100 submissions | `POST /api/admin` with `action: "te100-approve"`             |
| Send email digest manually | `POST /api/admin` with `Authorization: Bearer <CRON_SECRET>` |
| Manage user tiers/roles    | `npm run admin:grant / revoke` or Firestore Console          |

---

## Production Deployment (Vercel)

### Architecture

| Layer    | Local dev                        | Production (Vercel)                                                                        |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend | `vite --port 3000`               | Static files from `dist/` on Vercel CDN                                                    |
| Backend  | `server.ts` (Express, port 3001) | `vercel.json` rewrite → `api/generate/dispatch.ts` → `api/_handlers/*` (Vercel serverless) |
| Secrets  | `.env` or Doppler `dev` config   | Vercel env vars or Doppler `prd` config                                                    |

> `server.ts` is **never deployed** — it is the local-dev BFF only. Production uses the serverless functions in `api/`.

### Deployment Steps

1. Push to GitHub and connect the repo to a Vercel project.

2. Set environment variables in **Vercel dashboard → Project → Settings → Environment Variables**:

   | Variable                            | Production       | Preview                    |
   | ----------------------------------- | ---------------- | -------------------------- |
   | `GEMINI_API_KEY`                    | ✅               | ✅                         |
   | `APP_URL`                           | ✅ (live domain) | ✅ (Vercel preview URL)    |
   | `VITE_FIREBASE_API_KEY`             | ✅               | ✅                         |
   | `VITE_FIREBASE_AUTH_DOMAIN`         | ✅               | ✅                         |
   | `VITE_FIREBASE_PROJECT_ID`          | ✅               | ✅                         |
   | `VITE_FIREBASE_STORAGE_BUCKET`      | ✅               | ✅                         |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅               | ✅                         |
   | `VITE_FIREBASE_APP_ID`              | ✅               | ✅                         |
   | `FIREBASE_PROJECT_ID`               | ✅               | ✅                         |
   | `FIREBASE_SERVICE_ACCOUNT_KEY`      | ✅               | ⛔ (not needed in Preview) |
   | `DEV_MOCK`                          | ⛔ **Never set** | ⛔ **Never set**           |

3. Vercel runs `npm run build` automatically on every push to `main`.

### Using Doppler in Production (Recommended)

Instead of pasting secrets directly into the Vercel dashboard, connect Doppler:

1. Add secrets to Doppler under the `prd` config (keep `DEV_MOCK` only in the `dev` config).
2. Install the [Doppler Vercel integration](https://www.doppler.com/integrations/vercel) — it syncs secrets to Vercel automatically on rotation.
3. You never touch the Vercel dashboard for secrets again.

---

## Security Checklist

### Local Development

- [ ] `.env` is listed in `.gitignore` — confirm with `git check-ignore -v .env`
- [ ] Never paste `FIREBASE_SERVICE_ACCOUNT_KEY` into a chat, Slack, or Notion
- [ ] Use `npm run dev:mock` when doing UI-only work to avoid burning real API quota
- [ ] Each developer has their own `GEMINI_API_KEY` — do not share keys

### Doppler Config

- [ ] `DEV_MOCK=true` exists **only** in the `dev` config, not in `stg` or `prd`
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` exists **only** in `prd`, not in `dev`
- [ ] Access to Doppler `prd` config is restricted to production-authorized team members

### Production (Vercel)

- [ ] `DEV_MOCK` is **not present** in any Vercel environment variable
- [ ] `NODE_ENV=production` is set (Vercel sets this automatically)
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` is scoped to **Production** environment only, not Preview
- [ ] `GEMINI_API_KEY` is rotated immediately if it was ever committed to git or shared
- [ ] Firebase Security Rules restrict Firestore reads/writes by authentication state
- [ ] The CORS origin in `vercel.json` matches your actual production domain
