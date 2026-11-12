import {test,expect} from '@playwright/test';

const one={
  id:'12345678-9abc-4def-8aaa-123456789abc',
  name:'CI nearby reviewed clinic',category:'Health',lga_id:'ado-ekiti',
  address_text:'CI-only street',publisher:'Reviewed test source',
  source_url:'https://example.org/reviewed-1',distance_km:0.9,
};
const two={
  ...one,id:'12345678-9abc-4def-8aaa-123456789abd',
  name:'CI second nearby clinic',distance_km:5.2,
  source_url:'https://example.org/reviewed-2',
};
const response=(items=[one,two],status='ready',radiusKm=25)=>({
  items,reviewedOnly:true,order:'distance',status,radiusKm,
});
test('Sprint 08 starts with the unchanged 24 categories, no GPS prompt and no automatic nearby request',async({page})=>{
  const requests=[];
  page.on('request',r=>{if(r.url().includes('/api/places/nearby'))requests.push(r.url());});
  await page.goto('/explore');
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await expect(page.getByRole('searchbox',{name:'Search services and places'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Find nearby places by distance'})).toBeVisible();
  await page.locator('.directory-nearby-explanation summary').click();
  await expect(page.getByText(/filters by verified LGA, not distance/)).toBeVisible();
  await expect(page.getByText(/Only reviewed, geocoded listings can appear/)).toBeVisible();
  expect(requests).toEqual([]);
});

test('explicit nearby click shows two reviewed, distance-sorted records with source and filters',async({page,context})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:7.625,longitude:5.245});
  const calls=[];
  await page.route('**/api/places/nearby',async route=>{
    calls.push({
      url:route.request().url(),
      method:route.request().method(),
      payload:JSON.parse(route.request().postData()||'{}'),
    });
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(response([one,two],'ready',
        JSON.parse(route.request().postData()||'{}').radiusKm))});
  });
  await page.goto('/explore');
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByRole('heading',{name:'Reviewed places nearby'})).toBeVisible();
  await expect(page.getByRole('link',{name:'CI nearby reviewed clinic'})).toBeVisible();
  await expect(page.getByRole('link',{name:'CI second nearby clinic'})).toBeVisible();
  const names=await page.locator('.directory-nearest-title').allTextContents();
  expect(names).toEqual([one.name,two.name]);
  await expect(page.locator('.directory-nearest-distance').first()).toContainText('~0.9 km');
  await expect(page.locator('.directory-nearest-distance').last()).toContainText('~5.2 km');
  await expect(page.getByRole('link',{name:'Reviewed test source'}).first())
    .toHaveAttribute('href','https://example.org/reviewed-1');
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].url).not.toContain('7.625');
  expect(calls[0].payload).toEqual({
    latitude:7.625,longitude:5.245,confirmed:true,
    category:null,lga:null,q:null,radiusKm:25,limit:20,
  });
  await page.locator('#nearby-radius').selectOption('10');
  await expect(page.getByRole('heading',{name:'Reviewed places nearby'})).toHaveCount(0);
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByRole('heading',{name:'Reviewed places nearby'})).toBeVisible();
  expect(calls[1].payload.radiusKm).toBe(10);
});

test('category and LGA selection carry across the explicit nearby lookup and reset stale results',async({page,context})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:7.625,longitude:5.245});
  const submitted=[];
  await page.route('**/api/places/nearby',async route=>{
    submitted.push(JSON.parse(route.request().postData()||'{}'));
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(response([one]))});
  });
  await page.goto('/explore');
  await page.getByRole('button',{name:'Hospitals'}).click();
  await page.locator('.directory-manual-area summary').click();
  await page.locator('#explore-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByRole('link',{name:one.name})).toBeVisible();
  expect(submitted).toHaveLength(1);
  expect(submitted[0].category).toBe('Health');
  expect(submitted[0].lga).toBe('ado-ekiti');
  await page.locator('#explore-lga').selectOption('ikere');
  await expect(page.getByRole('heading',{name:'Reviewed places nearby'})).toHaveCount(0);
  await expect(page.locator('.directory-category-tile')).toHaveCount(1);
});

test('outside-Ekiti and uncertain-coverage states do not claim any nearby matches',async({page,context})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:41.4,longitude:2.1});
  await page.route('**/api/places/nearby',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(response([],'outside_ekiti')),
  }));
  await page.goto('/explore');
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByText(/Your device appears outside Ekiti State/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Reviewed places nearby'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Hotels',exact:true})).toBeVisible();
  await page.unroute('**/api/places/nearby');
  await page.route('**/api/places/nearby',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(response([],'uncertain_coverage')),
  }));
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByText(/cannot be matched confidently/)).toBeVisible();
});

test('unreviewed or unsorted payloads and disabled API fail without misleading results',async({page,context})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:7.6,longitude:5.2});
  await page.route('**/api/places/nearby',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({...response([one]),reviewedOnly:false}),
  }));
  await page.goto('/explore');
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByText(/Verified distance search is not available here/)).toBeVisible();
  await expect(page.getByRole('link',{name:one.name})).toHaveCount(0);
  await page.unroute('**/api/places/nearby');
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByText(/Verified distance search is not available here/)).toBeVisible();
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
});

test('nearby search stays usable at 280px without overflowing or adding a dashboard',async({page,context})=>{
  await page.setViewportSize({width:280,height:720});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:7.625,longitude:5.245});
  await page.route('**/api/places/nearby',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(response([one])),
  }));
  await page.goto('/explore');
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await page.getByRole('button',{name:'Find nearby places by distance'}).click();
  await expect(page.getByRole('heading',{name:'Reviewed places nearby'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.screenshot({path:'test-results/sprint-08-review/explore-nearby-280.png',fullPage:true});
});

test('unclassified trades never return unrelated hotels or other nearby records',async({page})=>{
  const calls=[];
  page.on('request',request=>{
    if(request.url().includes('/api/places/nearby'))calls.push(request.url());
  });
  await page.goto('/explore');
  await page.getByRole('button',{name:'Plumbers',exact:true}).click();
  await expect(page.getByText(/no reviewed directory classification yet/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Find nearby places by distance'})).toBeDisabled();
  expect(calls).toEqual([]);
  await page.getByRole('button',{name:/Browse all categories/}).click();
  await expect(page.getByRole('button',{name:'Find nearby places by distance'})).toBeEnabled();
});
