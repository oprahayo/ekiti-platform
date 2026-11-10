import { test, expect } from '@playwright/test';

test('English/Yoruba toggle updates centered welcome and persists across reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti Civic' })).toBeVisible();
  await expect(page.getByText('Your mobile gateway to Ekiti State')).toBeVisible();
  await expect(page.locator('.home-actions > *')).toHaveCount(3);
  await page.getByRole('button', { name: 'YOR' }).click();
  await expect(page.getByRole('heading', { name: 'Káàbọ̀ sí Ekiti Civic' })).toBeVisible();
  await expect(page.getByText('Ẹnu ọ̀nà rẹ sí Ìpínlẹ̀ Èkìtì')).toBeVisible();
  await expect(page.getByRole('button', { name: 'YOR' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Káàbọ̀ sí Ekiti Civic' })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti Civic' })).toBeVisible();
});

test('theme icon switches instantly without opening a settings panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.settings-panel')).toHaveCount(0);
});

test('rotating prompts are static under reduced motion and do not affect accessible search', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Ask about Ekiti' }))
    .toHaveAttribute('placeholder', 'Ask me anything about Ekiti…');
  await page.getByRole('searchbox', { name: 'Ask about Ekiti' }).click();
  await expect(page).toHaveURL(/\/ask/);
});

test('English chat returns citations, an answer and an opt-in audio control', async ({ page }) => {
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Who is the governor of Ekiti?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Biodun Oyebanji was inaugurated/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Gov. Oyebanji’s second-term inauguration/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play answer audio' })).toBeVisible();
  await expect(page.getByText(/not a full generative AI conversation/)).toBeVisible();
});

test('Yoruba chat returns readable Yoruba answer and a source link', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'YOR' }).click();
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Mélòó ni ìjọba ìbílẹ̀ Èkìtì?');
  await page.locator('#ask-input').press('Enter');
  await expect(page.getByText(/Ìpínlẹ̀ Èkìtì ní ìjọba ìbílẹ̀/)).toBeVisible();
  await expect(page.getByRole('link', { name: /government overview and local governments/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ka ìdáhùn náà sókè' }).click();
  await expect(page.locator('.chat-answer [role="status"]')).toContainText(/Yoruba voice|À ń ka|Audio/);
});

test('unknown question fails honestly without invented source citations', async ({ page }) => {
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Can you predict a private court ruling?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/cannot verify an answer/)).toBeVisible();
  await expect(page.locator('.answer-sources a')).toHaveCount(0);
});

for (const width of [280, 320, 360, 390, 428]) {
  test('bilingual home remains single-column without overflow at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 670 });
    await page.goto('/');
    await page.getByRole('button', { name: 'YOR' }).click();
    const measure = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      theme: document.querySelector('.theme-switch')?.getBoundingClientRect().height,
      ask: document.querySelector('.ask-bar')?.getBoundingClientRect().height,
    }));
    expect(measure.document).toBeLessThanOrEqual(measure.viewport);
    expect(measure.theme).toBeGreaterThanOrEqual(44);
    expect(measure.ask).toBeGreaterThanOrEqual(44);
  });
}
