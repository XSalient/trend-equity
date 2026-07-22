import React from 'react';
import { Lock } from 'lucide-react';

interface LockedAnalysisSectionProps {
  children: React.ReactNode;
  label?: string;
  onUnlockClick?: () => void;
}

export const LockedAnalysisSection: React.FC<LockedAnalysisSectionProps> = ({
  children,
  label = 'Locked Content',
  onUnlockClick,
}) => {
  return (
    <div className="relative group/locked rounded-lg overflow-hidden">
      {/* Blurred content underneath */}
      <div className="blur-sm pointer-events-none opacity-50">{children}</div>

      {/* Overlay with CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-zinc-900/40 via-zinc-900/60 to-zinc-900/40 backdrop-blur-xs rounded-lg border border-zinc-700/30">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-zinc-300">{label}</p>
            <p className="text-xs text-zinc-500">Pro feature</p>
          </div>
          {onUnlockClick && (
            <button
              onClick={onUnlockClick}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors mt-1 hover:underline"
            >
              Unlock full analysis →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
