import { test, expect } from '@playwright/test';

const description = 'The wooden footbridge near the market has broken sections and residents cannot cross safely.';
const efon = { latitude: 7.677235411135371, longitude: 4.943747799903621 };

test('report wizard runs without GPS, uploads or an online intake endpoint', async ({ page, context }) => {
  await context.grantPermissions([]);
  const calls: string[] = [];
  page.on('request', request => calls.push(request.url()));
  await page.goto('/report');
  await expect(page.getByRole('heading', { name: 'What happened?' })).toBeVisible();
  await page.getByRole('button', { name: 'Complaint' }).click();
  await page.locator('#incident-description').fill(description);
  await expect(page.getByText('Draft saved · just now')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to location' }).click();
  await expect(page.getByRole('heading', { name: 'Where is it?' })).toBeVisible();
  await expect(page.locator('#lga option')).toHaveCount(17);
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(page.getByText(/Location permission denied or unavailable/)).toBeVisible({ timeout: 15000 });
  await page.locator('#lga').selectOption('efon');
  await page.locator('#ward').selectOption({ label: 'EFON IX' });
  await expect(page.getByText('Ward selected by you. Its exact geographic boundary is not verified.')).toBeVisible();
  await page.getByRole('button', { name: 'Review draft' }).click();
  await expect(page.getByRole('heading', { name: 'Review your draft' })).toBeVisible();
  await expect(page.locator('.review-list')).toContainText(description);
  await expect(page.locator('.review-list')).toContainText('EFON IX');
  await page.getByRole('checkbox', { name: /I understand this is a demonstration/ }).check();
  await page.getByRole('button', { name: 'Preview completion' }).click();
  await expect(page.getByRole('heading', { name: 'Preview complete' })).toBeVisible();
  await expect(page.getByText('No report was stored, transmitted, or sent to an agency.')).toBeVisible();
  await expect(page.getByText('DEMO-EKP-2026-00001')).toBeVisible();
  expect(calls.some(url => /\/api\/reports/.test(url))).toBe(false);
  expect(calls.some(url => /\/assets\/(map-|lga-)/.test(url))).toBe(false);
  expect(page.url()).not.toContain('token');
});

test('draft saves locally, survives refresh and does not leave device in API requests', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', request => calls.push(request.url()));
  await page.goto('/report');
  await page.locator('#incident-description').fill(description);
  await expect(page.getByText('Draft saved · just now')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ekiti-report-preview-v2'));
  expect(saved).toContain(description);
  await page.reload();
  await expect(page.locator('#incident-description')).toHaveValue(description);
  expect(calls.some(url => url.includes('/api/reports'))).toBe(false);
});

test('report wizard back button and browser back preserve entered text', async ({ page }) => {
  await page.goto('/report');
  await page.locator('#incident-description').fill(description);
  await page.getByRole('button', { name: 'Continue to location' }).click();
  await expect(page.getByRole('heading', { name: 'Where is it?' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'What happened?' })).toBeVisible();
  await expect(page.locator('#incident-description')).toHaveValue(description);
});

test('device GPS requires a tap and the server boundary check requires another', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(efon);
  let resolves = 0;
  page.on('request', request => { if (request.url().endsWith('/api/resolve')) resolves++; });
  await page.goto('/report');
  await page.locator('#incident-description').fill(description);
  await page.getByRole('button', { name: 'Continue to location' }).click();
  expect(resolves).toBe(0);
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(page.getByText('Position proposed. Confirm before checking the boundary.')).toBeVisible();
  expect(resolves).toBe(0);
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.getByText(/LGA matched in verified boundary data: Efon/)).toBeVisible();
  expect(resolves).toBe(1);
});

test('report map loads only after requesting it', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/report');
  await page.locator('#incident-description').fill(description);
  await page.getByRole('button', { name: 'Continue to location' }).click();
  expect(requests.some(url => /\/assets\/(map-|lga-)/.test(url))).toBe(false);
  await page.getByRole('button', { name: /Open Ekiti map/ }).click();
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.getByText(/Tap to choose an incident point/)).toBeVisible();
});

test('offline shell preserves the locally saved description after an airplane-mode refresh', async ({ page, context }) => {
  await page.goto('/report');
  await page.locator('#incident-description').fill(description);
  await expect(page.getByText('Draft saved · just now')).toBeVisible();
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers required for this test');
    await navigator.serviceWorker.ready;
  });
  // The first document was loaded before service worker control. An online
  // reload establishes a controlled page before simulating airplane mode.
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect(page.locator('#incident-description')).toHaveValue(description);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const check = async () => {
        const entries = performance.getEntriesByType('resource')
          .map(item => new URL(item.name).pathname)
          .filter(path => path.startsWith('/assets/') && path.endsWith('.js'));
        const matches = await Promise.all(entries.map(path => caches.match(path)));
        if (matches.length >= 2 && matches.every(Boolean)) return resolve();
        if (Date.now() - started > 10000) return reject(new Error('Public app assets not cached before offline refresh'));
        setTimeout(check, 100);
      };
      void check();
    });
  });
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#incident-description')).toHaveValue(description);
  } finally {
    await context.setOffline(false);
  }
});
