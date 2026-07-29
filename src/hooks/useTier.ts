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
  /**
   * TE-47: plan this subscription switches to at period end (builder → pro).
   * Null when nothing is scheduled. `tier` stays the *current* entitlement
   * throughout — the user keeps what they paid for until the date lands.
   */
  pendingTier: Tier | null;
  /** When `pendingTier` takes effect. */
  pendingTierDate: Date | null;
}

const EMPTY_SUBSCRIPTION: SubscriptionInfo = {
  proEndDate: null,
  cancelAtPeriodEnd: false,
  status: null,
  hasBillingAccount: false,
  pendingTier: null,
  pendingTierDate: null,
};

/** Firestore Timestamp | Date | epoch → Date, tolerant of all three shapes. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function useTier(user: User | null) {
  const [tier, setTier] = useState<Tier>('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(EMPTY_SUBSCRIPTION);
  /**
   * TE-44: `tier` is an *entitlement* — it is 'free' for anonymous visitors too,
   * which is what feature gates want but is wrong for anything that renders plan
   * identity ("Current plan"). This flag says whether the tier belongs to
   * somebody: a real account, or a dev `?mockTier=` that stands in for one.
   */
  const [hasAccount, setHasAccount] = useState(false);
  /**
   * TE-45: true between sign-in and the first Firestore snapshot. During that
   * window `tier` still reads 'free' for a paying member, which made the pricing
   * UI offer Checkout to somebody who already had a live subscription. Callers
   * that act on plan identity (upgrade CTAs, Checkout) must wait for this.
   */
  const [tierLoading, setTierLoading] = useState(false);

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
        // The mock stands in for a signed-in member of that tier, so plan
        // identity must render as it would for a real account.
        setHasAccount(true);
        setTierLoading(false);
        return;
      }
    }

    if (user) {
      setHasAccount(true);
      setTierLoading(true);
      // TE-08: subscribe rather than read once — the tier is written server-side
      // by the Stripe webhook / checkout confirmation, so the UI has to pick up
      // the upgrade without a page reload.
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(
        userRef,
        (docSnap) => {
          setTierLoading(false);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTier((data.tier as Tier) || 'free');
            setIsAdmin(data.role === 'admin');
            const end = data.proEndDate;
            const pendingAt = data.pendingTierDate;
            const pending = data.pendingTier as Tier | undefined;
            setSubscription({
              proEndDate: toDate(end),
              cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
              status: (data.subscriptionStatus as string) ?? null,
              hasBillingAccount: Boolean(data.stripeCustomerId),
              pendingTier:
                pending && (['free', 'pro', 'builder'] as Tier[]).includes(pending)
                  ? pending
                  : null,
              pendingTierDate: toDate(pendingAt),
            });
          } else {
            // User doc doesn't exist yet (new user) — default to free tier
            setTier('free');
            setIsAdmin(false);
            setSubscription(EMPTY_SUBSCRIPTION);
          }
        },
        (err: any) => {
          // The tier is as resolved as it is going to get — never leave the UI
          // stuck in the loading state on a failed read.
          setTierLoading(false);
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

    // Signed out: free-tier entitlement, but no plan to call theirs (TE-44).
    setTier('free');
    setIsAdmin(false);
    setSubscription(EMPTY_SUBSCRIPTION);
    setHasAccount(false);
    setTierLoading(false);
  }, [user]);

  // TE-38: this hook deliberately exposes NO tier mutators. `users/{uid}.tier`
  // is written only by server-side Stripe paths (see docs/PAYMENTS.md); the
  // client renders the Firestore snapshot and nothing else. The old
  // handleUpgrade/handleDowngrade/upgradeToBuilder trio faked local tier state
  // and desynced the UI from server truth — that was the "user already has this
  // tier or higher" bug. Cancels and plan switches go through the Stripe
  // Customer Portal (POST /api/portal); upgrades go through Checkout.
  return {
    tier,
    isAdmin,
    subscription,
    hasAccount,
    tierLoading,
  };
}
