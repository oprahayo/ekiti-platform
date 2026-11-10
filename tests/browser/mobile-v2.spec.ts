import { test, expect } from '@playwright/test';

test('Home has exactly three primary interactive blocks and independent identity', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti' })).toBeVisible();
  await expect(page.locator('.home-actions > *')).toHaveCount(3);
  await expect(page.getByRole('searchbox', { name: 'Ask about Ekiti' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Report a problem/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore Ekiti/ })).toBeVisible();
  await expect(page.getByText('Independent civic project · Not a government service')).toBeVisible();
  await expect(page.locator('.feature-grid, .hero-art, .floating-card')).toHaveCount(0);
  await expect(page.locator('.bottom-nav .nav-item')).toHaveCount(5);
});

for (const width of [280, 320, 360, 375, 390, 428, 768, 1024, 1440]) {
  test('mobile UI fits ' + width + 'px without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const result = await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll('.bottom-nav .nav-item'))
        .map(element => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
      const ask = document.querySelector('.ask-bar')!.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        navItems,
        askHeight: ask.height,
      };
    });
    expect(result.scrollWidth, 'No horizontal scrolling').toBeLessThanOrEqual(result.innerWidth);
    expect(result.askHeight).toBeGreaterThanOrEqual(44);
    result.navItems.forEach(item => {
      expect(item.height).toBeGreaterThanOrEqual(44);
      expect(item.width).toBeGreaterThanOrEqual(44);
    });
  });
}

test('five-tab navigation supports direct deep links', async ({ page }) => {
  for (const [path, heading] of [
    ['/ask', 'What would you like to know?'],
    ['/explore', 'Explore Ekiti'],
    ['/report', 'What happened?'],
    ['/track', 'Follow a report'],
    ['/scores', 'Public response'],
    ['/track/DEMO-EKP-2026-00001', 'Follow a report'],
    ['/places/demo-health-1', 'Sample community health center'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('Ask is editable and clear about demo sources and uncertainty', async ({ page }) => {
  await page.goto('/');
  await page.locator('#home-ask-input').focus();
  await expect(page).toHaveURL(/\/ask/);
  const input = page.locator('#ask-input');
  await expect(input).toBeFocused();
  await input.fill('How many local government areas?');
  await input.press('Enter');
  await expect(page.getByText(/16 local government areas/)).toBeVisible();
  await expect(page.getByText(/Project geographic directory · staging data/)).toBeVisible();
  await expect(page.getByText('This is a preview, not a live AI answer.')).toBeVisible();
});

test('Explore filters survive tab changes; all data is identified as demo', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByText('Sample listings only. No place below is verified or accepting claims yet.')).toBeVisible();
  await page.locator('#place-search').fill('school');
  await page.getByRole('button', { name: 'Schools' }).click();
  await expect(page.locator('.place-row')).toHaveCount(1);
  await expect(page.getByText('Example neighborhood school')).toBeVisible();
  await page.getByRole('link', { name: 'Scores', exact: true }).click();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page.locator('#place-search')).toHaveValue('school');
  await expect(page.getByRole('button', { name: 'Schools' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /Example neighborhood school/ }).click();
  await expect(page.getByText('Do not use this demo listing to find real services or contact a business.')).toBeVisible();
});

test('Explore does not load map assets unless explicitly requested', async ({ page }) => {
  const resources: string[] = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('/explore');
  await expect(page.locator('.place-row')).toHaveCount(5);
  expect(resources.some(url => /\/assets\/(map-|lga-)/.test(url))).toBe(false);
  await page.getByRole('button', { name: /Map · more data/ }).click();
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.getByText('Illustrative places are not geocoded or pinned.')).toBeVisible();
});

test('Scores show the denominator and a negative metric without implying real outcomes', async ({ page }) => {
  await page.goto('/scores');
  await expect(page.getByText('Reports filed')).toBeVisible();
  await expect(page.getByText('No response after 30 days')).toBeVisible();
  await expect(page.getByText(/Example denominator: 120 fictional reports/)).toBeVisible();
  await page.getByRole('button', { name: 'Open data & API' }).click();
  await expect(page.getByText(/Public data and an API have not launched/)).toBeVisible();
});

test('Track requires a token, never puts it in a URL, and labels all events as examples', async ({ page }) => {
  await page.goto('/track/DEMO-EKP-2026-00001');
  await page.locator('#tracking-token').fill('DEMO-ONLY-NOT-VALID');
  await page.getByRole('button', { name: 'Check status' }).click();
  await expect(page.getByText('Demo case only')).toBeVisible();
  await expect(page.locator('.case-timeline li')).toHaveCount(6);
  await expect(page.getByText('Resolved — claimed')).toBeVisible();
  await expect(page.getByText('Not independently verified')).toBeVisible();
  expect(page.url()).not.toContain('DEMO-ONLY-NOT-VALID');
  await expect(page.locator('.case-timeline li.event-recorded')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview escalation' }).click();
  await expect(page.getByText('Demo only — no escalation request was sent.')).toBeVisible();
});

test('theme toggle works, independent of system settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Use dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Use light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('voice overlay opens and closes to editable text when browser supports it', async ({ page }) => {
  await page.goto('/');
  const mic = page.getByRole('button', { name: 'Open voice mode' });
  if (await mic.count() === 0) {
    await expect(mic).toHaveCount(0); // Unsupported browsers must hide the trigger.
    return;
  }
  await mic.click();
  await expect(page.getByRole('dialog', { name: 'Speak now' })).toBeVisible();
  await expect(page.locator('.voice-ripple')).toHaveCount(3);
  await page.getByRole('button', { name: 'Text always works — tap to type' }).click();
  await expect(page).toHaveURL(/\/ask/);
  await expect(page.locator('#ask-input')).toBeFocused();
});

test('initial Home requests are first-party only and skip map/speech bundles', async ({ page }) => {
  const resources: string[] = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('/');
  await page.waitForTimeout(300);
  for (const resource of resources) {
    expect(new URL(resource).origin).toBe(new URL(page.url()).origin);
  }
  expect(resources.some(url => /\/assets\/(map-|lga-|VoiceOverlay)/.test(url))).toBe(false);
});

test('voice closes to originating Home screen and falls back to typing after no speech', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = 'en-NG';
      interimResults = false;
      continuous = false;
      onresult: unknown = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() { window.setTimeout(() => this.onerror?.({ error: 'no-speech' }), 50); }
      abort() {}
    }
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open voice mode' }).click();
  await expect(page.getByRole('dialog', { name: 'Speak now' })).toBeVisible();
  await page.getByRole('button', { name: 'Close voice mode' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti' })).toBeVisible();
  await page.getByRole('button', { name: 'Open voice mode' }).click();
  await page.getByRole('button', { name: 'Start voice input' }).click();
  await expect(page.getByText("Didn't catch that")).toBeVisible();
  await page.getByRole('button', { name: 'Text always works — tap to type' }).click();
  await expect(page).toHaveURL(/\/ask/);
  await expect(page.locator('#ask-input')).toBeFocused();
});
