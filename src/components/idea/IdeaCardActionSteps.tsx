import React from 'react';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Idea } from '../../types';
import { TIER_LIMITS, type Tier } from '../../constants';

interface IdeaCardActionStepsProps {
  idea: Idea;
  tier: Tier;
}

export const IdeaCardActionSteps: React.FC<IdeaCardActionStepsProps> = ({ idea, tier }) => {
  const stepLimit = TIER_LIMITS[tier].roadmapSteps;
  const totalSteps = idea.nextSteps?.length || 0;
  const isTruncated = totalSteps > stepLimit;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-emerald-500">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-xs font-semibold">Next Steps</span>
      </div>
      <div className="grid gap-2">
        {(idea.nextSteps || []).slice(0, stepLimit).map((step, i) => {
          const parts = step.split('|').map((s) => s.trim());
          const title = parts[0] || step;
          const timeline = parts[1];
          const risk = parts[2];
          const tool = parts[3];

          return (
            <div
              key={i}
              className="flex gap-3 p-3 bg-zinc-800/30 rounded-xl border border-white/5 group/step hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                {i + 1}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-medium text-zinc-200">{title}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {timeline && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeline}
                    </span>
                  )}
                  {risk && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500/50" /> {risk}
                    </span>
                  )}
                  {tool && <span className="text-xs text-emerald-500/70 font-mono">{tool}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {isTruncated && (
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800 text-center">
            <p className="text-xs text-zinc-500">
              {tier === 'free'
                ? `Upgrade to Pro to unlock all ${totalSteps} steps`
                : `Upgrade to Builder for full roadmap`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
