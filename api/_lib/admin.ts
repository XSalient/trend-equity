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
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (serviceAccountKey) {
    try {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountKey)),
        projectId,
      });
      return;
    } catch (e: any) {
      console.warn(
        '[FIREBASE ADMIN] FIREBASE_SERVICE_ACCOUNT_KEY JSON parse failed, trying file fallback:',
        e.message
      );
    }
  }

  if (serviceAccountPath) {
    const { readFileSync } = require('fs');
    const sa = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(sa), projectId });
    return;
  }

  // Fall back to Application Default Credentials
  if (!projectId) {
    throw new Error(
      '[FIREBASE ADMIN] Missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID in environment.'
    );
  }
  initializeApp({ projectId });
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}

export function getAdminAuth() {
  initAdmin();
  return getAuth();
}
