import React from 'react';
import { Bookmark, Wand2, Lock } from 'lucide-react';
import { Idea, UserSave, Tier } from '../../types';
import { TIER_LIMITS } from '../../constants';
import { useTierLimits } from '../../hooks/useTierLimits';
import { IdeaCard } from '../IdeaCard';
import { IdeaFeedSkeleton } from '../layout/SkeletonLoaders';

interface SavedIdeasTabProps {
  feedSaves: UserSave[];
  customSaves: UserSave[];
  toggleSave: (idea: Idea) => void;
  toggleCustomSave: (idea: Idea, userInput?: string) => void;
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

  return (
    <div className="space-y-10">
      {/* ── SECTION 1: Custom Ideas ────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Custom Ideas
            </h3>
            {tier !== 'free' && (
              <span className="text-[10px] text-zinc-600 font-mono bg-zinc-900/50 px-2 py-0.5 rounded-full border border-zinc-800/50">
                {customSaves.length} / {customSavesLimit}
              </span>
            )}
          </div>
          
          {tier !== 'free' && (
            <button
              onClick={onOpenAnalyzeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
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
        ) : customSaves.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {customSaves.map((save) => (
              <IdeaCard
                key={save.id}
                idea={save.idea}
                isSaved={true}
                onToggleSave={() => toggleCustomSave(save.idea, save.userInput)}
                onUpdateIdea={updateIdea}
                isSaving={false}
                tier={tier}
                onExport={(fmt) => exportToPDF(save.idea, fmt)}
                user={user}
                handleLogin={handleLogin}
                userInput={save.userInput}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-dashed border-zinc-800 text-center space-y-3 bg-zinc-900/20">
            <div className="w-10 h-10 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto text-zinc-600">
               <Wand2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-zinc-500 text-sm font-semibold">No custom ideas saved</p>
              <p className="text-zinc-600 text-[11px] max-w-[200px] mx-auto">
                Analyze a business concept above to get a full VC-grade profile and save it here.
              </p>
            </div>
          </div>
        )}
      </section>

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
