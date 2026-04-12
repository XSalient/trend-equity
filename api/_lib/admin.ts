/**
 * Shared Firebase Admin SDK initialisation — single source of truth.
 * Imported by cache.ts, usage.ts, auth.ts, and any route that needs Admin access.
 * Safe to call multiple times; initialises at most once per warm function invocation.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length > 0) return;
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    initializeApp({
      credential: cert(JSON.parse(serviceAccountKey)),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    // Local dev: relies on Application Default Credentials (gcloud auth application-default login)
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'trend-equity-63c48' });
  }
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}

export function getAdminAuth() {
  initAdmin();
  return getAuth();
}
