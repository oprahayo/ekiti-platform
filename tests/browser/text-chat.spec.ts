import { test, expect } from '@playwright/test';

test('home is a welcome gateway and reporting opens a separate conversational journey', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti Civic' })).toBeVisible();
  await expect(page.getByText('Your mobile gateway to Ekiti State.')).toBeVisible();
  await expect(page.locator('.welcome-action')).toHaveCount(5);
  await expect(page.locator('#home-ask-input')).toHaveCount(0);
  await page.getByRole('link', { name: /Report an issue/ }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Audio note/ })).toBeVisible();
});

test('the guided journey asks category, description and location in sequence', async ({ page }) => {
  await page.goto('/report');
  await page.getByRole('button', { name: /Write text/ }).click();
  await page.getByRole('button', { name: 'Roads' }).click();
  await page.locator('#guided-description').fill('My community bridge has collapsed near the main road.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Where in Ekiti did it happen/)).toBeVisible();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Would you like to attach evidence now/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Open voice mode/ })).toHaveCount(0);
});

test('capture mobile and desktop welcome and report journey screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path:'test-results/citizen-chat/home-mobile.png', fullPage:true });
  await page.getByRole('link', { name:/Report an issue/ }).click();
  await page.screenshot({ path:'test-results/citizen-chat/report-mobile.png', fullPage:true });
  await page.goto('/track');
  await expect(page.getByRole('heading', { name: 'Check a report' })).toBeVisible();
  await page.screenshot({ path:'test-results/citizen-chat/track-mobile.png', fullPage:true });
  await page.setViewportSize({ width:1280, height:820 });
  await page.goto('/');
  await page.screenshot({ path:'test-results/citizen-chat/home-desktop.png', fullPage:true });
  await page.setViewportSize({ width:280, height:720 });
  await page.goto('/');
  const metrics=await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    actionWidth: document.querySelector('.welcome-action')?.getBoundingClientRect().width,
  }));
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.actionWidth).toBeGreaterThanOrEqual(65);
  await page.screenshot({ path:'test-results/citizen-chat/home-280px.png', fullPage:true });
});
