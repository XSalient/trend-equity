import React from 'react';
import { Lock } from 'lucide-react';
import { Idea, DailyGeneration, FilterState, UserSave, Tier } from '../../types';
import { IdeaCard } from '../IdeaCard';
import { FilterBar } from '../FilterBar';
import { TIER_LIMITS } from '../../constants';
import { IdeaFeedSkeleton } from '../layout/SkeletonLoaders';

interface IdeaFeedProps {
  dailyGen: DailyGeneration | null;
  userSaves: UserSave[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  tier: Tier;
  onExportCSV: () => void;
  onExportPDF: () => void;
  toggleSave: (idea: Idea) => void;
  updateIdea: (idea: Idea) => void;
  getFilteredIdeas: (ideas: Idea[]) => Idea[];
  exportToPDF: (idea: Idea, format: string) => void;
  setActiveTab: (tab: any) => void;
  loading?: boolean;
  user: any;
  handleLogin: () => void;
}

export const IdeaFeed: React.FC<IdeaFeedProps> = ({
  dailyGen,
  userSaves,
  filters,
  setFilters,
  tier,
  onExportCSV,
  onExportPDF,
  toggleSave,
  updateIdea,
  getFilteredIdeas,
  exportToPDF,
  setActiveTab,
  loading,
  user,
  handleLogin
}) => {
  const allIdeas = dailyGen?.ideas || [];
  const filteredIdeas = getFilteredIdeas(allIdeas).slice(0, TIER_LIMITS[tier].dailyIdeas);
  const hasActiveFilters = filters.industries.length > 0 || filters.productTypes.length > 0 || 
    filters.riskLevels.length > 0 || filters.effortLevels.length > 0 || 
    filters.marketFocus.length > 0 || filters.teamSize.length > 0 || 
    filters.customKeywords.length > 0;

  return (
    <>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        tier={tier}
        onExportCSV={onExportCSV}
        onExportPDF={onExportPDF}
        resultCount={hasActiveFilters ? filteredIdeas.length : undefined}
        totalCount={hasActiveFilters ? Math.min(allIdeas.length, TIER_LIMITS[tier].dailyIdeas) : undefined}
      />

      {loading ? (
        <IdeaFeedSkeleton />
      ) : (
        <>
          {filteredIdeas.length === 0 && hasActiveFilters ? (
            <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-3">
              <p className="text-zinc-400 text-sm font-medium">No ideas match your current filters.</p>
              <p className="text-zinc-600 text-xs">Try adjusting or resetting your filters to see results.</p>
            </div>
          ) : (
            filteredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                isSaved={userSaves.some(s => s.idea.id === idea.id)}
                onToggleSave={() => toggleSave(idea)}
                onUpdateIdea={updateIdea}
                isSaving={false}
                tier={tier}
                onExport={(fmt) => exportToPDF(idea, fmt)}
                user={user}
                handleLogin={handleLogin}
              />
            ))
          )}

          {tier === 'free' && dailyGen && dailyGen.ideas.length > TIER_LIMITS.free.dailyIdeas && (
            <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-500" />
              <Lock className="w-10 h-10 text-zinc-700 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase italic tracking-tight">Unlock {dailyGen.ideas.length - TIER_LIMITS.free.dailyIdeas} More Ideas</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                  Pro & Builder users get up to {TIER_LIMITS.builder.dailyIdeas} ideas daily, unlimited saves, and priority email digests.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('pro')}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-widest rounded-full transition-all shadow-lg shadow-emerald-900/40"
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
