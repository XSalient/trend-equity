import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  Wand2,
  Users,
  AlertCircle,
  X,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Hammer,
  Search,
} from 'lucide-react';
import { Idea } from '../types';
import { useIdeaActions } from '../hooks/useIdeaActions';
import { trackEvent } from '../services/trackingService';
import { IdeaComments } from './idea/IdeaComments';
import { useIdeaFeedback } from '../hooks/useIdeaFeedback';

// Sub-components
import { IdeaCardHeader } from './idea/IdeaCardHeader';
import { IdeaCardStats } from './idea/IdeaCardStats';
import { IdeaCardAnalysis } from './idea/IdeaCardAnalysis';
import { IdeaCardActionSteps } from './idea/IdeaCardActionSteps';
import { IdeaCardToolkit } from './idea/IdeaCardToolkit';
import { IdeaCardVetting } from './idea/IdeaCardVetting';
import { IdeaCardEvidence } from './idea/IdeaCardEvidence';
import { IdeaCardQuality } from './idea/IdeaCardQuality';

interface IdeaCardProps {
  idea: Idea;
  isSaved: boolean;
  onToggleSave: () => void;
  onUpdateIdea?: (idea: Idea) => void;
  isSaving: boolean;
  tier: 'free' | 'pro' | 'builder';
  onExport?: (format: 'pdf' | 'notion' | 'gdocs') => void;
  user: any;
  handleLogin: () => void;
  userInput?: string;
  isAdmin?: boolean;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({
  idea,
  isSaved,
  onToggleSave,
  onUpdateIdea,
  isSaving,
  tier,
  onExport,
  user,
  handleLogin,
  userInput,
  isAdmin,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeToolkit, setActiveToolkit] = useState<
    'roadmap' | 'build' | 'validation' | 'progress' | null
  >(null);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStep, setNewStep] = useState({ step: '', details: '', milestone: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    isGeneratingPlan,
    isGeneratingBuild,
    isGeneratingValidation,
    isVetting,
    vettingResult,
    isGatheringEvidence,
    evidenceResult,
    handleGatherEvidence,
    explainingSection,
    explanation,
    setExplanation,
    actionError,
    clearActionError,
    handleGenerateFullPlan,
    handleGenerateBuild,
    handleGenerateValidation,
    handleExplainSection,
    handleExpertVetting,
  } = useIdeaActions(idea, (updated) => {
    onUpdateIdea?.(updated);
    // Auto-open relevant toolkit on generation
    if (updated.fullActionPlan && !idea.fullActionPlan) setActiveToolkit('roadmap');
    if (updated.buildWithMe && !idea.buildWithMe) setActiveToolkit('build');
    if (updated.validationToolkit && !idea.validationToolkit) setActiveToolkit('validation');
    if (updated.expertVetting && !idea.expertVetting) {
      setIsExpanded(true);
      setActiveToolkit(null);
    }
  });

  const {
    reaction,
    toggleReaction,
    loading: reactionLoading,
  } = useIdeaFeedback(idea.id, user?.uid);

  // Engagement telemetry (session-deduped, fire-and-forget)
  useEffect(() => {
    trackEvent('impression', idea.id);
  }, [idea.id]);

  useEffect(() => {
    if (isExpanded) trackEvent('expand', idea.id);
  }, [isExpanded, idea.id]);

  const handleExport = onExport
    ? (format: 'pdf' | 'notion' | 'gdocs') => {
        trackEvent('export', idea.id);
        onExport(format);
      }
    : undefined;

  const isFree = tier === 'free';
  const isBuilder = tier === 'builder';
  // isBuilder gates Builder subscription features (Build with Me, Expert Vetting)
  // Admin features (feed regeneration) are gated separately via the isAdmin prop passed to IdeaFeed/Header

  // BUG-4 FIX: auto-dismiss actionError after 6 seconds
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => clearActionError(), 6000);
    return () => clearTimeout(t);
  }, [actionError, clearActionError]);

  const handleToggleStepLocal = (stepId: string) => {
    if (!idea.fullActionPlan || !onUpdateIdea) return;
    const updatedRoadmap = idea.fullActionPlan.roadmap.map((s) =>
      s.id === stepId ? { ...s, isDone: !s.isDone } : s
    );
    onUpdateIdea({
      ...idea,
      fullActionPlan: { ...idea.fullActionPlan, roadmap: updatedRoadmap },
    });
  };

  const handleRemoveStepLocal = (stepId: string) => {
    if (!idea.fullActionPlan || !onUpdateIdea) return;
    const updatedRoadmap = idea.fullActionPlan.roadmap.filter((s) => s.id !== stepId);
    onUpdateIdea({
      ...idea,
      fullActionPlan: { ...idea.fullActionPlan, roadmap: updatedRoadmap },
    });
  };

  const handleAddCustomStepLocal = () => {
    if (!idea.fullActionPlan || !onUpdateIdea || !newStep.step) return;
    const customStep = {
      ...newStep,
      id: `custom-${Date.now()}`,
      isCustom: true,
      isDone: false,
    };
    onUpdateIdea({
      ...idea,
      fullActionPlan: {
        ...idea.fullActionPlan,
        roadmap: [...idea.fullActionPlan.roadmap, customStep],
      },
    });
    setNewStep({ step: '', details: '', milestone: '' });
    setIsAddingStep(false);
  };

  const handleToggleSaveLocal = () => {
    if (isSaved) {
      setShowDeleteConfirm(true);
    } else {
      trackEvent('save', idea.id);
      onToggleSave();
    }
  };

  const confirmDelete = () => {
    onToggleSave();
    setShowDeleteConfirm(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-zinc-600/80 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group relative"
    >
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-6 text-center"
          >
            <div className="space-y-4 max-w-xs">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Remove from saves?</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  This idea will be removed from your collection. Any custom analysis details may be
                  lost.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                >
                  Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 md:p-7 space-y-5">
        <IdeaCardHeader
          idea={idea}
          isSaved={isSaved}
          onToggleSave={handleToggleSaveLocal}
          isSaving={isSaving}
          onExport={handleExport}
          isFree={isFree}
          user={user}
        />

        {/* User Input — Only for Custom Ideas */}
        {userInput && (
          <div className="px-4 py-3 bg-zinc-800/20 border border-dashed border-zinc-700/50 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Your Input
            </span>
            <p className="text-xs text-zinc-400 italic">"{userInput}"</p>
          </div>
        )}

        {/* Pitch */}
        <div className="pl-3 border-l-2 border-emerald-500/40">
          <p className="text-zinc-300 text-sm leading-relaxed">{idea.pitch}</p>
        </div>

        <IdeaCardStats idea={idea} />

        <IdeaCardQuality idea={idea} isAdmin={isAdmin} onUpdateIdea={onUpdateIdea} />

        {/* Expandable Sections */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 flex items-center justify-between text-sm font-medium text-zinc-400 hover:text-white transition-colors py-2.5 px-4 bg-zinc-800/40 hover:bg-zinc-800/70 rounded-xl border border-zinc-700/30 hover:border-zinc-600/50"
            >
              <span>{isExpanded ? 'Hide Analysis' : 'View VC Analysis & Sources'}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all border ${
                evidenceResult
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700/50'
              }`}
              onClick={() => {
                if (!user) {
                  handleLogin();
                } else if (evidenceResult) {
                  setIsExpanded(true);
                } else {
                  handleGatherEvidence(false);
                }
              }}
              disabled={isGatheringEvidence}
            >
              {isGatheringEvidence ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {evidenceResult ? 'Evidence found' : 'Evidence'}
            </button>

            {isBuilder && (
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-900/30 disabled:opacity-50"
                  onClick={() => {
                    setIsExpanded(true);
                    if (idea.buildWithMe)
                      setActiveToolkit(activeToolkit === 'build' ? null : 'build');
                    else handleGenerateBuild();
                  }}
                  disabled={isGeneratingBuild}
                >
                  {isGeneratingBuild ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {idea.buildWithMe
                    ? activeToolkit === 'build'
                      ? 'Hide Build Pack'
                      : 'Build Pack'
                    : 'Build with me'}
                </button>
                <button
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all border ${
                    vettingResult
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700/50'
                  }`}
                  onClick={() => {
                    if (vettingResult) {
                      setIsExpanded(true);
                    } else {
                      handleExpertVetting(false);
                    }
                  }}
                  disabled={isVetting}
                >
                  {isVetting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  {vettingResult ? 'Vetting done' : 'Expert vetting'}
                </button>
              </div>
            )}
          </div>

          {/* BUG-4 FIX: inline error for Build / Plan / Vetting / Validation failures */}
          <AnimatePresence>
            {actionError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">
                  {typeof actionError === 'string' ? actionError : JSON.stringify(actionError)}
                </span>
                <button
                  onClick={clearActionError}
                  className="flex-shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-6 pt-4"
              >
                {vettingResult ? (
                  <IdeaCardVetting
                    vettingResult={vettingResult}
                    isAdmin={isAdmin}
                    onRefresh={() => handleExpertVetting(true)}
                    isRefreshing={isVetting}
                  />
                ) : isVetting ? (
                  <div className="p-10 flex flex-col items-center justify-center gap-3 bg-zinc-900/40 rounded-2xl border border-zinc-800 border-dashed">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-xs text-zinc-500 font-medium animate-pulse">
                      Generating expert vetting…
                    </p>
                  </div>
                ) : null}

                {evidenceResult && (
                  <IdeaCardEvidence
                    evidence={evidenceResult}
                    isAdmin={isAdmin}
                    onRefresh={() => handleGatherEvidence(true)}
                    isRefreshing={isGatheringEvidence}
                  />
                )}

                <IdeaCardActionSteps idea={idea} isFree={isFree} />

                <IdeaCardAnalysis idea={idea} />

                <IdeaCardToolkit
                  idea={idea}
                  activeToolkit={activeToolkit}
                  setActiveToolkit={setActiveToolkit}
                  isBuilder={isBuilder}
                  isFree={isFree}
                  isGeneratingValidation={isGeneratingValidation}
                  isGeneratingPlan={isGeneratingPlan}
                  isGeneratingBuild={isGeneratingBuild}
                  handleGenerateValidation={handleGenerateValidation}
                  handleGenerateBuild={handleGenerateBuild}
                  handleGenerateFullPlan={handleGenerateFullPlan}
                  handleToggleStep={handleToggleStepLocal}
                  handleRemoveStep={handleRemoveStepLocal}
                  handleExplainSection={handleExplainSection}
                  explainingSection={explainingSection}
                  explanation={explanation}
                  setExplanation={setExplanation}
                  isAddingStep={isAddingStep}
                  setIsAddingStep={setIsAddingStep}
                  newStep={newStep}
                  setNewStep={setNewStep}
                  handleAddCustomStep={handleAddCustomStepLocal}
                  isAdmin={isAdmin}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Community & Collaboration Footer */}
        <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => {
              if (!onUpdateIdea) return;
              onUpdateIdea({ ...idea, seekingPartner: !idea.seekingPartner });
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              idea.seekingPartner
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {idea.seekingPartner ? 'Seeking co-founder' : 'Find co-founder'}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => (user ? toggleReaction('up') : handleLogin())}
              disabled={reactionLoading}
              title="Upvote"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                reaction === 'up'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => (user ? toggleReaction('down') : handleLogin())}
              disabled={reactionLoading}
              title="Downvote"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                reaction === 'down'
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => (user ? toggleReaction('building') : handleLogin())}
              disabled={reactionLoading}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                reaction === 'building'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              {reaction === 'building' ? 'Building' : "I'm building this"}
            </button>
          </div>
        </div>

        <IdeaComments ideaId={idea.id} user={user} handleLogin={handleLogin} />
      </div>
    </motion.div>
  );
};
