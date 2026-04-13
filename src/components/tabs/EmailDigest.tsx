import React, { useState } from 'react';
import { Mail, Check, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';

interface EmailDigestTabProps {
  user: User | null;
}

export const EmailDigestTab: React.FC<EmailDigestTabProps> = ({ user }) => {
  const [dailyOn, setDailyOn] = useState(true);
  const [radarOn, setRadarOn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return; // guard: button is hidden when no user
    setSaving(true);
    // Simulate a short async save (replace with Firestore write when ready)
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="p-8 bg-zinc-900/50 border border-white/5 rounded-3xl text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">
            Priority Email Digest
          </h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            Get the most investable signals delivered to your inbox before the market wakes up.
          </p>
        </div>

        <div className="space-y-6 max-w-sm mx-auto">
          {/* Toggles */}
          <div className="flex flex-col gap-4">
            {/* Daily Digest toggle */}
            <button
              onClick={() => setDailyOn((v) => !v)}
              className="flex items-center justify-between p-4 bg-zinc-800/50 border border-white/5 rounded-xl text-left w-full hover:border-zinc-700/50 transition-colors"
            >
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">
                  Daily Digest
                </p>
                <p className="text-[10px] text-zinc-500">Every morning at 8:00 AM</p>
              </div>
              <div
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${dailyOn ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-200 ${dailyOn ? 'right-0.5' : 'left-0.5'}`}
                />
              </div>
            </button>

            {/* Weekly Radar toggle */}
            <button
              onClick={() => setRadarOn((v) => !v)}
              className="flex items-center justify-between p-4 bg-zinc-800/50 border border-white/5 rounded-xl text-left w-full hover:border-zinc-700/50 transition-colors"
            >
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">
                  Weekly Trend Radar
                </p>
                <p className="text-[10px] text-zinc-500">Every Sunday at 6:00 PM</p>
              </div>
              <div
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${radarOn ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-200 ${radarOn ? 'right-0.5' : 'left-0.5'}`}
                />
              </div>
            </button>
          </div>

          {/* Save button — shows sign-in gate when unauthenticated */}
          {user ? (
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="w-full py-4 flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-70"
            >
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Preferences Saved
                  </motion.span>
                ) : (
                  <motion.span
                    key="save"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {saving ? 'Saving…' : 'Save Preferences'}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-left">
                <LogIn className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <p className="text-xs text-zinc-400">
                  Sign in to save your preferences and receive digests.
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
            {user?.email
              ? `Digests are sent to ${user.email}`
              : 'Sign in to set your delivery email'}
          </p>
        </div>
      </div>
    </div>
  );
};
