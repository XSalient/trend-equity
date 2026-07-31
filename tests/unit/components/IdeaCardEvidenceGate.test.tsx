import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { IdeaCard } from '../../../src/components/IdeaCard';
import type { Idea } from '../../../src/types';

const mockTrackEvent = vi.fn();
const mockGatherEvidence = vi.fn();

vi.mock('../../../src/services/trackingService', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('../../../src/hooks/useIdeaActions', () => ({
  useIdeaActions: () => ({
    isGeneratingPlan: false,
    isGeneratingBuild: false,
    isGeneratingValidation: false,
    isVetting: false,
    vettingResult: null,
    isGatheringEvidence: false,
    evidenceResult: null,
    handleGatherEvidence: mockGatherEvidence,
    explainingSection: null,
    explanation: null,
    setExplanation: vi.fn(),
    actionError: null,
    clearActionError: vi.fn(),
    handleGenerateFullPlan: vi.fn(),
    handleGenerateBuild: vi.fn(),
    handleGenerateValidation: vi.fn(),
    handleExplainSection: vi.fn(),
    handleExpertVetting: vi.fn(),
  }),
}));

vi.mock('../../../src/hooks/useIdeaFeedback', () => ({
  useIdeaFeedback: () => ({ reaction: null, toggleReaction: vi.fn(), loading: false }),
}));

vi.mock('../../../src/components/idea/IdeaComments', () => ({
  IdeaComments: () => <div />,
}));

// IdeaCardEvidence reaches src/firebase.ts through analyticsService, which
// throws on an unconfigured API key at import time.
vi.mock('../../../src/services/analyticsService', () => ({
  logEvent: vi.fn(),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const idea = {
  id: 'idea-1',
  headline: 'AI Scheduling SaaS',
  pitch: 'Automates appointment booking',
  vcJustification: 'Large TAM',
  categoryTags: ['SaaS'],
  costEffort: 'Low',
  revenuePotentialScore: 85,
  trendSources: ['Product Hunt'],
  nextSteps: ['Talk to users'],
} as unknown as Idea;

const baseProps = {
  idea,
  isSaved: false,
  onToggleSave: vi.fn(),
  isSaving: false,
  onExport: vi.fn(),
  user: { uid: 'u1' },
  handleLogin: vi.fn(),
};

// The gated Evidence control is the free user's entry point to checkout. TE-59
// shipped it as a dead control twice over: `pointer-events-none` on the tooltip
// swallowed the click, and the two Saved-ideas render sites never passed
// `onUpgrade` at all. These assert the journey — a free user reaches the upgrade
// path — not that a particular element exists.
describe('IdeaCard free-tier Evidence gate', () => {
  beforeEach(() => {
    mockTrackEvent.mockClear();
    mockGatherEvidence.mockClear();
  });

  it('sends a free user to the upgrade path when the gated Evidence control is clicked', async () => {
    const onUpgrade = vi.fn();
    render(<IdeaCard {...baseProps} tier="free" onUpgrade={onUpgrade} />);

    const evidence = screen.getByRole('button', { name: /market evidence requires a pro plan/i });
    expect(evidence).toBeEnabled();

    await userEvent.click(evidence);

    expect(onUpgrade).toHaveBeenCalledOnce();
    expect(mockTrackEvent).toHaveBeenCalledWith('upgrade_click', 'idea-1');
    expect(mockGatherEvidence).not.toHaveBeenCalled();
  });

  it('renders the gated control as inert when there is no upgrade path to send the user to', () => {
    render(<IdeaCard {...baseProps} tier="free" />);

    expect(
      screen.getByRole('button', { name: /market evidence requires a pro plan/i })
    ).toBeDisabled();
  });

  it('gathers evidence instead of upgrading for a paid user', async () => {
    const onUpgrade = vi.fn();
    render(<IdeaCard {...baseProps} tier="pro" onUpgrade={onUpgrade} />);

    await userEvent.click(screen.getByRole('button', { name: /^evidence$/i }));

    expect(mockGatherEvidence).toHaveBeenCalledOnce();
    expect(onUpgrade).not.toHaveBeenCalled();
  });
});
