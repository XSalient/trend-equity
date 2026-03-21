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
  HelpCircle
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
        <p className="text-zinc-300 text-sm leading-relaxed italic border-l-2 border-emerald-500/30 pl-4 py-1">
          "{idea.pitch}"
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 pb-1">
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Potential Score</span>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                  style={{ width: `${idea.revenuePotentialScore * 10}%` }} 
                />
              </div>
              <span className="text-sm font-black font-mono text-emerald-400">{idea.revenuePotentialScore}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cost & Effort</span>
              <p className="text-xs text-zinc-300 font-medium">{idea.costEffort}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Exit Strategy</span>
              <p className="text-xs text-zinc-300 font-medium break-words line-clamp-2">{idea.potentialExit}</p>
            </div>
          </div>
        </div>

        {/* Next Steps (Preview) */}
        {idea.nextSteps && idea.nextSteps.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Actionable Next Steps</span>
            </div>
            <div className="grid gap-2">
              {idea.nextSteps.slice(0, isFree ? 3 : 7).map((step, i) => {
                const parts = step.split('|').map(s => s.trim());
                const title = parts[0] || step;
                const timeline = parts[1];
                const risk = parts[2];
                const tool = parts[3];

                return (
                  <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <span className={isFree ? 'line-clamp-1' : 'font-medium text-zinc-300'}>{title}</span>
                      {!isFree && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {timeline && (
                            <span className="text-[9px] text-blue-400 bg-blue-400/5 px-1.5 py-0.5 rounded border border-blue-400/10 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {timeline}
                            </span>
                          )}
                          {risk && (
                            <span className="text-[9px] text-amber-400 bg-amber-400/5 px-1.5 py-0.5 rounded border border-amber-400/10 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> {risk}
                            </span>
                          )}
                          {tool && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-400/5 px-1.5 py-0.5 rounded border border-emerald-400/10 flex items-center gap-1">
                              <Hammer className="w-2.5 h-2.5" /> {tool}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                className="overflow-hidden space-y-4 pt-2"
              >
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
                    <div className="flex items-center gap-2 text-amber-500 group/help">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Unfair Advantage</span>
                      <div className="relative">
                        <HelpCircle className="w-3 h-3 text-zinc-500 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-zinc-800 text-[10px] text-zinc-300 rounded-lg opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all z-50 border border-zinc-700 shadow-xl pointer-events-none">
                          Proprietary edge: data moat, patents, network effects, or unique distribution channels.
                        </div>
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
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 font-mono">
                      {idea.revenueSkeleton}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Trend Sources</span>
                    </div>
                    <ul className="space-y-1.5 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                      {idea.trendSources.map((source, i) => (
                        <li key={i} className="text-[11px] text-zinc-500 flex gap-2 items-start">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Pro/Builder Features (Toolkit & Tracker) */}
                {!isFree && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">
                      <BarChart3 className="w-3 h-3" />
                      Validation Toolkit
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">
                      <Shield className="w-3 h-3" />
                      Progress Tracker
                    </button>
                  </div>
                )}

                {/* Full Next Steps / Roadmap Section */}
                {isBuilder && idea.nextSteps && idea.nextSteps.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Full Action Plan</span>
                      </div>
                    </div>

                    {fullPlan ? (
                      <div className="space-y-6 bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Map className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Roadmap</span>
                            </div>
                            <div className="space-y-4">
                              {fullPlan.roadmap.map((item, i) => (
                                <div key={i} className="relative pl-6 border-l border-zinc-700 pb-4 last:pb-0">
                                  <div className="absolute left-[-4.5px] top-0 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                  <div className="space-y-1">
                                    <p className="text-xs font-bold text-white">{item.step}</p>
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">{item.details}</p>
                                    <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Milestone: {item.milestone}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Hammer className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Essential Tools</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {fullPlan.tools.map((tool, i) => (
                                  <span key={i} className="px-2 py-1 bg-zinc-900 text-[10px] text-zinc-300 rounded border border-zinc-800">{tool}</span>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-zinc-400">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Key Risks</span>
                              </div>
                              <ul className="space-y-1.5">
                                {fullPlan.risks.map((risk, i) => (
                                  <li key={i} className="text-[10px] text-zinc-400 flex gap-2">
                                    <span className="text-amber-500">•</span>
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Timeline</span>
                              </div>
                              <p className="text-xs text-zinc-300 font-medium">{fullPlan.timeline}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50 space-y-3">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Map className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Roadmap Preview</span>
                        </div>
                        <p className="text-xs text-zinc-400 italic">
                          "Step 4 – Build threat model and security audit protocol..."
                        </p>
                        <div className="pt-2">
                          <button 
                            onClick={handleGenerateFullPlan}
                            disabled={isGeneratingPlan}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                          >
                            {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            GENERATE FULL ROADMAP
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Upgrade CTA for Free/Pro */}
                {!isBuilder && (
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
