import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { IdeaCardVetting } from '../../../src/components/idea/IdeaCardVetting';
import type { ExpertVetting } from '../../../src/types';

const baseVetting: ExpertVetting = {
  ideaId: 'idea-1',
  score: 82,
  verdict: 'High Conviction',
  strengths: ['Strong market fit', 'Clear value proposition'],
  weaknesses: ['High customer acquisition cost', 'Competitive market'],
  riskMitigation: ['Focus on organic growth', 'Differentiate on UX'],
  pivotSuggestions: ['B2B pivot', 'Enterprise focus'],
  comparableExits: ['Stripe ($95B)', 'Twilio ($54B)'],
  generatedAt: '2025-01-01',
};

describe('IdeaCardVetting', () => {
  it('renders score and verdict', () => {
    render(<IdeaCardVetting vettingResult={baseVetting} />);
    expect(screen.getByText('82/100')).toBeInTheDocument();
    expect(screen.getByText('High Conviction')).toBeInTheDocument();
  });

  it('renders all strengths', () => {
    render(<IdeaCardVetting vettingResult={baseVetting} />);
    expect(screen.getByText('Strong market fit')).toBeInTheDocument();
    expect(screen.getByText('Clear value proposition')).toBeInTheDocument();
  });

  it('renders all weaknesses', () => {
    render(<IdeaCardVetting vettingResult={baseVetting} />);
    expect(screen.getByText('High customer acquisition cost')).toBeInTheDocument();
    expect(screen.getByText('Competitive market')).toBeInTheDocument();
  });

  it('renders risk mitigations and pivot suggestions', () => {
    render(<IdeaCardVetting vettingResult={baseVetting} />);
    expect(screen.getByText('Focus on organic growth')).toBeInTheDocument();
    expect(screen.getByText('B2B pivot')).toBeInTheDocument();
  });

  it('hides refresh button when isAdmin is false', () => {
    render(<IdeaCardVetting vettingResult={baseVetting} isAdmin={false} />);
    expect(screen.queryByTitle('Force refresh analysis')).not.toBeInTheDocument();
  });

  it('shows refresh button when isAdmin is true', () => {
    render(<IdeaCardVetting vettingResult={baseVetting} isAdmin={true} onRefresh={vi.fn()} />);
    expect(screen.getByTitle('Force refresh analysis')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', async () => {
    const onRefresh = vi.fn();
    render(<IdeaCardVetting vettingResult={baseVetting} isAdmin={true} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle('Force refresh analysis'));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disables refresh button when isRefreshing', () => {
    render(
      <IdeaCardVetting
        vettingResult={baseVetting}
        isAdmin={true}
        onRefresh={vi.fn()}
        isRefreshing={true}
      />
    );
    expect(screen.getByTitle('Force refresh analysis')).toBeDisabled();
  });

  it('shows Moderate verdict', () => {
    const vetting = { ...baseVetting, verdict: 'Moderate' as const, score: 55 };
    render(<IdeaCardVetting vettingResult={vetting} />);
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('55/100')).toBeInTheDocument();
  });

  it('shows Pass verdict', () => {
    const vetting = { ...baseVetting, verdict: 'Pass' as const, score: 30 };
    render(<IdeaCardVetting vettingResult={vetting} />);
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });
});
