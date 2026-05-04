import React, { useState, useEffect, useRef } from 'react';
import { Wand2, X, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { Idea, Tier, AnalyzeIdeaUsage } from '../types';
import { useTierLimits } from '../hooks/useTierLimits';
import { IdeaCard } from './IdeaCard';

interface AnalyzeIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: Tier;
  user: any;
  handleLogin: () => void;
  onAnalyzeComplete: (idea: Idea) => void;
  onSaveCustomIdea: (idea: Idea, userInput?: string) => void;
  customSavesCount: number;
  analyzeIdeaHook: {
    isAnalyzing: boolean;
    analyzeError: string | null;
    setAnalyzeError: (e: string | null) => void;
    analyzedIdea: Idea | null;
    clearAnalyzedIdea: () => void;
    usage: AnalyzeIdeaUsage | null;
    analyze: (description: string) => Promise<Idea | null>;
  };
  updateIdea: (idea: Idea) => void;
  exportToPDF: (idea: Idea, format: string) => void;
}

const LOADING_MESSAGES = [
  'Scanning market signals...',
  'Identifying structural advantages...',
  'Mapping competitor landscape...',
  'Assessing revenue potential...',
  'Building your VC-grade profile...',
];

type Phase = 'input' | 'loading' | 'result';

export const AnalyzeIdeaModal: React.FC<AnalyzeIdeaModalProps> = ({
  isOpen,
  onClose,
  tier,
  user,
  handleLogin,
  onAnalyzeComplete,
  onSaveCustomIdea,
  customSavesCount,
  analyzeIdeaHook,
  updateIdea,
  exportToPDF,
}) => {
  const [inputText, setInputText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [justSavedCustom, setJustSavedCustom] = useState(false);
  const [analysisDescription, setAnalysisDescription] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isAnalyzing,
    analyzeError,
    setAnalyzeError,
    analyzedIdea,
    clearAnalyzedIdea,
    usage,
    analyze,
  } = analyzeIdeaHook;
  const { getCustomSavesLimit } = useTierLimits();

  const customSavesLimit = getCustomSavesLimit(tier);
  const remaining = usage?.remaining ?? null;
  const limit = usage?.limit ?? null;
  const used = usage?.used ?? null;

  // Reset state whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInputText('');
      setPhase('input');
      setJustSavedCustom(false);
      clearAnalyzedIdea();
      setAnalyzeError(null);
    } else {
      // Autofocus textarea when modal opens
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cycle loading messages during analysis
  useEffect(() => {
    if (phase !== 'loading') return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setPhase('loading');
    setLoadingMsgIdx(0);
    const description = inputText.trim();
    setAnalysisDescription(description);
    const idea = await analyze(description);
    if (idea) {
      setPhase('result');
      onAnalyzeComplete(idea);
    } else {
      setPhase('input');
    }
  };

  const handleSaveCustom = () => {
    if (!analyzedIdea) return;
    onSaveCustomIdea(analyzedIdea, analysisDescription);
    setJustSavedCustom(true);
  };

  const handleAnalyzeAnother = () => {
    setInputText('');
    setPhase('input');
    setJustSavedCustom(false);
    clearAnalyzedIdea();
    setAnalyzeError(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const usageBadgeColor =
    remaining === null
      ? 'text-zinc-500 bg-zinc-800/60'
      : remaining === 0
        ? 'text-red-400 bg-red-900/20 border border-red-800/40'
        : remaining <= 2
          ? 'text-amber-400 bg-amber-900/20 border border-amber-800/40'
          : 'text-emerald-400 bg-emerald-900/20 border border-emerald-800/40';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-emerald-900/10 flex flex-col"
        style={{ maxWidth: phase === 'result' ? '720px' : '540px', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
              Analyze My Idea
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* ── PHASE: INPUT ─────────────────────────────────────────── */}
          {phase === 'input' && (
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <p className="text-zinc-300 text-sm font-semibold">
                  Describe your business concept
                </p>
                <p className="text-zinc-500 text-xs">
                  Our AI will build a full VC-grade profile — just like Daily Feed ideas.
                </p>
              </div>

              {/* Usage badge */}
              {usage && (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${usageBadgeColor}`}
                >
                  <span>
                    {remaining === 0
                      ? `Limit reached — resets ${usage.resetsAt}`
                      : `${remaining} of ${limit} ${limit === 1 ? 'analysis' : 'analyses'} remaining this month`}
                  </span>
                </div>
              )}

              {remaining === 0 ? (
                /* Locked state */
                <div className="p-6 rounded-xl border border-dashed border-zinc-700 text-center space-y-3">
                  <Lock className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-zinc-400 text-sm font-semibold">Monthly limit reached</p>
                  <p className="text-zinc-600 text-xs">
                    {used !== null && limit !== null
                      ? `You've used all ${limit} analyses this month. Resets ${usage?.resetsAt}.`
                      : 'Upgrade your plan for more analyses.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Error banner */}
                  {analyzeError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">{analyzeError}</p>
                    </div>
                  )}

                  {/* Textarea */}
                  <div className="space-y-1.5">
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        if (analyzeError) setAnalyzeError(null);
                      }}
                      maxLength={5000}
                      rows={5}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                      placeholder="e.g. A marketplace connecting independent pharmacists with bulk drug suppliers to break GPO monopolies in specialty medication procurement..."
                    />
                    <div className="flex items-center justify-between px-1">
                      <p className="text-zinc-600 text-xs">
                        Be specific — the more detail, the richer the analysis.
                      </p>
                      <span
                        className={`text-xs font-mono ${inputText.length > 4500 ? 'text-amber-400' : 'text-zinc-600'}`}
                      >
                        {inputText.length} / 5000
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={inputText.trim().length < 20 || isAnalyzing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl transition-all text-sm uppercase tracking-wider disabled:cursor-not-allowed"
                  >
                    <Wand2 className="w-4 h-4" />
                    Analyze My Idea
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── PHASE: LOADING ────────────────────────────────────────── */}
          {phase === 'loading' && (
            <div className="p-12 flex flex-col items-center justify-center space-y-5 min-h-[240px]">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <Wand2 className="w-5 h-5 text-emerald-500 absolute inset-0 m-auto" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-zinc-300 text-sm font-semibold">Analyzing your idea...</p>
                <p className="text-zinc-500 text-xs transition-all duration-500">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
              </div>
            </div>
          )}

          {/* ── PHASE: RESULT ─────────────────────────────────────────── */}
          {phase === 'result' && analyzedIdea && (
            <div className="p-4 space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-300 font-semibold">
                  Analysis complete — saved as My Latest Idea
                </p>
              </div>

              {/* IdeaCard */}
              <IdeaCard
                idea={analyzedIdea}
                isSaved={false}
                onToggleSave={() => {}} // toggling handled via "Save to Custom Ideas" below
                onUpdateIdea={(updated) => {
                  // Important: Update the local analysis state so UI reflects changes
                  if (analyzeIdeaHook.updateAnalyzedIdea) {
                    analyzeIdeaHook.updateAnalyzedIdea(updated);
                  }
                  // Also call the global update if it's already saved
                  updateIdea(updated);
                }}
                isSaving={false}
                tier={tier}
                onExport={(fmt) => exportToPDF(analyzedIdea, fmt)}
                user={user}
                handleLogin={handleLogin}
                userInput={analysisDescription}
              />

              {/* Save to Custom Ideas */}
              <div className="flex items-center justify-between gap-3 px-1">
                {justSavedCustom ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Saved to Custom Ideas
                  </div>
                ) : customSavesCount >= customSavesLimit ? (
                  <div className="text-xs text-zinc-600">
                    Custom Ideas full ({customSavesCount}/{customSavesLimit}) — upgrade for more
                  </div>
                ) : (
                  <button
                    onClick={handleSaveCustom}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Save to Custom Ideas
                    <span className="text-zinc-500">
                      ({customSavesCount}/{customSavesLimit})
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAnalyzeAnother}
                    disabled={remaining === 0}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Analyze Another
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
