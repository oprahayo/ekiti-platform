import { test, expect } from '@playwright/test';

test('isolated admin demo opens with explicit safeguards and verified-only agency status', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Operations workspace/);
  await expect(page.getByText('Demonstration workspace.')).toBeVisible();
  await expect(page.getByText('No confirmed external receipt')).toBeVisible();
  await expect(page.getByText('No authenticated view event')).toBeVisible();
  await expect(page.getByText('DEMO-1001').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Analytics/ })).toBeVisible();
});

test('a platform assignment appends only an internal event', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await page.getByRole('button', { name: 'Confirm demo action' }).click();
  await expect(page.locator('.detail-panel .status-pill')).toHaveText('Assigned');
  await expect(page.getByText('Assigned to the demo moderator')).toBeVisible();
  await expect(page.getByText('No confirmed external receipt')).toBeVisible();
  await expect(page.getByText('No authenticated view event')).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.detail-panel .status-pill')).toHaveText('Inbox');
});

test('queues, searching and sample analytics work without a backend', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Filter cases by status').selectOption('escalated');
  await expect(page.locator('.case-list-item')).toHaveCount(1);
  await page.getByLabel('Filter cases by status').selectOption('all');
  await page.getByRole('searchbox').fill('signage');
  await expect(page.locator('.case-list-item')).toHaveCount(1);
  await expect(page.locator('.case-list-item')).toContainText('DEMO-1005');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
  await expect(page.getByText('Simulated records')).toBeVisible();
});

test('mobile navigation keeps the case list and details usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto('/');
  await expect(page.locator('.case-list-item')).toHaveCount(6);
  await page.locator('.case-list-item').first().click();
  await expect(page.locator('.detail-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: '← Cases' })).toBeVisible();
  await page.getByRole('button', { name: '← Cases' }).click();
  await expect(page.locator('.case-panel')).toBeVisible();
});


test('moderation handles multiple content queues and never verifies a claim by button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Moderation/ }).click();
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(page.getByText('DEMO-MOD-101').first()).toBeVisible();
  await page.getByRole('button', { name: /Ownership claims/ }).click();
  await expect(page.getByText('An email-code login does not prove business ownership.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark reviewed (demo)' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Request more evidence (demo)' }).click();
  await page.getByLabel('Internal decision reason').fill('Business ownership has not been independently verified');
  await page.getByRole('button', { name: 'Record demo decision' }).click();
  await expect(page.getByText('Needs evidence').first()).toBeVisible();
  await expect(page.getByText('Business ownership has not been independently verified')).toBeVisible();
});

test('routing assistance never fabricates a government office or receipt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Office routing/ }).click();
  await expect(page.getByRole('heading', { name: 'Office routing' })).toBeVisible();
  await expect(page.getByText('Not assigned')).toBeVisible();
  await expect(page.getByText('Not attempted')).toBeVisible();
  await expect(page.getByText('Not mapped from verified polygons')).toBeVisible();
});

test('four primary tabs stay visible at 280px; case statuses live inside Cases', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 720 });
  await page.goto('/?view=all');
  const nav = page.getByRole('navigation', { name: 'Primary admin navigation' });
  await expect(nav.getByRole('button')).toHaveCount(4);
  for (const button of await nav.getByRole('button').all()) {
    const rect = await button.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(281);
  }
  await page.getByLabel('Filter cases by status').selectOption('awaiting');
  await expect(page.locator('.case-list-item')).toHaveCount(1);
  await expect(page).toHaveURL(/view=awaiting/);
  await nav.getByRole('button', { name: /Moderation/ }).click();
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await nav.getByRole('button', { name: /Routing/ }).click();
  await expect(page.getByRole('heading', { name: 'Office routing' })).toBeVisible();
  await nav.getByRole('button', { name: /Overview/ }).click();
  await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
});

test('mobile moderation and routing use list and detail screens with working back actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=moderation');
  await expect(page.locator('.moderation-list')).toBeVisible();
  await expect(page.locator('.moderation-inspector')).toBeHidden();
  await page.locator('.moderation-list-item').first().click();
  await expect(page.locator('.moderation-inspector')).toBeVisible();
  await expect(page.locator('.moderation-list')).toBeHidden();
  await page.getByRole('button', { name: '← Moderation queue' }).click();
  await expect(page.locator('.moderation-list')).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary admin navigation' })
    .getByRole('button', { name: /Routing/ }).click();
  await expect(page.locator('.routing-list')).toBeVisible();
  await expect(page.locator('.routing-detail')).toBeHidden();
  await page.locator('.routing-list-item').first().click();
  await expect(page.locator('.routing-detail')).toBeVisible();
  await page.getByRole('button', { name: '← Routing queue' }).click();
  await expect(page.locator('.routing-list')).toBeVisible();
});

test('view deep links and browser history stay in sync without exposing case details', async ({ page }) => {
  await page.goto('/?view=moderation');
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary admin navigation' })
    .getByRole('button', { name: /Cases/ }).click();
  await expect(page).toHaveURL(/view=all/);
  await page.getByLabel('Filter cases by status').selectOption('inbox');
  await expect(page).toHaveURL(/view=inbox/);
  await page.goBack();
  await expect(page.getByLabel('Filter cases by status')).toHaveValue('all');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
});
