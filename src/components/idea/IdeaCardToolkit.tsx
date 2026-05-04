import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Shield,
  Loader2,
  Wand2,
  Zap,
} from 'lucide-react';
import { Idea } from '../../types';
import { ToolkitSkeleton } from '../layout/SkeletonLoaders';

// Sub-components
import { ValidationSection } from './toolkit/ValidationSection';
import { ProgressSection } from './toolkit/ProgressSection';
import { BuildSection } from './toolkit/BuildSection';
import { RoadmapSection } from './toolkit/RoadmapSection';

interface IdeaCardToolkitProps {
  idea: Idea;
  activeToolkit: 'roadmap' | 'build' | 'validation' | 'progress' | null;
  setActiveToolkit: (toolkit: 'roadmap' | 'build' | 'validation' | 'progress' | null) => void;
  isBuilder: boolean;
  isFree: boolean;
  isGeneratingValidation: boolean;
  isGeneratingPlan: boolean;
  isGeneratingBuild: boolean;
  handleGenerateValidation: (refresh?: boolean) => void;
  handleGenerateBuild: (refresh?: boolean) => void;
  handleGenerateFullPlan: (refresh?: boolean) => void;
  handleToggleStep: (id: string) => void;
  handleRemoveStep: (id: string) => void;
  handleExplainSection: (step: string, details: string) => void;
  explainingSection: string | null;
  explanation: { section: string; text: string } | null;
  setExplanation: (val: any) => void;
  isAddingStep: boolean;
  setIsAddingStep: (val: boolean) => void;
  newStep: { step: string; details: string; milestone: string };
  setNewStep: (val: any) => void;
  handleAddCustomStep: () => void;
  isAdmin?: boolean;
}

export const IdeaCardToolkit: React.FC<IdeaCardToolkitProps> = ({
  idea,
  activeToolkit,
  setActiveToolkit,
  isBuilder,
  isFree,
  isGeneratingValidation,
  isGeneratingPlan,
  isGeneratingBuild,
  handleGenerateValidation,
  handleGenerateBuild,
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
}) => {
  const buildWithMe = idea.buildWithMe;
  const validationToolkit = idea.validationToolkit;

  return (
    <div className="space-y-4">
      {/* Pro/Builder Features (Toolkit & Tracker) */}
      {!isFree && (
        <div className={`grid ${isBuilder ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-2`}>
          <button
            onClick={async () => {
              if (validationToolkit)
                setActiveToolkit(activeToolkit === 'validation' ? null : 'validation');
              else {
                const success = await handleGenerateValidation();
                if (success) setActiveToolkit('validation');
              }
            }}
            disabled={isGeneratingValidation}
            className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl border transition-all ${
              activeToolkit === 'validation'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700/50'
            }`}
          >
            {isGeneratingValidation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            Validation Toolkit
          </button>

          {isBuilder && (
            <button
              onClick={() => setActiveToolkit(activeToolkit === 'progress' ? null : 'progress')}
              className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl border transition-all ${
                activeToolkit === 'progress'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700/50'
              }`}
            >
              <Shield className="w-4 h-4" />
              Progress Tracker
            </button>
          )}
        </div>
      )}

      {/* Toolkit Content Area */}
      <AnimatePresence>
        {activeToolkit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* ── Validation Toolkit ── */}
            {activeToolkit === 'validation' && (
              <ValidationSection
                idea={idea}
                setActiveToolkit={setActiveToolkit}
                isAdmin={isAdmin}
                onRefresh={() => handleGenerateValidation(true)}
                isRefreshing={isGeneratingValidation}
              />
            )}

            {/* ── Progress Tracker ── */}
            {activeToolkit === 'progress' && (
              <ProgressSection idea={idea} setActiveToolkit={setActiveToolkit} />
            )}

            {/* ── Build with Me ── */}
            {activeToolkit === 'build' && (
              <BuildSection
                idea={idea}
                setActiveToolkit={setActiveToolkit}
                isAdmin={isAdmin}
                onRefresh={() => handleGenerateBuild(true)}
                isRefreshing={isGeneratingBuild}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full Execution Plan (Builder only) ── */}
      {isBuilder && (
        <RoadmapSection
          idea={idea}
          activeToolkit={activeToolkit}
          setActiveToolkit={setActiveToolkit}
          isGeneratingPlan={isGeneratingPlan}
          handleGenerateFullPlan={handleGenerateFullPlan}
          handleToggleStep={handleToggleStep}
          handleRemoveStep={handleRemoveStep}
          handleExplainSection={handleExplainSection}
          explainingSection={explainingSection}
          explanation={explanation}
          setExplanation={setExplanation}
          isAddingStep={isAddingStep}
          setIsAddingStep={setIsAddingStep}
          newStep={newStep}
          setNewStep={setNewStep}
          handleAddCustomStep={handleAddCustomStep}
          isAdmin={isAdmin}
          onRefresh={() => handleGenerateFullPlan(true)}
          isRefreshing={isGeneratingPlan}
        />
      )}

      {/* ── Build with Me CTA (Builder only) ── */}
      {isBuilder && (
        <div className="pt-4 border-t border-zinc-800/60">
          <button
            onClick={async () => {
              if (buildWithMe) setActiveToolkit(activeToolkit === 'build' ? null : 'build');
              else {
                const success = await handleGenerateBuild();
                if (success) setActiveToolkit('build');
              }
            }}
            disabled={isGeneratingBuild}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${
              activeToolkit === 'build'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
            }`}
          >
            {isGeneratingBuild ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {buildWithMe
              ? activeToolkit === 'build'
                ? 'Hide builder pack'
                : 'View builder pack'
              : 'Build with me'}
          </button>
        </div>
      )}

      {/* ── Upgrade CTA (Free / Pro) ── */}
      {!isBuilder && (
        <div className="pt-4">
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-all border border-zinc-700 group/upgrade">
            <Zap className="w-4 h-4 text-amber-500 group-hover/upgrade:scale-110 transition-transform" />
            Upgrade for more features
          </button>
        </div>
      )}
    </div>
  );
};
