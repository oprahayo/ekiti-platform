import { test, expect } from '@playwright/test';

test('text-only chat homepage has three simple actions and an editable input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti Civic' })).toBeVisible();
  await expect(page.locator('.chat-intro-bubble')).toBeVisible();
  await expect(page.locator('.chat-quick-replies > *')).toHaveCount(3);
  await expect(page.locator('#home-ask-input')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect(page.locator('.voice-screen, .voice-mic, .audio-play')).toHaveCount(0);
  await page.locator('#home-ask-input').fill('How many local government areas?');
  await page.locator('#home-ask-input').press('Enter');
  await expect(page.locator('.chat-question')).toContainText('How many local government areas?');
  await expect(page.getByText(/16 local government areas/)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('reporting is a bubble conversation with a Send button instead of audio', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/report');
  await expect(page.locator('.conversation-turn.turn-assistant')).toBeVisible();
  await expect(page.locator('.conversation-composer textarea')).toBeVisible();
  await expect(page.locator('.conversation-send')).toHaveText('Send');
  await page.locator('#report-message').fill('My community bridge has collapsed near the main road.');
  await page.locator('#report-message').press('Enter');
  await expect(page.locator('.conversation-turn.turn-user')).toContainText('My community bridge has collapsed');
  await expect(page.getByText(/Which local government area did this happen in/)).toBeVisible();
  await expect(page.getByRole('button', { name: /voice|microphone|listen|audio|speak/i })).toHaveCount(0);
});

test('capture actual rendered mobile and desktop chat screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path:'test-results/citizen-chat/home-mobile.png', fullPage:true });
  await page.getByRole('link', { name:'Report a problem' }).click();
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
    composerWidth: document.querySelector('.ask-composer')?.getBoundingClientRect().width,
  }));
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.composerWidth).toBeGreaterThan(220);
  await page.screenshot({ path:'test-results/citizen-chat/home-280px.png', fullPage:true });
});
