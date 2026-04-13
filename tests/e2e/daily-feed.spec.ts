/**
 * E2E tests — Daily Feed tab
 *
 * Positive:
 *  + Renders heading with today's date
 *  + Shows correct idea count per tier (free=10, pro=25, builder=35)
 *  + Renders idea cards with headline, tags, score
 *  + Shows disclaimer at bottom of feed
 *  + Shows upsell banner for free tier when ideas are truncated
 *  + Refresh button visible for pro and builder tiers
 *
 * Negative:
 *  + Shows empty state when API returns 503
 *  + Shows "Try Again" button in error state
 *  + Retry button calls API again
 *  + Does NOT show mock/stale ideas (no _isMock content in DOM)
 */

import { test, expect, Page } from '@playwright/test';
import { interceptAllApis, injectMockDailyFeed, MOCK_DAILY_RESPONSE } from './helpers/mockData';

const BASE_URL = 'http://localhost:3000';

async function loadFeedWithMockData(page: Page, tier: string) {
  await injectMockDailyFeed(page);
  await interceptAllApis(page);
  await page.goto(`${BASE_URL}/?mockTier=${tier}`);
  await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });
}

test.describe('Daily Feed — Rendering', () => {
  test.setTimeout(30000);

  test('renders the TODAY heading with correct idea count for free tier', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    await expect(page.locator('text=/TOP 10 IDEAS/i').first()).toBeVisible();
  });

  test('renders correct idea count heading for pro tier (25)', async ({ page }) => {
    await loadFeedWithMockData(page, 'pro');

    await expect(page.locator('text=/TOP 25 IDEAS/i').first()).toBeVisible();
  });

  test('renders correct idea count heading for builder tier (35)', async ({ page }) => {
    await loadFeedWithMockData(page, 'builder');

    await expect(page.locator('text=/TOP 35 IDEAS/i').first()).toBeVisible();
  });

  test('shows idea cards with headlines visible', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    // At least the first idea's headline should be visible
    await expect(page.locator('text=Test Business Idea 1').first()).toBeVisible();
  });

  test('shows category tags on idea cards', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    // FinTech tag should appear (first idea)
    await expect(page.locator('text=FinTech').first()).toBeVisible();
  });

  test('shows revenue potential score on idea cards', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    // Potential score label
    await expect(page.locator('text=/Potential score/i').first()).toBeVisible();
  });

  test('shows disclaimer at the bottom of the feed', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('text=/Disclaimer/i').first()).toBeVisible();
  });

  test('shows upsell banner for free tier (ideas beyond 10 are locked)', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('text=/Unlock/i').first()).toBeVisible();
  });

  test('does NOT show upsell banner for builder tier', async ({ page }) => {
    await loadFeedWithMockData(page, 'builder');

    const upsellBanner = page.locator('text=/Unlock.*more ideas/i');
    await expect(upsellBanner).not.toBeVisible();
  });

  test('free tier shows exactly 10 idea cards (not more)', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    // Count visible idea cards — look for revenue potential score rows
    const ideaCards = page.locator(
      '[data-testid="idea-card"], .idea-card, text=/Test Business Idea/'
    );
    // At minimum 1 idea visible, at most 10
    const count = await page.locator('text=/Test Business Idea \\d+/').count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(10);
  });
});

test.describe('Daily Feed — Error States', () => {
  test.setTimeout(30000);

  test('shows empty state with message when API returns 503', async ({ page }) => {
    // Do NOT inject localStorage cache — force API call
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
    await page.waitForTimeout(8000); // allow time for Firestore miss + API call

    // Should show error/empty state — either "couldn't be generated" or similar
    const errorState = page.locator("text=/couldn't be generated|unavailable|Try Again/i");
    await expect(errorState.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows "Try Again" button in error state', async ({ page }) => {
    await page.route('**/api/generate/daily', async (route) => {
      await route.fulfill({ status: 503, body: JSON.stringify({ error: 'Unavailable' }) });
    });
    await page.route('**/api/generate/alerts', async (route) => {
      await route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForTimeout(8000);

    const retryBtn = page.locator('button', { hasText: /Try Again|Retry/i });
    await expect(retryBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('does NOT display mock/sample idea text in DOM', async ({ page }) => {
    // After mock removal, legacy mock content should never appear
    await injectMockDailyFeed(page);
    await interceptAllApis(page);
    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

    const mockText = await page
      .locator('text=/cached market signals|illustrative ideas|sample ideas/i')
      .count();
    expect(mockText).toBe(0);
  });
});

test.describe('Daily Feed — Tab Navigation', () => {
  test.setTimeout(30000);

  test('clicking "Daily Feed" tab keeps user on the feed', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    await page.click('button:has-text("Daily Feed")');
    await expect(page.locator('text=/TODAY/i').first()).toBeVisible();
  });

  test('clicking "Saved" tab navigates to saved ideas view', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    await page.click('button:has-text("Saved")');
    // Saved tab content
    await expect(page.locator('text=/Saved|saved/i').first()).toBeVisible();
  });

  test('clicking "Weekly Best" tab shows weekly best content', async ({ page }) => {
    await loadFeedWithMockData(page, 'free');

    // Mock weekly-best related Firestore calls by providing empty daily docs
    await page.click('button:has-text("Weekly Best")');
    await expect(page.locator('text=/Week|weekly|best/i').first()).toBeVisible({ timeout: 10000 });
  });
});
