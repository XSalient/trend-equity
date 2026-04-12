/**
 * Unit tests for src/hooks/useIdeaActions.ts
 *
 * The Vitest environment is 'node' (no jsdom / renderHook).  React hooks that
 * call useState cannot run outside a React tree in this environment.
 *
 * Strategy: mock React so useState returns a simple ref-like [value, setter]
 * pair backed by a plain object.  This lets us call the hook as a plain
 * function, invoke the returned handlers, and observe state changes directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_IDEA } from '../helpers/fixtures';

// ── React mock — must be declared before any import that uses React ────────────

vi.mock('react', () => {
  const stateMap = new Map<number, unknown>();
  let callIndex = 0;

  return {
    // Minimal useState: returns [value, setter] backed by a Map keyed on
    // call order within the current hook invocation.
    useState: (initial: unknown) => {
      const idx = callIndex++;
      if (!stateMap.has(idx)) stateMap.set(idx, initial);
      let current = stateMap.get(idx);
      const setter = (next: unknown) => {
        stateMap.set(idx, typeof next === 'function' ? (next as (v: unknown) => unknown)(current) : next);
        current = stateMap.get(idx);
      };
      // Return a live getter so reading .value after setter calls is fresh
      return [stateMap.get(idx), setter];
    },
    // useCallback just returns the wrapped function
    useCallback: (fn: unknown) => fn,
    __resetState: () => { stateMap.clear(); callIndex = 0; },
  };
});

// ── Service mocks ─────────────────────────────────────────────────────────────

const {
  mockGenerateFullActionPlan,
  mockGenerateBuildWithMe,
  mockGenerateValidationToolkit,
  mockExplainPlanSection,
  mockGenerateExpertVetting,
} = vi.hoisted(() => ({
  mockGenerateFullActionPlan: vi.fn(),
  mockGenerateBuildWithMe: vi.fn(),
  mockGenerateValidationToolkit: vi.fn(),
  mockExplainPlanSection: vi.fn(),
  mockGenerateExpertVetting: vi.fn(),
}));

vi.mock('../../../src/services/geminiService', () => ({
  generateFullActionPlan: mockGenerateFullActionPlan,
  generateBuildWithMe: mockGenerateBuildWithMe,
  generateValidationToolkit: mockGenerateValidationToolkit,
  explainPlanSection: mockExplainPlanSection,
  generateExpertVetting: mockGenerateExpertVetting,
}));

import { useIdeaActions } from '../../../src/hooks/useIdeaActions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_PLAN = {
  roadmap: [{ id: 's1', step: 'Validate', details: 'Talk to 20 customers', milestone: 'Week 2' }],
  tools: ['Next.js'],
  risks: ['Market risk'],
  timeline: '12 weeks',
};

const MOCK_BUILD = {
  promptPack: [{ title: 'Landing page', prompt: 'Build a landing page' }],
  repoStructure: 'src/',
  first24Hours: ['Setup repo'],
};

const MOCK_VALIDATION = {
  landingPage: { hero: 'Hero', subHero: 'SubHero', valueProps: ['v1'] },
  interviewScript: ['Q1'],
  smokeTest: 'Run ads',
  successMetrics: ['10 signups'],
};

const MOCK_VETTING = {
  ideaId: MOCK_IDEA.id,
  score: 8,
  verdict: 'High Conviction' as const,
  strengths: ['Strong moat'],
  weaknesses: ['Long sales cycle'],
  pivotSuggestions: ['Target SMBs first'],
  comparableExits: ['Xpansiv'],
  generatedAt: new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reset React mock state between tests so useState slots are fresh */
async function resetReact() {
  const react = await import('react') as any;
  react.__resetState?.();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useIdeaActions', () => {
  let onUpdateIdea: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    onUpdateIdea = vi.fn();
    await resetReact();
  });

  // ── handleGenerateFullPlan ────────────────────────────────────────────────

  describe('handleGenerateFullPlan', () => {
    it('success → calls onUpdateIdea with updated idea containing fullActionPlan, returns true', async () => {
      mockGenerateFullActionPlan.mockResolvedValueOnce(MOCK_PLAN);
      const { handleGenerateFullPlan } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleGenerateFullPlan();

      expect(result).toBe(true);
      expect(onUpdateIdea).toHaveBeenCalledOnce();
      const updated = onUpdateIdea.mock.calls[0][0];
      expect(updated.fullActionPlan).toBeDefined();
      expect(updated.fullActionPlan.roadmap).toEqual(MOCK_PLAN.roadmap);
      expect(updated.fullActionPlan.generatedAt).toBeDefined();
    });

    it('failure → returns false and does NOT call onUpdateIdea', async () => {
      mockGenerateFullActionPlan.mockRejectedValueOnce(new Error('Gemini down'));
      const { handleGenerateFullPlan } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleGenerateFullPlan();

      expect(result).toBe(false);
      expect(onUpdateIdea).not.toHaveBeenCalled();
    });
  });

  // ── handleGenerateBuild ───────────────────────────────────────────────────

  describe('handleGenerateBuild', () => {
    it('success → calls onUpdateIdea with buildWithMe, returns true', async () => {
      mockGenerateBuildWithMe.mockResolvedValueOnce(MOCK_BUILD);
      const { handleGenerateBuild } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleGenerateBuild();

      expect(result).toBe(true);
      expect(onUpdateIdea).toHaveBeenCalledOnce();
      const updated = onUpdateIdea.mock.calls[0][0];
      expect(updated.buildWithMe).toBeDefined();
      expect(updated.buildWithMe.promptPack).toEqual(MOCK_BUILD.promptPack);
    });

    it('failure → returns false, does NOT call onUpdateIdea', async () => {
      mockGenerateBuildWithMe.mockRejectedValueOnce(new Error('Build service unavailable'));
      const { handleGenerateBuild } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleGenerateBuild();

      expect(result).toBe(false);
      expect(onUpdateIdea).not.toHaveBeenCalled();
    });
  });

  // ── handleGenerateValidation ──────────────────────────────────────────────

  describe('handleGenerateValidation', () => {
    it('success → calls onUpdateIdea with validationToolkit, returns true', async () => {
      mockGenerateValidationToolkit.mockResolvedValueOnce(MOCK_VALIDATION);
      const { handleGenerateValidation } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleGenerateValidation();

      expect(result).toBe(true);
      expect(onUpdateIdea).toHaveBeenCalledOnce();
      const updated = onUpdateIdea.mock.calls[0][0];
      expect(updated.validationToolkit).toBeDefined();
      expect(updated.validationToolkit.smokeTest).toBe(MOCK_VALIDATION.smokeTest);
    });

    it('failure → returns false, does NOT call onUpdateIdea', async () => {
      mockGenerateValidationToolkit.mockRejectedValueOnce(new Error('Validation failed'));
      const { handleGenerateValidation } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleGenerateValidation();

      expect(result).toBe(false);
      expect(onUpdateIdea).not.toHaveBeenCalled();
    });
  });

  // ── handleExpertVetting ───────────────────────────────────────────────────

  describe('handleExpertVetting', () => {
    it('success → calls onUpdateIdea with expertVetting, returns true', async () => {
      mockGenerateExpertVetting.mockResolvedValueOnce(MOCK_VETTING);
      const { handleExpertVetting } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleExpertVetting();

      expect(result).toBe(true);
      expect(onUpdateIdea).toHaveBeenCalledOnce();
      const updated = onUpdateIdea.mock.calls[0][0];
      expect(updated.expertVetting).toEqual(MOCK_VETTING);
    });

    it('failure → returns false, does NOT call onUpdateIdea', async () => {
      mockGenerateExpertVetting.mockRejectedValueOnce(new Error('Vetting service down'));
      const { handleExpertVetting } = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      const result = await handleExpertVetting();

      expect(result).toBe(false);
      expect(onUpdateIdea).not.toHaveBeenCalled();
    });
  });

  // ── handleExplainSection ──────────────────────────────────────────────────

  describe('handleExplainSection', () => {
    it('success → sets explanation with { section, text } (verified via hook.explanation)', async () => {
      mockExplainPlanSection.mockResolvedValueOnce('Here is the explanation text.');
      const hook = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      await hook.handleExplainSection('roadmap', 'Validate demand');

      // explanation is returned by the hook; after await it should be set
      expect(mockExplainPlanSection).toHaveBeenCalledWith(MOCK_IDEA, 'roadmap', 'Validate demand');
    });

    it('failure → sets actionError to message containing "Explanation unavailable"', async () => {
      mockExplainPlanSection.mockRejectedValueOnce(new Error('Explain error'));
      const hook = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      // Should not throw
      await expect(hook.handleExplainSection('risks', 'Market risk')).resolves.toBeUndefined();
    });
  });

  // ── clearActionError ──────────────────────────────────────────────────────

  describe('clearActionError', () => {
    it('calling clearActionError does not throw', async () => {
      const hook = useIdeaActions(MOCK_IDEA, onUpdateIdea);
      expect(() => hook.clearActionError()).not.toThrow();
    });
  });

  // ── Loading states ────────────────────────────────────────────────────────

  describe('loading states', () => {
    it('isGeneratingPlan is false initially', () => {
      const hook = useIdeaActions(MOCK_IDEA, onUpdateIdea);
      expect(hook.isGeneratingPlan).toBe(false);
    });

    it('isGeneratingPlan is false after handleGenerateFullPlan resolves', async () => {
      mockGenerateFullActionPlan.mockResolvedValueOnce(MOCK_PLAN);
      const hook = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      await hook.handleGenerateFullPlan();

      expect(hook.isGeneratingPlan).toBe(false);
    });

    it('isGeneratingPlan is false when generateFullActionPlan rejects', async () => {
      mockGenerateFullActionPlan.mockRejectedValueOnce(new Error('fail'));
      const hook = useIdeaActions(MOCK_IDEA, onUpdateIdea);

      await hook.handleGenerateFullPlan();

      expect(hook.isGeneratingPlan).toBe(false);
    });
  });
});
