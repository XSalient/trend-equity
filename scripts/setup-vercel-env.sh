#!/usr/bin/env bash
# setup-vercel-env.sh
#
# Push all required Vercel environment variables for the trend-equity project.
# Run once. Requires Vercel CLI (vercel) authenticated with your account.
#
# Usage:
#   npm install -g vercel
#   vercel login
#   bash scripts/setup-vercel-env.sh

set -euo pipefail

PROJECT="trend-equity"
TEAM="saurabhs-projects-4d5cc478"

# ── helpers ──────────────────────────────────────────────────────────────────

require_vercel() {
  if ! command -v vercel &>/dev/null; then
    echo "ERROR: Vercel CLI not found. Install with: npm install -g vercel"
    exit 1
  fi
}

set_env() {
  local name="$1"
  local value="$2"
  local target="${3:-production,preview}"   # production,preview,development

  if [[ -z "$value" ]]; then
    echo "  SKIP  $name (empty — fill in manually via Vercel dashboard)"
    return
  fi

  # Remove existing, then add (idempotent)
  vercel env rm "$name" production --yes --token="${VERCEL_TOKEN:-}" --scope="$TEAM" 2>/dev/null || true
  vercel env rm "$name" preview   --yes --token="${VERCEL_TOKEN:-}" --scope="$TEAM" 2>/dev/null || true

  echo -n "$value" | vercel env add "$name" production --token="${VERCEL_TOKEN:-}" --scope="$TEAM" <<< "$value"
  echo -n "$value" | vercel env add "$name" preview    --token="${VERCEL_TOKEN:-}" --scope="$TEAM" <<< "$value"
  echo "  SET   $name"
}

# ── load values ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -o allexport; source "$PROJECT_ROOT/.env"; set +o allexport
fi

# ── main ─────────────────────────────────────────────────────────────────────

require_vercel

echo ""
echo "Setting Vercel env vars for project: $PROJECT (team: $TEAM)"
echo ""

set_env "VITE_FIREBASE_API_KEY"             "${VITE_FIREBASE_API_KEY:-}"
set_env "VITE_FIREBASE_AUTH_DOMAIN"         "${VITE_FIREBASE_AUTH_DOMAIN:-}"
set_env "VITE_FIREBASE_PROJECT_ID"          "${VITE_FIREBASE_PROJECT_ID:-}"
set_env "VITE_FIREBASE_STORAGE_BUCKET"      "${VITE_FIREBASE_STORAGE_BUCKET:-}"
set_env "VITE_FIREBASE_MESSAGING_SENDER_ID" "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}"
set_env "VITE_FIREBASE_APP_ID"              "${VITE_FIREBASE_APP_ID:-}"
set_env "VITE_SENTRY_DSN"                   "${VITE_SENTRY_DSN:-}"

# Backend-only (server-side Vercel Functions — not prefixed with VITE_)
set_env "FIREBASE_SERVICE_ACCOUNT_KEY"  "${FIREBASE_SERVICE_ACCOUNT_KEY:-}"
set_env "GEMINI_API_KEY"                "${GEMINI_API_KEY:-}"
set_env "GEMINI_MODEL"                  "${GEMINI_MODEL:-gemini-2.0-flash}"

echo ""
echo "Done. Verify at: https://vercel.com/saurabhs-projects-4d5cc478/trend-equity/settings/environment-variables"
