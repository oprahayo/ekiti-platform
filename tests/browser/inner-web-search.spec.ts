import {test,expect} from '@playwright/test';

test('Wider web requires a user click and labels external results accurately',async({page})=>{
  let requests=0;
  await page.route('**/api/search?**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({query:'Ekiti history',reviewedOnly:true,places:[],knowledge:[]}),
  }));
  await page.route('**/api/web-search?**',route=>{
    requests++;
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({query:'Ekiti history',scope:'ekiti-public-web',
        provider:'Wikipedia',verifiedByEkitiCivic:false,
        results:[{title:'Ekiti State',description:'A Nigerian state',
          url:'https://en.wikipedia.org/wiki/Ekiti_State',domain:'en.wikipedia.org'}]})});
  });
  await page.goto('/search?q=Ekiti+history');
  await expect(page.getByRole('tab',{name:'Wider web'})).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole('tab',{name:'Wider web'}).click();
  expect(requests).toBe(0);
  await expect(page.getByRole('heading',{name:'Explore the wider web'})).toBeVisible();
  await page.getByRole('button',{name:'Find public web sources'}).click();
  await expect(page.getByRole('link',{name:'Ekiti State',exact:true}))
    .toHaveAttribute('href','https://en.wikipedia.org/wiki/Ekiti_State');
  await expect(page.getByText(/External pages are not independently verified/)).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.getByRole('link',{name:'Google Search'})).toHaveAttribute('href',/google.com/);
});
test('When no external provider is available, offer honest public search links',async({page})=>{
  await page.route('**/api/web-search?**',route=>route.fulfill({
    status:503,contentType:'application/json',body:'{"available":false}',
  }));
  await page.goto('/search?q=Hotels+in+Ekiti');
  await page.getByRole('tab',{name:'Wider web'}).click();
  await page.getByRole('button',{name:'Find public web sources'}).click();
  await expect(page.getByText(/not currently configured or is temporarily unavailable/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Brave Search'})).toBeVisible();
  await expect(page.locator('.search-web-result')).toHaveCount(0);
});
test('Digital products grid uses distinctive vector icons, no text glyph substitutes',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Open Ekiti Civic menu').click();
  await expect(page.locator('.civic-product-link')).toHaveCount(8);
  await expect(page.locator('.civic-product-glyph svg')).toHaveCount(8);
  await expect(page.locator('.civic-product-report .civic-product-glyph svg')).toBeVisible();
  await expect(page.locator('.civic-product-map .civic-product-glyph svg')).toBeVisible();
});
test('Inner pages have responsive universal search and full-width desktop shell',async({page})=>{
  for(const width of [280,320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto('/explore');
    await expect(page.getByRole('searchbox',{name:'Search across Ekiti'})).toBeVisible();
    const layout=await page.evaluate(()=>{
      const shell=document.querySelector('.app-shell')!.getBoundingClientRect();
      const bar=document.querySelector('.inner-universal-search')!.getBoundingClientRect();
      return {document:document.documentElement.scrollWidth,
        viewport:innerWidth,shell:shell.width,bar:bar.width};
    });
    expect(layout.document).toBeLessThanOrEqual(width);
    if(width>=1024)expect(layout.shell).toBeGreaterThanOrEqual(width-2);
    expect(layout.bar).toBeGreaterThan(180);
  }
});
test('Global inner search enters public lookup; private incident stays in report flow',async({page})=>{
  const requests=[];
  page.on('request',request=>{
    if(request.url().includes('/api/web-search'))requests.push(request.url());
  });
  await page.goto('/explore');
  await page.getByRole('searchbox',{name:'Search across Ekiti'}).fill('Hotels in Ikogosi');
  await page.getByRole('button',{name:'Search from this page'}).click();
  await expect(page).toHaveURL(/\/search\?q=Hotels\+in\+Ikogosi/);
  await page.goto('/explore');
  await page.getByRole('searchbox',{name:'Search across Ekiti'})
    .fill('I want to report a dangerous road in Iludun Ekiti');
  await page.getByRole('button',{name:'Search from this page'}).click();
  await expect(page).toHaveURL(/\/report$/);
  expect(requests).toEqual([]);
});
