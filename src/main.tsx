import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { TierLimitsProvider } from './context/TierLimitsContext.tsx';
import './index.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  // Capture 100% of transactions in dev, 20% in production
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TierLimitsProvider>
      <App />
    </TierLimitsProvider>
  </StrictMode>
);
