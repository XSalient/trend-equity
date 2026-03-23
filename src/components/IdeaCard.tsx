import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  Wand2
} from 'lucide-react';
import { Idea } from '../types';
import { useIdeaActions } from '../hooks/useIdeaActions';

// Sub-components
import { IdeaCardHeader } from './idea/IdeaCardHeader';
import { IdeaCardStats } from './idea/IdeaCardStats';
import { IdeaCardAnalysis } from './idea/IdeaCardAnalysis';
import { IdeaCardActionSteps } from './idea/IdeaCardActionSteps';
import { IdeaCardToolkit } from './idea/IdeaCardToolkit';
import { IdeaCardVetting } from './idea/IdeaCardVetting';

interface IdeaCardProps {
  idea: Idea;
  isSaved: boolean;
  onToggleSave: () => void;
  onUpdateIdea?: (idea: Idea) => void;
  isSaving: boolean;
  tier: 'free' | 'pro' | 'builder';
  onExport?: (format: 'pdf' | 'notion' | 'gdocs') => void;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({
  idea,
  isSaved,
  onToggleSave,
  onUpdateIdea,
  isSaving,
  tier,
  onExport
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeToolkit, setActiveToolkit] = useState<'roadmap' | 'build' | 'validation' | 'progress' | null>(null);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStep, setNewStep] = useState({ step: '', details: '', milestone: '' });

  const {
    isGeneratingPlan,
    isGeneratingBuild,
    isGeneratingValidation,
    isVetting,
    vettingResult,
    explainingSection,
    explanation,
    setExplanation,
    handleGenerateFullPlan,
    handleGenerateBuild,
    handleGenerateValidation,
    handleExplainSection,
    handleExpertVetting
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

  const isFree = tier === 'free';
  const isBuilder = tier === 'builder';

  const handleToggleStepLocal = (stepId: string) => {
    if (!idea.fullActionPlan || !onUpdateIdea) return;
    const updatedRoadmap = idea.fullActionPlan.roadmap.map(s =>
      s.id === stepId ? { ...s, isDone: !s.isDone } : s
    );
    onUpdateIdea({
      ...idea,
      fullActionPlan: { ...idea.fullActionPlan, roadmap: updatedRoadmap }
    });
  };

  const handleRemoveStepLocal = (stepId: string) => {
    if (!idea.fullActionPlan || !onUpdateIdea) return;
    const updatedRoadmap = idea.fullActionPlan.roadmap.filter(s => s.id !== stepId);
    onUpdateIdea({
      ...idea,
      fullActionPlan: { ...idea.fullActionPlan, roadmap: updatedRoadmap }
    });
  };

  const handleAddCustomStepLocal = () => {
    if (!idea.fullActionPlan || !onUpdateIdea || !newStep.step) return;
    const customStep = {
      ...newStep,
      id: `custom-${Date.now()}`,
      isCustom: true,
      isDone: false
    };
    onUpdateIdea({
      ...idea,
      fullActionPlan: {
        ...idea.fullActionPlan,
        roadmap: [...idea.fullActionPlan.roadmap, customStep]
      }
    });
    setNewStep({ step: '', details: '', milestone: '' });
    setIsAddingStep(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors group"
    >
      <div className="p-5 md:p-6 space-y-4">
        <IdeaCardHeader
          idea={idea}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          isSaving={isSaving}
          onExport={onExport}
          isFree={isFree}
        />

        {/* Pitch */}
        <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50">
          <p className="text-zinc-300 text-sm leading-relaxed italic">
            "{idea.pitch}"
          </p>
        </div>

        <IdeaCardStats idea={idea} />

        {/* Expandable Sections */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 flex items-center justify-between text-xs font-bold text-zinc-400 hover:text-white transition-colors py-2 px-3 bg-zinc-800/30 rounded-lg"
            >
              {isExpanded ? 'HIDE VC ANALYSIS' : 'VIEW VC ANALYSIS & SOURCES'}
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isBuilder && (
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                  onClick={() => {
                    setIsExpanded(true);
                    if (idea.buildWithMe) setActiveToolkit(activeToolkit === 'build' ? null : 'build');
                    else handleGenerateBuild();
                  }}
                  disabled={isGeneratingBuild}
                >
                  {isGeneratingBuild ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {idea.buildWithMe ? (activeToolkit === 'build' ? 'HIDE BUILD PACK' : 'VIEW BUILD PACK') : 'BUILD WITH ME'}
                </button>
                <button
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all border ${vettingResult
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-white/5'
                    }`}
                  onClick={handleExpertVetting}
                  disabled={isVetting}
                >
                  {isVetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {vettingResult ? 'VETTING COMPLETE' : 'EXPERT VETTING'}
                </button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-6 pt-4"
              >
                {vettingResult && <IdeaCardVetting vettingResult={vettingResult} />}

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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
