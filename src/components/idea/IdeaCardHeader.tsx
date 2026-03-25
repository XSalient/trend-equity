import React from 'react';
import { Download, FileText, Share2, Bookmark, BookmarkCheck, Loader2, Zap } from 'lucide-react';
import { Idea } from '../../types';

interface IdeaCardHeaderProps {
  idea: Idea;
  isSaved: boolean;
  onToggleSave: () => void;
  isSaving: boolean;
  onExport?: (format: 'pdf' | 'notion' | 'gdocs') => void;
  isFree: boolean;
}

export const IdeaCardHeader: React.FC<IdeaCardHeaderProps> = ({
  idea,
  isSaved,
  onToggleSave,
  isSaving,
  onExport,
  isFree
}) => {
  return (
    <div className="flex justify-between items-start gap-4">
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1.5 items-center">
          {(idea.categoryTags || []).map(tag => (
            <span key={tag} className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {tag}
            </span>
          ))}
          <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {idea.heatBadge || 'Early Bird'}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-white leading-snug group-hover:text-emerald-400 transition-colors">{idea.headline}</h3>
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
                  <p className="text-xs text-zinc-500">Upgrade for Notion/GDocs</p>
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
  );
};
