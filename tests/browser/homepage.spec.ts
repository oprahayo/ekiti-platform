import { test, expect } from '@playwright/test';

test('homepage introduces available tools and opens a private draft', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Know your community/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start with what you need.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore your area/ })).toBeVisible();

  await page.getByRole('link', { name: 'Start a private draft' }).click();
  await expect(page.locator('.draft')).toHaveAttribute('open', '');
  await expect(page.getByLabel('Report type')).toBeVisible();
  await expect(page.getByText('This is a draft tool, not a reporting service.')).toBeVisible();
  await expect(page.locator('#draft-privacy')).toContainText('Downloading does not submit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('location finder is reachable without navigating away', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Explore Ekiti/ }).first().click();
  await expect(page.locator('#location')).toBeInViewport();
  await expect(page.locator('#lga option')).toHaveCount(17);
  await page.locator('#lga').selectOption('ikere');
  await expect(page.locator('#summary-lga')).toHaveText('Ikere · manual');
});
