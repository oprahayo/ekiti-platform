import { test, expect } from '@playwright/test';

const allTradeNames = [
  'Plumbers','Hairdressers','Carpenters & Joiners','Electricians',
  'Cleaners','Painters','Locksmiths','Movers','Gardeners','Mechanics',
  'Builders','Roofers',
];

test('Explore shows the reference-inspired three-column yellow-accent category grid', async ({ page }) => {
  const api: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/places')) api.push(request.url()); });
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Browse Categories' })).toBeVisible();
  await expect(page.getByText('Find local businesses, services and places across Ekiti State.')).toBeVisible();
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await expect(page.locator('.directory-tile-icon')).toHaveCount(24);
  await expect(page.getByRole('searchbox', { name: 'Search services and places' })).toBeVisible();
  for (const name of allTradeNames) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const grid = await page.locator('.directory-grid').evaluate(element => {
    const computed = getComputedStyle(element);
    const columns = computed.gridTemplateColumns.split(' ');
    const tiles = Array.from(element.children).slice(0, 3).map(child => {
      const { x, y, width, height } = child.getBoundingClientRect();
      return { x, y, width, height };
    });
    return { columns, tiles, color: computed.backgroundColor };
  });
  expect(grid.columns).toHaveLength(3);
  expect(grid.tiles[0].y).toBe(grid.tiles[1].y);
  expect(grid.tiles[1].y).toBe(grid.tiles[2].y);
  expect(grid.tiles[0].x).toBeLessThan(grid.tiles[1].x);
  expect(grid.tiles[1].x).toBeLessThan(grid.tiles[2].x);
  expect(api).toHaveLength(0); // No unnecessary database request before selecting a filter.
});

for (const width of [280, 320, 360, 375, 390, 428, 768, 1024]) {
  test('category grid fits a ' + width + 'px device in three columns without overflow', async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/explore');
    await expect(page.locator('.directory-category-tile')).toHaveCount(24);
    const metrics = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.directory-category-tile')];
      const rectangles = tiles.map(element => element.getBoundingClientRect());
      const icon = document.querySelector('.directory-category-tile svg')!.getBoundingClientRect();
      return {
        columns: getComputedStyle(document.querySelector('.directory-grid')!).gridTemplateColumns.split(' ').length,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        tileWidths: rectangles.map(rect => rect.width),
        tileHeights: rectangles.map(rect => rect.height),
        iconWidth: icon.width,
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.columns).toBe(3);
    expect(Math.min(...metrics.tileWidths)).toBeGreaterThanOrEqual(65);
    expect(Math.min(...metrics.tileHeights)).toBeGreaterThanOrEqual(100);
    expect(metrics.iconWidth).toBeGreaterThanOrEqual(38);
  });
}

test('typing a service searches category names; choosing it reveals honest results', async ({ page }) => {
  await page.goto('/explore');
  await page.locator('#place-search').fill('plumber');
  await expect(page.locator('.directory-category-tile')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Plumbers' })).toBeVisible();
  await page.getByRole('button', { name: 'Plumbers' }).click();
  await expect(page.getByRole('button', { name: 'Plumbers' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/This service category is ready for browsing/)).toBeVisible();
  await expect(page.getByText('Nothing verified here yet')).toBeVisible();
  await expect(page.locator('.place-row')).toHaveCount(0);
  await page.getByRole('button', { name: /Browse all categories/ }).click();
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
});

test('search and category navigation show sample fixtures only as unverified previews', async ({ page }) => {
  await page.goto('/explore');
  await page.locator('#place-search').fill('school');
  await expect(page.getByRole('button', { name: 'Schools' })).toBeVisible();
  await page.getByRole('button', { name: 'Schools' }).click();
  await expect(page.getByRole('heading', { name: 'Sample layout preview' })).toBeVisible();
  await expect(page.getByText('Not verified')).toBeVisible();
  await expect(page.getByText('Example neighborhood school')).toBeVisible();
  await page.locator('#explore-lga').selectOption('ado-ekiti');
  await expect(page.getByText('Nothing verified here yet')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await expect(page.locator('#explore-lga')).toHaveValue('');
});

test('direct route from Ask to a hotel keeps LGA, category and honest empty state', async ({ page }) => {
  await page.goto('/ask');
  await page.locator('#ask-input').fill('Find hotels around Aribayo Ido-Ekiti');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator('#explore-lga')).toHaveValue('ido-osi');
  await expect(page.getByRole('button', { name: 'Hotels' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Nothing verified here yet')).toBeVisible();
});

test('verified listing response exposes source and allows directions only with vetted coordinates', async ({ page }) => {
  const id = '12345678-9abc-4def-8aaa-123456789abc';
  const item = {
    id, name: 'CI reviewed place example', category: 'Hotels', lga_id: 'ado-ekiti',
    description: 'Test record only; not a real hotel.', address_text: 'CI test area',
    contact_phone: null, website_url: 'https://example.org/', photo_url: null,
    latitude: 7.62, longitude: 5.22, owner_claim_state: 'unclaimed',
    source_url: 'https://www.ekitistate.gov.ng/', publisher: 'Test publisher',
    reviewed_at: '2026-11-10T12:00:00Z',
  };
  await page.route('**/api/places?**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      items: [item], reviewedOnly: true,
    }) }));
  await page.route('**/api/places/' + id, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      item, reviewedOnly: true,
    }) }));
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Hotels' }).click();
  await expect(page.getByRole('heading', { name: 'Reviewed directory entries' })).toBeVisible();
  await page.getByRole('link', { name: /CI reviewed place example/ }).click();
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  await expect(page.getByRole('link', { name: /Test publisher · View source/ })).toHaveAttribute('href', item.source_url);
  await expect(page.getByRole('link', { name: 'Open directions in Google Maps' }))
    .toHaveAttribute('href', /google\.com\/maps\/dir\//);
});

test('reviewed listing without vetted coordinates must not show map directions', async ({ page }) => {
  const id = '12345678-9abc-4def-8aaa-123456789abd';
  await page.route('**/api/places/' + id, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      reviewedOnly: true,
      item: {
        id, name: 'CI record without coordinates', category: 'Hotels', lga_id: 'ado-ekiti',
        description: 'Test record only', address_text: '',
        contact_phone: null, website_url: null, photo_url: null, latitude: null,
        longitude: null, owner_claim_state: 'unclaimed',
        source_url: 'https://www.ekitistate.gov.ng/', publisher: 'Test publisher',
        reviewed_at: '2026-11-10T12:00:00Z',
      },
    }) }));
  await page.goto('/places/' + id);
  await expect(page.getByRole('heading', { name: 'CI record without coordinates' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open directions in Google Maps' })).toHaveCount(0);
  await expect(page.getByText('Map directions are unavailable until exact coordinates are reviewed.')).toBeVisible();
});

test('light and dark themes keep category drawings and the shared civic accent', async ({ page }) => {
  await page.goto('/explore');
  const theme = await page.locator('.directory-page').evaluate(element => {
    const style = getComputedStyle(element);
    return {
      directory: style.getPropertyValue('--directory-yellow').trim(),
      civic: style.getPropertyValue('--accent').trim(),
    };
  });
  expect(theme.directory).toBe(theme.civic);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
