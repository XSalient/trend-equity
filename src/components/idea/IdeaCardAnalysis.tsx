import React from 'react';
import { Target, Zap, HelpCircle, DollarSign, TrendingUp, BarChart2, Users, Shield } from 'lucide-react';
import { Idea } from '../../types';

interface IdeaCardAnalysisProps {
  idea: Idea;
}

function SectionLabel({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

export const IdeaCardAnalysis: React.FC<IdeaCardAnalysisProps> = ({ idea }) => {
  const regulatoryColor =
    idea.regulatoryFlags?.startsWith('High') ? 'text-red-400' :
    idea.regulatoryFlags?.startsWith('Medium') ? 'text-amber-400' :
    'text-green-400';

  return (
    <div className="space-y-5">

      {/* Row 1: VC Justification + Unfair Advantage */}
      <div className="grid md:grid-cols-2 gap-3 items-start">
        <div className="space-y-2">
          <SectionLabel icon={Target} label="VC Justification" color="text-emerald-500" />
          <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
            {idea.vcJustification}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-500 relative group/help">
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-semibold">Unfair Advantage</span>
            <HelpCircle className="w-3 h-3 text-zinc-600 cursor-help" />
            <div className="absolute bottom-full mb-2 left-0 w-52 p-2.5 bg-zinc-800 text-xs text-zinc-300 rounded-lg opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all z-50 border border-zinc-700 shadow-xl pointer-events-none leading-relaxed">
              Proprietary edge: data moat, patents, network effects, or unique distribution channels.
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
            {idea.unfairAdvantage || <span className="text-zinc-600 italic">Not assessed for this idea</span>}
          </p>
        </div>
      </div>

      {/* Row 2: Revenue Model — full width */}
      <div className="space-y-2">
        <SectionLabel icon={DollarSign} label="Revenue Model" color="text-blue-400" />
        <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 font-mono">
          {idea.revenueSkeleton || <span className="font-sans italic text-zinc-600">No revenue model specified</span>}
        </p>
      </div>

      {/* Row 3: Trend Sources — full width */}
      <div className="space-y-2">
        <SectionLabel icon={TrendingUp} label="Trend Sources" color="text-zinc-400" />
        <ul className="space-y-2 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
          {(idea.trendSources || []).map((source, i) => (
            <li key={i} className="text-xs text-zinc-500 flex gap-2 items-start leading-relaxed">
              <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
              <span>{source}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Row 4: Market Size / Competitors / Regulatory */}
      {(idea.marketSize || idea.competitorLandscape || idea.regulatoryFlags) && (
        <div className="grid md:grid-cols-3 gap-3 items-start">
          {idea.marketSize && (
            <div className="space-y-2">
              <SectionLabel icon={BarChart2} label="Market Size" color="text-emerald-400" />
              <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                {idea.marketSize}
              </p>
            </div>
          )}

          {idea.competitorLandscape && (
            <div className="space-y-2">
              <SectionLabel icon={Users} label="Competitors" color="text-purple-400" />
              <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                {idea.competitorLandscape}
              </p>
            </div>
          )}

          {idea.regulatoryFlags && (
            <div className="space-y-2">
              <SectionLabel icon={Shield} label="Regulatory" color={regulatoryColor} />
              <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50">
                {idea.regulatoryFlags}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
