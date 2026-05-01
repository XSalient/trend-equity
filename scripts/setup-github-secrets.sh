#!/usr/bin/env bash
# setup-github-secrets.sh
#
# One-shot script to push all required GitHub Secrets for CI/CD.
# Run once after cloning. Requires GitHub CLI (gh) or a GITHUB_TOKEN.
#
# Usage:
#   export GITHUB_TOKEN=ghp_...
#   bash scripts/setup-github-secrets.sh
#
# Or with gh CLI already authenticated:
#   bash scripts/setup-github-secrets.sh
#
# Values sourced from:
#   - .secrets_backup/android-keystore-values.txt  (Android signing)
#   - Your local .env file                          (Firebase + Sentry)

set -euo pipefail

OWNER="XSalient"
REPO="trend-equity"

# ── helpers ──────────────────────────────────────────────────────────────────

check_deps() {
  if command -v gh &>/dev/null; then
    echo "Using gh CLI"
    USE_GH=1
  elif [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "Using GITHUB_TOKEN with curl"
    USE_GH=0
  else
    echo "ERROR: install 'gh' CLI or export GITHUB_TOKEN=ghp_..."
    exit 1
  fi
}

set_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  SKIP  $name (empty — fill in manually)"
    return
  fi
  if [[ "${USE_GH}" == "1" ]]; then
    echo -n "$value" | gh secret set "$name" --repo "$OWNER/$REPO"
  else
    # GitHub REST API — encrypt via gh CLI's libsodium wrapper isn't available
    # without gh, so we call the API directly. GitHub requires sodium encryption
    # which needs the public key. This simplified version uses gh-style curl.
    local pub_key pub_key_id encrypted
    pub_key=$(curl -sS -H "Authorization: token $GITHUB_TOKEN" \
      "https://api.github.com/repos/$OWNER/$REPO/actions/secrets/public-key")
    pub_key_id=$(echo "$pub_key" | python3 -c "import sys,json; print(json.load(sys.stdin)['key_id'])")
    encrypted=$(echo -n "$value" | python3 - <<'PYEOF'
import sys, base64, json
from nacl import encoding, public

raw_key = sys.stdin.buffer.read()
pub_key_b64 = json.loads(open('/dev/stdin').read())  # placeholder
PYEOF
    )
    # Sodium encryption requires PyNaCl. If unavailable, use gh CLI instead.
    echo "  NOTE  GitHub secret encryption requires gh CLI or PyNaCl."
    echo "        Install gh: https://cli.github.com"
    echo "        Then re-run this script."
    exit 1
  fi
  echo "  SET   $name"
}

# ── load values ──────────────────────────────────────────────────────────────

load_env() {
  local file="$1"
  if [[ -f "$file" ]]; then
    # shellcheck disable=SC1090
    set -o allexport; source "$file"; set +o allexport
  fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

load_env "$PROJECT_ROOT/.env"
load_env "$PROJECT_ROOT/.secrets_backup/android-keystore-values.txt"

# ── main ─────────────────────────────────────────────────────────────────────

check_deps

echo ""
echo "Setting GitHub Secrets for $OWNER/$REPO ..."
echo ""

# Firebase (sourced from .env)
set_secret "VITE_FIREBASE_API_KEY"              "${VITE_FIREBASE_API_KEY:-}"
set_secret "VITE_FIREBASE_AUTH_DOMAIN"          "${VITE_FIREBASE_AUTH_DOMAIN:-}"
set_secret "VITE_FIREBASE_PROJECT_ID"           "${VITE_FIREBASE_PROJECT_ID:-}"
set_secret "VITE_FIREBASE_STORAGE_BUCKET"       "${VITE_FIREBASE_STORAGE_BUCKET:-}"
set_secret "VITE_FIREBASE_MESSAGING_SENDER_ID"  "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}"
set_secret "VITE_FIREBASE_APP_ID"               "${VITE_FIREBASE_APP_ID:-}"

# Sentry (set VITE_SENTRY_DSN in .env or export before running)
set_secret "VITE_SENTRY_DSN" "${VITE_SENTRY_DSN:-}"

# Android signing (sourced from .secrets_backup/android-keystore-values.txt)
set_secret "ANDROID_KEYSTORE_BASE64"    "${ANDROID_KEYSTORE_BASE64:-}"
set_secret "ANDROID_KEY_ALIAS"          "${ANDROID_KEY_ALIAS:-}"
set_secret "ANDROID_KEYSTORE_PASSWORD"  "${ANDROID_KEYSTORE_PASSWORD:-}"
set_secret "ANDROID_KEY_PASSWORD"       "${ANDROID_KEY_PASSWORD:-}"

echo ""
echo "Done. Verify at: https://github.com/$OWNER/$REPO/settings/secrets/actions"
echo ""
echo "Next steps:"
echo "  1. Create a Sentry project at https://sentry.io (platform: JavaScript → React)"
echo "  2. Add the DSN to: .env, GitHub Secrets (VITE_SENTRY_DSN), and Vercel env vars"
echo "  3. Configure the >1% crash rate alert in Sentry → Alerts"
echo "  4. Push the keystore file to a secure store (1Password / Doppler)"
echo "     File: android/app/trendequity-release.keystore"
echo "     Values: .secrets_backup/android-keystore-values.txt"
