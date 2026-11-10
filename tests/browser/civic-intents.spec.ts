import { test, expect } from '@playwright/test';

test('a natural-language report request goes into private report chat and never the knowledge API', async ({ page }) => {
  const asks: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/api/ask')) asks.push(request.postData() || ''); });
  await page.goto('/ask');
  const narrative = 'I want to report a damaged footbridge near the market in Ido-Ekiti.';
  await page.locator('#ask-input').fill(narrative);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/report/);
  await expect(page.getByText(narrative)).toBeVisible();
  await expect(page.getByText(/Which local government area did this happen in/)).toBeVisible();
  expect(asks).toHaveLength(0);
});

test('hotel request routes to Explore without presenting fictional hotels as verified nearby results', async ({ page }) => {
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Find hotels near Aribayo, Ido-Ekiti');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator('#explore-lga')).toHaveValue('ido-osi');
  await expect(page.getByRole('button', { name: 'Hotels' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sample listings only. No place below is verified or accepting claims yet.')).toBeVisible();
  await expect(page.getByText('Nothing verified here yet')).toBeVisible();
  await expect(page.locator('.place-row')).toHaveCount(0);
});

test('tracking question routes into conversational status screen without any case API', async ({ page }) => {
  const api: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) api.push(request.url()); });
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Track my report status');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/track/);
  await expect(page.getByText(/there are no real cases to retrieve yet/)).toBeVisible();
  expect(api).toEqual([]);
});

test('factual questions continue to use cited, sourced answers', async ({ page }) => {
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Who is the governor of Ekiti?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Biodun Oyebanji was inaugurated/)).toBeVisible();
  await expect(page.locator('.answer-sources a').first()).toBeVisible();
});

test('a report microphone returns its transcript to the report composer, not Ask', async ({ page }) => {
  await page.addInitScript(() => {
    class Speech {
      lang = 'en-NG';
      interimResults = false;
      continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({
          results: { 0: { 0: { transcript: 'The damaged footbridge needs urgent attention in my area.' } } },
        }), 50);
      }
      abort() {}
    }
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = Speech;
  });
  await page.goto('/report');
  await page.getByRole('button', { name: 'Reply using microphone' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#report-message')).toHaveValue('The damaged footbridge needs urgent attention in my area.', { timeout: 5000 });
  await expect(page).toHaveURL(/\/report/);
});
