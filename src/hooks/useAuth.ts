import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in popup closed by user.");
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError("Sign-in failed: Localhost is not authorized. Please add 'localhost' to your Authorized Domains in the Firebase Console (Authentication > Settings).");
        return;
      }
      console.error("Login Error:", err);
      setError("Failed to sign in. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  return { user, authReady, handleLogin, handleLogout, error, setError };
}
