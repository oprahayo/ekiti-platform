import {test,expect} from '@playwright/test';

test('Explore opens one interactive Ekiti map without publishing fictional pins',async({page})=>{
  const external:string[]=[];
  page.on('request',r=>{
    if(/tile\.openstreetmap\.org|maps\.googleapis\.com/.test(r.url()))
      external.push(r.url());
  });
  await page.goto('/explore');
  await expect(page.locator('.directory-review-map-canvas')).toBeVisible();
  const map=page.getByRole('region',{name:'Reviewed Ekiti directory map'});
  await expect(map.getByRole('heading',{name:'Explore Ekiti on the map'})).toBeVisible();
  await expect(map.getByText(/independently reviewed places pinned/)).toBeVisible();
  await expect(map.getByText(/Sample directory entries are never pinned/)).toBeVisible();
  await expect(map.getByText(/does not show private incident points/)).toBeVisible();
  expect(external).toEqual([]);
});

test('directory map remains available at 320px with privacy-safe empty state',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/explore');
  await expect(page.locator('.directory-review-map-canvas')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Explore Ekiti on the map'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});


test('incident map is optional and never requests private boundary resolution until explicit confirmation',async({page})=>{
  let resolveCalls=0;
  page.on('request',request=>{
    if(request.url().includes('/api/resolve'))resolveCalls++;
  });
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill('A dangerous roadside ditch needs attention near the community market.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Choose on Ekiti map'}).click();
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.getByText(/Your selected point stays in memory/)).toBeVisible();
  expect(resolveCalls).toBe(0);
  await page.getByRole('button',{name:'Choose on Ekiti map'}).click();
  await expect(page.locator('#map')).toHaveCount(0);
  expect(resolveCalls).toBe(0);
});
