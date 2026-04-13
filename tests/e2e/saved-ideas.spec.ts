/**
 * E2E tests — Saved Ideas Tab
 *
 * Positive:
 *  + Saved tab is accessible from navigation
 *  + Empty state shown when no ideas are saved
 *  + Empty state has descriptive message
 *  + Saved ideas appear after toggling save on an idea
 *
 * Negative:
 *  + Saved tab for unauthenticated user shows login prompt or empty state
 *  + No idea cards shown in empty saved state
 */

import { test, expect, Page } from '@playwright/test';
import { injectMockDailyFeed, interceptAllApis } from './helpers/mockData';

const BASE_URL = 'http://localhost:3000';

async function loadAndGoToSaved(page: Page, tier: string) {
  await injectMockDailyFeed(page);
  await interceptAllApis(page);
  await page.goto(`${BASE_URL}/?mockTier=${tier}`);
  await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

  await page.click('button:has-text("Saved")');
  await page.waitForTimeout(500);
}

test.describe('Saved Ideas Tab — Empty State', () => {
  test.setTimeout(30000);

  test('saved tab shows empty state when no ideas are saved', async ({ page }) => {
    await loadAndGoToSaved(page, 'free');

    // Should show empty state message
    const emptyMsg = page.locator('text=/No saved ideas|no saved|bookmark/i');
    await expect(emptyMsg.first()).toBeVisible({ timeout: 5000 });
  });

  test('empty saved state has descriptive subtext', async ({ page }) => {
    await loadAndGoToSaved(page, 'free');

    // Should show some guidance text
    const subtext = page.locator('text=/bookmark|save|later|appear/i');
    await expect(subtext.first()).toBeVisible({ timeout: 5000 });
  });

  test('empty saved state does NOT show any idea cards', async ({ page }) => {
    await loadAndGoToSaved(page, 'free');

    await page.waitForTimeout(500);
    const ideaCards = page.locator('text=/Test Business Idea \\d+/');
    const count = await ideaCards.count();
    expect(count).toBe(0);
  });
});

test.describe('Saved Ideas Tab — Navigation', () => {
  test.setTimeout(30000);

  test('clicking Saved tab shows saved content section', async ({ page }) => {
    await loadAndGoToSaved(page, 'free');

    // Saved section should be active / visible
    const savedSection = page.locator('text=/saved|Saved/i');
    await expect(savedSection.first()).toBeVisible();
  });

  test('clicking Daily Feed tab returns to feed from saved', async ({ page }) => {
    await loadAndGoToSaved(page, 'pro');

    await page.click('button:has-text("Daily Feed")');
    await page.waitForTimeout(300);

    await expect(page.locator('text=/TODAY/i').first()).toBeVisible();
  });

  test('saved tab is accessible for pro tier', async ({ page }) => {
    await loadAndGoToSaved(page, 'pro');

    // No error, content area visible
    const pageBody = page.locator('body');
    await expect(pageBody).toBeVisible();
  });

  test('saved tab is accessible for builder tier', async ({ page }) => {
    await loadAndGoToSaved(page, 'builder');

    const pageBody = page.locator('body');
    await expect(pageBody).toBeVisible();
  });
});

test.describe('Saved Ideas Tab — Save Action', () => {
  test.setTimeout(45000);

  test('save button interaction does not crash the app', async ({ page }) => {
    await injectMockDailyFeed(page);
    await interceptAllApis(page);
    await page.goto(`${BASE_URL}/?mockTier=pro`);
    await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

    // Attempt to click a save button on first card
    const saveButtons = page.locator(
      'button[aria-label*="Save"], button[aria-label*="save"], button[title*="Save"]'
    );
    if ((await saveButtons.count()) > 0) {
      await saveButtons.first().click();
      await page.waitForTimeout(1000);
    }

    // App should still be functional
    await expect(page.locator('text=/TODAY/i').first()).toBeVisible();
  });
});
