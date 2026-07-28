import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts', 'tests/setup-dom.ts'],
    environmentMatchGlobs: [['tests/unit/components/**', 'jsdom']],
    // Parallel execution is on by default in Vitest 2.x. The `forks` pool
    // (tinypool + child_process) crashes with "Worker exited unexpectedly" on
    // Node 25, which hangs the whole run — so the npm scripts pass
    // `--pool=threads`. The old `--workers=4` flag does not exist in Vitest 2
    // and made `npm run test:unit` fail immediately.
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
