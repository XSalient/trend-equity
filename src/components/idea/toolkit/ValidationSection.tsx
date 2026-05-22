import React from 'react';
import { X, Globe, ClipboardList, Target, BarChart3, RefreshCw } from 'lucide-react';
import { Idea } from '../../../types';
import { ToolkitSkeleton } from '../../layout/SkeletonLoaders';

interface ValidationSectionProps {
  idea: Idea;
  setActiveToolkit: (toolkit: any) => void;
  isAdmin?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const safeString = (val: any) => {
  if (typeof val === 'string') return val;
  if (!val) return '';
  return JSON.stringify(val);
};

export const ValidationSection: React.FC<ValidationSectionProps> = ({
  idea,
  setActiveToolkit,
  isAdmin,
  onRefresh,
  isRefreshing,
}) => {
  const toolkit = idea.validationToolkit;

  if (!toolkit && !isRefreshing) {
    return (
      <div className="mt-2">
        <ToolkitSkeleton />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-7 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-8 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Validation Toolkit</h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
              GTM Strategy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-50"
              title="Force refresh analysis"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => setActiveToolkit(null)}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isRefreshing && toolkit && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 pb-1">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Refreshing toolkit…</span>
        </div>
      )}

      {!toolkit ? (
        <div className="py-10">
          <ToolkitSkeleton />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Landing Page */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Landing Page Copy</span>
            </div>
            <div className="p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/30 space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Hero Headline</p>
                <p className="text-sm font-semibold text-white leading-tight">
                  {safeString(toolkit.landingPage?.hero)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Sub-headline</p>
                <p className="text-xs text-zinc-400">{safeString(toolkit.landingPage?.subHero)}</p>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                {(toolkit.landingPage?.valueProps || []).map((prop: any, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-medium rounded-md border border-emerald-500/20"
                  >
                    {safeString(prop)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Interview Script */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <ClipboardList className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Interview Script</span>
            </div>
            <div className="space-y-2">
              {(toolkit.interviewScript || []).map((q: any, i: number) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="text-zinc-600 font-mono flex-shrink-0">{i + 1}.</span>
                  <p className="text-zinc-400 leading-relaxed italic">"{safeString(q)}"</p>
                </div>
              ))}
            </div>
          </div>

          {/* Smoke Test */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Target className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Smoke Test Strategy
              </span>
            </div>
            <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <p className="text-xs text-zinc-300 leading-relaxed italic">
                {safeString(toolkit.smokeTest)}
              </p>
            </div>
          </div>

          {/* Success Metrics */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Success Metrics</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(toolkit.successMetrics || []).map((m: any, i: number) => (
                <div
                  key={i}
                  className="px-3 py-2 bg-zinc-800/30 rounded-lg border border-zinc-700/20 text-xs text-zinc-400 flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  {safeString(m)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
