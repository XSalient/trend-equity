import React from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Target, XCircle } from 'lucide-react';
import { Idea } from '../../types';

interface IdeaCardQualityProps {
  idea: Idea;
  isAdmin?: boolean;
  onUpdateIdea?: (idea: Idea) => void;
}

const FIT_STYLES = {
  keeper: {
    label: 'Keeper',
    icon: CheckCircle2,
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
  salvageable: {
    label: 'Needs narrowing',
    icon: AlertTriangle,
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  cut: {
    label: 'Cut candidate',
    icon: XCircle,
    className: 'text-red-400 bg-red-500/10 border-red-500/25',
  },
} as const;

function humanizeIssue(issue: string): string {
  return issue.replace(/_/g, ' ');
}

export const IdeaCardQuality: React.FC<IdeaCardQualityProps> = ({
  idea,
  isAdmin,
  onUpdateIdea,
}) => {
  const fit = idea.founderFit || (idea.qualityScore && idea.qualityScore >= 7.2 ? 'keeper' : null);
  const fitStyle = fit ? FIT_STYLES[fit] : null;
  const FitIcon = fitStyle?.icon;
  const score = idea.qualityScore ?? idea.qualityScorePrecheck;
  const hasQualityData =
    fit ||
    typeof score === 'number' ||
    idea.firstWedge ||
    idea.validationTest ||
    idea.killReason ||
    (idea.qualityIssues?.length || 0) > 0;

  if (!hasQualityData && !isAdmin) return null;

  const setReviewStatus = (adminReviewStatus: NonNullable<Idea['adminReviewStatus']>) => {
    onUpdateIdea?.({ ...idea, adminReviewStatus });
  };

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/35 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {fitStyle && FitIcon && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${fitStyle.className}`}
            >
              <FitIcon className="h-3.5 w-3.5" />
              {fitStyle.label}
            </span>
          )}
          {typeof score === 'number' && (
            <span className="text-xs font-mono text-zinc-400">
              Quality {Math.round(score * 10) / 10}/10
            </span>
          )}
        </div>

        {isAdmin && onUpdateIdea && (
          <div className="flex flex-wrap gap-1.5">
            {[
              ['published', 'Publish'],
              ['needs_narrowing', 'Narrow'],
              ['rejected', 'Reject'],
            ].map(([status, label]) => (
              <button
                key={status}
                onClick={() => setReviewStatus(status as NonNullable<Idea['adminReviewStatus']>)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  idea.adminReviewStatus === status
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(idea.buyer || idea.firstWedge || idea.validationTest || idea.killReason) && (
        <div className="grid gap-3 md:grid-cols-2">
          {(idea.buyer || idea.firstWedge) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Target className="h-3.5 w-3.5" />
                Initial wedge
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                {idea.buyer ? `${idea.buyer}: ` : ''}
                {idea.firstWedge || 'Not specified'}
              </p>
            </div>
          )}

          {(idea.validationTest || idea.killReason) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                <FlaskConical className="h-3.5 w-3.5" />
                Validation / kill test
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                {idea.validationTest || idea.killReason}
              </p>
            </div>
          )}
        </div>
      )}

      {idea.killReason && (
        <p className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-300/90">
          {idea.killReason}
        </p>
      )}

      {isAdmin && (idea.qualityIssues?.length || 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {idea.qualityIssues!.map((issue) => (
            <span
              key={issue}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500"
            >
              {humanizeIssue(issue)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
