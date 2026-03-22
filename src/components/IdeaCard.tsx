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
  Sparkles
} from 'lucide-react';
import { Idea } from '../types';
import { generateFullActionPlan } from '../services/geminiService';

interface IdeaCardProps {
  idea: Idea;
  isSaved: boolean;
  onToggleSave: () => void;
  isSaving: boolean;
  tier: 'free' | 'pro' | 'builder';
  onExport?: (format: 'pdf' | 'notion' | 'gdocs') => void;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ 
  idea, 
  isSaved, 
  onToggleSave, 
  isSaving,
  tier,
  onExport
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [fullPlan, setFullPlan] = useState<Idea['fullActionPlan'] | null>(null);
  
  const isFree = tier === 'free';
  const isPro = tier === 'pro';
  const isBuilder = tier === 'builder';

  const handleGenerateFullPlan = async () => {
    if (!isBuilder) return;
    setIsGeneratingPlan(true);
    try {
      const plan = await generateFullActionPlan(idea);
      setFullPlan(plan);
    } catch (error) {
      console.error("Failed to generate full plan:", error);
      alert("Failed to generate full plan. Please try again.");
    } finally {
      setIsGeneratingPlan(false);
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
              {idea.categoryTags.map(tag => (
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
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                onClick={() => alert("Build with Me: Generating prompt pack and starter repo...")}
              >
                <Wand2 className="w-4 h-4" />
                BUILD WITH ME
              </button>
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
                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Actionable Next Steps</span>
                  </div>
                  <div className="grid gap-2">
                    {idea.nextSteps.slice(0, isFree ? 3 : idea.nextSteps.length).map((step, i) => {
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
                      {idea.trendSources.map((source, i) => (
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
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <button className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg border border-white/5">
                      <BarChart3 className="w-4 h-4" />
                      Validation Toolkit
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest rounded-lg border border-white/5">
                      <Shield className="w-4 h-4" />
                      Progress Tracker
                    </button>
                  </div>
                )}

                {/* Full Action Plan - Only for Builder */}
                {isBuilder && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Rocket className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Full Execution Plan</span>
                      </div>
                      {!fullPlan && (
                        <button 
                          onClick={handleGenerateFullPlan}
                          disabled={isGeneratingPlan}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {isGeneratingPlan ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              Generate Full Plan
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {fullPlan && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {/* Roadmap Steps */}
                        <div className="space-y-3">
                          {fullPlan.roadmap.map((item, i) => (
                            <div key={i} className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Phase {i + 1}</span>
                                <span className="text-[10px] font-mono text-zinc-500">{item.milestone}</span>
                              </div>
                              <h5 className="text-sm font-bold text-white">{item.step}</h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">{item.details}</p>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Stack/Tools</span>
                            <div className="flex flex-wrap gap-2">
                              {fullPlan.tools.map((tool, i) => (
                                <span key={i} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] rounded-md border border-white/5">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Key Risks</span>
                            <div className="flex flex-wrap gap-2">
                              {fullPlan.risks.map((risk, i) => (
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
