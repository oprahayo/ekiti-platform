import { test, expect } from '@playwright/test';

// ST_PointOnSurface of the reviewed GRID3 Efon polygon.
const efon = { latitude: 7.677235411135371, longitude: 4.943747799903621 };

test('keyboard selection and filtering need neither a map nor GPS', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await expect(page.locator('#lga option')).toHaveCount(17);
  await page.getByRole('searchbox', { name: 'Filter Local government area' }).fill('efon');
  await page.locator('#lga').focus();
  await page.keyboard.press('e');
  await expect(page.locator('#summary-lga')).toHaveText('Efon · manual');
  await page.getByRole('searchbox', { name: 'Filter Electoral ward (optional)' }).fill('EFON IX');
  await page.locator('#ward').selectOption({ label: 'EFON IX' });
  await expect(page.locator('#summary-ward')).toHaveText('EFON IX');
  await page.locator('#place').fill('Near the market');
  await expect(page.locator('#summary-place')).toHaveText('Near the market');
  expect(requests.some((url) => /\/assets\/(map-|lga-)|\/api\/resolve/.test(url))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('GPS proposes a point; explicit confirmation resolves it through PostGIS', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(efon);
  let resolutions = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/resolve')) resolutions++;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use device GPS' }).click();
  await expect(page.locator('#point-status')).toContainText('Device position found');
  expect(resolutions).toBe(0);
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.locator('#summary-lga')).toHaveText('Efon · boundary match');
  await expect(page.locator('#summary-ward')).toHaveText('Unspecified');
  expect(resolutions).toBe(1);
  await page.locator('#lga').selectOption('oye');
  await expect(page.locator('#evidence')).toContainText('differs');
  await page.locator('#lat').fill('0');
  await page.locator('#lon').fill('0');
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.locator('#evidence')).toContainText('outside');
  await expect(page.locator('#summary-lga')).toHaveText('Oye · manual');
});

test('opt-in MapLibre selection works with local boundary assets', async ({ page }) => {
  await page.goto('/');
  const loaded = page.waitForResponse((r) => /\/assets\/lga-.*\.json$/.test(r.url()) && r.ok());
  await page.getByRole('button', { name: 'Open Ekiti map' }).click();
  await loaded;
  const canvas = page.locator('#map canvas');
  await expect(canvas).toBeVisible();
  await canvas.click();
  await expect(page.locator('#point-status')).toContainText('Position selected');
  await expect(page.locator('#evidence')).toHaveText('No incident position confirmed.');
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.locator('#evidence')).toContainText('Boundary lookup:');
  await expect(page.locator('#summary-ward')).toHaveText('Unspecified');
});

test('denied GPS and failed lookup preserve manual selections', async ({ page, context }) => {
  await context.grantPermissions([]);
  await page.goto('/');
  await page.locator('#lga').selectOption('efon');
  await page.locator('#ward').selectOption({ label: 'EFON IX' });
  await page.getByRole('button', { name: 'Use device GPS' }).click();
  await expect(page.locator('#point-status')).toContainText('location unavailable', {
    timeout: 15000,
  });
  await page.route('**/api/resolve', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.locator('#lat').fill(String(efon.latitude));
  await page.locator('#lon').fill(String(efon.longitude));
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.locator('#point-status')).toContainText('lookup unavailable');
  await expect(page.locator('#summary-ward')).toHaveText('EFON IX');
});

test('directory retry and map failure leave the list usable', async ({ page }) => {
  await page.route('**/api/areas', (route) => route.fulfill({ status: 503, body: '{}' }), {
    times: 1,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Retry directory' }).click();
  await page.locator('#lga').selectOption('efon');
  await page.route('**/assets/map-*.js', (route) => route.abort());
  await page.getByRole('button', { name: 'Open Ekiti map' }).click();
  await expect(page.locator('#point-status')).toContainText('Map unavailable');
  await page.locator('#ward').selectOption({ label: 'EFON IX' });
  await expect(page.locator('#summary-ward')).toHaveText('EFON IX');
});
