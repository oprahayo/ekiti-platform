import { test, expect } from '@playwright/test';

test('Home prioritizes universal search instead of large card navigation',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Welcome to Ekiti Civic'})).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'Search Ekiti State'})).toBeVisible();
  await expect(page.getByLabel('Open Ekiti Civic menu')).toBeVisible();
  await expect(page.locator('.welcome-action,.feature-grid,.hero-art,.floating-card')).toHaveCount(0);
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.getByText(/Government report delivery and live submissions/)).toBeVisible();
});

for (const width of [280, 320, 360, 375, 390, 428, 768, 1024, 1440]) {
  test('search home fits '+width+'px without overflow',async({page})=>{
    await page.setViewportSize({width,height:800});
    await page.goto('/');
    const metrics=await page.evaluate(()=>{
      const search=document.querySelector('.gateway-search-field')!.getBoundingClientRect();
      const submit=document.querySelector('.gateway-inline-submit')!.getBoundingClientRect();
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
        inputWidth:search.width,submitWidth:submit.width};
    });
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.inputWidth).toBeGreaterThan(220);
    expect(metrics.submitWidth).toBeGreaterThanOrEqual(40);
  });
}

test('five-tab navigation supports direct deep links', async ({ page }) => {
  for (const [path, heading] of [
    ['/ask', 'Ask anything about Ekiti'],
    ['/explore', 'Explore Ekiti'],
    ['/report', 'Report an issue'],
    ['/track', 'Check a report'],
    ['/scores', 'Public response'],
    ['/profile', 'Citizen Profile'],
    ['/track/DEMO-EKP-2026-00001', 'Check a report'],
    ['/places/demo-health-1', 'Sample community health center'],
  ]) {
    await page.goto(path);
    if (path === '/report') await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
    else await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});

test('Homepage question uses one search surface and returns sourced Ekiti facts',async({page})=>{
  await page.goto('/');
  await page.locator('#ekiti-home-search').fill('How many local government areas?');
  await page.getByRole('button',{name:'Search Ekiti',exact:true}).last().click();
  await expect(page).toHaveURL(/\/search\?q=How\+many/);
  await expect(page.getByRole('heading',{name:'Answer from Ekiti sources'})).toBeVisible();
  await expect(page.getByText(/16 local government areas/).first()).toBeVisible();
});

test('Explore filters survive tab changes; all data is identified as demo', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore Ekiti', exact: true })).toBeVisible();
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

test('Explore opens one first-party LGA map with the categories, not a second hidden map', async ({ page }) => {
  const resources: string[] = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('/explore');
  await expect(page.locator('.directory-review-map-canvas')).toBeVisible();
  await expect(page.locator('.directory-review-map-canvas')).toHaveCount(1);
  await expect(page.locator('.directory-map-first-stage .directory-category-tile')).toHaveCount(24);
  await expect(page.locator('.place-row')).toHaveCount(0);
  await expect(page.getByText(/Sample directory entries are never pinned as real locations/)).toBeVisible();
  expect(resources.some(url => /tile\.openstreetmap\.org|maps\.googleapis\.com/.test(url))).toBe(false);
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

test('system theme follows OS changes and manual preferences override it',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'System',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
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

test('browser speech support never triggers microphone permission on the search page',async({page})=>{
  await page.addInitScript(()=>{
    (window as unknown as {SpeechRecognition:unknown}).SpeechRecognition=class {};
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Open voice mode'})).toHaveCount(0);
  await page.locator('#ekiti-home-search').fill('Ekiti history');
  await expect(page.locator('#ekiti-home-search')).toHaveValue('Ekiti history');
});
