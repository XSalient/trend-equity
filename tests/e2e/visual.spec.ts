/**
 * E2E Visual Regression Tests
 *
 * These tests capture screenshots of key views and compare against
 * stored baselines. Run `npx playwright test --update-snapshots` to
 * regenerate baselines after intentional UI changes.
 *
 * Covered views:
 *  + Daily Feed — free tier (desktop)
 *  + Daily Feed — pro tier (desktop)
 *  + Daily Feed — builder tier (desktop)
 *  + Filter panel open state
 *  + Saved Ideas — empty state
 *  + Weekly Best — empty state
 *  + Error state — 503 daily API failure
 *  + Mobile viewport — daily feed (free)
 */

import { test, expect, Page } from '@playwright/test';
import { injectMockDailyFeed, interceptAllApis } from './helpers/mockData';

const BASE_URL = 'http://localhost:3000';

async function loadFeed(page: Page, tier: string) {
  await injectMockDailyFeed(page);
  await interceptAllApis(page);
  await page.goto(`${BASE_URL}/?mockTier=${tier}`);
  await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });
  // Small wait for animations/transitions
  await page.waitForTimeout(500);
}

test.describe('Visual — Daily Feed', () => {
  test.setTimeout(30000);

  test('daily feed free tier matches snapshot', async ({ page }) => {
    await loadFeed(page, 'free');
    await expect(page).toHaveScreenshot('daily-feed-free.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });

  test('daily feed pro tier matches snapshot', async ({ page }) => {
    await loadFeed(page, 'pro');
    await expect(page).toHaveScreenshot('daily-feed-pro.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });

  test('daily feed builder tier matches snapshot', async ({ page }) => {
    await loadFeed(page, 'builder');
    await expect(page).toHaveScreenshot('daily-feed-builder.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });
});

test.describe('Visual — Filter Panel', () => {
  test.setTimeout(30000);

  test('filter panel open state matches snapshot', async ({ page }) => {
    await loadFeed(page, 'pro');

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(400);

    await expect(page).toHaveScreenshot('filter-panel-open.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });

  test('filter panel with active filter matches snapshot', async ({ page }) => {
    await loadFeed(page, 'pro');

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(400);

    const finTechBtn = page.locator('button', { hasText: 'FinTech' }).first();
    if (await finTechBtn.isVisible()) {
      await finTechBtn.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('filter-panel-active.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });
});

test.describe('Visual — Saved Ideas', () => {
  test.setTimeout(30000);

  test('saved ideas empty state matches snapshot', async ({ page }) => {
    await loadFeed(page, 'free');

    await page.click('button:has-text("Saved")');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('saved-ideas-empty.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });
});

test.describe('Visual — Weekly Best', () => {
  test.setTimeout(30000);

  test('weekly best tab initial state matches snapshot', async ({ page }) => {
    await loadFeed(page, 'free');

    const weeklyTab = page.locator('button', { hasText: /Weekly Best/i }).first();
    if (await weeklyTab.isVisible()) {
      await weeklyTab.click();
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('weekly-best-initial.png', {
        fullPage: false,
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });
});

test.describe('Visual — Error State', () => {
  test.setTimeout(45000);

  test('daily feed error state matches snapshot', async ({ page }) => {
    await page.route('**/api/generate/daily', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI generation temporarily unavailable.' }),
      });
    });
    await page.route('**/api/generate/alerts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForTimeout(9000);

    await expect(page).toHaveScreenshot('daily-feed-error.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });
});

test.describe('Visual — Mobile Viewport', () => {
  test.setTimeout(30000);

  test('daily feed free tier on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
    await loadFeed(page, 'free');

    await expect(page).toHaveScreenshot('daily-feed-free-mobile.png', {
      fullPage: false,
      animations: 'disabled',
      threshold: 0.2,
    });
  });

  test('filter panel on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadFeed(page, 'pro');

    const filtersBtn = page.locator('button:has-text("Filters")');
    if (await filtersBtn.isVisible()) {
      await filtersBtn.click();
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot('filter-panel-mobile.png', {
        fullPage: false,
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });
});
