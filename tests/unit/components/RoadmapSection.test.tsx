import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { RoadmapSection } from '../../../src/components/idea/toolkit/RoadmapSection';
import type { Idea } from '../../../src/types';

vi.mock('../../../src/components/layout/SkeletonLoaders', () => ({
  ToolkitSkeleton: () => <div data-testid="toolkit-skeleton" />,
}));

const baseIdea: Idea = {
  id: 'idea-1',
  headline: 'AI Scheduling SaaS',
  pitch: 'Automates appointment booking for service businesses',
  vcJustification: 'Clear pain point, large TAM',
  categoryTags: ['SaaS'],
  costEffort: 'Low',
  revenuePotentialScore: 85,
  revenueSkeleton: 'Subscription + transaction fees',
  unfairAdvantage: 'AI-first approach',
  potentialExit: 'Acquisition',
  trendSources: ['source1'],
  saturationLabel: 'Medium',
  heatBadge: 'Warm',
  nextSteps: ['Step 1'],
};

const mockPlan = {
  roadmap: [
    {
      id: 'step-1',
      step: 'Validate the market',
      details: 'Interview 20 potential customers',
      milestone: 'Week 1',
      isDone: false,
    },
    {
      id: 'step-2',
      step: 'Build MVP',
      details: 'Core booking flow only',
      milestone: 'Week 4',
      isDone: false,
    },
    {
      id: 'step-3',
      step: 'Launch beta',
      details: 'Invite first 50 users',
      milestone: 'Week 6',
      isDone: true,
    },
  ],
  tools: ['Next.js', 'Stripe', 'Cal.com API'],
  risks: ['High churn if UX poor', 'Enterprise sales cycle long'],
  timeline: '3 months to first paying customer',
  generatedAt: '2025-01-01',
};

const defaultProps = {
  setActiveToolkit: vi.fn(),
  isGeneratingPlan: false,
  handleGenerateFullPlan: vi.fn().mockResolvedValue(true),
  handleToggleStep: vi.fn(),
  handleRemoveStep: vi.fn(),
  handleExplainSection: vi.fn(),
  explainingSection: null,
  explanation: null,
  setExplanation: vi.fn(),
  isAddingStep: false,
  setIsAddingStep: vi.fn(),
  newStep: { step: '', details: '', milestone: '' },
  setNewStep: vi.fn(),
  handleAddCustomStep: vi.fn(),
};

describe('RoadmapSection', () => {
  it('shows generate plan CTA when no action plan exists', () => {
    render(<RoadmapSection {...defaultProps} idea={baseIdea} />);
    expect(screen.getByText('Generate Full Roadmap')).toBeInTheDocument();
  });

  it('calls handleGenerateFullPlan when CTA clicked', async () => {
    const handleGenerateFullPlan = vi.fn().mockResolvedValue(true);
    render(
      <RoadmapSection
        {...defaultProps}
        idea={baseIdea}
        handleGenerateFullPlan={handleGenerateFullPlan}
      />
    );
    await userEvent.click(screen.getByText('Generate Full Roadmap'));
    expect(handleGenerateFullPlan).toHaveBeenCalledOnce();
    // Must be called with NO arguments — passing the click event through as the
    // `refresh` param gets JSON.stringified into the API body and throws
    // "Converting circular structure to JSON".
    expect(handleGenerateFullPlan).toHaveBeenCalledWith();
  });

  it('shows skeleton loader while generating plan', () => {
    render(<RoadmapSection {...defaultProps} idea={baseIdea} isGeneratingPlan={true} />);
    expect(screen.getByTestId('toolkit-skeleton')).toBeInTheDocument();
  });

  it('renders roadmap steps when plan exists', () => {
    const idea = { ...baseIdea, fullActionPlan: mockPlan };
    render(<RoadmapSection {...defaultProps} idea={idea} />);
    expect(screen.getByText('Validate the market')).toBeInTheDocument();
    expect(screen.getByText('Build MVP')).toBeInTheDocument();
    expect(screen.getByText('Launch beta')).toBeInTheDocument();
  });

  it('renders step milestones', () => {
    const idea = { ...baseIdea, fullActionPlan: mockPlan };
    render(<RoadmapSection {...defaultProps} idea={idea} />);
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 4')).toBeInTheDocument();
  });

  it('renders step details', () => {
    const idea = { ...baseIdea, fullActionPlan: mockPlan };
    render(<RoadmapSection {...defaultProps} idea={idea} />);
    expect(screen.getByText('Interview 20 potential customers')).toBeInTheDocument();
    expect(screen.getByText('Core booking flow only')).toBeInTheDocument();
  });

  it('calls handleToggleStep when step toggle button clicked', async () => {
    const handleToggleStep = vi.fn();
    const idea = { ...baseIdea, fullActionPlan: mockPlan };
    render(<RoadmapSection {...defaultProps} idea={idea} handleToggleStep={handleToggleStep} />);
    // Each step's first button is the toggle (Circle/CheckCircle icon)
    const stepEl = screen.getByText('Validate the market').closest('.group') as HTMLElement;
    const toggleBtn = within(stepEl).getAllByRole('button')[0];
    await userEvent.click(toggleBtn);
    expect(handleToggleStep).toHaveBeenCalledWith('step-1');
  });

  it('hides admin refresh button when not admin', () => {
    const idea = { ...baseIdea, fullActionPlan: mockPlan };
    render(<RoadmapSection {...defaultProps} idea={idea} isAdmin={false} />);
    expect(screen.queryByTitle('Force refresh analysis')).not.toBeInTheDocument();
  });

  it('shows admin refresh button when isAdmin', () => {
    const idea = { ...baseIdea, fullActionPlan: mockPlan };
    render(<RoadmapSection {...defaultProps} idea={idea} isAdmin={true} onRefresh={vi.fn()} />);
    expect(screen.getByTitle('Force refresh analysis')).toBeInTheDocument();
  });
});
