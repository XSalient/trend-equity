import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Tier } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorUtils';

/**
 * TE-38: read-only view of the Stripe subscription, mirrored from the
 * `users/{uid}` doc. Everything here is written server-side (webhook /
 * checkout return leg) — the client never mutates any of it.
 */
export interface SubscriptionInfo {
  /** End of the paid period (renewal date, or expiry if cancelAtPeriodEnd). */
  proEndDate: Date | null;
  /** True when the user cancelled in the portal but the period hasn't ended. */
  cancelAtPeriodEnd: boolean;
  /** Raw Stripe subscription status: active | past_due | canceled | … */
  status: string | null;
  /** True once a Stripe customer exists — gates the "Manage billing" button. */
  hasBillingAccount: boolean;
}

const EMPTY_SUBSCRIPTION: SubscriptionInfo = {
  proEndDate: null,
  cancelAtPeriodEnd: false,
  status: null,
  hasBillingAccount: false,
};

export function useTier(user: User | null) {
  const [tier, setTier] = useState<Tier>('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(EMPTY_SUBSCRIPTION);
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
      // TE-08: subscribe rather than read once — the tier is written server-side
      // by the Stripe webhook / checkout confirmation, so the UI has to pick up
      // the upgrade without a page reload.
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTier((data.tier as Tier) || 'free');
            setIsAdmin(data.role === 'admin');
            const end = data.proEndDate;
            setSubscription({
              proEndDate:
                end && typeof end.toDate === 'function' ? end.toDate() : end ? new Date(end) : null,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
              status: (data.subscriptionStatus as string) ?? null,
              hasBillingAccount: Boolean(data.stripeCustomerId),
            });
          } else {
            // User doc doesn't exist yet (new user) — default to free tier
            setTier('free');
            setIsAdmin(false);
            setSubscription(EMPTY_SUBSCRIPTION);
          }
        },
        (err: any) => {
          // Permission denied (common for new users before server setup) — gracefully default to free
          if (err?.code === 'permission-denied') {
            console.warn('[TIER] User doc not accessible, defaulting to free tier');
            setTier('free');
            setIsAdmin(false);
            setSubscription(EMPTY_SUBSCRIPTION);
          } else {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }
        }
      );
      return unsubscribe;
    }

    setTier('free');
    setIsAdmin(false);
    setSubscription(EMPTY_SUBSCRIPTION);
  }, [user]);

  /**
   * TE-14: Removed fake upgrade functionality.
   * Tier changes are NOT persisted to Firestore from the client.
   * Tier should only be changed server-side after verified payment (e.g., Stripe webhook).
   * Users join waitlist instead of fake upgrading.
   */
  const handleUpgrade = async (plan: Tier) => {
    // TE-14: No longer used — waitlist modal handles tier interest instead
    console.warn('[useTier] handleUpgrade called but should be replaced by waitlist modal');
  };

  const handleDowngrade = async (plan: Tier) => {
    setTier(plan);
    notify(`Downgraded to ${plan.toUpperCase()}.`);
  };

  /**
   * TE-14: upgradeToBuilder no longer fakes an upgrade.
   * Tier changes only happen server-side after verified payment (Stripe webhook).
   */
  const upgradeToBuilder = async (onLoginNeeded: () => void) => {
    if (!user) {
      onLoginNeeded();
      return;
    }
    // TE-14: No longer changes tier client-side. Waitlist modal handles tier interest.
    notify('Join the waitlist to get Builder tier when payments launch.');
  };

  return {
    tier,
    isAdmin,
    subscription,
    setTier,
    handleUpgrade,
    handleDowngrade,
    upgradeToBuilder,
    tierNotification,
  };
}
