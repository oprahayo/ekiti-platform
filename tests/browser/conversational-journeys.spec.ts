import { test, expect } from '@playwright/test';

const description = 'The footbridge near the public market has broken sections and people may fall while crossing.';
const efon = { latitude: 7.677235411135371, longitude: 4.943747799903621 };

test('assistant prepares a report with no forms, no fake receipt and a downloadable text file', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', req => requests.push(req.url()));
  await page.goto('/report/text-draft');
  await expect(page.getByRole('heading', { name: 'Tell me what happened' })).toBeVisible();
  await expect(page.getByText(/I will help you prepare a private draft/)).toBeVisible();
  await expect(page.locator('.report-progress, #draft-form, #incident-description')).toHaveCount(0);
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  await expect(page.getByText(/Which local government area did this happen in/)).toBeVisible();
  await page.locator('#report-area').selectOption('efon');
  await expect(page.getByText(/Understood — Efon/)).toBeVisible();
  await page.getByRole('button', { name: 'No more details — continue' }).click();
  await expect(page.getByRole('heading', { name: 'Your private draft' })).toBeVisible();
  await expect(page.locator('.review-list')).toContainText(description);
  await expect(page.locator('.review-list')).toContainText('Efon');
  await page.getByRole('button', { name: 'Change LGA' }).click();
  await page.locator('#report-area').selectOption('ado-ekiti');
  await page.getByRole('button', { name: 'No more details — continue' }).click();
  await expect(page.locator('.review-list')).toContainText('Ado-Ekiti');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download private draft' }).click();
  expect((await download).suggestedFilename()).toBe('ekiti-private-report-draft.txt');
  await expect(page.getByText('Download prepared · Not submitted')).toBeVisible();
  await expect(page.getByText(/Nothing was submitted or assigned a tracking number/)).toBeVisible();
  expect(requests.some(url => url.includes('/api/reports'))).toBe(false);
  await expect(page.locator('.reference-text')).toHaveCount(0);
});

test('conversation remains private on this device and can be cleared', async ({ page }) => {
  await page.goto('/report/text-draft');
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.reload();
  await expect(page.getByText(description)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear private draft and conversation' }).click();
  await expect(page.getByText(description)).toHaveCount(0);
  await page.waitForTimeout(600);
  const stored = await page.evaluate(() => localStorage.getItem('ekiti-conversation-draft-v1'));
  expect(stored).not.toContain(description);
});

test('GPS is opt-in and server boundary check requires explicit confirmation', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(efon);
  let coordinatesSent = 0;
  page.on('request', request => { if (request.url().endsWith('/api/resolve')) coordinatesSent++; });
  await page.goto('/report/text-draft');
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  expect(coordinatesSent).toBe(0);
  await page.getByText('Optional: check a precise map location').click();
  await page.getByRole('button', { name: 'Use device GPS' }).click();
  await expect(page.getByText(/Position proposed. It has not been sent/)).toBeVisible();
  expect(coordinatesSent).toBe(0);
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.getByText(/Boundary match: Efon/)).toBeVisible();
  await expect(page.getByText(/Understood — Efon/)).toBeVisible();
  expect(coordinatesSent).toBe(1);
});

test('denied GPS leaves the conversation usable', async ({ page, context }) => {
  await context.grantPermissions([]);
  await page.goto('/report/text-draft');
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  await page.getByText('Optional: check a precise map location').click();
  await page.getByRole('button', { name: 'Use device GPS' }).click();
  await expect(page.getByText(/GPS denied or unavailable/)).toBeVisible({ timeout: 12000 });
  await page.locator('#report-area').selectOption('efon');
  await expect(page.getByText(/Understood — Efon/)).toBeVisible();
});

test('map remains a deliberate and lazy-loaded optional control', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', req => requests.push(req.url()));
  await page.goto('/report/text-draft');
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  expect(requests.some(url => /\/assets\/(map-|lga-)/.test(url))).toBe(false);
  await page.getByText('Optional: check a precise map location').click();
  await page.getByRole('button', { name: 'Open Ekiti map' }).click();
  await expect(page.locator('#map')).toBeVisible();
});

test('offline refresh restores the private report conversation when service worker controls the page', async ({ page, context }) => {
  await page.goto('/report/text-draft');
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const check = async () => {
        const paths = performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
          .filter(path => path.startsWith('/assets/') && path.endsWith('.js'));
        const hits = await Promise.all(paths.map(path => caches.match(path)));
        if (hits.length >= 2 && hits.every(Boolean)) return resolve();
        if (Date.now() - start > 12000) return reject(new Error('Public JS not cached'));
        setTimeout(check, 100);
      };
      void check();
    });
  });
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(description)).toBeVisible();
  } finally { await context.setOffline(false); }
});

test('Track is conversational and never accepts a fabricated real case', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', req => urls.push(req.url()));
  await page.goto('/track');
  await expect(page.getByRole('heading', { name: 'Check a report' })).toBeVisible();
  await expect(page.getByText(/there are no real cases to retrieve yet/)).toBeVisible();
  await page.locator('#tracking-message').fill('EKP-REAL-123456');
  await page.locator('.conversation-send').click();
  await expect(page.getByText(/I cannot look up or confirm any real report reference/)).toBeVisible();
  await page.getByRole('button', { name: 'Show a fictional tracking example' }).click();
  await expect(page.getByRole('heading', { name: 'Example timeline · not a real case' })).toBeVisible();
  await expect(page.locator('.case-timeline li')).toHaveCount(6);
  await expect(page.locator('.case-timeline li.event-recorded')).toHaveCount(0);
  expect(urls.some(url => /\/api\/reports|\/api\/tracking/.test(url))).toBe(false);
});

test('Yoruba toggle changes report prompts without silently translating citizens text', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'YOR' }).click();
  await page.goto('/report/text-draft');
  await expect(page.getByRole('heading', { name: 'Ṣàlàyé ohun tó ṣẹlẹ̀' })).toBeVisible();
  await expect(page.getByText(/Sọ ohun tó ṣẹlẹ̀ ní àdúgbò rẹ/)).toBeVisible();
  await page.locator('#report-message').fill(description);
  await page.locator('.conversation-send').click();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(/Ìjọba ìbílẹ̀ wo ni ìṣẹ̀lẹ̀ náà/)).toBeVisible();
});

for(const width of [280, 320, 360, 390, 428, 768]) {
  test('conversation UI does not overflow ' + width + 'px mobile or tablet', async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/report/text-draft');
    await expect(page.locator('#report-message')).toBeVisible();
    const metrics = await page.evaluate(() => {
      const composer = document.querySelector('.conversation-composer')!.getBoundingClientRect();
      const button = document.querySelector('.conversation-send')!.getBoundingClientRect();
      return { width: document.documentElement.scrollWidth, viewport: window.innerWidth,
        composerHeight: composer.height, buttonHeight: button.height };
    });
    expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.composerHeight).toBeGreaterThan(48);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
  });
}
