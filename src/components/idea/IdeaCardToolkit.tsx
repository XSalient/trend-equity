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
        <div className={`grid ${isBuilder ? 'grid-cols-2' : 'grid-cols-1'} gap-4 pt-2`}>
          <button
            onClick={() => {
              if (validationToolkit) setActiveToolkit(activeToolkit === 'validation' ? null : 'validation');
              else handleGenerateValidation();
            }}
            disabled={isGeneratingValidation}
            className={`flex items-center justify-center gap-2 py-2.5 transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg border ${activeToolkit === 'validation'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-white/5'
              }`}
          >
            {isGeneratingValidation ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Validation Toolkit
          </button>
          {isBuilder && (
            <button
              onClick={() => setActiveToolkit(activeToolkit === 'progress' ? null : 'progress')}
              className={`flex items-center justify-center gap-2 py-2.5 transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg border ${activeToolkit === 'progress'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-white/5'
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
            {(isGeneratingValidation || isGeneratingPlan || isGeneratingBuild) && (
              <ToolkitSkeleton />
            )}

            {activeToolkit === 'validation' && validationToolkit && (
              <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Market Validation Toolkit</h4>
                  <button onClick={() => setActiveToolkit(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Landing Page Copy (Smoke Test)</p>
                    <div className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 space-y-2">
                      <p className="text-sm font-bold text-white">{validationToolkit.landingPage.hero}</p>
                      <p className="text-xs text-zinc-400">{validationToolkit.landingPage.subHero}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {validationToolkit.landingPage.valueProps.map((prop, i) => (
                          <span key={i} className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">{prop}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Interview Script</p>
                      <ul className="space-y-2">
                        {validationToolkit.interviewScript.map((q, i) => (
                          <li key={i} className="text-[11px] text-zinc-400 flex gap-2">
                            <span className="text-emerald-500 font-bold">{i + 1}.</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Smoke Test Strategy</p>
                        <p className="text-[11px] text-zinc-400 bg-zinc-800/30 p-3 rounded-xl border border-white/5">{validationToolkit.smokeTest}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Success Metrics</p>
                        <div className="flex flex-wrap gap-2">
                          {validationToolkit.successMetrics.map((m, i) => (
                            <span key={i} className="text-[10px] text-zinc-300 bg-zinc-800 px-2 py-1 rounded-md">{m}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeToolkit === 'progress' && (
              <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Startup Momentum Tracker</h4>
                  <button onClick={() => setActiveToolkit(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-zinc-800/50 rounded-xl border border-white/5">
                      <p className="text-2xl font-black text-emerald-500">
                        {fullPlan ? Math.round((fullPlan.roadmap.filter(s => s.isDone).length / fullPlan.roadmap.length) * 100) : 0}%
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase mt-1">Roadmap</p>
                    </div>
                    <div className="text-center p-3 bg-zinc-800/50 rounded-xl border border-white/5">
                      <p className="text-2xl font-black text-amber-500">
                        {validationToolkit ? '100%' : '0%'}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase mt-1">Validation</p>
                    </div>
                    <div className="text-center p-3 bg-zinc-800/50 rounded-xl border border-white/5">
                      <p className="text-2xl font-black text-blue-500">
                        {buildWithMe ? '100%' : '0%'}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase mt-1">Build Ready</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Overall Readiness</span>
                      <span className="text-xs font-bold text-emerald-500">
                        {Math.round(
                          ((fullPlan ? (fullPlan.roadmap.filter(s => s.isDone).length / fullPlan.roadmap.length) : 0) * 0.5 +
                            (validationToolkit ? 0.3 : 0) +
                            (buildWithMe ? 0.2 : 0)) * 100
                        )}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((fullPlan ? (fullPlan.roadmap.filter(s => s.isDone).length / fullPlan.roadmap.length) : 0) * 0.5 + (validationToolkit ? 0.3 : 0) + (buildWithMe ? 0.2 : 0)) * 100}%` }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeToolkit === 'build' && buildWithMe && (
              <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-2xl space-y-5 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Build with Me: Starter Pack</h4>
                  <button onClick={() => setActiveToolkit(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">AI Prompt Pack (Copy & Paste)</p>
                    <div className="space-y-2">
                      {buildWithMe.promptPack.map((p, i) => (
                        <div key={i} className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold text-emerald-400">{p.title}</p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(p.prompt);
                                alert("Prompt copied to clipboard!");
                              }}
                              className="text-[9px] font-bold text-zinc-500 hover:text-white uppercase"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-400 line-clamp-2 italic">"{p.prompt}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Starter Repo Structure</p>
                      <pre className="text-[9px] font-mono text-zinc-400 bg-black/30 p-3 rounded-xl border border-white/5 overflow-x-auto">
                        {buildWithMe.repoStructure}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">First 24 Hours Checklist</p>
                      <ul className="space-y-2">
                        {buildWithMe.first24Hours.map((task, i) => (
                          <li key={i} className="text-[11px] text-zinc-400 flex gap-2">
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

      {/* Full Action Plan - Only for Builder */}
      {isBuilder && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Rocket className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Full Execution Plan</span>
            </div>
            <div className="flex items-center gap-2">
              {fullPlan && (
                <button
                  onClick={() => setActiveToolkit(activeToolkit === 'roadmap' ? null : 'roadmap')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${activeToolkit === 'roadmap'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-800/50 text-zinc-500 border-white/5'
                    }`}
                >
                  {activeToolkit === 'roadmap' ? 'Hide Roadmap' : 'Show Roadmap'}
                </button>
              )}
              <button
                onClick={handleGenerateFullPlan}
                disabled={isGeneratingPlan}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 border border-emerald-500/20"
              >
                {isGeneratingPlan ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {fullPlan ? "Regenerating..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    {fullPlan ? "Regenerate Full Plan" : "Generate Full Plan"}
                  </>
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
                      className={`p-4 rounded-xl border transition-all space-y-2 relative group/item ${item.isDone ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-zinc-900/50 border-white/5'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStep(item.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${item.isDone ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700 hover:border-emerald-500'
                              }`}
                          >
                            {item.isDone && <CheckCircle2 className="w-3 h-3 text-black" />}
                          </button>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                            {item.isCustom ? 'Custom Step' : `Phase ${i + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-zinc-500">{item.milestone}</span>
                          <button
                            onClick={() => handleRemoveStep(item.id)}
                            className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Remove Step"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <h5 className={`text-sm font-bold ${item.isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                        {item.step}
                      </h5>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.details}</p>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleExplainSection(item.step, item.details)}
                          disabled={explainingSection === item.step}
                          className="text-[9px] font-bold text-zinc-500 hover:text-emerald-500 uppercase tracking-widest flex items-center gap-1"
                        >
                          {explainingSection === item.step ? (
                            <Loader2 className="w-2 h-2 animate-spin" />
                          ) : (
                            <HelpCircle className="w-2 h-2" />
                          )}
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
                        placeholder="Step Title"
                        value={newStep.step}
                        onChange={e => setNewStep({ ...newStep, step: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <textarea
                        placeholder="Details..."
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
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-lg"
                        >
                          Add Step
                        </button>
                        <button
                          onClick={() => setIsAddingStep(false)}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-bold uppercase rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingStep(true)}
                      className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-500 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      + Add Custom Step
                    </button>
                  )}
                </div>

                {/* Explanation Modal-like area */}
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
                        className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2 text-emerald-500">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">VC Deep Dive: {explanation.section}</span>
                      </div>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {explanation.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Stack/Tools</span>
                      <button
                        onClick={() => handleExplainSection('Tech Stack', fullPlan.tools.join(', '))}
                        className="text-[8px] font-bold text-zinc-600 hover:text-emerald-500 uppercase"
                      >
                        Explain Stack
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(fullPlan.tools || []).map((tool, i) => (
                        <span key={i} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] rounded-md border border-white/5">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Key Risks</span>
                      <button
                        onClick={() => handleExplainSection('Risk Mitigation', fullPlan.risks.join(', '))}
                        className="text-[8px] font-bold text-zinc-600 hover:text-emerald-500 uppercase"
                      >
                        Mitigation Plan
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(fullPlan.risks || []).map((risk, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] rounded-md border border-red-500/20">
                          {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Estimated Timeline</span>
                  <span className="text-xs font-bold text-white">{fullPlan.timeline}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Build with Me - Only for Builder */}
      {isBuilder && (
        <div className="pt-4 border-t border-white/5">
          <button
            onClick={() => {
              if (buildWithMe) setActiveToolkit(activeToolkit === 'build' ? null : 'build');
              else handleGenerateBuild();
            }}
            disabled={isGeneratingBuild}
            className={`w-full flex items-center justify-center gap-2 py-3 transition-all text-xs font-bold rounded-lg shadow-lg ${activeToolkit === 'build'
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
              }`}
          >
            {isGeneratingBuild ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {buildWithMe ? (activeToolkit === 'build' ? 'HIDE BUILDER PACK' : 'VIEW BUILDER PACK') : 'BUILD WITH ME'}
          </button>
        </div>
      )}

      {/* Upgrade CTA for Free/Pro */}
      {(!isBuilder) && (
        <div className="pt-4">
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-zinc-700 group/upgrade">
            <Zap className="w-4 h-4 text-amber-500 group-hover/upgrade:scale-110 transition-transform" />
            UPGRADE FOR MORE FEATURES
          </button>
        </div>
      )}
    </div>
  );
};
