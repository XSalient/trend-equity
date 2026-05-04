import React from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Idea } from '../../../types';
import { ToolkitSkeleton } from '../../layout/SkeletonLoaders';

interface BuildSectionProps {
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

export const BuildSection: React.FC<BuildSectionProps> = ({
  idea,
  setActiveToolkit,
  isAdmin,
  onRefresh,
  isRefreshing,
}) => {
  const buildWithMe = idea.buildWithMe;

  if (!buildWithMe && !isRefreshing) {
    return (
      <div className="mt-2">
        <ToolkitSkeleton />
      </div>
    );
  }

  return (
    <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-emerald-500">Build with Me: Starter Pack</h4>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-50"
              title="Force refresh analysis"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => setActiveToolkit(null)}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isRefreshing || !buildWithMe ? (
        <div className="py-10">
          <ToolkitSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          {/* AI Prompt Pack */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
              AI Prompt Pack (copy & paste)
            </p>
            <div className="space-y-2">
              {(buildWithMe.promptPack || []).map((p: any, i: number) => (
                <div
                  key={i}
                  className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-emerald-400">{safeString(p.title)}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(safeString(p.prompt));
                        alert('Prompt copied to clipboard!');
                      }}
                      className="text-xs font-medium text-zinc-500 hover:text-white transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 italic">
                    "{safeString(p.prompt)}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* First 24 Hours Checklist */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
                First 24 hours checklist
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {(buildWithMe.first24Hours || []).map((task: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/20 text-xs text-zinc-400"
                  >
                    <div className="w-4 h-4 rounded border border-zinc-700 flex-shrink-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500/20 rounded-sm" />
                    </div>
                    {safeString(task)}
                  </div>
                ))}
              </div>
            </div>

            {/* Starter Repo Structure */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
                  Starter repo structure
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(safeString(buildWithMe.repoStructure));
                    alert('Structure copied to clipboard!');
                  }}
                  className="text-xs font-medium text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  Copy Structure
                </button>
              </div>
              <pre className="text-[11px] font-mono text-zinc-400 bg-black/40 p-4 rounded-xl border border-zinc-700/40 overflow-x-auto whitespace-pre-wrap w-full leading-relaxed">
                {safeString(buildWithMe.repoStructure)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
