/**
 * Unit tests for api/_lib/ai-provider.ts
 *
 * Covers:
 *  + GoogleProvider passes camelCase config (systemInstruction, responseMimeType,
 *    responseSchema) to the @google/genai SDK — the v1 SDK silently ignores
 *    snake_case / top-level fields
 *  + generateWithAI threads opts.model through to the SDK call
 *  + generateWithAI falls back to GEMINI_MODEL env / default model
 *  + generateWithAI parses JSON when schema provided, returns raw text otherwise
 *  + throws on empty SDK response
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import { generateWithAI, DEFAULT_SYSTEM_PROMPT } from '../../../api/_lib/ai-provider';

const SCHEMA = { type: 'object', properties: { foo: { type: 'string' } } };

describe('generateWithAI → GoogleProvider params shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    mockGenerateContent.mockResolvedValue({ text: '{"foo":"bar"}' });
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  it('passes camelCase systemInstruction/responseMimeType/responseSchema inside config', async () => {
    await generateWithAI('test prompt', SCHEMA, 'You are a test.');

    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const params = mockGenerateContent.mock.calls[0][0];

    expect(params.config.systemInstruction).toBe('You are a test.');
    expect(params.config.responseMimeType).toBe('application/json');
    expect(params.config.responseSchema).toEqual(SCHEMA);
    // Regression: the old snake_case / top-level fields must be gone
    expect(params.system_instruction).toBeUndefined();
    expect(params.config.response_mime_type).toBeUndefined();
    expect(params.config.response_schema).toBeUndefined();
  });

  it('uses text/plain mime type and default system prompt when no schema given', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'plain answer' });

    const result = await generateWithAI('just text');

    const params = mockGenerateContent.mock.calls[0][0];
    expect(params.config.responseMimeType).toBe('text/plain');
    expect(params.config.systemInstruction).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(result).toBe('plain answer');
  });

  it('threads opts.model through to the SDK call', async () => {
    await generateWithAI('prompt', SCHEMA, undefined, { model: 'gemini-2.5-pro' });

    const params = mockGenerateContent.mock.calls[0][0];
    expect(params.model).toBe('gemini-2.5-pro');
  });

  it('falls back to GEMINI_MODEL env when opts.model absent', async () => {
    process.env.GEMINI_MODEL = 'gemini-env-model';

    await generateWithAI('prompt', SCHEMA);

    const params = mockGenerateContent.mock.calls[0][0];
    expect(params.model).toBe('gemini-env-model');
  });

  it('defaults to gemini-1.5-flash when no model configured', async () => {
    await generateWithAI('prompt', SCHEMA);

    const params = mockGenerateContent.mock.calls[0][0];
    expect(params.model).toBe('gemini-1.5-flash');
  });

  it('parses JSON responses (including fenced markdown) when schema provided', async () => {
    mockGenerateContent.mockResolvedValue({ text: '```json\n{"foo":"fenced"}\n```' });

    const result = await generateWithAI('prompt', SCHEMA);
    expect(result).toEqual({ foo: 'fenced' });
  });

  it('throws when the SDK returns an empty response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    await expect(generateWithAI('prompt', SCHEMA)).rejects.toThrow('empty response');
  });
});
