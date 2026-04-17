import React from 'react';
import { Bookmark, Wand2, Lock } from 'lucide-react';
import { Idea, UserSave, UserLatestIdea, Tier } from '../../types';
import { TIER_LIMITS } from '../../constants';
import { useTierLimits } from '../../hooks/useTierLimits';
import { IdeaCard } from '../IdeaCard';
import { IdeaFeedSkeleton } from '../layout/SkeletonLoaders';

interface SavedIdeasTabProps {
  feedSaves: UserSave[];
  customSaves: UserSave[];
  latestIdea: UserLatestIdea | null;
  loadingLatest: boolean;
  toggleSave: (idea: Idea) => void;
  toggleCustomSave: (idea: Idea) => void;
  updateIdea: (idea: Idea) => void;
  tier: Tier;
  exportToPDF: (idea: Idea, format: string) => void;
  loading?: boolean;
  user: any;
  handleLogin: () => void;
  onOpenAnalyzeModal: () => void;
  onUpgradeNeeded: () => void;
}

export const SavedIdeasTab: React.FC<SavedIdeasTabProps> = ({
  feedSaves,
  customSaves,
  latestIdea,
  loadingLatest,
  toggleSave,
  toggleCustomSave,
  updateIdea,
  tier,
  exportToPDF,
  loading,
  user,
  handleLogin,
  onOpenAnalyzeModal,
  onUpgradeNeeded,
}) => {
  const { getCustomSavesLimit } = useTierLimits();
  if (loading) return <IdeaFeedSkeleton />;

  const customSavesLimit = getCustomSavesLimit(tier);
  const feedSavesLimit = TIER_LIMITS[tier]?.monthlySaves ?? Infinity;

  const isLatestAlsoCustomSaved = latestIdea
    ? customSaves.some((s) => s.idea.id === latestIdea.idea.id)
    : false;

  return (
    <div className="space-y-10">
      {/* ── SECTION 1: My Latest Idea ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            My Latest Idea
          </h3>
          {tier !== 'free' && (
            <button
              onClick={onOpenAnalyzeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Analyze My Idea
            </button>
          )}
        </div>

        {tier === 'free' ? (
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-center gap-4">
            <Lock className="w-8 h-8 text-zinc-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 font-semibold text-sm">Pro feature</p>
              <p className="text-zinc-600 text-xs mt-0.5">
                Upgrade to Pro to analyze your own business ideas with AI.
              </p>
            </div>
            <button
              onClick={onUpgradeNeeded}
              className="flex-shrink-0 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all"
            >
              Upgrade
            </button>
          </div>
        ) : loadingLatest ? (
          <IdeaFeedSkeleton />
        ) : latestIdea ? (
          <IdeaCard
            idea={latestIdea.idea}
            isSaved={isLatestAlsoCustomSaved}
            onToggleSave={() => toggleCustomSave(latestIdea.idea)}
            onUpdateIdea={updateIdea}
            isSaving={false}
            tier={tier}
            onExport={(fmt) => exportToPDF(latestIdea.idea, fmt)}
            user={user}
            handleLogin={handleLogin}
          />
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center space-y-2">
            <Wand2 className="w-8 h-8 text-zinc-700 mx-auto" />
            <p className="text-zinc-500 text-sm font-semibold">No analysis yet</p>
            <p className="text-zinc-600 text-xs">
              Click "Analyze My Idea" above to get a full VC-grade profile for your concept.
            </p>
          </div>
        )}
      </section>

      {/* ── SECTION 2: Custom Ideas ────────────────────────────────── */}
      {tier !== 'free' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Custom Ideas
            </h3>
            <span className="text-xs text-zinc-600 font-mono">
              {customSaves.length} / {customSavesLimit}
            </span>
          </div>

          {customSaves.length > 0 ? (
            <div className="space-y-4">
              {customSaves.map((save) => (
                <IdeaCard
                  key={save.id}
                  idea={save.idea}
                  isSaved={true}
                  onToggleSave={() => toggleCustomSave(save.idea)}
                  onUpdateIdea={updateIdea}
                  isSaving={false}
                  tier={tier}
                  onExport={(fmt) => exportToPDF(save.idea, fmt)}
                  user={user}
                  handleLogin={handleLogin}
                />
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-dashed border-zinc-800 text-center space-y-1">
              <p className="text-zinc-600 text-xs">
                Analyze an idea and save it here for future reference.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── SECTION 3: Saved from Daily Feed ──────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Daily Feed Collection
          </h3>
          <span className="text-xs text-zinc-600 font-mono">
            {feedSaves.length} {isFinite(feedSavesLimit) ? `/ ${feedSavesLimit}` : ''}
          </span>
        </div>

        {feedSaves.length > 0 ? (
          <div className="space-y-4">
            {feedSaves.map((save) => (
              <IdeaCard
                key={save.id}
                idea={save.idea}
                isSaved={true}
                onToggleSave={() => toggleSave(save.idea)}
                onUpdateIdea={updateIdea}
                isSaving={false}
                tier={tier}
                onExport={(fmt) => exportToPDF(save.idea, fmt)}
                user={user}
                handleLogin={handleLogin}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center space-y-4">
            <Bookmark className="w-12 h-12 text-zinc-800 mx-auto" />
            <div className="space-y-1">
              <p className="text-zinc-400 font-bold">No saved ideas yet</p>
              <p className="text-zinc-600 text-xs">
                Ideas you bookmark from the Daily Feed will appear here.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
