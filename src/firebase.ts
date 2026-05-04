import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Robust validation to prevent cryptic Firebase errors
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value || value === 'undefined')
  .map(([key]) => key);

if (missingKeys.length > 0) {
  const errorMsg = `[FIREBASE] Critical missing environment variables: ${missingKeys.join(', ')}. Ensure they are set in your Vercel/Doppler settings with the VITE_ prefix.`;
  console.error(errorMsg);
  // Throwing here prevents the app from crashing later with "invalid-api-key"
  if (import.meta.env.PROD) {
    // In production, we might want to show a UI error instead of just throwing
  }
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
