import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BarChart3, Shield, Loader2, CheckCircle2, Wand2, Sparkles, HelpCircle, Trash2, Rocket, Zap } from 'lucide-react';
import { Idea, ExpertVetting } from '../../types';
import { ToolkitSkeleton } from '../layout/SkeletonLoaders';

interface IdeaCardToolkitProps {
  idea: Idea;
  activeToolkit: 'roadmap' | 'build' | 'validation' | 'progress' | null;
  setActiveToolkit: (toolkit: 'roadmap' | 'build' | 'validation' | 'progress' | null) => void;
  isBuilder: boolean;
  isFree: boolean;
  isGeneratingValidation: boolean;
  isGeneratingPlan: boolean;
  isGeneratingBuild: boolean;
  handleGenerateValidation: () => void;
  handleGenerateBuild: () => void;
  handleGenerateFullPlan: () => void;
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
  handleAddCustomStep
}) => {
  const fullPlan = idea.fullActionPlan;
  const buildWithMe = idea.buildWithMe;
  const validationToolkit = idea.validationToolkit;

  return (
    <div className="space-y-4">

      {/* Pro/Builder Features (Toolkit & Tracker) */}
      {!isFree && (
        <div className={`grid ${isBuilder ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-2`}>
          <button
            onClick={() => {
              if (validationToolkit) setActiveToolkit(activeToolkit === 'validation' ? null : 'validation');
              else handleGenerateValidation();
            }}
            disabled={isGeneratingValidation}
            className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl border transition-all ${
              activeToolkit === 'validation'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700/50'
            }`}
          >
            {isGeneratingValidation ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
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
            {(isGeneratingValidation || isGeneratingPlan || isGeneratingBuild) && <ToolkitSkeleton />}

            {/* ── Validation Toolkit ── */}
            {activeToolkit === 'validation' && validationToolkit && (
              <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-emerald-500">Market Validation Toolkit</h4>
                  <button onClick={() => setActiveToolkit(null)} className="text-zinc-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-500">Landing Page Copy (Smoke Test)</p>
                    <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-2">
                      <p className="text-sm font-semibold text-white">{validationToolkit.landingPage.hero}</p>
                      <p className="text-xs text-zinc-400">{validationToolkit.landingPage.subHero}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {validationToolkit.landingPage.valueProps.map((prop, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                            {prop}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500">Interview Script</p>
                      <ul className="space-y-2">
                        {validationToolkit.interviewScript.map((q, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-2">
                            <span className="text-emerald-500 font-semibold flex-shrink-0">{i + 1}.</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-zinc-500">Smoke Test Strategy</p>
                        <p className="text-xs text-zinc-400 bg-zinc-800/30 p-3 rounded-xl border border-zinc-700/40 leading-relaxed">
                          {validationToolkit.smokeTest}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-zinc-500">Success Metrics</p>
                        <div className="flex flex-wrap gap-2">
                          {validationToolkit.successMetrics.map((m, i) => (
                            <span key={i} className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700/50">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Progress Tracker ── */}
            {activeToolkit === 'progress' && (
              <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-emerald-500">Startup Momentum Tracker</h4>
                  <button onClick={() => setActiveToolkit(null)} className="text-zinc-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        value: fullPlan
                          ? `${Math.round((fullPlan.roadmap.filter(s => s.isDone).length / fullPlan.roadmap.length) * 100)}%`
                          : '0%',
                        label: 'Roadmap',
                        color: 'text-emerald-500',
                      },
                      { value: validationToolkit ? '100%' : '0%', label: 'Validation', color: 'text-amber-500' },
                      { value: buildWithMe ? '100%' : '0%', label: 'Build ready', color: 'text-blue-500' },
                    ].map(({ value, label, color }) => (
                      <div key={label} className="text-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/40">
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-zinc-500 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-zinc-500">Overall readiness</span>
                      <span className="text-xs font-semibold text-emerald-500">
                        {Math.round(
                          ((fullPlan ? (fullPlan.roadmap.filter(s => s.isDone).length / fullPlan.roadmap.length) : 0) * 0.5 +
                            (validationToolkit ? 0.3 : 0) +
                            (buildWithMe ? 0.2 : 0)) * 100
                        )}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${((fullPlan ? (fullPlan.roadmap.filter(s => s.isDone).length / fullPlan.roadmap.length) : 0) * 0.5 +
                            (validationToolkit ? 0.3 : 0) +
                            (buildWithMe ? 0.2 : 0)) * 100}%`
                        }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Build with Me ── */}
            {activeToolkit === 'build' && buildWithMe && (
              <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-emerald-500">Build with Me: Starter Pack</h4>
                  <button onClick={() => setActiveToolkit(null)} className="text-zinc-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-zinc-500">AI Prompt Pack (copy & paste)</p>
                    <div className="space-y-2">
                      {buildWithMe.promptPack.map((p, i) => (
                        <div key={i} className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-semibold text-emerald-400">{p.title}</p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(p.prompt);
                                alert('Prompt copied to clipboard!');
                              }}
                              className="text-xs font-medium text-zinc-500 hover:text-white transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-xs text-zinc-400 line-clamp-2 italic">"{p.prompt}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500">Starter repo structure</p>
                      <pre className="text-xs font-mono text-zinc-400 bg-black/30 p-3 rounded-xl border border-zinc-700/40 overflow-x-auto">
                        {buildWithMe.repoStructure}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500">First 24 hours checklist</p>
                      <ul className="space-y-2">
                        {buildWithMe.first24Hours.map((task, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-2">
                            <div className="w-4 h-4 rounded border border-zinc-700 flex-shrink-0 mt-0.5" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full Execution Plan (Builder only) ── */}
      {isBuilder && (
        <div className="space-y-4 pt-4 border-t border-zinc-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Rocket className="w-4 h-4" />
              <span className="text-sm font-semibold">Full Execution Plan</span>
            </div>
            <div className="flex items-center gap-2">
              {fullPlan && (
                <button
                  onClick={() => setActiveToolkit(activeToolkit === 'roadmap' ? null : 'roadmap')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    activeToolkit === 'roadmap'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300'
                  }`}
                >
                  {activeToolkit === 'roadmap' ? 'Hide roadmap' : 'Show roadmap'}
                </button>
              )}
              <button
                onClick={handleGenerateFullPlan}
                disabled={isGeneratingPlan}
                className="px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 border border-emerald-500/20"
              >
                {isGeneratingPlan ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />{fullPlan ? 'Regenerating…' : 'Generating…'}</>
                ) : (
                  <><Sparkles className="w-3 h-3" />{fullPlan ? 'Regenerate plan' : 'Generate full plan'}</>
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {activeToolkit === 'roadmap' && fullPlan && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* Roadmap Steps */}
                <div className="space-y-3">
                  {(fullPlan.roadmap || []).map((item, i) => (
                    <div
                      key={item.id || i}
                      className={`p-4 rounded-xl border transition-all space-y-2 relative group/item ${
                        item.isDone
                          ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60'
                          : 'bg-zinc-900/50 border-zinc-700/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStep(item.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                              item.isDone ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700 hover:border-emerald-500'
                            }`}
                          >
                            {item.isDone && <CheckCircle2 className="w-3 h-3 text-black" />}
                          </button>
                          <span className="text-xs font-semibold text-emerald-500">
                            {item.isCustom ? 'Custom step' : `Phase ${i + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-500">{item.milestone}</span>
                          <button
                            onClick={() => handleRemoveStep(item.id)}
                            className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all"
                            title="Remove step"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <h5 className={`text-sm font-semibold ${item.isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                        {item.step}
                      </h5>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.details}</p>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleExplainSection(item.step, item.details)}
                          disabled={explainingSection === item.step}
                          className="text-xs font-medium text-zinc-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          {explainingSection === item.step
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <HelpCircle className="w-3 h-3" />
                          }
                          Explain this step
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Custom Step */}
                  {isAddingStep ? (
                    <div className="p-4 bg-zinc-900/80 border border-emerald-500/30 rounded-xl space-y-3">
                      <input
                        type="text"
                        placeholder="Step title"
                        value={newStep.step}
                        onChange={e => setNewStep({ ...newStep, step: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <textarea
                        placeholder="Details…"
                        value={newStep.details}
                        onChange={e => setNewStep({ ...newStep, details: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 h-20"
                      />
                      <input
                        type="text"
                        placeholder="Milestone (e.g. 1 week)"
                        value={newStep.milestone}
                        onChange={e => setNewStep({ ...newStep, milestone: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddCustomStep}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Add step
                        </button>
                        <button
                          onClick={() => setIsAddingStep(false)}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingStep(true)}
                      className="w-full py-3 border border-dashed border-zinc-700/60 hover:border-zinc-600 rounded-xl text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-all"
                    >
                      + Add custom step
                    </button>
                  )}
                </div>

                {/* Explanation panel */}
                <AnimatePresence>
                  {explanation && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-3 relative"
                    >
                      <button
                        onClick={() => setExplanation(null)}
                        className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2 text-emerald-500">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-semibold">VC Deep Dive: {explanation.section}</span>
                      </div>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {explanation.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stack & Risks */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500">Stack / Tools</span>
                      <button
                        onClick={() => handleExplainSection('Tech Stack', fullPlan.tools.join(', '))}
                        className="text-xs font-medium text-zinc-600 hover:text-emerald-400 transition-colors"
                      >
                        Explain stack
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(fullPlan.tools || []).map((tool, i) => (
                        <span key={i} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-md border border-zinc-700/50">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500">Key risks</span>
                      <button
                        onClick={() => handleExplainSection('Risk Mitigation', fullPlan.risks.join(', '))}
                        className="text-xs font-medium text-zinc-600 hover:text-emerald-400 transition-colors"
                      >
                        Mitigation plan
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(fullPlan.risks || []).map((risk, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-md border border-red-500/20">
                          {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-500">Estimated timeline</span>
                  <span className="text-xs font-semibold text-white">{fullPlan.timeline}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Build with Me CTA (Builder only) ── */}
      {isBuilder && (
        <div className="pt-4 border-t border-zinc-800/60">
          <button
            onClick={() => {
              if (buildWithMe) setActiveToolkit(activeToolkit === 'build' ? null : 'build');
              else handleGenerateBuild();
            }}
            disabled={isGeneratingBuild}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${
              activeToolkit === 'build'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
            }`}
          >
            {isGeneratingBuild ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {buildWithMe
              ? activeToolkit === 'build' ? 'Hide builder pack' : 'View builder pack'
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
