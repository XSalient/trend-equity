import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // On native, pick up the Google sign-in result after redirect completes
    if (Capacitor.isNativePlatform()) {
      getRedirectResult(auth).catch(() => {});
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      if (Capacitor.isNativePlatform()) {
        // Popups are blocked in native WebViews — use full-page redirect instead
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in popup closed by user.");
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Sign-in failed: ${window.location.hostname} is not authorized. Please add it to Authorized Domains in the Firebase Console (Authentication > Settings).`);
        return;
      }
      console.error("Login Error:", err);
      setError("Failed to sign in. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  return { user, authReady, handleLogin, handleLogout, error, setError };
}
