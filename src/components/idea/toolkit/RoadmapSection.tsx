import React from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Idea } from '../../../types';
import { ToolkitSkeleton } from '../../layout/SkeletonLoaders';

interface RoadmapSectionProps {
  idea: Idea;
  setActiveToolkit: (toolkit: any) => void;
  isGeneratingPlan: boolean;
  handleGenerateFullPlan: () => void;
  handleToggleStep: (id: string) => void;
  handleRemoveStep: (id: string) => void;
  handleExplainSection: (section: string, context: string) => void;
  explainingSection: string | null;
  explanation: { section: string; text: string } | null;
  setExplanation: (val: any) => void;
  isAddingStep: boolean;
  setIsAddingStep: (val: boolean) => void;
  newStep: any;
  setNewStep: (val: any) => void;
  handleAddCustomStep: () => void;
  isAdmin?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const safeString = (val: any) => {
  if (typeof val === 'string') return val;
  if (!val) return '';
  return JSON.stringify(val);
};

export const RoadmapSection: React.FC<RoadmapSectionProps> = ({
  idea,
  setActiveToolkit,
  isGeneratingPlan,
  handleGenerateFullPlan,
  handleToggleStep,
  handleRemoveStep,
  handleExplainSection,
  explainingSection,
  explanation,
  setExplanation,
  isAddingStep,
  setIsAddingStep,
  newStep,
  setNewStep,
  handleAddCustomStep,
  isAdmin,
  onRefresh,
  isRefreshing,
}) => {
  const fullPlan = idea.fullActionPlan;

  if (!fullPlan && !isGeneratingPlan) {
    return (
      <div className="p-8 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl text-center space-y-4 mt-2">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white">Generate Implementation Roadmap</h4>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Get a step-by-step 30-60-90 day execution plan tailored for this idea.
          </p>
        </div>
        <button
          onClick={() => handleGenerateFullPlan()}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20"
        >
          Generate Full Roadmap
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-7 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-6 mt-2 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />

      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <h4 className="text-sm font-bold text-white">Execution Roadmap</h4>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing || isGeneratingPlan}
              className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-50"
              title="Force refresh analysis"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing || isGeneratingPlan ? 'animate-spin' : ''}`}
              />
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

      {!fullPlan ? (
        <div className="py-10">
          <ToolkitSkeleton />
        </div>
      ) : (
        <div className="space-y-4 relative">
          {(isGeneratingPlan || isRefreshing) && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 pb-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Refreshing plan…</span>
            </div>
          )}
          {(fullPlan.roadmap || []).map((item: any, i: number) => (
            <div
              key={item.id || i}
              className={`group p-4 rounded-xl border transition-all ${
                item.isDone
                  ? 'bg-zinc-900/40 border-emerald-500/10 opacity-70'
                  : 'bg-zinc-800/40 border-zinc-700/30 hover:border-zinc-600/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => handleToggleStep(item.id)}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${
                    item.isDone ? 'text-emerald-500' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {item.isDone ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-sm font-semibold ${item.isDone ? 'text-zinc-500 line-through' : 'text-white'}`}
                    >
                      {safeString(item.step)}
                    </h5>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleExplainSection(item.step, item.details)}
                        className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md"
                        title="Explain this step"
                      >
                        {explainingSection === item.step ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {item.isCustom && (
                        <button
                          onClick={() => handleRemoveStep(item.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                          title="Remove step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {safeString(item.details)}
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    {item.milestone && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                        <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider">
                          {safeString(item.milestone)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isAddingStep ? (
            <div className="p-4 bg-zinc-800/60 rounded-xl border border-emerald-500/30 space-y-3">
              <input
                autoFocus
                placeholder="Step title..."
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                value={newStep.step}
                onChange={(e) => setNewStep({ ...newStep, step: e.target.value })}
              />
              <textarea
                placeholder="Additional details..."
                className="w-full bg-transparent text-xs text-zinc-400 placeholder:text-zinc-600 focus:outline-none resize-none"
                rows={2}
                value={newStep.details}
                onChange={(e) => setNewStep({ ...newStep, details: e.target.value })}
              />
              <div className="flex justify-between items-center pt-2">
                <input
                  placeholder="Milestone (e.g. Day 30)"
                  className="bg-transparent text-[10px] text-emerald-500 placeholder:text-zinc-600 focus:outline-none uppercase font-bold tracking-wider"
                  value={newStep.milestone}
                  onChange={(e) => setNewStep({ ...newStep, milestone: e.target.value })}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddingStep(false)}
                    className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomStep}
                    disabled={!newStep.step}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider disabled:opacity-50"
                  >
                    Add Step
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingStep(true)}
              className="w-full py-3 flex items-center justify-center gap-2 border border-dashed border-zinc-800 hover:border-zinc-600 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Custom Step
            </button>
          )}
        </div>
      )}

      {/* Explanation Modal Overlay */}
      {explanation && (
        <div className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm p-6 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-sm font-bold text-emerald-400">Expert Explanation</h5>
            <button onClick={() => setExplanation(null)} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-white font-medium mb-2">{safeString(explanation.section)}</p>
          <div className="flex-1 overflow-y-auto">
            <p className="text-xs text-zinc-400 leading-relaxed italic">
              "{safeString(explanation.text)}"
            </p>
          </div>
          <button
            onClick={() => setExplanation(null)}
            className="mt-6 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
};
