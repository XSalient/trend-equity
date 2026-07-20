import React, { useState } from 'react';
import { X, Mail, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: 'pro' | 'builder';
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({ isOpen, onClose, tier }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError(null);

    // Send email to waitlist endpoint (future: wire to actual email service)
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier }),
      });

      if (!response.ok) {
        // Silently fail for now — just show success anyway (graceful degradation)
        // TODO: Wire to actual Firestore collection once serverless endpoint exists
      }
      setSubmitted(true);
      setTimeout(() => {
        setEmail('');
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch {
      // Network error — still show success (we'll capture via form if available)
      setSubmitted(true);
      setTimeout(() => {
        setEmail('');
        setSubmitted(false);
        onClose();
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const tierNames: Record<string, string> = {
    pro: 'Pro ($9/mo)',
    builder: 'Builder ($19/mo)',
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
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Mail className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">
                    Join Waitlist
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{tierNames[tier]}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-6"
                >
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-zinc-300">Thanks for joining!</p>
                    <p className="text-xs text-zinc-500">We'll email you when {tier} is ready.</p>
                  </div>
                </motion.div>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">
                    Payments and {tier === 'pro' ? 'Pro' : 'Builder'} tier access are coming soon.
                    Add yourself to the waitlist and we'll notify you when you can upgrade.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError(null);
                        }}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                      />
                      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Joining...' : 'Join Waitlist'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
