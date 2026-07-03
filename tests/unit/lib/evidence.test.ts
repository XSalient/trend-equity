/**
 * Unit tests for api/_lib/evidence.ts
 *
 * Covers:
 *  + Two-step orchestration: grounded research call (with googleSearch tool,
 *    no schema) followed by a schema-constrained structuring call
 *  + Real groundingChunks URIs become sources — model-written URLs are ignored
 *  + Uses GEMINI_EVIDENCE_MODEL env for the grounded call
 *  + Malformed structuring output falls back to safe defaults
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockProviderGenerate, mockGenerateWithAI } = vi.hoisted(() => ({
  mockProviderGenerate: vi.fn(),
  mockGenerateWithAI: vi.fn(),
}));

vi.mock('../../../api/_lib/ai-provider', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getAIProvider: () => ({ name: 'google', generate: mockProviderGenerate }),
    generateWithAI: mockGenerateWithAI,
  };
});

import { gatherEvidence } from '../../../api/_lib/evidence';

const IDEA = { headline: 'Compliance SaaS for EU battery passports', pitch: 'B2B tooling.' };

describe('gatherEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_EVIDENCE_MODEL;
    mockProviderGenerate.mockResolvedValue({
      text: 'Research findings: Competitor X exists. Market is $2B per Statista.',
      groundingChunks: [
        { title: 'Statista Report', uri: 'https://statista.com/report' },
        { title: 'Competitor X', uri: 'https://competitorx.com' },
      ],
    });
    mockGenerateWithAI.mockResolvedValue({
      competitors: [{ name: 'Competitor X', oneLiner: 'Enterprise-only battery compliance.' }],
      marketSizeCited: '$2B by 2030 (Statista)',
      whyNowEvidence: 'EU regulation effective Feb 2027 mandates digital passports.',
      sources: [{ title: 'Hallucinated', url: 'https://fake.example.com' }],
      evidenceScore: 8,
    });
  });

  afterEach(() => {
    delete process.env.GEMINI_EVIDENCE_MODEL;
  });

  it('runs grounded research first (tools, no schema), then structures the findings', async () => {
    const result = await gatherEvidence(IDEA);

    // Step 1: grounded call
    expect(mockProviderGenerate).toHaveBeenCalledOnce();
    const groundedOpts = mockProviderGenerate.mock.calls[0][0];
    expect(groundedOpts.tools).toEqual([{ googleSearch: {} }]);
    expect(groundedOpts.schema).toBeUndefined();
    expect(groundedOpts.prompt).toContain(IDEA.headline);

    // Step 2: structuring call receives the research text
    expect(mockGenerateWithAI).toHaveBeenCalledOnce();
    const structurePrompt: string = mockGenerateWithAI.mock.calls[0][0];
    expect(structurePrompt).toContain('Research findings: Competitor X exists');

    expect(result.competitors[0].name).toBe('Competitor X');
    expect(result.evidenceScore).toBe(8);
    expect(result.generatedAt).toBeTruthy();
  });

  it('uses only real grounding URIs as sources, discarding model-written URLs', async () => {
    const result = await gatherEvidence(IDEA);

    expect(result.sources).toEqual([
      { title: 'Statista Report', url: 'https://statista.com/report' },
      { title: 'Competitor X', url: 'https://competitorx.com' },
    ]);
    expect(result.sources.some((s) => s.url.includes('fake.example.com'))).toBe(false);
  });

  it('threads GEMINI_EVIDENCE_MODEL to the grounded call', async () => {
    process.env.GEMINI_EVIDENCE_MODEL = 'gemini-2.5-pro';

    await gatherEvidence(IDEA);

    expect(mockProviderGenerate.mock.calls[0][0].model).toBe('gemini-2.5-pro');
  });

  it('defaults the evidence model to gemini-2.5-flash', async () => {
    await gatherEvidence(IDEA);

    expect(mockProviderGenerate.mock.calls[0][0].model).toBe('gemini-2.5-flash');
  });

  it('handles missing groundingChunks (no sources) gracefully', async () => {
    mockProviderGenerate.mockResolvedValue({ text: 'Nothing found.' });

    const result = await gatherEvidence(IDEA);
    expect(result.sources).toEqual([]);
  });

  it('falls back to safe defaults when the structuring output is malformed', async () => {
    mockGenerateWithAI.mockResolvedValue({ garbage: true });

    const result = await gatherEvidence(IDEA);

    expect(result.competitors).toEqual([]);
    expect(result.marketSizeCited).toBe('No reliable figure found');
    expect(result.evidenceScore).toBe(5);
  });
});
