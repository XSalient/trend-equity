import React, { useState } from 'react';
import { X, Loader, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TIER_LIMITS } from '../constants';

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTier: 'free' | 'pro' | 'builder';
  firebaseToken?: string;
}

const PRICING = {
  pro: {
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
  firebaseToken,
}) => {
  const [selectedTier, setSelectedTier] = useState<'pro' | 'builder'>('pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (tier: 'pro' | 'builder') => {
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

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create checkout session');
        setLoading(false);
        return;
      }

      const { url } = await response.json();

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

  const tierOptions =
    userTier === 'free' ? ['pro', 'builder'] : userTier === 'pro' ? ['builder'] : [];

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
                  Upgrade your plan
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Get instant access — no waiting list</p>
              </div>
              <button
                onClick={onClose}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tierOptions.includes('pro') && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedTier('pro')}
                    className={`p-4 rounded-2xl border-2 transition-all text-left ${
                      selectedTier === 'pro'
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-bold text-white">${PRICING.pro.price}</span>
                      <span className="text-xs text-zinc-400">/ {PRICING.pro.period}</span>
                    </div>
                    <h4 className="font-bold text-white mb-3">Pro</h4>
                    <ul className="space-y-2">
                      {PRICING.pro.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-xs text-zinc-300">
                          <Check className="w-4 h-4 text-emerald-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </motion.button>
                )}

                {tierOptions.includes('builder') && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedTier('builder')}
                    className={`p-4 rounded-2xl border-2 transition-all text-left ${
                      selectedTier === 'builder'
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-bold text-white">
                        ${PRICING.builder.price}
                      </span>
                      <span className="text-xs text-zinc-400">/ {PRICING.builder.period}</span>
                    </div>
                    <h4 className="font-bold text-white mb-3">Builder</h4>
                    <ul className="space-y-2">
                      {PRICING.builder.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-xs text-zinc-300">
                          <Check className="w-4 h-4 text-emerald-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </motion.button>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleCheckout(selectedTier)}
                disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                {loading
                  ? 'Loading...'
                  : `Upgrade to ${selectedTier === 'pro' ? 'Pro' : 'Builder'}`}
              </button>

              {/* Security note */}
              <p className="text-xs text-zinc-500 text-center">
                Powered by Stripe • Secure payment processing
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
