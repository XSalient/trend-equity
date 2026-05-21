import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { IdeaCardToolkit } from '../../../src/components/idea/IdeaCardToolkit';
import type { Idea } from '../../../src/types';

// Mock child toolkit sections so IdeaCardToolkit is tested in isolation
vi.mock('../../../src/components/idea/toolkit/ValidationSection', () => ({
  ValidationSection: () => <div data-testid="validation-section">Validation Content</div>,
}));
vi.mock('../../../src/components/idea/toolkit/RoadmapSection', () => ({
  RoadmapSection: () => <div data-testid="roadmap-section">Roadmap Content</div>,
}));
vi.mock('../../../src/components/idea/toolkit/BuildSection', () => ({
  BuildSection: () => <div data-testid="build-section">Build Content</div>,
}));
vi.mock('../../../src/components/idea/toolkit/ProgressSection', () => ({
  ProgressSection: () => <div data-testid="progress-section">Progress Content</div>,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const baseIdea: Idea = {
  id: 'idea-1',
  headline: 'AI Scheduling SaaS',
  pitch: 'Automates appointment booking',
  vcJustification: 'Large TAM',
  categoryTags: ['SaaS'],
  costEffort: 'Low',
  revenuePotentialScore: 85,
  revenueSkeleton: 'Subscription',
  unfairAdvantage: 'AI-first',
  potentialExit: 'Acquisition',
  trendSources: [],
  saturationLabel: 'Low',
  heatBadge: 'Hot',
  nextSteps: [],
};

const makeProps = (overrides = {}) => ({
  idea: baseIdea,
  activeToolkit: null as 'roadmap' | 'build' | 'validation' | 'progress' | null,
  setActiveToolkit: vi.fn(),
  isBuilder: true,
  isFree: false,
  isGeneratingValidation: false,
  isGeneratingPlan: false,
  isGeneratingBuild: false,
  handleGenerateValidation: vi.fn().mockResolvedValue(true),
  handleGenerateBuild: vi.fn().mockResolvedValue(true),
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
  ...overrides,
});

describe('IdeaCardToolkit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Validation Toolkit button for non-free users', () => {
    render(<IdeaCardToolkit {...makeProps({ isFree: false })} />);
    expect(screen.getByText('Validation Toolkit')).toBeInTheDocument();
  });

  it('hides Validation Toolkit button for free users', () => {
    render(<IdeaCardToolkit {...makeProps({ isFree: true })} />);
    expect(screen.queryByText('Validation Toolkit')).not.toBeInTheDocument();
  });

  it('shows Progress Tracker button for builder tier', () => {
    render(<IdeaCardToolkit {...makeProps({ isBuilder: true, isFree: false })} />);
    expect(screen.getByText('Progress Tracker')).toBeInTheDocument();
  });

  it('hides Progress Tracker for non-builder', () => {
    render(<IdeaCardToolkit {...makeProps({ isBuilder: false, isFree: false })} />);
    expect(screen.queryByText('Progress Tracker')).not.toBeInTheDocument();
  });

  it('shows upgrade CTA for non-builder users', () => {
    render(<IdeaCardToolkit {...makeProps({ isBuilder: false, isFree: false })} />);
    expect(screen.getByText('Upgrade for more features')).toBeInTheDocument();
  });

  it('hides upgrade CTA for builder users', () => {
    render(<IdeaCardToolkit {...makeProps({ isBuilder: true })} />);
    expect(screen.queryByText('Upgrade for more features')).not.toBeInTheDocument();
  });

  it('renders RoadmapSection for builder users', () => {
    render(<IdeaCardToolkit {...makeProps({ isBuilder: true })} />);
    expect(screen.getByTestId('roadmap-section')).toBeInTheDocument();
  });

  it('does not render RoadmapSection for non-builder', () => {
    render(<IdeaCardToolkit {...makeProps({ isBuilder: false, isFree: false })} />);
    expect(screen.queryByTestId('roadmap-section')).not.toBeInTheDocument();
  });

  it('calls handleGenerateValidation when Validation Toolkit clicked with no existing toolkit', async () => {
    const handleGenerateValidation = vi.fn().mockResolvedValue(true);
    render(<IdeaCardToolkit {...makeProps({ isFree: false, handleGenerateValidation })} />);
    await userEvent.click(screen.getByText('Validation Toolkit'));
    expect(handleGenerateValidation).toHaveBeenCalledOnce();
  });

  it('toggles validation section without re-generating when toolkit already exists', async () => {
    const handleGenerateValidation = vi.fn();
    const setActiveToolkit = vi.fn();
    const ideaWithToolkit = {
      ...baseIdea,
      validationToolkit: {
        landingPage: { hero: 'H', subHero: 'S', valueProps: [] },
        interviewScript: [],
        smokeTest: 'test',
        successMetrics: [],
        generatedAt: '2025-01-01',
      },
    };
    render(
      <IdeaCardToolkit
        {...makeProps({ idea: ideaWithToolkit, isFree: false, handleGenerateValidation, setActiveToolkit })}
      />
    );
    await userEvent.click(screen.getByText('Validation Toolkit'));
    expect(handleGenerateValidation).not.toHaveBeenCalled();
    expect(setActiveToolkit).toHaveBeenCalledWith('validation');
  });

  it('shows ValidationSection when activeToolkit is validation', () => {
    render(<IdeaCardToolkit {...makeProps({ activeToolkit: 'validation', isFree: false })} />);
    expect(screen.getByTestId('validation-section')).toBeInTheDocument();
  });

  it('shows BuildSection when activeToolkit is build', () => {
    render(<IdeaCardToolkit {...makeProps({ activeToolkit: 'build' })} />);
    expect(screen.getByTestId('build-section')).toBeInTheDocument();
  });

  it('shows ProgressSection when activeToolkit is progress', () => {
    render(<IdeaCardToolkit {...makeProps({ activeToolkit: 'progress' })} />);
    expect(screen.getByTestId('progress-section')).toBeInTheDocument();
  });

  it('disables Validation Toolkit button while generating', () => {
    render(<IdeaCardToolkit {...makeProps({ isFree: false, isGeneratingValidation: true })} />);
    const btn = screen.getByText('Validation Toolkit').closest('button');
    expect(btn).toBeDisabled();
  });
});
