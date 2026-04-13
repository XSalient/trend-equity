import React from 'react';
import { Shield } from 'lucide-react';
import { ExpertVetting } from '../../types';

interface IdeaCardVettingProps {
  vettingResult: ExpertVetting;
}

export const IdeaCardVetting: React.FC<IdeaCardVettingProps> = ({ vettingResult }) => {
  return (
    <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-500">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Expert VC Vetting</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
              vettingResult.verdict === 'High Conviction'
                ? 'bg-emerald-500 text-black'
                : vettingResult.verdict === 'Moderate'
                  ? 'bg-amber-500 text-black'
                  : 'bg-red-500 text-white'
            }`}
          >
            {vettingResult.verdict}
          </span>
          <span className="text-xl font-black text-white">{vettingResult.score}/100</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
            Strengths
          </p>
          <ul className="space-y-1">
            {vettingResult.strengths.map((s, i) => (
              <li key={i} className="text-[11px] text-zinc-300 flex gap-2">
                <span className="text-emerald-500">•</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Weaknesses</p>
          <ul className="space-y-1">
            {vettingResult.weaknesses.map((w, i) => (
              <li key={i} className="text-[11px] text-zinc-300 flex gap-2">
                <span className="text-red-500">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pt-2 space-y-2">
        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
          Pivot Suggestions
        </p>
        <div className="flex flex-wrap gap-2">
          {vettingResult.pivotSuggestions.map((p, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] rounded-lg"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
