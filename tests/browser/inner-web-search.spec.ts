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


test('Source highlights cite original links without claiming generated or verified answers',async({page})=>{
  await page.route('**/api/search?**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({query:'Ekiti tourism',reviewedOnly:true,places:[],knowledge:[]}),
  }));
  await page.route('**/api/web-search?**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({query:'Ekiti tourism',scope:'ekiti-public-web',
      provider:'Brave Search',verifiedByEkitiCivic:false,results:[
        {title:'Ikogosi Warm Springs',description:'Public visitor information about Ikogosi',
          url:'https://example.org/ikogosi',domain:'example.org'},
        {title:'Tourism in Ekiti',description:'Public overview of tourism in Ekiti State',
          url:'https://example.net/tourism',domain:'example.net'},
      ]}),
  }));
  await page.setViewportSize({width:320,height:760});
  await page.goto('/search?q=Ekiti+tourism');
  await page.getByRole('tab',{name:'Wider web'}).click();
  await expect(page.getByRole('heading',{name:'Source highlights'})).toHaveCount(0);
  await page.getByRole('button',{name:'Find public web sources'}).click();
  await expect(page.getByRole('heading',{name:'Source highlights'})).toBeVisible();
  await expect(page.getByRole('link',{name:/Source 1: Ikogosi Warm Springs/}))
    .toHaveAttribute('href','https://example.org/ikogosi');
  await expect(page.getByRole('link',{name:/Source 2: Tourism in Ekiti/}))
    .toHaveAttribute('href','https://example.net/tourism');
  await expect(page.getByText(/not an AI-generated answer/)).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});


test('Nested search field renders as one borderless input within one responsive shell',async({page})=>{
  for(const width of [280,320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto('/report');
    const result=await page.locator('.inner-universal-search').evaluate(form=>{
      const input=form.querySelector('input[type="search"]');
      const computed=getComputedStyle(input);
      const outer=form.getBoundingClientRect(),inner=input.getBoundingClientRect();
      return {border:computed.borderTopWidth,background:computed.backgroundColor,
        outer:outer.width,inner:inner.width,scroll:document.documentElement.scrollWidth,
        viewport:innerWidth};
    });
    expect(result.border).toBe('0px');
    expect(result.background).toBe('rgba(0, 0, 0, 0)');
    expect(result.outer).toBeGreaterThan(180);
    expect(result.inner).toBeGreaterThan(28);
    expect(result.scroll).toBeLessThanOrEqual(width);
  }
});
test('Grounded public answer is opt-in and orders Ekiti Civic sources before external links',async({page})=>{
  let answerCalls=0;
  await page.route('**/api/search?**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({query:'Ekiti capital',reviewedOnly:true,places:[],
      knowledge:[{id:'c1',title:'Capital of Ekiti',summary_en:'Ado-Ekiti is capital',
        subject:'Government',framing:'fact',
        source_url:'https://ekitistate.gov.ng/about',publisher:'Government'}]}),
  }));
  await page.route('**/api/web-answer?**',route=>{
    answerCalls++;
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({query:'Ekiti capital',language:'en',mode:'source-excerpts',
        provider:'Wikipedia',reviewedFirst:true,
        claims:[{text:'Ado-Ekiti is capital',sourceIds:[1]}],
        sources:[
          {id:1,title:'Capital of Ekiti',url:'https://ekitistate.gov.ng/about',
            publisher:'Government',origin:'ekiti-civic',evidence:'reviewed-record',excerpt:'Ado-Ekiti is capital'},
          {id:2,title:'Ekiti State',url:'https://en.wikipedia.org/wiki/Ekiti_State',
            publisher:'Wikipedia',origin:'external-web',evidence:'search-snippet',excerpt:'A state in Nigeria'},
        ],
        limitation:'These are attributed source excerpts, not a generated AI answer.'})});
  });
  await page.goto('/search?q=Ekiti+capital');
  expect(answerCalls).toBe(0);
  await expect(page.getByRole('heading',{name:'Ekiti knowledge and public information'})).toBeVisible();
  await page.getByRole('button',{name:'Read sources & explain'}).click();
  await expect(page.getByRole('heading',{name:'Answer from public sources'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Citation 1: Capital of Ekiti'}))
    .toHaveAttribute('href','https://ekitistate.gov.ng/about');
  await expect(page.getByText(/not a generated AI answer/)).toBeVisible();
  const sourceRows=await page.locator('.search-grounded-citations li').allTextContents();
  expect(sourceRows[0]).toContain('Reviewed Ekiti Civic source');
  expect(sourceRows[1]).toContain('External · search excerpt');
  expect(answerCalls).toBe(1);
});
test('Tailored product symbols keep distinct artwork and report progression visible',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Open Ekiti Civic menu').click();
  const paths=await page.locator('.civic-product-glyph svg').evaluateAll(elements=>
    elements.map(svg=>svg.innerHTML));
  expect(paths).toHaveLength(8);
  expect(new Set(paths).size).toBe(8);
  await page.getByRole('link',{name:/Civic report/}).click();
  await expect(page.locator('.guided-stage-meter')).toBeVisible();
  await page.getByRole('button',{name:/Write text/}).click();
  await expect(page.getByText(/Step 2 · Topic/)).toBeVisible();
});
