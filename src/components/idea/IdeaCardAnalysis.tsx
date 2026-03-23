import React from 'react';
import { Target, Zap, HelpCircle, DollarSign, TrendingUp } from 'lucide-react';
import { Idea } from '../../types';

interface IdeaCardAnalysisProps {
  idea: Idea;
}

export const IdeaCardAnalysis: React.FC<IdeaCardAnalysisProps> = ({ idea }) => {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-500">
            <Target className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">VC Justification</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
            {idea.vcJustification}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-500 group/help relative">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Unfair Advantage</span>
            <HelpCircle className="w-3 h-3 text-zinc-500 cursor-help" />
            <div className="absolute bottom-full mb-2 left-0 w-48 p-2 bg-zinc-800 text-[10px] text-zinc-300 rounded-lg opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all z-50 border border-zinc-700 shadow-xl pointer-events-none">
              Proprietary edge: data moat, patents, network effects, or unique distribution channels.
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
            {idea.unfairAdvantage}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-500">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Revenue Model</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 font-mono h-full">
            {idea.revenueSkeleton}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Trend Sources</span>
          </div>
          <ul className="space-y-1.5 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 h-full">
            {(idea.trendSources || []).map((source, i) => (
              <li key={i} className="text-[11px] text-zinc-500 flex gap-2 items-start">
                <span className="text-emerald-500 mt-0.5">•</span>
                {source}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};
