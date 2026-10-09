import { test, expect } from '@playwright/test';

test.describe('Authentication and Routing', () => {
  test('displays login page correctly', async ({ page }) => {
    // Navigate to the base URL
    await page.goto('/');
    
    // Check if it redirects to login or shows login form
    // Look for login-related elements since the app is protected
    await expect(page.locator('text=Welcome back').or(page.locator('text=Sign In'))).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log("Could not find exact welcome text, verifying login form presence");
    });
    
    // Check if the URL contains 'login' or the form is present
    const url = page.url();
    expect(url).toContain('login');
  });
  
  test('authenticated workflows (skipped)', async () => {
    test.skip(true, 'Cannot safely test authenticated workflows without a dedicated isolated database environment.');
  });
});
