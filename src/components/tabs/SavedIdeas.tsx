import React from 'react';
import { Bookmark } from 'lucide-react';
import { Idea, UserSave, Tier } from '../../types';
import { IdeaCard } from '../IdeaCard';
import { IdeaFeedSkeleton } from '../layout/SkeletonLoaders';

interface SavedIdeasTabProps {
  userSaves: UserSave[];
  toggleSave: (idea: Idea) => void;
  updateIdea: (idea: Idea) => void;
  tier: Tier;
  exportToPDF: (idea: Idea, format: string) => void;
  loading?: boolean;
  user: any;
  handleLogin: () => void;
}

export const SavedIdeasTab: React.FC<SavedIdeasTabProps> = ({
  userSaves,
  toggleSave,
  updateIdea,
  tier,
  exportToPDF,
  loading,
  user,
  handleLogin
}) => {
  if (loading) return <IdeaFeedSkeleton />;

  return (
    userSaves.length > 0 ? (
      userSaves.map((save) => (
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
      ))
    ) : (
      <div className="py-20 text-center space-y-4">
        <Bookmark className="w-12 h-12 text-zinc-800 mx-auto" />
        <div className="space-y-1">
          <p className="text-zinc-400 font-bold">No saved ideas yet</p>
          <p className="text-zinc-600 text-xs">Ideas you bookmark will appear here for later review.</p>
        </div>
      </div>
    )
  );
};
