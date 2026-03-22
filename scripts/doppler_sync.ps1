# Doppler Sync Script
# This script will take your local secrets and move them to Doppler.
# PREREQUISITE: Install Doppler CLI (https://docs.doppler.com/docs/install-cli)

# 1. Initialize Doppler project if not done
if (!(Test-Path "doppler.yaml")) {
    Write-Host "Initializing Doppler project..." -ForegroundColor Cyan
    doppler setup --project trend-equity --config dev
}

# 2. Upload .env secrets
Write-Host "Uploading .env secrets..." -ForegroundColor Green
doppler secrets upload .env

# 3. Upload Prompts (as a large secret)
Write-Host "Uploading SYSTEM_PROMPT..." -ForegroundColor Green
$prompts = Get-Content -Raw src/services/prompts.json | ConvertFrom-Json
$prompts.SYSTEM_PROMPT | doppler secrets set SYSTEM_PROMPT --stdin

# 4. Upload Firebase Config
Write-Host "Uploading Firebase Config..." -ForegroundColor Green
Get-Content -Raw firebase-applet-config.json | doppler secrets set FIREBASE_CONFIG --stdin

Write-Host "✅ Sync Complete! You can now access these via the Doppler MCP server." -ForegroundColor Green
