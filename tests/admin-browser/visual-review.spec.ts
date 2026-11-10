import { test, expect } from '@playwright/test';

test('capture honest desktop and mobile admin visual audit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByText('Demonstration workspace.')).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-review/desktop-cases.png', fullPage: true });
  await page.getByRole('button', { name: /Moderation/ }).click();
  await page.screenshot({ path: 'test-results/admin-review/desktop-moderation.png', fullPage: true });
  await page.getByRole('button', { name: /Routing/ }).click();
  await page.screenshot({ path: 'test-results/admin-review/desktop-routing.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Cases/ }).click();
  await page.screenshot({ path: 'test-results/admin-review/mobile-cases.png', fullPage: true });
  await page.locator('.case-list-item').first().click();
  await page.screenshot({ path: 'test-results/admin-review/mobile-case-detail.png', fullPage: true });
  await page.getByRole('button', { name: /Moderation/ }).click();
  await page.screenshot({ path: 'test-results/admin-review/mobile-moderation.png', fullPage: true });
  await page.locator('.moderation-list-item').first().click();
  await page.screenshot({ path: 'test-results/admin-review/mobile-moderation-detail.png', fullPage: true });
  await page.getByRole('button', { name: /Routing/ }).click();
  await page.screenshot({ path: 'test-results/admin-review/mobile-routing.png', fullPage: true });
  await page.locator('.routing-list-item').first().click();
  await page.screenshot({ path: 'test-results/admin-review/mobile-routing-detail.png', fullPage: true });
  await page.setViewportSize({ width: 280, height: 720 });
  await page.screenshot({ path: 'test-results/admin-review/narrow-routing.png', fullPage: true });
});
