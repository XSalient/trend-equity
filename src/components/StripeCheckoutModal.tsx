import React, { useEffect, useState } from 'react';
import { X, Loader, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PaidTier = 'pro' | 'builder';

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTier: 'free' | 'pro' | 'builder';
  /**
   * TE-45: the plan whose card the user actually clicked. Without it the modal
   * always defaulted to Pro, so "Upgrade now" on the Builder card opened a
   * checkout for $9 Pro instead of $19 Builder.
   */
  initialTier?: PaidTier;
  firebaseToken?: string;
  /**
   * Opens the Stripe Customer Portal. Existing subscribers change plans there —
   * a second Checkout would create a second subscription (docs/PAYMENTS.md).
   */
  onManageBilling?: () => void;
}

const PRICING: Record<
  PaidTier,
  { label: string; price: number; period: string; features: string[] }
> = {
  pro: {
    label: 'Pro',
    price: 9,
    period: 'month',
    features: [
      '25 ideas/day',
      'Unlimited saves',
      'Full VC analysis',
      'CSV export',
      'Validation toolkit',
    ],
  },
  builder: {
    label: 'Builder',
    price: 19,
    period: 'month',
    features: [
      '35 ideas/day',
      'Unlimited saves',
      'Full VC analysis',
      'CSV export',
      'Validation toolkit',
      'Advanced tools',
      'Weekly Radar',
      'Futurecasting',
    ],
  },
};

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  isOpen,
  onClose,
  userTier,
  initialTier,
  firebaseToken,
  onManageBilling,
}) => {
  const [picked, setPicked] = useState<PaidTier>(initialTier ?? 'pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The modal stays mounted between opens, so a stale pick would survive into
  // the next open — even when a different card was clicked.
  useEffect(() => {
    if (!isOpen) return;
    setPicked(initialTier ?? 'pro');
    setError(null);
  }, [isOpen, initialTier]);

  /**
   * Checkout creates a *new* subscription, so it is free → paid only. Cancels
   * and pro↔builder switches go through the Customer Portal (docs/PAYMENTS.md),
   * which is why a subscriber is offered no tier here at all.
   */
  const tierOptions: PaidTier[] = userTier === 'free' ? ['pro', 'builder'] : [];

  // Never let the CTA name — or charge for — a tier that is not on offer. The
  // old code kept an unclamped 'pro' default, which rendered a Builder-only
  // modal with an "Upgrade to Pro" button (TE-45).
  const selectedTier: PaidTier | null = tierOptions.includes(picked)
    ? picked
    : (tierOptions[0] ?? null);

  const handleCheckout = async (tier: PaidTier) => {
    // Without a token the request 401s; say so rather than showing "Network error".
    if (!firebaseToken) {
      setError('Please sign in again before upgrading — your session has expired.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify({ tier }),
      });

      // A missing route or an SPA fallback returns HTML, which would blow up
      // response.json() and surface as a misleading "Network error".
      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        const errorMsg =
          data?.debug ||
          data?.error ||
          `Checkout failed (HTTP ${response.status}). The payment endpoint did not return a valid response.`;
        setError(errorMsg);
        console.error('Checkout failed:', { status: response.status, data });
        setLoading(false);
        return;
      }

      const { url } = data;

      if (!url) {
        setError('No checkout URL returned from server');
        setLoading(false);
        return;
      }

      // Redirect to Stripe checkout page
      window.location.href = url;
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight">
                  {selectedTier ? 'Upgrade your plan' : 'Manage your plan'}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {selectedTier
                    ? 'Get instant access — no waiting list'
                    : 'Your subscription is live — changes happen in the billing portal'}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <p className="text-xs text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Pricing cards */}
              {selectedTier && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tierOptions.map((tier) => (
                    <motion.button
                      key={tier}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setPicked(tier)}
                      aria-pressed={selectedTier === tier}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedTier === tier
                          ? 'border-emerald-500 bg-emerald-500/5'
                          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-2xl font-bold text-white">
                          ${PRICING[tier].price}
                        </span>
                        <span className="text-xs text-zinc-400">/ {PRICING[tier].period}</span>
                      </div>
                      <h4 className="font-bold text-white mb-3">{PRICING[tier].label}</h4>
                      <ul className="space-y-2">
                        {PRICING[tier].features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2 text-xs text-zinc-300"
                          >
                            <Check className="w-4 h-4 text-emerald-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* CTA — Checkout for new subscriptions, portal for existing ones */}
              {selectedTier ? (
                <>
                  <button
                    onClick={() => handleCheckout(selectedTier)}
                    disabled={loading}
                    className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <Loader className="w-4 h-4 animate-spin" />}
                    {loading ? 'Loading...' : `Upgrade to ${PRICING[selectedTier].label}`}
                  </button>

                  {/* Security note */}
                  <p className="text-xs text-zinc-500 text-center">
                    Powered by Stripe • Secure payment processing
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-300">
                    You are already on the{' '}
                    <span className="font-bold text-white uppercase">{userTier}</span> plan. Plan
                    switches, payment methods, invoices and cancellation are all handled in the
                    Stripe billing portal.
                  </p>
                  {onManageBilling && (
                    <button
                      onClick={onManageBilling}
                      className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all"
                    >
                      Manage billing
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
