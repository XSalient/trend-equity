/**
 * Unit tests for api/_lib/gemini.ts
 *
 * Covers:
 *  + Successful JSON generation with schema
 *  + Successful plain-text generation (no schema)
 *  + Uses custom systemInstruction when provided
 *  + Falls back to DEFAULT_SYSTEM_PROMPT when no override
 *  - Throws when GEMINI_API_KEY is missing
 *  - Throws when Gemini returns unparseable JSON
 *  - Throws when Gemini API call itself throws
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock @google/genai before importing the module under test ---
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: mockGenerateContent },
  })),
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
  },
}));

import { generateWithGemini, DEFAULT_SYSTEM_PROMPT } from '../../../api/_lib/gemini';

describe('generateWithGemini', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key-123';
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  // ── Positive cases ────────────────────────────────────────────────

  it('parses and returns JSON when schema is provided', async () => {
    const payload = { ideas: [{ headline: 'Test Idea' }] };
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(payload) });

    const result = await generateWithGemini('test prompt', { type: 'OBJECT' });

    expect(result).toEqual(payload);
    expect(mockGenerateContent).toHaveBeenCalledOnce();
  });

  it('returns { text } object when no schema is provided', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Plain text response' });

    const result = await generateWithGemini('test prompt');

    expect(result).toEqual({ text: 'Plain text response' });
  });

  it('uses DEFAULT_SYSTEM_PROMPT when no systemInstruction supplied', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{}' });
    await generateWithGemini('prompt', { type: 'OBJECT' });

    const callConfig = mockGenerateContent.mock.calls[0][0].config;
    expect(callConfig.systemInstruction).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('uses custom systemInstruction when explicitly provided', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{}' });
    await generateWithGemini('prompt', undefined, 'Custom instruction');

    const callConfig = mockGenerateContent.mock.calls[0][0].config;
    expect(callConfig.systemInstruction).toBe('Custom instruction');
  });

  it('sets responseMimeType to application/json when schema provided', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"ok":true}' });
    await generateWithGemini('prompt', { type: 'OBJECT' });

    const callConfig = mockGenerateContent.mock.calls[0][0].config;
    expect(callConfig.responseMimeType).toBe('application/json');
  });

  it('sets responseMimeType to text/plain when no schema', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'hello' });
    await generateWithGemini('prompt');

    const callConfig = mockGenerateContent.mock.calls[0][0].config;
    expect(callConfig.responseMimeType).toBe('text/plain');
  });

  it('uses GEMINI_MODEL env var when set', async () => {
    process.env.GEMINI_MODEL = 'gemini-1.5-pro';
    mockGenerateContent.mockResolvedValue({ text: '{}' });
    await generateWithGemini('prompt', { type: 'OBJECT' });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-1.5-pro');
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
  });

  // ── Negative cases ────────────────────────────────────────────────

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(generateWithGemini('prompt')).rejects.toThrow('GEMINI_API_KEY missing');
  });

  it('throws when Gemini returns invalid JSON with schema', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not valid json }{' });

    await expect(generateWithGemini('prompt', { type: 'OBJECT' })).rejects.toThrow(
      'AI returned invalid JSON structure.'
    );
  });

  it('propagates error when Gemini API call throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API quota exceeded'));

    await expect(generateWithGemini('prompt')).rejects.toThrow('API quota exceeded');
  });

  it('DEFAULT_SYSTEM_PROMPT contains all three quality test keywords', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain('SIGNAL-GROUNDED');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('NON-OBVIOUS');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('STRUCTURAL EDGE');
  });
});
