import React, { useState } from 'react';
import { Trophy, X, Loader2, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from 'firebase/auth';

interface TE100ModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TE100Modal: React.FC<TE100ModalProps> = ({ user, isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    projectName: '',
    url: '',
    pitch: '',
    mrr: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'te100_submissions'), {
        ...formData,
        userId: user.uid,
        userEmail: user.email,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting TE-100:', err);
      alert('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden shadow-emerald-900/10">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Trend-Equity 100</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-emerald-500/10 flex items-center justify-center rounded-full mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-black uppercase italic">Application Sent</h4>
                <p className="text-sm text-zinc-400">Our VC algorithms are reviewing your submission. We will notify you via email if you make the TE-100 list.</p>
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
                <p className="text-xs text-zinc-400">The premier directory of AI-native startups built with Trend-Equity.</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Project Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.projectName}
                  onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. Acme AI"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Website URL</label>
                <input 
                  type="url" 
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">One Sentence Pitch</label>
                <input 
                  type="text" 
                  required
                  value={formData.pitch}
                  onChange={(e) => setFormData({...formData, pitch: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="We do X for Y by doing Z"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Current MRR (Optional)</label>
                <input 
                  type="text" 
                  value={formData.mrr}
                  onChange={(e) => setFormData({...formData, mrr: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="$0"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
