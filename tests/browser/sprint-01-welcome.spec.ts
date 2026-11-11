import { test, expect } from '@playwright/test';

const actions = [
  ['/report', 'Report an issue'],
  ['/report?kind=feedback', 'Give feedback'],
  ['/explore', 'Explore Ekiti'],
  ['/listings/new', 'Post a listing'],
  ['/ask', 'Ask about Ekiti'],
];

for (const width of [280, 320, 390, 768, 1280]) {
  test('Sprint 01: centred welcome, spacious sections and compact actions at '+width+'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name:'Welcome to Ekiti Civic' })).toBeVisible();
    await expect(page.getByText('Your mobile gateway to Ekiti State.')).toBeVisible();
    await expect(page.getByRole('heading', { name:'What would you like to do?' })).toBeVisible();
    await expect(page.locator('.welcome-action')).toHaveCount(5);

    const measurements = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error('Missing: '+selector);
        return element.getBoundingClientRect();
      };
      const app=rect('.app-shell');
      const header=rect('.app-header');
      const heading=rect('.welcome-heading');
      const headline=rect('#welcome-title');
      const subtitle=rect('.welcome-subtitle');
      const prompt=rect('#welcome-task-heading');
      const grid=rect('.welcome-action-list');
      const items=[...document.querySelectorAll('.welcome-action')].map(item => item.getBoundingClientRect());
      const columns=getComputedStyle(document.querySelector('.welcome-action-list')!).gridTemplateColumns.trim().split(/\s+/).length;
      return {
        viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
        headerToHero:heading.top-header.bottom,
        headlineCenter:headline.left+headline.width/2,
        appCenter:app.left+app.width/2,
        subtitleCenter:subtitle.left+subtitle.width/2,
        promptCenter:prompt.left+prompt.width/2,
        heroToPrompt:prompt.top-subtitle.bottom,
        promptToButtons:grid.top-prompt.bottom,
        items:items.map(box=>({width:box.width,height:box.height})),
        columns,
      };
    });

    expect(measurements.documentWidth).toBeLessThanOrEqual(measurements.viewport);
    expect(measurements.headerToHero).toBeGreaterThanOrEqual(30);
    expect(measurements.heroToPrompt).toBeGreaterThanOrEqual(27);
    expect(measurements.promptToButtons).toBeGreaterThanOrEqual(12);
    for (const center of ['headlineCenter','subtitleCenter','promptCenter'] as const)
      expect(Math.abs(measurements[center]-measurements.appCenter)).toBeLessThanOrEqual(7);
    expect(measurements.columns).toBe(6);
    for (const item of measurements.items) {
      expect(item.height).toBeGreaterThanOrEqual(48);
      expect(item.height).toBeLessThanOrEqual(135);
      expect(item.width).toBeGreaterThanOrEqual(65);
    }
    await expect(page.locator('.app-header .wordmark')).toBeVisible();
    await expect(page.locator('.app-header .header-profile-link')).toHaveCount(1);
    if ([280, 390, 1280].includes(width))
      await page.screenshot({path:'test-results/sprint-01-welcome/home-'+width+'.png',fullPage:true});
  });
}

test('Sprint 01: all five icon-led actions launch their existing workflows', async ({ page }) => {
  await page.goto('/');
  for (const [route, title] of actions) {
    const link=page.locator('.welcome-action[href="'+route+'"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText(title);
  }
  await page.getByRole('link',{name:/Report an issue/}).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
  await page.goto('/');
  await page.getByRole('link',{name:/Explore Ekiti/}).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole('heading',{name:'Browse Categories'})).toBeVisible();
});

test('Sprint 01: keyboard, dark mode and Yoruba heading remain usable', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await expect(page.getByRole('heading',{name:'Welcome to Ekiti Civic'})).toBeVisible();
  const colors=await page.locator('.welcome-action').first().evaluate(element=>{
    const css=getComputedStyle(element);
    return {background:css.backgroundColor,color:css.color};
  });
  expect(colors.background).not.toEqual(colors.color);
  await page.getByRole('button',{name:'YOR'}).click();
  await expect(page.getByRole('heading',{name:'Káàbọ̀ sí Ekiti Civic'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Kí ni o fẹ́ ṣe lónìí?'})).toBeVisible();
  await page.locator('.welcome-action').first().focus();
  await expect(page.locator('.welcome-action').first()).toBeFocused();
});
