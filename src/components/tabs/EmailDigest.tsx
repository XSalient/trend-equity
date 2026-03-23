import React from 'react';
import { Mail } from 'lucide-react';
import { User } from 'firebase/auth';

interface EmailDigestTabProps {
  user: User | null;
}

export const EmailDigestTab: React.FC<EmailDigestTabProps> = ({ user }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="p-8 bg-zinc-900/50 border border-white/5 rounded-3xl text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Priority Email Digest</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            Get the most investable signals delivered to your inbox before the market wakes up.
          </p>
        </div>

        <div className="space-y-6 max-w-sm mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 border border-white/5 rounded-xl">
              <div className="text-left">
                <p className="text-xs font-bold text-white uppercase tracking-widest">Daily Digest</p>
                <p className="text-[10px] text-zinc-500">Every morning at 8:00 AM</p>
              </div>
              <div className="w-10 h-5 bg-emerald-500 rounded-full relative cursor-pointer">
                <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow-lg" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 border border-white/5 rounded-xl opacity-50">
              <div className="text-left">
                <p className="text-xs font-bold text-white uppercase tracking-widest">Weekly Trend Radar</p>
                <p className="text-[10px] text-zinc-500">Every Sunday at 6:00 PM</p>
              </div>
              <div className="w-10 h-5 bg-zinc-700 rounded-full relative cursor-pointer">
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-lg" />
              </div>
            </div>
          </div>
          <button className="w-full py-4 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20">
            Save Preferences
          </button>
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
            Digests are sent to {user?.email}
          </p>
        </div>
      </div>
    </div>
  );
};
