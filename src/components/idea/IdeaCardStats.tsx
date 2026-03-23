import React from 'react';
import { Idea } from '../../types';

interface IdeaCardStatsProps {
  idea: Idea;
}

export const IdeaCardStats: React.FC<IdeaCardStatsProps> = ({ idea }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Potential Score</span>
          <span className="text-sm font-black font-mono text-emerald-400 leading-none">{idea.revenuePotentialScore}</span>
        </div>
        <div className="h-2.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5 relative">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 relative"
            style={{ width: `${idea.revenuePotentialScore * 10}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
          <div
            className="absolute top-0 bottom-0 left-0 bg-emerald-500/20 blur-md"
            style={{ width: `${idea.revenuePotentialScore * 10}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cost & Effort</span>
          <p className="text-xs text-zinc-300 font-medium">{idea.costEffort}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Exit Strategy</span>
          <p className="text-xs text-zinc-300 font-medium line-clamp-2">{idea.potentialExit}</p>
        </div>
      </div>
    </div>
  );
};
