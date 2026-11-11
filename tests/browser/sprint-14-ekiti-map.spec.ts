import {test,expect} from '@playwright/test';

test('Explore opens interactive Ekiti boundaries without publishing fictional pins',async({page})=>{
  const external:string[]=[];
  page.on('request',r=>{
    if(/tile\.openstreetmap\.org|maps\.googleapis\.com/.test(r.url()))
      external.push(r.url());
  });
  await page.goto('/explore');
  await page.getByRole('button',{name:'View interactive Ekiti directory map'}).click();
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
  await page.getByRole('button',{name:'View interactive Ekiti directory map'}).click();
  await expect(page.getByRole('heading',{name:'Explore Ekiti on the map'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});
