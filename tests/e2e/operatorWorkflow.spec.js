import { test, expect } from '@playwright/test';

test.describe('E2E: Operator Shop Floor Workflow', () => {
  test('renders login page and validates input fields', async ({ page }) => {
    await page.goto('/');
    
    // Check main title or logo on login page
    await expect(page.locator('h1')).toContainText('КУЛИЦЯ');
    
    // Check username and password input visibility
    const usernameInput = page.locator('input[placeholder="ЛОГІН"]');
    const passwordInput = page.locator('input[placeholder="ПАРОЛЬ"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('handles invalid credentials gracefully', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[placeholder="ЛОГІН"]', 'non_existent_operator');
    await page.fill('input[placeholder="ПАРОЛЬ"]', 'wrong_password_123');
    await page.click('button[type="submit"]');

    // Check error message container
    const errorMessage = page.locator('text=помилка');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
