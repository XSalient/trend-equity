/**
 * Global test setup for Vitest unit tests.
 * Runs before every test file.
 */
import { vi } from 'vitest';

// Suppress console noise in tests (errors/warnings still surface via test failures)
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Provide a minimal process.env for all tests
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-2.0-flash';
process.env.FIREBASE_PROJECT_ID = 'trend-equity-test';
