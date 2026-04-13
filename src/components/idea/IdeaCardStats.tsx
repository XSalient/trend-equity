import React from 'react';
import { Idea } from '../../types';

interface IdeaCardStatsProps {
  idea: Idea;
}

export const IdeaCardStats: React.FC<IdeaCardStatsProps> = ({ idea }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500 font-medium">Potential score</span>
          <span className="text-sm font-bold font-mono text-emerald-400">
            {idea.revenuePotentialScore}
            <span className="text-zinc-600 text-xs font-normal">/10</span>
          </span>
        </div>
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${idea.revenuePotentialScore * 10}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-zinc-500 font-medium">Cost & effort</span>
          <p className="text-xs text-zinc-300">{idea.costEffort}</p>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-zinc-500 font-medium">Exit strategy</span>
          <p className="text-xs text-zinc-300 line-clamp-2">{idea.potentialExit}</p>
        </div>
      </div>
    </div>
  );
};
