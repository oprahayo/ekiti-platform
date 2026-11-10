import { test, expect } from '@playwright/test';

const id = '12345678-9abc-4def-8aaa-123456789abc';
const listing = {
  id, name: 'CI reviewed plumbing test place', category: 'Hotels', lga_id: 'ado-ekiti',
  description: 'Testing only; no real business is represented.',
  address_text: 'CI address', contact_phone: '+2348034567890',
  website_url: 'https://example.org/', photo_url: null, latitude: 7.62, longitude: 5.22,
  owner_claim_state: 'unclaimed', source_url: 'https://www.ekitistate.gov.ng/',
  publisher: 'CI Publisher', reviewed_at: '2026-11-10T12:00:00Z',
};

for (const width of [280, 320, 360, 375, 390, 428, 768]) {
  test('sticky header and bottom navigation fit ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 660 });
    await page.goto('/explore');
    await expect(page.locator('.directory-category-tile')).toHaveCount(24);
    await expect(page.locator('.app-header')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const dimensions = await page.evaluate(() => {
      const header = document.querySelector('.app-header')!.getBoundingClientRect();
      const nav = document.querySelector('.bottom-nav')!.getBoundingClientRect();
      const links = Array.from(document.querySelectorAll('.bottom-nav a')).map(item => item.getBoundingClientRect().height);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        headerY: header.top,
        headerHeight: header.height,
        headerVisible: header.bottom > 0,
        navBottom: nav.bottom,
        navLinks: links,
      };
    });
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
    expect(dimensions.headerY).toBeGreaterThanOrEqual(-1);
    expect(dimensions.headerY).toBeLessThanOrEqual(1);
    expect(dimensions.headerHeight).toBeGreaterThanOrEqual(60);
    expect(dimensions.headerVisible).toBe(true);
    expect(dimensions.navBottom).toBeCloseTo(660, 0);
    for (const height of dimensions.navLinks) expect(height).toBeGreaterThanOrEqual(44);
  });
}

test('Yellow Pages has a warm-yellow hero and useful non-fabricated shortcuts', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.locator('.directory-hero')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Browse Categories' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Near me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add listing' })).toHaveAttribute('href', '/profile');
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await expect(page.locator('.place-row')).toHaveCount(0);
});

test('Near Me never transmits precise coordinates before a second confirmation', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 7.677235411135371, longitude: 4.943747799903621 });
  let coordinates = 0;
  page.on('request', req => { if (req.url().endsWith('/api/resolve')) coordinates++; });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Near me' }).click();
  await expect(page.getByText('Location proposed. Confirm before checking its LGA on the server.')).toBeVisible();
  expect(coordinates).toBe(0);
  await page.getByRole('button', { name: 'Confirm location and find LGA' }).click();
  await expect(page.getByText(/Showing results in Efon/)).toBeVisible();
  await expect(page.locator('#explore-lga')).toHaveValue('efon');
  expect(coordinates).toBe(1);
});

test('Profile uses guest identity, About modal, local counts and a path to Scores', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Citizen Profile' })).toBeVisible();
  await expect(page.getByText('Guest browsing · Your device only')).toBeVisible();
  await expect(page.getByRole('button', { name: /Saved listings: 0/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Unpublished review drafts: 0/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /About & Contact/ })).toBeVisible();
  await page.getByRole('button', { name: /About & Contact/ }).click();
  await expect(page.getByRole('dialog', { name: 'About Ekiti Civic' })).toBeVisible();
  await expect(page.getByText('Independent civic project · Not a government service', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: /Public Response Scores/ }).click();
  await expect(page).toHaveURL(/\/scores/);
});

test('Sign-in preview never collects passwords or misrepresents accounts', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign in or create an account' }).click();
  await expect(page.getByRole('dialog', { name: 'Sign in & Citizen Profile' })).toBeVisible();
  await expect(page.getByText(/Verified citizen sign-in is not active/)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reviewed listing supports local bookmarks and honest customer review drafts', async ({ page }) => {
  await page.route('**/api/places/' + id, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ reviewedOnly: true, item: listing }) }));
  await page.goto('/places/' + id);
  await expect(page.getByRole('heading', { name: listing.name })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+2348034567890');
  await expect(page.getByRole('link', { name: 'Open directions in Google Maps' }))
    .toHaveAttribute('href', /google\.com\/maps\/dir/);
  await page.getByRole('button', { name: 'Save this listing' }).click();
  await expect(page.getByRole('button', { name: 'Remove saved listing' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Reviews' }).click();
  await expect(page.getByText(/No public review feed or aggregate rating is connected yet/)).toBeVisible();
  await page.getByRole('button', { name: /Write a review/ }).click();
  await page.getByRole('button', { name: '5 stars' }).click();
  await page.locator('#directory-review-text').fill('A detailed experience written for browser testing only.');
  await page.getByRole('button', { name: 'Save private review draft' }).click();
  await expect(page.getByText(/Saved on this browser only/)).toBeVisible();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved listings: 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unpublished review drafts: 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Unpublished review drafts: 1' }).click();
  await expect(page.getByText('A detailed experience written for browser testing only.')).toBeVisible();
  await expect(page.getByText('Not published')).toBeVisible();
  await page.getByRole('button', { name: 'Delete local draft' }).click();
  await expect(page.getByText('No saved review drafts yet.')).toBeVisible();
});

test('unverified or illustrative listing cannot receive saved reviews or public ratings', async ({ page }) => {
  await page.goto('/places/demo-hotel-1');
  await expect(page.getByText(/fictional directory example/)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reviews' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save this listing' })).toHaveCount(0);
  await expect(page.locator('.directory-star-select')).toHaveCount(0);
});

test('owner claim opens a disclosure, not an unprotected KYC upload', async ({ page }) => {
  await page.route('**/api/places/' + id, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ reviewedOnly: true, item: { ...listing, contact_phone: null, latitude: null, longitude: null } }) }));
  await page.goto('/places/' + id);
  await page.getByRole('button', { name: 'Claim this listing' }).click();
  await expect(page.getByRole('dialog', { name: 'Claim this listing' })).toBeVisible();
  await expect(page.getByText(/No ownership documents or personal details/)).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
