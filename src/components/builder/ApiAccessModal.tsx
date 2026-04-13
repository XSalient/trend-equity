import React, { useState } from 'react';
import { Settings, X, Copy, CheckCircle2, Terminal } from 'lucide-react';
import { User } from 'firebase/auth';

interface ApiAccessModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ApiAccessModal: React.FC<ApiAccessModalProps> = ({ user, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  // We mock the API key generation for the frontend MVP
  const mockApiKey = `te_live_${user?.uid?.substring(0, 16) || 'mock_key_8x9f2a'}_bld`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mockApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden shadow-emerald-900/10">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
              API Access
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-1">
            <h4 className="text-xl font-black uppercase italic">Developer Keys</h4>
            <p className="text-sm text-zinc-400">
              Unlock programmatic access to the Trend-Equity AI Engine to power your own workflows.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
              Your API Secret Key
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400 overflow-x-auto">
                {mockApiKey}
              </div>
              <button
                onClick={handleCopy}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors shrink-0"
              >
                {copied ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 italic mt-1">
              Do not expose this key in client-side code.
            </p>
          </div>

          <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-mono text-zinc-400">cURL Example</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-zinc-300 leading-relaxed">
                {`curl -X POST https://api.trendequity.com/v1/generate \\
  -H "Authorization: Bearer ${mockApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "daily",
    "date": "2026-03-23"
  }'`}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Rate Limit
              </p>
              <p className="text-lg font-black text-white">
                100<span className="text-xs text-zinc-500 font-normal">/min</span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Quota Used
              </p>
              <p className="text-lg font-black text-white">4%</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Status
              </p>
              <p className="text-lg font-black text-emerald-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Active
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
