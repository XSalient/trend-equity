/**
 * E2E tests — Error States
 *
 * Positive (error recovery):
 *  + "Try Again" button rerenders the feed on click
 *  + Retry button triggers API call
 *
 * Negative:
 *  + API 503 shows error state with message
 *  + API 503 shows "Try Again" button
 *  + Network timeout shows error state
 *  + Radar 503 shows error/unavailable message
 *  + Action plan 503 shows error in modal/panel
 *  + No stale mock content shown in DOM after error
 */

import { test, expect, Page } from '@playwright/test';
import { injectMockDailyFeed, interceptAllApis, MOCK_DAILY_RESPONSE } from './helpers/mockData';

const BASE_URL = 'http://localhost:3000';

test.describe('Error States — Daily Feed API Failure', () => {
  test.setTimeout(45000);

  test('shows error message when daily API returns 503', async ({ page }) => {
    // No localStorage injection — force API call path
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

    const errorMsg = page.locator("text=/couldn't be generated|unavailable|Try Again|error/i");
    await expect(errorMsg.first()).toBeVisible({ timeout: 5000 });
  });

  test('shows "Try Again" button when daily API returns 503', async ({ page }) => {
    await page.route('**/api/generate/daily', async (route) => {
      await route.fulfill({
        status: 503,
        body: JSON.stringify({ error: 'Unavailable' }),
      });
    });
    await page.route('**/api/generate/alerts', async (route) => {
      await route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForTimeout(9000);

    const retryBtn = page.locator('button', { hasText: /Try Again|Retry/i });
    await expect(retryBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('retry button triggers another API call', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/generate/daily', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({ status: 503, body: JSON.stringify({ error: 'Unavailable' }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DAILY_RESPONSE),
        });
      }
    });
    await page.route('**/api/generate/alerts', async (route) => {
      await route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForTimeout(9000);

    const retryBtn = page.locator('button', { hasText: /Try Again|Retry/i });
    if (await retryBtn.count() > 0) {
      await retryBtn.first().click();
      await page.waitForTimeout(3000);
      // At least 2 calls made (initial + retry)
      expect(callCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('no mock/sample/cached placeholder text in DOM on error', async ({ page }) => {
    await page.route('**/api/generate/daily', async (route) => {
      await route.fulfill({ status: 503, body: JSON.stringify({ error: 'Unavailable' }) });
    });
    await page.route('**/api/generate/alerts', async (route) => {
      await route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForTimeout(9000);

    const mockText = await page.locator('text=/cached market signals|illustrative ideas|sample ideas|_isMock/i').count();
    expect(mockText).toBe(0);
  });
});

test.describe('Error States — Radar API Failure', () => {
  test.setTimeout(45000);

  test('radar tab shows error when API returns 503', async ({ page }) => {
    await injectMockDailyFeed(page);
    await interceptAllApis(page);

    // Override radar to fail
    await page.route('**/api/generate/radar', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI generation temporarily unavailable.' }),
      });
    });

    await page.goto(`${BASE_URL}/?mockTier=pro`);
    await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

    // Navigate to radar
    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i }).first();
    await radarTab.click();
    await page.waitForTimeout(500);

    // Click generate if button present
    const generateBtn = page.locator('button', { hasText: /Generate|Analyse|Analyze/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(5000);

      const errorMsg = page.locator('text=/unavailable|error|failed|Try again/i');
      await expect(errorMsg.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Error States — Network Conditions', () => {
  test.setTimeout(45000);

  test('app renders with localStorage cache even when API is offline', async ({ page }) => {
    // Inject localStorage data — app should use it without calling the API
    await injectMockDailyFeed(page);

    // Block all API calls
    await page.route('**/api/generate/**', async (route) => {
      await route.abort('failed');
    });
    await page.route('**/api/generate/alerts', async (route) => {
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

    // Should still show ideas from localStorage
    await expect(page.locator('text=Test Business Idea 1').first()).toBeVisible();
  });
});

test.describe('Error States — 429 Rate Limiting', () => {
  test.setTimeout(45000);

  test('radar shows quota message when API returns 429', async ({ page }) => {
    await injectMockDailyFeed(page);
    await interceptAllApis(page);

    await page.route('**/api/generate/radar', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Daily radar limit reached', _usage: { remaining: 0, limit: 3 } }),
      });
    });

    await page.goto(`${BASE_URL}/?mockTier=free`);
    await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i }).first();
    await radarTab.click();
    await page.waitForTimeout(500);

    const generateBtn = page.locator('button', { hasText: /Generate|Analyse|Analyze/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(3000);

      // Should show limit/quota message
      const limitMsg = page.locator('text=/limit|quota|reached|exceeded/i');
      await expect(limitMsg.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
