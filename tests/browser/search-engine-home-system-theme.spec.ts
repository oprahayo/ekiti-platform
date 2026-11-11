import {test,expect} from '@playwright/test';

test('System follows device light/dark changes until a manual override is chosen',async({page})=>{
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
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('report intent is private and does not leak into the public search URL or APIs',async({page})=>{
  const requests:string[]=[];
  page.on('request',req=>{if(/\/api\/(search|ask)/.test(req.url()))requests.push(req.url());});
  await page.goto('/');
  await page.locator('#ekiti-home-search').fill(
    'I want to report a damaged bridge beside a public market in Iludun Ekiti.');
  await page.getByRole('button',{name:'Search Ekiti',exact:true}).last().click();
  await expect(page).toHaveURL(/\/report$/);
  expect(page.url()).not.toContain('damaged+bridge');
  expect(requests).toHaveLength(0);
});

test('menu opens directory map only on request and keeps ordinary browsing accessible',async({page})=>{
  const requests:string[]=[];
  page.on('request',req=>requests.push(req.url()));
  await page.goto('/');
  expect(requests.some(url=>/maplibre|lga-/.test(url))).toBe(false);
  await page.getByLabel('Open Ekiti Civic menu').click();
  await page.locator('.civic-products-panel').getByRole('link',{name:/Ekiti map/}).click();
  await expect(page).toHaveURL(/\/explore\?map=1$/);
  await expect(page.locator('.directory-review-map-canvas')).toBeVisible();
  await expect(page.getByText(/16 local government boundaries/)).toBeVisible();
});

test('no geolocation permission requested on first load or search',async({page})=>{
  const calls:string[]=[];
  page.on('request',req=>{if(req.url().includes('/api/resolve'))calls.push(req.url());});
  await page.goto('/');
  await expect(page.getByRole('searchbox',{name:'Search Ekiti State'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Use my location'})).toHaveCount(0);
  await page.locator('#ekiti-home-search').fill('Hotels in Ikogosi');
  await page.getByRole('button',{name:'Search Ekiti',exact:true}).last().click();
  await expect(page).toHaveURL(/\/search\?q=Hotels/);
  expect(calls).toHaveLength(0);
});

test('desktop home fills viewport while search content remains centered',async({page})=>{
  for(const width of [280,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    const sizes=await page.evaluate(()=>{
      const shell=document.querySelector('.app-shell')!.getBoundingClientRect();
      const box=document.querySelector('.gateway-search-field')!.getBoundingClientRect();
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
        shell:shell.width,field:box.width};
    });
    expect(sizes.scroll).toBeLessThanOrEqual(width);
    if(width>=1024)expect(sizes.shell).toBeGreaterThanOrEqual(width-2);
    expect(sizes.field).toBeGreaterThan(220);
    expect(sizes.field).toBeLessThanOrEqual(780);
  }
});
