import React from 'react';
import { X, Target, Flag } from 'lucide-react';
import { Idea } from '../../../types';

interface ProgressSectionProps {
  idea: Idea;
  setActiveToolkit: (toolkit: any) => void;
}

const safeString = (val: any) => {
  if (typeof val === 'string') return val;
  if (!val) return '';
  return JSON.stringify(val);
};

export const ProgressSection: React.FC<ProgressSectionProps> = ({ idea, setActiveToolkit }) => {
  const fullPlan = idea.fullActionPlan;
  if (!fullPlan) return null;

  const roadmap = fullPlan.roadmap || [];
  const completedSteps = roadmap.filter((s: any) => s.isDone).length;
  const totalSteps = roadmap.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-6 mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Execution Progress</h4>
        <button
          onClick={() => setActiveToolkit(null)}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Total Completion</span>
            <span className="text-emerald-500 font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-zinc-800/40 rounded-xl border border-zinc-700/20">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Phase</span>
            </div>
            <p className="text-xs text-white font-semibold">
              {progress < 30 ? 'Initial Research' : progress < 60 ? 'Development' : 'Scaling'}
            </p>
          </div>
          <div className="p-3 bg-zinc-800/40 rounded-xl border border-zinc-700/20">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Milestone</span>
            </div>
            <p className="text-xs text-white font-semibold">
              {totalSteps - completedSteps} steps remaining
            </p>
          </div>
        </div>

        {roadmap.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Recent Activity
            </p>
            <div className="space-y-2">
              {roadmap.slice(0, 3).map((step: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${step.isDone ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  />
                  <span className={step.isDone ? 'text-zinc-400' : 'text-zinc-500'}>
                    {safeString(step.step)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
