import React, { useEffect } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { Idea, WeeklyBestIdea, Tier } from '../../types';
import { IdeaCard } from '../IdeaCard';
import { IdeaFeedSkeleton } from '../layout/SkeletonLoaders';

interface WeeklyBestProps {
  weeklyBest: WeeklyBestIdea[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  onFetch: () => void;
  userSaves: { idea: Idea }[];
  toggleSave: (idea: Idea) => void;
  updateIdea: (idea: Idea) => void;
  tier: Tier;
  exportToPDF: (idea: Idea, format: string) => void;
  user: any;
  handleLogin: () => void;
}

export const WeeklyBestTab: React.FC<WeeklyBestProps> = ({
  weeklyBest,
  loading,
  error,
  fetched,
  onFetch,
  userSaves,
  toggleSave,
  updateIdea,
  tier,
  exportToPDF,
  user,
  handleLogin,
}) => {
  useEffect(() => {
    if (!fetched && !loading) onFetch();
  }, [fetched, loading, onFetch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold tracking-tight text-white">Top 10 of the Week</h3>
          </div>
          <p className="text-xs text-zinc-500">
            Ideas the AI kept surfacing over the past 7 days — ranked by recurrence, then revenue
            potential.
          </p>
        </div>
        {fetched && (
          <button
            onClick={onFetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && <IdeaFeedSkeleton count={3} />}

      {/* Error */}
      {!loading && error && (
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-3">
          <p className="text-zinc-400 text-sm">{error}</p>
          <button
            onClick={onFetch}
            className="px-4 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && fetched && weeklyBest.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <Trophy className="w-12 h-12 text-zinc-800 mx-auto" />
          <div className="space-y-1">
            <p className="text-zinc-400 font-bold">Not enough data yet</p>
            <p className="text-zinc-600 text-sm max-w-xs mx-auto">
              Check back after a few days of idea generation — recurring ideas will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Ideas */}
      {!loading &&
        !error &&
        weeklyBest.map((idea) => (
          <div key={idea.id}>
            {idea.recurrenceCount > 1 && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="text-base leading-none">🔁</span>
                  Appeared {idea.recurrenceCount}× this week
                </span>
              </div>
            )}
            <IdeaCard
              idea={idea}
              isSaved={userSaves.some((s) => s.idea.id === idea.id)}
              onToggleSave={() => toggleSave(idea)}
              onUpdateIdea={updateIdea}
              isSaving={false}
              tier={tier}
              onExport={(fmt) => exportToPDF(idea, fmt)}
              user={user}
              handleLogin={handleLogin}
            />
          </div>
        ))}
    </div>
  );
};
