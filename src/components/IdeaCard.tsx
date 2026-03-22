import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Download, 
  FileText, 
  Share2, 
  Bookmark, 
  BookmarkCheck, 
  Loader2, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Wand2, 
  Target, 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  Shield,
  Clock,
  AlertTriangle,
  Hammer,
  Map,
  HelpCircle,
  Rocket,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { Idea, ExpertVetting } from '../types';
import { 
  generateFullActionPlan, 
  explainPlanSection,
  generateBuildWithMe,
  generateValidationToolkit,
  generateExpertVetting
} from '../services/geminiService';

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
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingBuild, setIsGeneratingBuild] = useState(false);
  const [isGeneratingValidation, setIsGeneratingValidation] = useState(false);
  const [isVetting, setIsVetting] = useState(false);
  const [vettingResult, setVettingResult] = useState<ExpertVetting | null>(null);
  const [explainingSection, setExplainingSection] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ section: string; text: string } | null>(null);
  const [newStep, setNewStep] = useState({ step: '', details: '', milestone: '' });
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [activeToolkit, setActiveToolkit] = useState<'roadmap' | 'build' | 'validation' | 'progress' | null>(null);
  
  const fullPlan = idea.fullActionPlan;
  const buildWithMe = idea.buildWithMe;
  const validationToolkit = idea.validationToolkit;
  
  const isFree = tier === 'free';
  const isPro = tier === 'pro';
  const isBuilder = tier === 'builder';

  const handleGenerateFullPlan = async () => {
    if (!isBuilder) return;
    setIsGeneratingPlan(true);
    try {
      const plan = await generateFullActionPlan(idea);
      const updatedIdea = {
        ...idea,
        fullActionPlan: {
          ...plan,
          generatedAt: new Date().toISOString()
        }
      };
      onUpdateIdea?.(updatedIdea);
      setActiveToolkit('roadmap');
    } catch (error) {
      console.error("Failed to generate full plan:", error);
      alert("Failed to generate full plan. Please try again.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateBuild = async () => {
    if (!isBuilder) return;
    setIsGeneratingBuild(true);
    try {
      const build = await generateBuildWithMe(idea);
      onUpdateIdea?.({
        ...idea,
        buildWithMe: { ...build, generatedAt: new Date().toISOString() }
      });
      setActiveToolkit('build');
    } catch (error) {
      console.error("Failed to generate build toolkit:", error);
    } finally {
      setIsGeneratingBuild(false);
    }
  };

  const handleGenerateValidation = async () => {
    if (!isBuilder) return;
    setIsGeneratingValidation(true);
    try {
      const validation = await generateValidationToolkit(idea);
      onUpdateIdea?.({
        ...idea,
        validationToolkit: { ...validation, generatedAt: new Date().toISOString() }
      });
      setActiveToolkit('validation');
    } catch (error) {
      console.error("Failed to generate validation toolkit:", error);
    } finally {
      setIsGeneratingValidation(false);
    }
  };

  const handleToggleStep = (stepId: string) => {
    if (!fullPlan || !onUpdateIdea) return;
    const updatedRoadmap = fullPlan.roadmap.map(s => 
      s.id === stepId ? { ...s, isDone: !s.isDone } : s
    );
    onUpdateIdea({
      ...idea,
      fullActionPlan: { ...fullPlan, roadmap: updatedRoadmap }
    });
  };

  const handleRemoveStep = (stepId: string) => {
    if (!fullPlan || !onUpdateIdea) return;
    const updatedRoadmap = fullPlan.roadmap.filter(s => s.id !== stepId);
    onUpdateIdea({
      ...idea,
      fullActionPlan: { ...fullPlan, roadmap: updatedRoadmap }
    });
  };

  const handleAddCustomStep = () => {
    if (!fullPlan || !onUpdateIdea || !newStep.step) return;
    const customStep = {
      ...newStep,
      id: `custom-${Date.now()}`,
      isCustom: true,
      isDone: false
    };
    onUpdateIdea({
      ...idea,
      fullActionPlan: { 
        ...fullPlan, 
        roadmap: [...fullPlan.roadmap, customStep] 
      }
    });
    setNewStep({ step: '', details: '', milestone: '' });
    setIsAddingStep(false);
  };

  const handleExplainSection = async (section: string, context: string) => {
    if (!isBuilder) return;
    setExplainingSection(section);
    try {
      const text = await explainPlanSection(idea, section, context);
      setExplanation({ section, text });
    } catch (error) {
      console.error("Failed to explain section:", error);
    } finally {
      setExplainingSection(null);
    }
  };

  const handleExpertVetting = async () => {
    if (!isBuilder) return;
    setIsVetting(true);
    try {
      const result = await generateExpertVetting(idea);
      setVettingResult(result);
      setIsExpanded(true);
      setActiveToolkit(null); // Close other toolkits to show vetting
    } catch (error) {
      console.error("Failed to vet idea:", error);
    } finally {
      setIsVetting(false);
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors group"
    >
      <div className="p-5 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-2 items-center">
              {(idea.categoryTags || []).map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {idea.heatBadge || 'Early Bird'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white leading-tight group-hover:text-emerald-400 transition-colors">{idea.headline}</h3>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <div className="relative group/export">
                <button 
                  className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors bg-zinc-800/50 rounded-full"
                  title="Export Pitch Deck"
                >
                  <Download className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-50 p-1">
                  <button 
                    onClick={() => onExport('pdf')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> PDF Pitch Deck
                  </button>
                  {!isFree ? (
                    <>
                      <button 
                        onClick={() => onExport('notion')}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2"
                      >
                        <Share2 className="w-4 h-4" /> Notion Template
                      </button>
                      <button 
                        onClick={() => onExport('gdocs')}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> Google Docs
                      </button>
                    </>
                  ) : (
                    <div className="px-3 py-2 border-t border-zinc-800 mt-1">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Upgrade for Notion/GDocs</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <button 
              onClick={onToggleSave}
              disabled={isSaving}
              className={`p-2 rounded-full transition-colors ${isSaved ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'}`}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />)}
            </button>
          </div>
        </div>

        {/* Pitch */}
        <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50">
          <p className="text-zinc-300 text-sm leading-relaxed italic">
            "{idea.pitch}"
          </p>
        </div>

        {/* Stats Grid */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Potential Score</span>
              <span className="text-sm font-black font-mono text-emerald-400 leading-none">{idea.revenuePotentialScore}</span>
            </div>
            <div className="h-2.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5 relative">
              <div 
                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 relative" 
                style={{ width: `${idea.revenuePotentialScore * 10}%` }} 
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
              <div 
                className="absolute top-0 bottom-0 left-0 bg-emerald-500/20 blur-md"
                style={{ width: `${idea.revenuePotentialScore * 10}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cost & Effort</span>
              <p className="text-xs text-zinc-300 font-medium">{idea.costEffort}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Exit Strategy</span>
              <p className="text-xs text-zinc-300 font-medium line-clamp-2">{idea.potentialExit}</p>
            </div>
          </div>
        </div>

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
                    if (buildWithMe) setActiveToolkit(activeToolkit === 'build' ? null : 'build');
                    else handleGenerateBuild();
                  }}
                  disabled={isGeneratingBuild}
                >
                  {isGeneratingBuild ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {buildWithMe ? (activeToolkit === 'build' ? 'HIDE BUILD PACK' : 'VIEW BUILD PACK') : 'BUILD WITH ME'}
                </button>
                <button 
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all border ${
                    vettingResult 
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
                {/* Actionable Next Steps - Moved to top of expanded section */}
                <div className="space-y-3">
                  {vettingResult && (
                    <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-500">
                          <Shield className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Expert VC Vetting</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                            vettingResult.verdict === 'High Conviction' ? 'bg-emerald-500 text-black' :
                            vettingResult.verdict === 'Moderate' ? 'bg-amber-500 text-black' : 'bg-red-500 text-white'
                          }`}>
                            {vettingResult.verdict}
                          </span>
                          <span className="text-xl font-black text-white">{vettingResult.score}/100</span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Strengths</p>
                          <ul className="space-y-1">
                            {vettingResult.strengths.map((s, i) => (
                              <li key={i} className="text-[11px] text-zinc-300 flex gap-2">
                                <span className="text-emerald-500">•</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Weaknesses</p>
                          <ul className="space-y-1">
                            {vettingResult.weaknesses.map((w, i) => (
                              <li key={i} className="text-[11px] text-zinc-300 flex gap-2">
                                <span className="text-red-500">•</span> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-2 space-y-2">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pivot Suggestions</p>
                        <div className="flex flex-wrap gap-2">
                          {vettingResult.pivotSuggestions.map((p, i) => (
                            <span key={i} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] rounded-lg">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Actionable Next Steps</span>
                  </div>
                  <div className="grid gap-2">
                    {(idea.nextSteps || []).slice(0, isFree ? 3 : (idea.nextSteps?.length || 0)).map((step, i) => {
                      const parts = step.split('|').map(s => s.trim());
                      const title = parts[0] || step;
                      const timeline = parts[1];
                      const risk = parts[2];
                      const tool = parts[3];

                      return (
                        <div key={i} className="flex gap-3 p-3 bg-zinc-800/30 rounded-xl border border-white/5 group/step hover:bg-zinc-800/50 transition-colors">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                            {i + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-xs font-bold text-zinc-200">{title}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {timeline && (
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {timeline}
                                </span>
                              )}
                              {risk && (
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500/50" /> {risk}
                                </span>
                              )}
                              {tool && (
                                <span className="text-[10px] text-emerald-500/70 font-mono">
                                  {tool}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {isFree && (
                      <div className="p-3 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800 text-center">
                        <p className="text-[10px] text-zinc-500 italic">Upgrade to PRO to unlock all 7 steps</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">VC Justification</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                      {idea.vcJustification}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-500 group/help relative">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Unfair Advantage</span>
                      <HelpCircle className="w-3 h-3 text-zinc-500 cursor-help" />
                      <div className="absolute bottom-full mb-2 left-0 w-48 p-2 bg-zinc-800 text-[10px] text-zinc-300 rounded-lg opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all z-50 border border-zinc-700 shadow-xl pointer-events-none">
                        Proprietary edge: data moat, patents, network effects, or unique distribution channels.
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                      {idea.unfairAdvantage}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-500">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Revenue Model</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 font-mono h-full">
                      {idea.revenueSkeleton}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Trend Sources</span>
                    </div>
                    <ul className="space-y-1.5 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 h-full">
                      {(idea.trendSources || []).map((source, i) => (
                        <li key={i} className="text-[11px] text-zinc-500 flex gap-2 items-start">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Pro/Builder Features (Toolkit & Tracker) - Moved Up */}
                {!isFree && (
                  <div className={`grid ${isBuilder ? 'grid-cols-2' : 'grid-cols-1'} gap-4 pt-2`}>
                    <button 
                      onClick={() => {
                        if (validationToolkit) setActiveToolkit(activeToolkit === 'validation' ? null : 'validation');
                        else handleGenerateValidation();
                      }}
                      disabled={isGeneratingValidation}
                      className={`flex items-center justify-center gap-2 py-2.5 transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg border ${
                        activeToolkit === 'validation' 
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
                        className={`flex items-center justify-center gap-2 py-2.5 transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg border ${
                          activeToolkit === 'progress' 
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
                                      <span className="text-emerald-500 font-bold">{i+1}.</span> {q}
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
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                              activeToolkit === 'roadmap' 
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
                                className={`p-4 rounded-xl border transition-all space-y-2 relative group/item ${
                                  item.isDone ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-zinc-900/50 border-white/5'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleToggleStep(item.id)}
                                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                        item.isDone ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700 hover:border-emerald-500'
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
                      className={`w-full flex items-center justify-center gap-2 py-3 transition-all text-xs font-bold rounded-lg shadow-lg ${
                        activeToolkit === 'build'
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
