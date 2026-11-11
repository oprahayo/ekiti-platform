import {test,expect} from '@playwright/test';

const place={
  id:'12345678-9abc-4def-8aaa-123456789abc',name:'CI reviewed Ekiti hotel',
  category:'Hotels',lga_id:'ado-ekiti',description:'Verified record fixture for browser tests.',
  address_text:'Ado-Ekiti',source_url:'https://example.org/listing',
  publisher:'Test source',reviewed_at:'2026-11-11T00:00:00Z',
};
const knowledge={
  id:'12345678-9abc-4def-8aaa-123456789abd',title:'Ekiti public information fixture',
  summary_en:'A short, source-backed browser fixture, not a real civic claim.',
  subject:'tourism',framing:'source_claim',source_url:'https://example.org/article',
  publisher:'Test publisher',published_on:'2026-11-11',
};

test('home universal search opens reviewed, source-linked results, not illustrative entries',async({page})=>{
  await page.route('**/api/search?**',async route=>{
    const url=new URL(route.request().url());
    expect(url.searchParams.get('q')).toBe('hotel in Ekiti');
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({query:'hotel in Ekiti',reviewedOnly:true,
        places:[place],knowledge:[knowledge]})});
  });
  await page.goto('/');
  await page.locator('#ekiti-home-search').fill('hotel in Ekiti');
  await page.getByRole('button',{name:'Search Ekiti'}).click();
  await expect(page).toHaveURL(/\/search\?q=hotel\+in\+Ekiti/);
  await expect(page.getByRole('heading',{name:'Search Ekiti'})).toBeVisible();
  await expect(page.getByRole('link',{name:place.name})).toHaveAttribute('href','/places/'+place.id);
  await expect(page.getByRole('link',{name:knowledge.title})).toHaveAttribute('href',knowledge.source_url);
  await expect(page.getByText('2 reviewed results shown for “hotel in Ekiti”')).toBeVisible();
  await expect(page.getByText(/Sample layout preview/)).toHaveCount(0);
});

test('desktop results use desktop width, while narrow mobile remains overflow-free',async({page})=>{
  await page.route('**/api/search?**',route=>route.fulfill({status:200,
    contentType:'application/json',body:JSON.stringify({
      query:'Ekiti',reviewedOnly:true,places:[],knowledge:[],
    })}));
  for(const width of [320,390,1024,1440,1920]){
    await page.setViewportSize({width,height:900});
    await page.goto('/search?q=Ekiti');
    await expect(page.getByText(/No reviewed result matches yet/)).toBeVisible();
    const layout=await page.evaluate(()=>{
      const shell=document.querySelector('.app-shell')!.getBoundingClientRect();
      const main=document.querySelector('.search-results-page')!.getBoundingClientRect();
      return {scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,
        shellWidth:shell.width,mainWidth:main.width};
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(width);
    if(width>=1024){
      expect(layout.shellWidth).toBeGreaterThanOrEqual(width-2);
      expect(layout.mainWidth).toBeGreaterThan(740);
    }
  }
});

test('search failure never fabricates results or a successful lookup',async({page})=>{
  await page.route('**/api/search?**',route=>route.fulfill({status:503,
    contentType:'application/json',body:'{"error":"Service temporarily unavailable"}'}));
  await page.goto('/search?q=hotel');
  await expect(page.getByText(/Verified search is temporarily unavailable/)).toBeVisible();
  await expect(page.locator('.search-result')).toHaveCount(0);
});
