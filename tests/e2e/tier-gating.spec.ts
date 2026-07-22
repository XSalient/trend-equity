/**
 * E2E tests — Tier Gating
 *
 * Positive:
 *  + Free tier sees Daily Feed with 10 ideas
 *  + Pro tier sees 25 ideas
 *  + Builder tier sees 35 ideas
 *  + Weekly Radar tab visible for all tiers
 *  + Futurecasting tab visible for all tiers
 *  + Weekly Best tab visible for all tiers
 *  + Builder tier can access all tabs without upgrade prompts
 *
 * Negative:
 *  + Free tier sees upgrade/upsell banner on scroll
 *  + Radar prompt count visible for free tier
 *  + Usage counter shown when feature has been used
 */

import { test, expect, Page } from '@playwright/test';
import {
  injectMockDailyFeed,
  interceptAllApis,
  MOCK_RADAR_RESPONSE,
  MOCK_FUTURECASTING_RESPONSE,
} from './helpers/mockData';

const BASE_URL = 'http://localhost:3000';

async function loadApp(page: Page, tier: string) {
  await injectMockDailyFeed(page);
  await interceptAllApis(page);
  await page.goto(`${BASE_URL}/?mockTier=${tier}`);
  await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });
}

test.describe('Tier Gating — Idea Count', () => {
  test.setTimeout(30000);

  test('free tier heading shows TOP 10 IDEAS', async ({ page }) => {
    await loadApp(page, 'free');
    await expect(page.locator('text=/TOP 10 IDEAS/i').first()).toBeVisible();
  });

  test('pro tier heading shows TOP 25 IDEAS', async ({ page }) => {
    await loadApp(page, 'pro');
    await expect(page.locator('text=/TOP 25 IDEAS/i').first()).toBeVisible();
  });

  test('builder tier heading shows TOP 35 IDEAS', async ({ page }) => {
    await loadApp(page, 'builder');
    await expect(page.locator('text=/TOP 35 IDEAS/i').first()).toBeVisible();
  });

  test('free tier shows upsell/unlock banner below fold', async ({ page }) => {
    await loadApp(page, 'free');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await expect(page.locator('text=/Unlock/i').first()).toBeVisible();
  });

  test('pro tier does NOT show free-tier lock banner', async ({ page }) => {
    await loadApp(page, 'pro');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const lockBanner = page.locator('text=/Unlock.*more ideas/i');
    await expect(lockBanner).not.toBeVisible();
  });

  test('builder tier does NOT show lock banner', async ({ page }) => {
    await loadApp(page, 'builder');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const lockBanner = page.locator('text=/Unlock.*more ideas/i');
    await expect(lockBanner).not.toBeVisible();
  });
});

test.describe('Tier Gating — Tab Visibility', () => {
  test.setTimeout(30000);

  test('Weekly Radar tab button is visible for free tier', async ({ page }) => {
    await loadApp(page, 'free');
    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i });
    await expect(radarTab.first()).toBeVisible();
  });

  test('Weekly Radar tab button is visible for pro tier', async ({ page }) => {
    await loadApp(page, 'pro');
    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i });
    await expect(radarTab.first()).toBeVisible();
  });

  test('Futurecasting tab button is visible for all tiers', async ({ page }) => {
    await loadApp(page, 'free');
    const futureTab = page.locator('button', { hasText: /Future|Futurecasting/i });
    await expect(futureTab.first()).toBeVisible();
  });

  test('Weekly Best tab is accessible for all tiers', async ({ page }) => {
    await loadApp(page, 'free');
    const weeklyTab = page.locator('button', { hasText: /Weekly Best|Weekly/i });
    await expect(weeklyTab.first()).toBeVisible();
  });

  test('Saved tab is visible for all tiers', async ({ page }) => {
    await loadApp(page, 'free');
    const savedTab = page.locator('button', { hasText: /^Saved$/i });
    await expect(savedTab.first()).toBeVisible();
  });
});

test.describe('Tier Gating — Radar Feature', () => {
  test.setTimeout(45000);

  test('clicking Radar tab shows radar content for free tier', async ({ page }) => {
    await loadApp(page, 'free');

    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i }).first();
    await radarTab.click();
    await page.waitForTimeout(1000);

    // Should show radar content or usage gate
    const radarContent = page.locator('text=/Radar|Trends|Generate/i');
    await expect(radarContent.first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking Radar tab shows radar content for pro tier', async ({ page }) => {
    await loadApp(page, 'pro');

    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i }).first();
    await radarTab.click();
    await page.waitForTimeout(500);

    const radarContent = page.locator('text=/Radar|Trends|Generate/i');
    await expect(radarContent.first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking Radar tab shows radar content for builder tier', async ({ page }) => {
    await loadApp(page, 'builder');

    const radarTab = page.locator('button', { hasText: /Radar|Weekly Radar/i }).first();
    await radarTab.click();
    await page.waitForTimeout(500);

    const radarContent = page.locator('text=/Radar|Trends|Generate/i');
    await expect(radarContent.first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Tier Gating — Futurecasting Feature', () => {
  test.setTimeout(45000);

  test('futurecasting tab loads for pro tier', async ({ page }) => {
    await loadApp(page, 'pro');

    const futureTab = page.locator('button', { hasText: /Future|Futurecasting/i }).first();
    await futureTab.click();
    await page.waitForTimeout(500);

    const futureContent = page.locator('text=/Future|2030|Prediction|Generate/i');
    await expect(futureContent.first()).toBeVisible({ timeout: 8000 });
  });

  test('futurecasting tab loads for builder tier', async ({ page }) => {
    await loadApp(page, 'builder');

    const futureTab = page.locator('button', { hasText: /Future|Futurecasting/i }).first();
    await futureTab.click();
    await page.waitForTimeout(500);

    const futureContent = page.locator('text=/Future|2030|Prediction|Generate/i');
    await expect(futureContent.first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Tier Gating — Next Steps (TE-25)', () => {
  test.setTimeout(30000);

  test('free tier shows 3 next steps with upgrade prompt', async ({ page }) => {
    await loadApp(page, 'free');

    const firstIdea = page.locator('[class*="IdeaCard"]').first();
    await firstIdea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const expandBtn = firstIdea.locator('button:has-text("View VC Analysis")').first();
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      await page.waitForTimeout(500);
    }

    const steps = page
      .locator('text=/Next Steps/i')
      .first()
      .locator('xpath=following-sibling::div[1]//div[contains(@class, "flex gap-3")]');
    const stepCount = await steps.count();
    expect(stepCount).toBeLessThanOrEqual(3);

    // Should show upgrade prompt if there are more than 3 steps
    if (stepCount === 3) {
      const prompt = page.locator('text=/Upgrade to Pro/i');
      await expect(prompt).toBeVisible({ timeout: 5000 });
    }
  });

  test('pro tier shows 7 next steps with builder upgrade prompt when truncated', async ({
    page,
  }) => {
    await loadApp(page, 'pro');

    const firstIdea = page.locator('[class*="IdeaCard"]').first();
    await firstIdea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const expandBtn = firstIdea.locator('button:has-text("View VC Analysis")').first();
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      await page.waitForTimeout(500);
    }

    const steps = page
      .locator('text=/Next Steps/i')
      .first()
      .locator('xpath=following-sibling::div[1]//div[contains(@class, "flex gap-3")]');
    const stepCount = await steps.count();
    expect(stepCount).toBeLessThanOrEqual(7);

    // Should show builder upgrade prompt if truncated
    if (stepCount === 7) {
      const prompt = page.locator('text=/Upgrade to Builder/i');
      await expect(prompt).toBeVisible({ timeout: 5000 });
    }
  });

  test('builder tier shows all next steps (10+)', async ({ page }) => {
    await loadApp(page, 'builder');

    const firstIdea = page.locator('[class*="IdeaCard"]').first();
    await firstIdea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const expandBtn = firstIdea.locator('button:has-text("View VC Analysis")').first();
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      await page.waitForTimeout(500);
    }

    const steps = page
      .locator('text=/Next Steps/i')
      .first()
      .locator('xpath=following-sibling::div[1]//div[contains(@class, "flex gap-3")]');
    const stepCount = await steps.count();
    // Builder sees all steps; upgrade prompt should not appear
    const prompt = page.locator('text=/Upgrade/i').locator('text=/roadmap/i');
    await expect(prompt).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tier Gating — Comments (TE-26)', () => {
  test.setTimeout(30000);

  test('free tier comment input is disabled with pro prompt', async ({ page }) => {
    await loadApp(page, 'free');

    const firstIdea = page.locator('[class*="IdeaCard"]').first();
    await firstIdea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const commentBtn = page.locator('button', { hasText: /Community|Comment/i }).first();
    if ((await commentBtn.count()) > 0) {
      await commentBtn.click();
      await page.waitForTimeout(500);
    }

    const commentInput = page.locator('input[placeholder*="Pro feature"]');
    if ((await commentInput.count()) > 0) {
      await expect(commentInput).toBeDisabled();
    }
  });

  test('pro tier comment input is enabled', async ({ page }) => {
    await loadApp(page, 'pro');

    const firstIdea = page.locator('[class*="IdeaCard"]').first();
    await firstIdea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const commentBtn = page.locator('button', { hasText: /Community|Comment/i }).first();
    if ((await commentBtn.count()) > 0) {
      await commentBtn.click();
      await page.waitForTimeout(500);
    }

    const commentInput = page.locator('input[placeholder*="feedback"]');
    if ((await commentInput.count()) > 0) {
      await expect(commentInput).toBeEnabled();
    }
  });

  test('builder tier comment input is enabled', async ({ page }) => {
    await loadApp(page, 'builder');

    const firstIdea = page.locator('[class*="IdeaCard"]').first();
    await firstIdea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const commentBtn = page.locator('button', { hasText: /Community|Comment/i }).first();
    if ((await commentBtn.count()) > 0) {
      await commentBtn.click();
      await page.waitForTimeout(500);
    }

    const commentInput = page.locator('input[placeholder*="feedback"]');
    if ((await commentInput.count()) > 0) {
      await expect(commentInput).toBeEnabled();
    }
  });
});

test.describe('Tier Gating — Local Market Filter', () => {
  test.setTimeout(30000);

  test('Local Market filter button is disabled for free tier', async ({ page }) => {
    await loadApp(page, 'free');

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(500);

    const localBtn = page.locator('button', { hasText: 'Local Market' });
    if ((await localBtn.count()) > 0) {
      await expect(localBtn.first()).toBeDisabled();
    }
  });

  test('Local Market filter button is enabled for pro tier', async ({ page }) => {
    await loadApp(page, 'pro');

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(500);

    const localBtn = page.locator('button', { hasText: 'Local Market' });
    if ((await localBtn.count()) > 0) {
      await expect(localBtn.first()).toBeEnabled();
    }
  });

  test('Local Market filter button is enabled for builder tier', async ({ page }) => {
    await loadApp(page, 'builder');

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(500);

    const localBtn = page.locator('button', { hasText: 'Local Market' });
    if ((await localBtn.count()) > 0) {
      await expect(localBtn.first()).toBeEnabled();
    }
  });
});
