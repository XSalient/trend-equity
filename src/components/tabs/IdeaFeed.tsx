import React from 'react';
import { Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { Idea, DailyGeneration, FilterState, UserSave, Tier } from '../../types';
import { IdeaCard } from '../IdeaCard';
import { FilterBar } from '../FilterBar';
import { DAILY_FEATURED_IDEAS, TIER_LIMITS } from '../../constants';
import { IdeaFeedSkeleton } from '../layout/SkeletonLoaders';

interface IdeaFeedProps {
  dailyGen: DailyGeneration | null;
  userSaves: UserSave[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  tier: Tier;
  isAdmin: boolean;
  onExportCSV: () => void;
  onExportPDF: () => void;
  toggleSave: (idea: Idea) => void;
  updateIdea: (idea: Idea) => void;
  getFilteredIdeas: (ideas: Idea[]) => Idea[];
  exportToPDF: (idea: Idea, format: string) => void;
  setActiveTab: (tab: any) => void;
  triggerGeneration: () => void;
  loading?: boolean;
  generating?: boolean;
  error?: string | null;
  user: any;
  handleLogin: () => void;
}

export const IdeaFeed: React.FC<IdeaFeedProps> = ({
  dailyGen,
  userSaves,
  filters,
  setFilters,
  tier,
  isAdmin,
  onExportCSV,
  onExportPDF,
  toggleSave,
  updateIdea,
  getFilteredIdeas,
  exportToPDF,
  setActiveTab,
  triggerGeneration,
  loading = false,
  generating = false,
  error = null,
  user,
  handleLogin,
}) => {
  const [showExtras, setShowExtras] = React.useState(false);
  const allIdeas = dailyGen?.ideas || [];
  const tierIdeas = allIdeas.slice(0, TIER_LIMITS[tier].dailyIdeas);
  const filteredIdeas = getFilteredIdeas(tierIdeas);
  const hasActiveFilters =
    filters.industries.length > 0 ||
    filters.productTypes.length > 0 ||
    filters.riskLevels.length > 0 ||
    filters.effortLevels.length > 0 ||
    filters.marketFocus.length > 0 ||
    filters.teamSize.length > 0 ||
    filters.customKeywords.length > 0;
  const shouldGroupExtras = !hasActiveFilters && filteredIdeas.length > DAILY_FEATURED_IDEAS;
  const visibleIdeas =
    shouldGroupExtras && !showExtras ? filteredIdeas.slice(0, DAILY_FEATURED_IDEAS) : filteredIdeas;
  const hiddenExtraCount = Math.max(0, filteredIdeas.length - DAILY_FEATURED_IDEAS);

  return (
    <>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        tier={tier}
        onExportCSV={onExportCSV}
        onExportPDF={onExportPDF}
        resultCount={hasActiveFilters ? filteredIdeas.length : undefined}
        totalCount={hasActiveFilters ? tierIdeas.length : undefined}
        onUpgrade={() => setActiveTab('pro')}
      />

      {loading ? (
        <IdeaFeedSkeleton />
      ) : !dailyGen ? (
        <div className="p-12 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl text-center space-y-6 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="relative">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
              <RefreshCw className="w-8 h-8 text-zinc-600 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                {isAdmin ? "Generate Today's Insights" : 'Curation in Progress'}
              </h3>
              <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
                {isAdmin
                  ? "Trigger the VC engine to scan today's high-signal trends and populate the global feed for all users."
                  : "Our VC engine is scanning real-time signals from the last 24 hours to identify today's highest conviction opportunities. Check back shortly."}
              </p>
            </div>
          </div>

          <div className="pt-2 relative z-10">
            {isAdmin ? (
              <button
                onClick={triggerGeneration}
                disabled={generating || loading}
                className={`inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold transition-all shadow-lg active:scale-95 ${
                  generating || loading
                    ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'GENERATING...' : 'TRIGGER GENERATION'}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800/30 text-zinc-500 text-xs font-bold uppercase tracking-widest rounded-full border border-zinc-800/50">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                SCANNING LIVE SIGNALS
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs justify-center max-w-sm mx-auto">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {filteredIdeas.length === 0 && hasActiveFilters ? (
            <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-3">
              <p className="text-zinc-400 text-sm font-medium">
                No ideas match your current filters.
              </p>
              <p className="text-zinc-600 text-xs">
                Try adjusting or resetting your filters to see results.
              </p>
            </div>
          ) : (
            <>
              {visibleIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  isSaved={userSaves.some((s) => s.idea.id === idea.id)}
                  onToggleSave={() => toggleSave(idea)}
                  onUpdateIdea={updateIdea}
                  isSaving={false}
                  tier={tier}
                  onExport={(fmt) => exportToPDF(idea, fmt)}
                  user={user}
                  handleLogin={handleLogin}
                  isAdmin={isAdmin}
                />
              ))}

              {shouldGroupExtras && (
                <button
                  onClick={() => setShowExtras((value) => !value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                >
                  {showExtras
                    ? 'Hide extra opportunities'
                    : `Show ${hiddenExtraCount} extra opportunities for deeper scanning`}
                </button>
              )}
            </>
          )}

          {tier === 'free' && dailyGen && dailyGen.ideas.length > TIER_LIMITS.free.dailyIdeas && (
            <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-500" />
              <Lock className="w-10 h-10 text-zinc-700 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight">
                  Unlock {dailyGen.ideas.length - TIER_LIMITS.free.dailyIdeas} more ideas
                </h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                  Pro & Builder users get up to {TIER_LIMITS.builder.dailyIdeas} ideas daily,
                  unlimited saves, and priority email digests.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('pro')}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full transition-all shadow-lg shadow-emerald-900/40"
              >
                View Pricing
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
};
