import { test, expect } from '@playwright/test';

test.describe('E2E: Warehouse & Inventory Navigation', () => {
  test('verifies public machine call route access', async ({ page }) => {
    // Machine call page is public
    await page.goto('/machines/test-machine-id/call');
    
    // Page should render without redirecting to login
    await expect(page).toHaveURL(/\/machines\/test-machine-id\/call/);
  });

  test('verifies app layout elements and responsive shell', async ({ page }) => {
    await page.goto('/login');
    
    // Verify industrial version branding
    await expect(page.locator('text=INDUSTRIAL CONTROL V2.0')).toBeVisible();
  });
});
