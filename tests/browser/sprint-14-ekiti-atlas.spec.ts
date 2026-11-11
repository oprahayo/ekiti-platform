import {test,expect} from '@playwright/test';

test('Ekiti atlas loads with no incident marker or private report lookup',async({page})=>{
  let privateRequests=0,placeRequests=0;
  page.on('request',request=>{
    if(/api\/reports|api\/tracking|\/private\/|civic_my/.test(request.url()))privateRequests++;
    if(request.url().includes('/api/places'))placeRequests++;
  });
  await page.goto('/map');
  await expect(page.getByRole('heading',{name:'Explore Ekiti on the map'})).toBeVisible();
  await expect(page.locator('#map')).toBeVisible();
  expect(privateRequests).toBe(0);
  expect(placeRequests).toBe(0,'No reviewed directory fetch until deliberate search');
  await page.getByRole('button',{name:'Public reports'}).click();
  await expect(page.getByRole('heading',{name:'Privacy before publication'})).toBeVisible();
  await expect(page.getByText(/No report locations are published here yet/)).toBeVisible();
  expect(privateRequests).toBe(0);
});

test('directory pins require real reviewed place data and never use illustrative fixtures',async({page})=>{
  let requests=0;
  await page.route('**/api/places?**',async route=>{
    requests++;
    await route.fulfill({json:{reviewedOnly:true,items:[
      {id:'12345678-1234-4234-8234-123456789012',name:'Reviewed Test Clinic',
        category:'Health',lga_id:'ado-ekiti',publisher:'CI source',
        reviewed_at:'2026-11-10T12:00:00Z',latitude:7.62,longitude:5.22},
      {id:'22345678-1234-4234-8234-123456789012',name:'No verified position',
        category:'Hotel',lga_id:'ikere',publisher:'CI source',
        reviewed_at:'2026-11-10T12:00:00Z',latitude:null,longitude:null},
    ]}});
  });
  await page.goto('/map');
  expect(requests).toBe(0);
  await page.getByLabel('Local government area').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Show reviewed places'}).click();
  await expect(page.getByText(/1 reviewed place with coordinates on this map page/)).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.getByText(/Only reviewed business locations with validated coordinates are pinned/)).toBeVisible();
  await page.getByRole('button',{name:'Public reports'}).click();
  await expect(page.getByText(/No report locations are published here yet/)).toBeVisible();
});

test('incident map selection is optional and never calls the resolver until explicit confirmation',async({page})=>{
  let requests=0;
  await page.route('**/api/resolve',async route=>{
    requests++;
    await route.fulfill({json:{stateBoundaryStatus:'outside',
      lga:{status:'outside_scope',match:null,candidates:[]},
      ward:{status:'outside_scope',match:null,candidates:[]}}});
  });
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill(
    'Broken bridge approach near the market creates danger for road users.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Choose on Ekiti map'}).click();
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.getByText(/Tap only where the incident took place/)).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole('button',{name:'Check this incident point'})).toHaveCount(0);
  await page.getByRole('button',{name:'Choose on Ekiti map'}).click();
  await expect(page.locator('#map')).toHaveCount(0);
  expect(requests).toBe(0);
});
test('280px atlas remains usable and does not overflow',async({page})=>{
  await page.setViewportSize({width:280,height:760});
  await page.goto('/map');
  await expect(page.getByRole('heading',{name:'Explore Ekiti on the map'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
});
