import React, { useState, useEffect } from 'react';
import {
  Trophy,
  X,
  Loader2,
  CheckCircle2,
  LogIn,
  AlertCircle,
  ExternalLink,
  ListFilter,
  Send,
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from 'firebase/auth';
import { useCuratedTE100 } from '../../hooks/useTE100';

interface TE100ModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = { projectName: '', url: '', pitch: '', mrr: '' };

export const TE100Modal: React.FC<TE100ModalProps> = ({ user, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'submit'>('browse');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { entries, loading: entriesLoading, error: entriesError } = useCuratedTE100();

  // BUG-7 FIX: reset state every time the modal opens fresh
  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setSubmitError(null);
      setFormData(EMPTY_FORM);
      setActiveTab('browse');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // BUG-6 FIX: show inline auth gate instead of silently returning
    if (!user) {
      setSubmitError('You must be signed in to submit an application.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'te100_submissions'), {
        ...formData,
        userId: user.uid,
        userEmail: user.email,
        timestamp: serverTimestamp(),
        status: 'pending',
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting TE-100:', err);
      // BUG-6 FIX: replace alert() with inline error state
      setSubmitError('Failed to submit application. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden shadow-emerald-900/10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
              Trend-Equity 100
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'browse'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            Browse TE-100
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'submit'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Apply
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === 'browse' ? (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h4 className="text-lg font-black uppercase italic">The TE-100</h4>
                <p className="text-xs text-zinc-400">
                  Curated AI-native startups built with Trend-Equity.
                </p>
              </div>

              {entriesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>
              ) : entriesError ? (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">Failed to load entries. Please try again.</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Trophy className="w-10 h-10 text-zinc-700 mx-auto" />
                  <p className="text-sm text-zinc-500">No entries yet. Be the first to apply!</p>
                  <button
                    onClick={() => setActiveTab('submit')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors"
                  >
                    Submit your project →
                  </button>
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 bg-zinc-800/40 border border-zinc-700/40 rounded-xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-sm font-bold text-white">{entry.projectName}</h5>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-emerald-400 transition-colors shrink-0"
                        aria-label={`Visit ${entry.projectName}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{entry.pitch}</p>
                    {entry.mrr && (
                      <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                        MRR: {entry.mrr}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Submit tab */
            submitted ? (
              <div className="text-center space-y-4 py-8">
                <div className="w-16 h-16 bg-emerald-500/10 flex items-center justify-center rounded-full mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-black uppercase italic">Application Sent</h4>
                  <p className="text-sm text-zinc-400">
                    Our VC algorithms are reviewing your submission. We'll notify you via email if
                    you make the TE-100 list.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-2 bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1 text-center pb-2">
                  <h4 className="text-lg font-black uppercase italic">Apply for TE-100</h4>
                  <p className="text-xs text-zinc-400">
                    The premier directory of AI-native startups built with Trend-Equity.
                  </p>
                </div>

                {/* BUG-6 FIX: inline auth gate instead of silent no-op */}
                {!user && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <LogIn className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      You need to be signed in to apply. Click <strong>Sign In</strong> in the
                      header first.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="e.g. Acme AI"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                    One Sentence Pitch
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.pitch}
                    onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="We do X for Y by doing Z"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                    Current MRR (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.mrr}
                    onChange={(e) => setFormData({ ...formData, mrr: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="$0"
                  />
                </div>

                {/* BUG-6 FIX: inline error banner instead of alert() */}
                {submitError && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{submitError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4" />
                  )}
                  {loading ? 'Submitting…' : 'Submit Application'}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
};
