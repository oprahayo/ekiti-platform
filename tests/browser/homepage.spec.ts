import { test, expect } from '@playwright/test';

test('homepage prioritizes a usable location finder and honest private draft', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Find your place/i })).toBeVisible();
  await expect(page.getByText('Online submission and case tracking are not yet available.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore your area/ })).toBeVisible();
  await expect(page.locator('.feature-grid, .feature, .steps, .panel, .art-card')).toHaveCount(0);

  await page.getByRole('link', { name: /Write a private draft/ }).click();
  await expect(page.locator('.draft')).toHaveAttribute('open', '');
  await expect(page.getByLabel('Report type')).toBeVisible();
  await expect(page.locator('.draft-alert')).toContainText('not sent to government offices');
  await expect(page.locator('#draft-privacy')).toContainText('Downloading does not submit');
});

test('area finder works with one select per level, without redundant search fields', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Explore your area/ }).click();
  await expect(page.locator('#location')).toBeInViewport();
  await expect(page.locator('#lga option')).toHaveCount(17);
  await expect(page.locator('#fields select')).toHaveCount(2);
  await expect(page.locator('#fields input')).toHaveCount(0);
  await page.locator('#lga').selectOption('ikere');
  await expect(page.locator('#summary-lga')).toHaveText('Ikere · manual');
});

for (const width of [280, 320, 360, 375, 390, 428, 768, 1024, 1440]) {
  test('layout does not overflow at ' + width + 'px and keeps key actions touch-friendly', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.locator('#lga option')).toHaveCount(17);
    const metrics = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      actions: ['.action-primary', '.action-text', '#position-tools summary', '.draft summary', '#lga', '#ward'].map(selector => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { selector, width: r.width, height: r.height };
      }),
    }));
    expect(metrics.document, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport);
    for (const item of metrics.actions) {
      expect(item.height, item.selector + ' target height').toBeGreaterThanOrEqual(44);
    }
  });
}

test('optional precision tools are collapsed by default and keyboard accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#position-tools')).not.toHaveAttribute('open', '');
  await expect(page.locator('#map-box')).toBeHidden();
  await page.locator('#position-tools summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#position-tools')).toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Use device GPS' })).toBeVisible();
});

test('independent identity and no third-party typeface requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).hostname));
  await page.goto('/');
  await expect(page.getByText('Not affiliated with the Ekiti State Government. Staging release.')).toBeVisible();
  expect(requests.filter(host => !['127.0.0.1', 'localhost'].includes(host))).toEqual([]);
});
