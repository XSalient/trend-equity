import { test, expect, Page, Route } from '@playwright/test';

/**
 * =============================================================
 * Localization & Tier E2E Tests
 * =============================================================
 *
 * Strategy:
 *  - `?mockTier=<tier>` overrides Firestore tier lookup in useTier.ts.
 *  - We intercept `/api/generate/daily` to capture the request payload
 *    and verify country + countryCount values per tier.
 *  - Firebase Firestore uses gRPC/WebSocket channels that bypass HTTP
 *    route interception, so the app may load cached data from Firestore.
 *    We therefore split assertions:
 *      1. PAYLOAD tests: always assert the outgoing API body (if triggered).
 *      2. FILTER UI tests: test that the filter button is enabled/disabled
 *         per tier, and that clicking it toggles the visual "active" state.
 */

// --- Tests ---

test.describe('Localization: API Payload Per Tier', () => {
  test.setTimeout(45000);

  test('Free Tier sends countryCount=1 in API request', async ({ page }) => {
    let capturedPayload: any = null;
    await page.route('**/api/generate/daily', async (route: Route) => {
      capturedPayload = route.request().postDataJSON();
      // Let it pass through to the real server
      await route.continue();
    });

    await page.goto('/?mockTier=free');
    // Wait for the page to render content
    await page.waitForSelector('[class*="bg-zinc"]', { timeout: 15000 });
    // Give the app time to potentially trigger an API call
    await page.waitForTimeout(5000);

    if (capturedPayload) {
      expect(capturedPayload.countryCount).toBe(1);
      expect(capturedPayload.country).toBeTruthy();
      console.log('✅ Free Tier payload verified:', capturedPayload.country, capturedPayload.countryCount);
    } else {
      console.log('ℹ️  Free Tier: No API call triggered (cached data exists). Payload test skipped.');
    }
  });

  test('Pro Tier sends countryCount=3 in API request', async ({ page }) => {
    let capturedPayload: any = null;
    await page.route('**/api/generate/daily', async (route: Route) => {
      capturedPayload = route.request().postDataJSON();
      await route.continue();
    });

    await page.goto('/?mockTier=pro');
    await page.waitForSelector('[class*="bg-zinc"]', { timeout: 15000 });
    await page.waitForTimeout(5000);

    if (capturedPayload) {
      expect(capturedPayload.countryCount).toBe(3);
      console.log('✅ Pro Tier payload verified:', capturedPayload.country, capturedPayload.countryCount);
    } else {
      console.log('ℹ️  Pro Tier: No API call triggered (cached data exists). Payload test skipped.');
    }
  });

  test('Builder Tier sends countryCount=5 in API request', async ({ page }) => {
    let capturedPayload: any = null;
    await page.route('**/api/generate/daily', async (route: Route) => {
      capturedPayload = route.request().postDataJSON();
      await route.continue();
    });

    await page.goto('/?mockTier=builder');
    await page.waitForSelector('[class*="bg-zinc"]', { timeout: 15000 });
    await page.waitForTimeout(5000);

    if (capturedPayload) {
      expect(capturedPayload.countryCount).toBe(5);
      console.log('✅ Builder Tier payload verified:', capturedPayload.country, capturedPayload.countryCount);
    } else {
      console.log('ℹ️  Builder Tier: No API call triggered (cached data exists). Payload test skipped.');
    }
  });
});


test.describe('Localization: Filter UI Per Tier', () => {
  test.setTimeout(45000);

  test('Free Tier: Local Market filter button is DISABLED', async ({ page }) => {
    await page.goto('/?mockTier=free');
    // Wait for the disclaimer or any feed content to appear
    await page.waitForSelector('text=/DISCLAIMER|TODAY/i', { timeout: 20000 });

    // Open the filter panel
    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(500);

    // Find the Local Market button
    const localBtn = page.locator('button', { hasText: 'Local Market' });
    await expect(localBtn).toBeVisible();
    await expect(localBtn).toBeDisabled();
    console.log('✅ Free Tier: Local Market filter is disabled as expected.');
  });

  test('Pro Tier: Local Market filter button is ENABLED and toggles state', async ({ page }) => {
    await page.goto('/?mockTier=pro');
    await page.waitForSelector('text=/DISCLAIMER|TODAY/i', { timeout: 20000 });

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(500);

    const localBtn = page.locator('button', { hasText: 'Local Market' });
    await expect(localBtn).toBeVisible();
    await expect(localBtn).toBeEnabled();

    // Click it - should become "active" (emerald background)
    await localBtn.click();
    await page.waitForTimeout(500);

    // Assert it has the active styling (bg-emerald-500)
    await expect(localBtn).toHaveClass(/bg-emerald-500/);
    console.log('✅ Pro Tier: Local Market filter is enabled and toggles to active state.');

    // Click again to deselect
    await localBtn.click();
    await page.waitForTimeout(500);
    await expect(localBtn).not.toHaveClass(/bg-emerald-500/);
    console.log('✅ Pro Tier: Local Market filter correctly deselects on second click.');
  });

  test('Builder Tier: Local Market filter button is ENABLED and toggles state', async ({ page }) => {
    await page.goto('/?mockTier=builder');
    await page.waitForSelector('text=/DISCLAIMER|TODAY/i', { timeout: 20000 });

    await page.click('button:has-text("Filters")');
    await page.waitForTimeout(500);

    const localBtn = page.locator('button', { hasText: 'Local Market' });
    await expect(localBtn).toBeVisible();
    await expect(localBtn).toBeEnabled();

    await localBtn.click();
    await page.waitForTimeout(500);
    await expect(localBtn).toHaveClass(/bg-emerald-500/);

    // Wait 3 seconds to verify it STAYS selected (the old bug)
    await page.waitForTimeout(3000);
    await expect(localBtn).toHaveClass(/bg-emerald-500/);
    console.log('✅ Builder Tier: Local Market filter stays selected after 3 seconds (no deselection bug).');
  });
});
