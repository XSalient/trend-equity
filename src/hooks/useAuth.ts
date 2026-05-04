import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.info('[AUTH] Initializing with Project:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
    console.info('[AUTH] Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);

    // Catch errors from the redirect fallback path (e.g. auth/unauthorized-domain)
    getRedirectResult(auth).catch((err: any) => {
      console.error('[AUTH] Redirect result error:', err.code, err.message);
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          `Sign-in failed: ${window.location.hostname} is not authorized. Please add it to Authorized Domains in the Firebase Console.`
        );
      } else {
        setError(`Sign-in failed: ${err.message}`);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        console.info('[AUTH] State changed: USER_IN', u.email);
        // Force refresh token once to pick up any new custom claims (tier)
        try {
          await u.getIdToken(true);
        } catch (e) {
          console.warn('[AUTH] Token refresh failed:', e);
        }
      } else {
        console.info('[AUTH] State changed: USER_OUT');
      }
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    console.info('[AUTH] handleLogin triggered');
    try {
      const provider = new GoogleAuthProvider();

      if (Capacitor.isNativePlatform()) {
        // Native Capacitor: popups not available, must use redirect
        await signInWithRedirect(auth, provider);
      } else {
        try {
          await signInWithPopup(auth, provider);
        } catch (popupErr: any) {
          if (popupErr.code === 'auth/popup-blocked') {
            // Fall back to redirect when browser blocks the popup.
            // Works because vercel.json proxies /__/auth/* to Firebase Hosting,
            // making authDomain (trend-equity.vercel.app) same-origin as the app.
            await signInWithRedirect(auth, provider);
          } else {
            throw popupErr;
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.log('Sign-in popup closed by user.');
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          `Sign-in failed: ${window.location.hostname} is not authorized. Please add it to Authorized Domains in the Firebase Console (Authentication > Settings).`
        );
        return;
      }
      console.error('Login Error:', err);
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleLogout = () => signOut(auth);

  return { user, authReady, handleLogin, handleLogout, error, setError };
}
