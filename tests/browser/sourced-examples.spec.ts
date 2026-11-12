import {test,expect} from '@playwright/test';

const emptyResults = (query:string) => ({
  query,reviewedOnly:true,places:[],knowledge:[],
});

test('homepage search discovers an Ikogosi resort with original source, not a fake verified entry',async({page})=>{
  await page.route('**/api/search?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('q')||'';
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(emptyResults(query))});
  });
  await page.goto('/search?q=Hotels+in+Ikogosi');
  const section=page.getByRole('region',{name:'Source-confirmed Ekiti places'});
  await expect(section.getByRole('heading',{name:'Places with public source links'})).toBeVisible();
  await expect(section.locator('.sourced-place-example')).toHaveCount(1);
  await expect(section.getByRole('link',{name:'Ikogosi Warm Springs Resort'}))
    .toHaveAttribute('href','https://www.ikogosiresort.com/');
  await expect(section).toContainText('not approved Ekiti Civic directory entries');
  await expect(page.getByText(/0 reviewed results shown for/)).toBeVisible();
  await expect(page.locator('.search-results-list .search-result')).toHaveCount(0);
});

test('a reviewed directory entry suppresses an equivalent unreviewed example',async({page})=>{
  await page.route('**/api/search?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('q')||'';
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ...emptyResults(query),places:[{
        id:'12345678-9abc-4def-8aaa-123456789abc',
        name:'Federal Teaching Hospital, Ido-Ekiti',category:'Health',lga_id:'ido-osi',
        address_text:'Ido-Ekiti',description:'CI-only reviewed source fixture',
        source_url:'https://fethi.gov.ng/',publisher:'CI review',reviewed_at:'2026-11-12',
      }],
    })});
  });
  await page.goto('/search?q=hospital+in+Ido+Ekiti');
  await expect(page.getByRole('link',{name:'Federal Teaching Hospital, Ido-Ekiti'}))
    .toHaveAttribute('href','/places/12345678-9abc-4def-8aaa-123456789abc');
  await expect(page.locator('.sourced-place-example')).toHaveCount(0);
  await expect(page.getByText(/1 reviewed result shown for/)).toBeVisible();
});

test('Explore and universal results use identical source-backed data and locality filters',async({page})=>{
  await page.goto('/explore');
  await expect(page.locator('.sourced-place-examples-explore .sourced-place-example')).toHaveCount(6);
  await page.getByRole('button',{name:'Hospitals'}).click();
  await expect(page.locator('.sourced-place-examples-explore .sourced-place-example')).toHaveCount(2);
  await page.locator('.directory-manual-area summary').click();
  await page.locator('#explore-lga').selectOption('ido-osi');
  const section=page.getByRole('region',{name:'Source-confirmed Ekiti places'});
  await expect(section.getByRole('link',{name:'Federal Teaching Hospital, Ido-Ekiti'}))
    .toHaveAttribute('href','https://fethi.gov.ng/');
  await expect(section.locator('.sourced-place-example')).toHaveCount(1);
});

test('source examples do not fabricate reviewed listings when the API is unavailable',async({page})=>{
  await page.route('**/api/search?**',route=>route.fulfill({
    status:503,contentType:'application/json',body:'{"error":"offline"}',
  }));
  await page.goto('/search?q=Federal+University+Oye');
  await expect(page.getByText(/Verified search is temporarily unavailable/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Federal University Oye-Ekiti'}))
    .toHaveAttribute('href','https://fuoye.edu.ng/');
  await expect(page.locator('.search-results-list .search-result')).toHaveCount(0);
});

test('sources are not promoted for private report narratives or generic state queries',async({page})=>{
  await page.route('**/api/search?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('q')||'';
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(emptyResults(query))});
  });
  await page.goto('/search?q=my+report+about+Ikogosi+hotel');
  await expect(page.locator('.sourced-place-example')).toHaveCount(0);
  await page.goto('/search?q=Ekiti');
  await expect(page.locator('.sourced-place-example')).toHaveCount(0);
});

test('source-backed examples fit the narrowest viewport in light and dark themes',async({page})=>{
  await page.route('**/api/search?**',route=>{
    const query=new URL(route.request().url()).searchParams.get('q')||'';
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(emptyResults(query))});
  });
  for(const width of [280,320,390,1024]){
    await page.setViewportSize({width,height:780});
    await page.goto('/search?q=hospitals+in+Ado+Ekiti');
    await expect(page.getByRole('link',{name:'Ekiti State University Teaching Hospital'})).toBeVisible();
    const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  }
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByRole('link',{name:'Ekiti State University Teaching Hospital'})).toBeVisible();
});
