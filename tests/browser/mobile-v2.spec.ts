import { test, expect } from '@playwright/test';

test('Home offers five task-first civic actions instead of launching directly into chat', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti Civic' })).toBeVisible();
  await expect(page.locator('.welcome-action')).toHaveCount(5);
  await expect(page.getByRole('link', { name: /Ask about Ekiti/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Report an issue/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Post a listing/ })).toBeVisible();
  await expect(page.getByText(/Real submissions, official receipts and public case publication are not enabled yet/)).toBeVisible();
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
      const action = document.querySelector('.welcome-action')!.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        navItems,
        actionHeight: action.height,
      };
    });
    expect(result.scrollWidth, 'No horizontal scrolling').toBeLessThanOrEqual(result.innerWidth);
    expect(result.actionHeight).toBeGreaterThanOrEqual(44);
    result.navItems.forEach(item => {
      expect(item.height).toBeGreaterThanOrEqual(44);
      expect(item.width).toBeGreaterThanOrEqual(44);
    });
  });
}

test('five-tab navigation supports direct deep links', async ({ page }) => {
  for (const [path, heading] of [
    ['/ask', 'Ask anything about Ekiti'],
    ['/explore', 'Browse Categories'],
    ['/report', 'Report an issue'],
    ['/track', 'Check a report'],
    ['/scores', 'Public response'],
    ['/profile', 'Citizen Profile'],
    ['/track/DEMO-EKP-2026-00001', 'Check a report'],
    ['/places/demo-health-1', 'Sample community health center'],
  ]) {
    await page.goto(path);
    if (path === '/report') await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
    else await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('Welcome gateway opens a separate source-backed question conversation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Ask about Ekiti/ }).click();
  await expect(page).toHaveURL(/\/ask$/);
  const input = page.locator('#ask-input');
  await input.fill('How many local government areas?');
  await input.press('Enter');
  await expect(page.getByText(/16 local government areas/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Ekiti State — government overview/ })).toBeVisible();
})

test('Explore filters survive tab changes; all data is identified as demo', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Browse Categories' })).toBeVisible();
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await page.locator('#place-search').fill('school');
  await page.getByRole('button', { name: 'Schools' }).click();
  await expect(page.locator('.place-row')).toHaveCount(1);
  await expect(page.getByText('Example neighborhood school')).toBeVisible();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page.locator('#place-search')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Sample layout preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schools' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /Example neighborhood school/ }).click();
  await expect(page.getByText(/This is a fictional directory example/)).toBeVisible();
});

test('Explore does not load map assets unless explicitly requested', async ({ page }) => {
  const resources: string[] = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('/explore');
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await expect(page.locator('.place-row')).toHaveCount(0);
  expect(resources.some(url => /\/assets\/(map-|lga-)/.test(url))).toBe(false);
  await page.getByRole('button', { name: 'View interactive Ekiti directory map' }).click();
  await expect(page.locator('.directory-review-map-canvas')).toBeVisible();
  await expect(page.getByText('Sample directory entries are never pinned as real locations.')).toBeVisible();
});

test('Scores show the denominator and a negative metric without implying real outcomes', async ({ page }) => {
  await page.goto('/scores');
  await expect(page.getByText('Reports filed')).toBeVisible();
  await expect(page.getByText('No response after 30 days')).toBeVisible();
  await expect(page.getByText(/Example denominator: 120 fictional reports/)).toBeVisible();
  await page.getByRole('button', { name: 'Open data & API' }).click();
  await expect(page.getByText(/Public data and an API have not launched/)).toBeVisible();
});

test('fictional tracking deep link never requires a fake token or claims official activity', async ({ page }) => {
  await page.goto('/track/DEMO-EKP-2026-00001');
  await expect(page.getByRole('heading', { name: 'Example timeline · not a real case' })).toBeVisible();
  await expect(page.locator('.case-timeline li')).toHaveCount(6);
  await expect(page.locator('.case-timeline li.event-recorded')).toHaveCount(0);
  await expect(page.getByText('Not independently verified')).toBeVisible();
  await expect(page.locator('#tracking-token')).toHaveCount(0);
});

test('theme toggle works, independent of system settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('there are no voice or audio controls on citizen chat routes', async ({ page }) => {
  for(const path of ['/', '/ask', '/report', '/track']) {
    await page.goto(path);
    await expect(page.getByRole('button',{name:/Open voice mode|microphone|listen to answer|speech recognition/i})).toHaveCount(0);
  }
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

test('browser speech support never opens voice UI', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { SpeechRecognition:unknown }).SpeechRecognition=class {};
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Open voice mode'})).toHaveCount(0);
  await page.getByRole('link', { name: /Ask about Ekiti/ }).click();
  await page.locator('#ask-input').fill('Hello from the text chat');
  await expect(page.locator('#ask-input')).toHaveValue('Hello from the text chat');
});

