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
    // Pick up the Google sign-in result after redirect completes (both web & native)
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Force refresh token once to pick up any new custom claims (tier)
        await u.getIdToken(true);
      }
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (Capacitor.isNativePlatform() || !isLocalhost) {
        // Use redirect for native and production to avoid popup blockers
        await signInWithRedirect(auth, provider);
      } else {
        // Local dev optimization: popups are fine here
        try {
          await signInWithPopup(auth, provider);
        } catch (err: any) {
          console.warn('Login popup issue:', err.code, err.message);
          await signInWithRedirect(auth, provider);
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
