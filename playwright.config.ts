import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // sequential for visual stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  // Snapshot storage location — committed to repo for CI comparison
  snapshotDir: './tests/e2e/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',

  expect: {
    // Allow up to 5s for assertions to pass (helpful for async rendering)
    timeout: 5000,
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixelRatio: 0.05,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
      // Non-visual tests run on all spec files
      testMatch: /^(?!.*visual).*\.spec\.ts$/,
    },
    {
      name: 'chromium-visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Consistent fonts reduce visual diff noise
        launchOptions: {
          args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
        },
      },
      // Visual tests only in this project
      testMatch: /visual\.spec\.ts$/,
    },
  ],

  // Dev server — start if not already running
  webServer: process.env.CI
    ? {
        command: 'npm run preview',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
        timeout: 30000,
      }
    : undefined,
});
