import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { TierLimitsProvider } from './context/TierLimitsContext.tsx';
import './index.css';

// DSN is intentionally public — Sentry security relies on trusted origins, not DSN secrecy.
// Override via VITE_SENTRY_DSN env var for per-environment control.
const SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  'https://60d47c74ed6e5ade9e0da8d4c12643f4@o241198.ingest.us.sentry.io/4511312009625600';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.MODE,
  // Always on in production builds; in dev, only if VITE_SENTRY_DSN is explicitly set
  enabled: import.meta.env.PROD || !!import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TierLimitsProvider>
      <App />
    </TierLimitsProvider>
  </StrictMode>
);
