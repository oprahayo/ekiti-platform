import { test, expect } from '@playwright/test';

test('first-visit home has five civic actions, close subtitle, no forum, and optional location', async ({page}) => {
  const locationCalls:string[]=[];
  page.on('request',request => {
    if (request.url().includes('/api/resolve')) locationCalls.push(request.postData() || '');
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Welcome to Ekiti Civic'})).toBeVisible();
  await expect(page.getByText('AN INDEPENDENT CIVIC PLATFORM')).toHaveCount(0);
  await expect(page.locator('.welcome-dice-list .welcome-action')).toHaveCount(5);
  await expect(page.getByRole('link',{name:/Community post/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Ask about Ekiti/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Use my location'})).toBeVisible();
  const gap=await page.evaluate(()=>{
    const title=document.querySelector('#welcome-title')!.getBoundingClientRect();
    const subtitle=document.querySelector('.welcome-subtitle')!.getBoundingClientRect();
    return subtitle.top-title.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(2);
  expect(gap).toBeLessThan(15);
  expect(locationCalls).toHaveLength(0);
  await page.getByRole('button',{name:'Not now'}).click();
  await expect(page.getByRole('button',{name:'Use my location'})).toHaveCount(0);
  expect(locationCalls).toHaveLength(0);
  await page.getByRole('link',{name:/Explore Ekiti/}).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole('heading',{name:'Browse Categories'})).toBeVisible();
});

test('consenting to nearby applies verified Ekiti LGA without saving coordinates', async ({page,context}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:7.677235411135371,longitude:4.943747799903621});
  const calls:string[]=[];
  page.on('request',request => {
    if(request.url().includes('/api/resolve')) calls.push(request.postData() || '');
  });
  await page.goto('/');
  expect(calls).toHaveLength(0);
  await page.getByRole('button',{name:'Use my location'}).click();
  await expect(page.getByText(/Showing verified Ekiti LGA results for Efon/)).toBeVisible();
  expect(calls).toHaveLength(1);
  await page.getByRole('link',{name:/Explore Ekiti/}).click();
  await expect(page.locator('#explore-lga')).toHaveValue('efon');
  await page.getByRole('button',{name:'Hotels'}).click();
  await expect(page.getByText(/Efon/).first()).toBeVisible();
  const stored=await page.evaluate(()=>JSON.stringify({...sessionStorage}));
  expect(stored).not.toContain('7.677');
  expect(stored).not.toContain('4.943');
});

test('outside Ekiti coverage is explicit without blocking browse', async ({page,context}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:41.386,longitude:2.169});
  await page.goto('/');
  await page.getByRole('button',{name:'Use my location'}).click();
  await expect(page.getByText(/outside Ekiti State/)).toBeVisible();
  await page.getByRole('link',{name:/Explore Ekiti/}).click();
  await expect(page.locator('#explore-lga')).toHaveValue('');
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await expect(page.getByText(/outside Ekiti State/)).toBeVisible();
});

test('Explore removes Yellow Pages branding, hides LGA selector, and fits compact tiles', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/explore');
  await expect(page.getByText(/EKITI YELLOW PAGES/)).toHaveCount(0);
  await expect(page.locator('.directory-mark')).toHaveCount(0);
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  const sizes=await page.evaluate(()=>{
    const search=document.querySelector('.directory-search')!.getBoundingClientRect();
    const near=document.querySelector('.directory-nearby')!.getBoundingClientRect();
    const card=document.querySelector('.directory-category-tile')!.getBoundingClientRect();
    return {
      yDiff:Math.abs(search.y-near.y),height:card.height,
      columns:getComputedStyle(document.querySelector('.directory-grid')!).gridTemplateColumns.split(' ').length,
      scroll:document.documentElement.scrollWidth,viewport:innerWidth,
    };
  });
  expect(sizes.yDiff).toBeLessThan(3);
  expect(sizes.height).toBeLessThanOrEqual(110);
  expect(sizes.columns).toBe(4);
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.viewport);
  await expect(page.locator('.directory-manual-area')).not.toHaveAttribute('open');
  await page.locator('.directory-manual-area summary').click();
  await page.locator('#explore-lga').selectOption('ikere');
  await expect(page.getByText(/Browsing Ikere by choice/)).toBeVisible();
});

test('report chat responds after typing and sound setting is genuinely optional', async ({page}) => {
  await page.goto('/report');
  await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
  await expect(page.locator('.chat-avatar')).toHaveCount(0);
  await expect(page.getByText(/Private preview/)).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Chat sounds off'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Chat sounds off'}).click();
  await expect(page.getByRole('button',{name:'Chat sounds on'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Video',exact:true}).click();
  await expect(page.getByLabel('Ekiti Civic is typing')).toBeVisible();
  await expect(page.getByText(/What best describes the report/)).toBeVisible();
  await page.getByRole('button',{name:'Security'}).click();
  await page.locator('#guided-description').fill('Someone damaged the security light near our estate last night.');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('button',{name:'Record on device'})).toBeVisible();
  await page.getByRole('button',{name:'Record on device'}).click();
  await expect(page.getByRole('button',{name:'Start video recording'})).toBeVisible();
  await expect(page.getByText(/not live-streamed, backed up, or sent to Ekiti Civic/)).toBeVisible();
  await page.getByRole('button',{name:'Upload existing file'}).click();
  await expect(page.getByLabel('Choose existing evidence')).toBeVisible();
});

test('emergency instructions are immediate, never delayed for typing animation', async ({page}) => {
  await page.goto('/report');
  await page.getByRole('button',{name:'Audio note'}).click();
  await page.getByRole('button',{name:'Emergency'}).click();
  await expect(page.getByText(/contact emergency services directly/)).toBeVisible();
  await expect(page.getByLabel('Ekiti Civic is typing')).toHaveCount(0);
});

test('visual review: home, report and compact Explore at 280, 390 and 1280px', async ({page}) => {
  for(const width of [280,390,1280]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    await expect(page.locator('.welcome-dice-list .welcome-action')).toHaveCount(5);
    await page.screenshot({path:'test-results/sprint-01-refinement/home-'+width+'.png',fullPage:true});
    await page.goto('/report');
    await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
    await page.screenshot({path:'test-results/sprint-01-refinement/report-'+width+'.png',fullPage:true});
    await page.goto('/explore');
    await expect(page.locator('.directory-category-tile')).toHaveCount(24);
    await page.screenshot({path:'test-results/sprint-01-refinement/explore-'+width+'.png',fullPage:true});
    const w=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(w).toBeLessThanOrEqual(width);
  }
});
