# Trend-Equity Setup Guide

This guide explains how to set up the Trend-Equity project on a new development machine using **Doppler** for secret management.

## 🚀 Prerequisites

1.  **Node.js**: Install the latest LTS version.
2.  **Doppler CLI**: [Install Doppler CLI](https://docs.doppler.com/docs/install-cli).
3.  **Git**: Ensure you have access to the repository.

## 🛠️ First-Time Setup

### 1. Clone the Repository
```bash
git clone https://github.com/s7github/trend-equity.git
cd trend-equity
```

### 2. Authenticate Doppler
Log in to your Doppler account on the new machine:
```bash
doppler login
```

### 3. Connect the Project
Link your local directory to the existing Doppler project:
```bash
doppler setup --project trend-equity --config dev
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Run the Application
You can run the app directly using Doppler to inject secrets into the environment:
```bash
doppler run -- npm run dev
```
Alternatively, if you prefer using a `.env` file locally:
```bash
doppler secrets download --format env --no-backup > .env
npm run dev
```

---

## 🔒 Managing Secrets

The project uses a **BFF (Backend For Frontend)** architecture to protect sensitive data. The following secrets are managed via Doppler:

- `GEMINI_API_KEY`: Your Google AI Studio API key.
- `SYSTEM_PROMPT`: The proprietary business logic for the AI engine.
- `FIREBASE_CONFIG`: The application's Firebase credentials.

### Syncing Changes
If you update local configuration files (like `prompts.json`) and want to push them to Doppler:
```powershell
./scripts/doppler_sync.ps1
```

## 🛠️ Technical Stack
- **Frontend**: React, Vite, Tailwind CSS, Motion.
- **Backend**: Node.js, Express (BFF architecture).
- **Database**: Firebase Firestore & Auth.
- **AI**: Google Gemini API.
