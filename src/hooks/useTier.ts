import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Tier } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorUtils';

export function useTier(user: User | null) {
  const [tier, setTier] = useState<Tier>('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [tierNotification, setTierNotification] = useState<string | null>(null);

  const notify = (msg: string) => {
    setTierNotification(msg);
    setTimeout(() => setTierNotification(null), 4000);
  };

  useEffect(() => {
    // FIX (S-3): mockTier & mockAdmin URL param is ONLY active in development/test mode.
    // In production builds this block is removed by the bundler (dead code elimination).
    if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_MODE === 'true') {
      const searchParams = new URLSearchParams(window.location.search);
      const mockTier = searchParams.get('mockTier') as Tier;
      const mockAdmin = searchParams.get('mockAdmin') === 'true';
      if (mockTier && (['free', 'pro', 'builder'] as Tier[]).includes(mockTier)) {
        setTier(mockTier);
        setIsAdmin(mockAdmin || mockTier === 'builder'); // default mock builder to admin for dev simplicity unless specified
        return;
      }
    }

    if (user) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTier((data.tier as Tier) || 'free');
            setIsAdmin(data.role === 'admin');
          } else {
            setTier('free');
            setIsAdmin(false);
          }
        })
        .catch((err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));
    } else {
      setTier('free');
      setIsAdmin(false);
    }
  }, [user]);

  /**
   * FIX (S-9): Tier changes are NOT persisted to Firestore from the client.
   * Tier should only be changed server-side after verified payment (e.g., Stripe webhook).
   * This function updates local UI state only — the tier reverts on reload until
   * a server-side payment system writes the new tier via Admin SDK.
   *
   * FIX (U-2): Replaced alert() with notification state.
   */
  const handleUpgrade = async (plan: Tier) => {
    setTier(plan);
    notify(`Upgraded to ${plan.toUpperCase()}! Reload will revert until payment is connected.`);
  };

  const handleDowngrade = async (plan: Tier) => {
    setTier(plan);
    notify(`Downgraded to ${plan.toUpperCase()}.`);
  };

  /**
   * FIX (B-4): upgradeToBuilder now persists to Firestore for logged-in users.
   * Still requires server-side payment verification to be complete.
   *
   * FIX (U-2): Replaced alert() with notification state.
   */
  const upgradeToBuilder = async (onLoginNeeded: () => void) => {
    if (!user) {
      onLoginNeeded();
      return;
    }
    setTier('builder');
    // NOTE: This client-side Firestore write is blocked by updated security rules.
    // Tier persistence requires a server-side payment webhook. Keeping local state change only.
    notify('Builder tier unlocked for this session.');
  };

  return {
    tier,
    isAdmin,
    setTier,
    handleUpgrade,
    handleDowngrade,
    upgradeToBuilder,
    tierNotification,
  };
}
