import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { ValidationSection } from '../../../src/components/idea/toolkit/ValidationSection';
import type { Idea } from '../../../src/types';

vi.mock('../../../src/components/layout/SkeletonLoaders', () => ({
  ToolkitSkeleton: () => <div data-testid="toolkit-skeleton" />,
}));

const baseIdea: Idea = {
  id: 'idea-1',
  headline: 'AI-Powered Legal Research',
  pitch: 'Automates case law research for small law firms',
  vcJustification: 'Massive TAM, clear pain point',
  categoryTags: ['LegalTech', 'AI'],
  costEffort: 'Medium',
  revenuePotentialScore: 88,
  revenueSkeleton: 'SaaS subscription',
  unfairAdvantage: 'Proprietary dataset',
  potentialExit: 'Strategic acquisition',
  trendSources: ['source1'],
  saturationLabel: 'Low',
  heatBadge: 'Hot',
  nextSteps: ['Step 1'],
};

const mockValidationToolkit = {
  landingPage: {
    hero: 'Research Cases 10x Faster',
    subHero: 'AI-powered legal research for small firms',
    valueProps: ['Save 20hrs/week', 'Cut research costs by 60%'],
  },
  interviewScript: [
    'What is your biggest research pain point?',
    'How do you currently handle case law?',
  ],
  smokeTest: 'Create a landing page with email capture and measure signups',
  successMetrics: ['100 signups in 2 weeks', '$5k MRR in 3 months'],
  generatedAt: '2025-01-01',
};

describe('ValidationSection', () => {
  it('shows skeleton when no validation toolkit and not refreshing', () => {
    render(<ValidationSection idea={baseIdea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByTestId('toolkit-skeleton')).toBeInTheDocument();
  });

  it('shows loading skeleton when isRefreshing with no toolkit', () => {
    render(<ValidationSection idea={baseIdea} setActiveToolkit={vi.fn()} isRefreshing={true} />);
    expect(screen.getByTestId('toolkit-skeleton')).toBeInTheDocument();
  });

  it('renders hero headline when toolkit data is present', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByText('Research Cases 10x Faster')).toBeInTheDocument();
  });

  it('renders sub-headline', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByText('AI-powered legal research for small firms')).toBeInTheDocument();
  });

  it('renders value propositions', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByText('Save 20hrs/week')).toBeInTheDocument();
    expect(screen.getByText('Cut research costs by 60%')).toBeInTheDocument();
  });

  it('renders interview questions', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByText(/"What is your biggest research pain point\?"/)).toBeInTheDocument();
  });

  it('renders smoke test strategy', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByText(/Create a landing page with email capture/)).toBeInTheDocument();
  });

  it('renders success metrics', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} />);
    expect(screen.getByText('100 signups in 2 weeks')).toBeInTheDocument();
    expect(screen.getByText('$5k MRR in 3 months')).toBeInTheDocument();
  });

  it('hides admin refresh button when not admin', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={vi.fn()} isAdmin={false} />);
    expect(screen.queryByTitle('Force refresh analysis')).not.toBeInTheDocument();
  });

  it('shows admin refresh button when isAdmin', () => {
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(
      <ValidationSection
        idea={idea}
        setActiveToolkit={vi.fn()}
        isAdmin={true}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByTitle('Force refresh analysis')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', async () => {
    const onRefresh = vi.fn();
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(
      <ValidationSection
        idea={idea}
        setActiveToolkit={vi.fn()}
        isAdmin={true}
        onRefresh={onRefresh}
      />
    );
    await userEvent.click(screen.getByTitle('Force refresh analysis'));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('calls setActiveToolkit(null) when close button clicked', async () => {
    const setActiveToolkit = vi.fn();
    const idea = { ...baseIdea, validationToolkit: mockValidationToolkit };
    render(<ValidationSection idea={idea} setActiveToolkit={setActiveToolkit} />);
    // Close button is the X button in the header
    const closeBtn = screen.getByRole('button', { name: '' });
    await userEvent.click(closeBtn);
    expect(setActiveToolkit).toHaveBeenCalledWith(null);
  });
});
