/**
 * E2E tests — Pricing plan identity (TE-44)
 *
 * A signed-out visitor has free-tier *entitlement* but is on no plan at all.
 * Nothing on the pricing tab may claim a plan is theirs.
 *
 * Positive:
 *  + Signed-out tab reads "Pricing" (not "Upgrade" / "Plan")
 *  + All three cards offer an actionable "Proceed" CTA
 *
 * Negative:
 *  + No "Current" badge, no "CURRENT PLAN" button, no possessive "Your … Features"
 *  + Signed-in (mocked) free user still sees the real current-plan treatment
 */

import { test, expect, Page } from '@playwright/test';
import { injectMockDailyFeed, interceptAllApis } from './helpers/mockData';

const BASE_URL = 'http://localhost:3000';

async function openPricing(page: Page, query = '') {
  await injectMockDailyFeed(page);
  await interceptAllApis(page);
  await page.goto(`${BASE_URL}/${query}`);
  await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });
  await page
    .locator('button', { hasText: /^(Pricing|Upgrade|Plan)$/ })
    .first()
    .click();
  await expect(page.locator('text=/Choose Your Path/i').first()).toBeVisible({ timeout: 8000 });
}

test.describe('Pricing — signed out (TE-44)', () => {
  test.setTimeout(30000);

  test('tab is labelled Pricing, not Upgrade', async ({ page }) => {
    await injectMockDailyFeed(page);
    await interceptAllApis(page);
    await page.goto(BASE_URL);
    await page.waitForSelector('text=/TODAY/i', { timeout: 15000 });

    await expect(page.locator('button', { hasText: /^Pricing$/ }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /^Upgrade$/ })).toHaveCount(0);
  });

  test('no card claims to be the current plan', async ({ page }) => {
    await openPricing(page);

    await expect(page.locator('button', { hasText: /CURRENT PLAN/i })).toHaveCount(0);
    await expect(page.locator('text=/^Current$/i')).toHaveCount(0);
    await expect(page.locator('text=/Your FREE Features/i')).toHaveCount(0);
  });

  test('all three cards offer an enabled Proceed CTA', async ({ page }) => {
    await openPricing(page);

    const proceed = page.locator('button', { hasText: /^PROCEED$/i });
    await expect(proceed).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(proceed.nth(i)).toBeEnabled();
    }
  });

  test('feature showcase is framed as a preview', async ({ page }) => {
    await openPricing(page);

    await expect(page.locator('text=/Preview: FREE Features/i').first()).toBeVisible();
    await expect(page.locator('text=/Sign in to get started/i').first()).toBeVisible();
  });
});

test.describe('Pricing — signed in (TE-44 regression guard)', () => {
  test.setTimeout(30000);

  test('mocked free member still sees the current-plan treatment', async ({ page }) => {
    await openPricing(page, '?mockTier=free');

    await expect(page.locator('button', { hasText: /CURRENT PLAN/i }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /^PROCEED$/i })).toHaveCount(0);
    await expect(page.locator('text=/Your FREE Features/i').first()).toBeVisible();
  });

  test('mocked builder member sees Builder as current', async ({ page }) => {
    await openPricing(page, '?mockTier=builder');

    // Exactly one card may claim the plan, and it must be the Builder card.
    const currentBtn = page.locator('button', { hasText: /^CURRENT PLAN$/i });
    await expect(currentBtn).toHaveCount(1);
    const card = currentBtn.locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]');
    await expect(card.locator('h4')).toHaveText(/Builder/i);
  });
});
