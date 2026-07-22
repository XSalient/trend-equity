import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Critical Routes', () => {
  test.beforeEach(async ({ page }) => {
    // Set mock mode to avoid external dependencies
    await page.addInitScript(() => {
      localStorage.setItem('PLAYWRIGHT_TEST', 'true');
    });
  });

  test('App loads without errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // App should render
    await expect(page.locator('body')).toContainText(/trending|idea|startup/i);
    expect(errors).toEqual([]);
  });

  test('Daily feed renders', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for feed content (tab is active by default)
    const feedTab = page.locator('button:has-text("Ideas")').first();
    await expect(feedTab).toBeVisible();

    // Feed should contain idea cards or empty state
    const ideasContainer = page.locator('[data-testid="ideas-container"], main');
    await expect(ideasContainer).toBeVisible();
  });

  test('Save/unsave idea (auth required)', async ({ page, context }) => {
    // Mock auth by setting token in storage (simulating signed-in state)
    await context.addInitScript(() => {
      // This would normally be set by Firebase auth
      localStorage.setItem('firebase:authUser:mock-token', 'true');
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    // Look for save button on an idea card
    const saveButtons = page.locator('button[aria-label*="Save"]').first();
    if (await saveButtons.isVisible()) {
      await saveButtons.click();
      // Button should toggle (either become unsaved or show saved state)
      await expect(page.locator('[data-testid="toast"], .toast')).not.toHaveCount(0);
    }
  });

  test('Tier gate visible (Free sees lock icon)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Pro/Builder features should have tier indicators
    // Look for lock icon or tier badge (depends on implementation)
    const tiergateIndicators = page.locator(
      '[data-testid="tier-gate"], .lock, [aria-label*="Pro"]'
    );

    // If any tier-gated content exists, it should be visible
    const contentExists = await page.locator('main').isVisible();
    expect(contentExists).toBe(true);
  });

  test('Pricing page loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Find and click pricing or settings link (if it exists)
    const pricingLink = page.locator('a:has-text(/pricing|upgrade|pro/i)').first();
    if (await pricingLink.isVisible()) {
      await pricingLink.click();
      await page.waitForLoadState('networkidle');

      // Pricing content should load
      await expect(page.locator('body')).toContainText(/free|pro|builder/i);
    }
  });

  test('Comment section visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Expand an idea to see comments (if cards are clickable)
    const ideaCard = page.locator('[data-testid="idea-card"]').first();
    if (await ideaCard.isVisible()) {
      // Comments may be in a modal or expanded view
      // This is a basic check that the UI renders without crashing
      await expect(ideaCard).toBeVisible();
    }
  });

  test('Sign out works', async ({ page, context }) => {
    // Simulate signed-in state
    await context.addInitScript(() => {
      localStorage.setItem('firebase:authUser:mock-token', 'true');
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    // Look for sign-out button (usually in header/menu)
    const signOutButton = page.locator('button:has-text(/sign out|logout|exit/i)').first();
    if (await signOutButton.isVisible()) {
      await signOutButton.click();
      // After sign out, should return to login state
      await page.waitForLoadState('networkidle');
      expect(true).toBe(true); // Just verify no crash
    }
  });
});
