import React from 'react';
import { Search, RefreshCw, ExternalLink } from 'lucide-react';
import { Idea } from '../../types';

interface IdeaCardEvidenceProps {
  evidence: NonNullable<Idea['evidence']>;
  isAdmin?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const IdeaCardEvidence: React.FC<IdeaCardEvidenceProps> = ({
  evidence,
  isAdmin,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="p-5 bg-sky-500/5 border border-sky-500/20 rounded-2xl space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sky-400">
          <Search className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Market Evidence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-white">{evidence.evidenceScore}/10</span>
          {isAdmin && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-md transition-all disabled:opacity-50"
              title="Force refresh evidence"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">
            Competitors Found
          </p>
          {evidence.competitors.length > 0 ? (
            <ul className="space-y-1">
              {evidence.competitors.map((c, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex gap-2">
                  <span className="text-sky-400">•</span>
                  <span>
                    <span className="font-semibold text-white">{c.name}</span> — {c.oneLiner}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-500">
              No direct competitors found in search results.
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              Market Size (Cited)
            </p>
            <p className="text-[11px] text-zinc-300">{evidence.marketSizeCited}</p>
          </div>
          {evidence.whyNowEvidence && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                Why Now
              </p>
              <p className="text-[11px] text-zinc-300">{evidence.whyNowEvidence}</p>
            </div>
          )}
        </div>
      </div>

      {evidence.sources.length > 0 && (
        <div className="pt-2 space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Verified Sources
          </p>
          <div className="flex flex-wrap gap-2">
            {evidence.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 hover:border-sky-500/50 text-zinc-400 hover:text-sky-400 text-[10px] rounded-lg transition-all max-w-60"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{s.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
