import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDynamicPrompt,
  runSelfImprovement,
  DEFAULT_QUALITY_BLOCK,
} from '../../../api/_lib/prompt-optimizer';
import AI from '../../../api/_lib/ai-provider';

const mockGenerateWithAI = vi.fn();

vi.mock('../../../api/_lib/ai-provider', () => {
  return {
    default: {
      generateWithAI: (...args: any[]) => mockGenerateWithAI(...args),
      Type: {
        OBJECT: 'object',
        ARRAY: 'array',
        STRING: 'string',
        NUMBER: 'number',
        INTEGER: 'integer',
        BOOLEAN: 'boolean',
      },
      DEFAULT_SYSTEM_PROMPT: 'Mocked system prompt default instructions',
    },
  };
});

describe('prompt-optimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDynamicPrompt', () => {
    it('returns fallbacks when document does not exist in Firestore', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue(mockDoc),
        }),
      };

      const promptData = await getDynamicPrompt(mockDb);

      expect(promptData.systemPrompt).toBe('Mocked system prompt default instructions');
      expect(promptData.qualityBlock).toBe(DEFAULT_QUALITY_BLOCK);
      expect(promptData.version).toBe(0);
    });

    it('returns custom prompt from Firestore when it exists', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            systemPrompt: 'Custom System Prompt',
            qualityBlock: 'Custom Quality Instructions',
            version: 3,
          }),
        }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue(mockDoc),
        }),
      };

      const promptData = await getDynamicPrompt(mockDb);

      expect(promptData.systemPrompt).toBe('Custom System Prompt');
      expect(promptData.qualityBlock).toBe('Custom Quality Instructions');
      expect(promptData.version).toBe(3);
    });
  });

  describe('runSelfImprovement', () => {
    it('skips optimization if already ran today', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockConfigDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            lastOptimized: today,
          }),
        }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue(mockConfigDoc),
        }),
      };

      await runSelfImprovement(mockDb);

      expect(mockConfigDoc.get).toHaveBeenCalled();
      // Should not call collection('daily_generations')
      expect(mockDb.collection).not.toHaveBeenCalledWith('daily_generations');
    });

    it('runs self-critique and optimizes prompt when daily run is needed', async () => {
      const mockConfigDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockResolvedValue(undefined),
      };

      const mockDailySnap = {
        docs: [
          {
            id: '2026-05-19',
            data: () => ({
              ideas: [
                { id: '1', headline: 'AI Copilot for Lawyers', pitch: 'A generic legal chatbot.' },
              ],
            }),
          },
        ],
      };

      const mockReactionsSnap = {
        docs: [
          {
            id: 'react-1',
            data: () => ({
              ideaId: '1',
              type: 'down',
            }),
          },
        ],
      };

      const mockCommentsSnap = {
        docs: [
          {
            id: 'comment-1',
            data: () => ({
              ideaId: '1',
              text: 'Too generic, every startup does this.',
            }),
          },
        ],
      };

      const mockCollection = vi.fn().mockImplementation((name: string) => {
        if (name === 'config') {
          return { doc: vi.fn().mockReturnValue(mockConfigDoc) };
        }
        if (name === 'daily_generations') {
          return {
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockDailySnap),
          };
        }
        if (name === 'idea_reactions') {
          return {
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockReactionsSnap),
          };
        }
        if (name === 'comments') {
          return {
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockCommentsSnap),
          };
        }
        return {};
      });

      const mockDb = { collection: mockCollection };

      // Mock AI calls
      const MOCK_SYSTEM_PROMPT =
        'You are a senior VC analyst generating high-conviction startup ideas from real market signals. Focus on defensible moats and second-order opportunities.';
      const MOCK_QUALITY_BLOCK =
        'REQUIREMENTS FOR EVERY IDEA: Cite at least one specific signal. Find second-order opportunities. Enforce sector diversity. Avoid generic AI wrappers.';

      mockGenerateWithAI
        .mockResolvedValueOnce('Critique: The legal AI idea is too cliché.') // VC Critique
        .mockResolvedValueOnce({
          systemPrompt: MOCK_SYSTEM_PROMPT,
          qualityBlock: MOCK_QUALITY_BLOCK,
        }); // Refinement

      await runSelfImprovement(mockDb, true); // force=true to bypass today check

      expect(mockGenerateWithAI).toHaveBeenCalledTimes(2);
      expect(mockConfigDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: MOCK_SYSTEM_PROMPT,
          qualityBlock: MOCK_QUALITY_BLOCK,
          version: 1,
        })
      );
    });
  });
});
