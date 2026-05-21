import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts', 'tests/setup-dom.ts'],
    environmentMatchGlobs: [['tests/unit/components/**', 'jsdom']],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['api/**/*.ts', 'src/components/**/*.tsx', 'src/hooks/**/*.ts'],
      exclude: ['api/generate/*.ts', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
