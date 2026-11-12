#!/usr/bin/env node
/**
 * Credential-free live citizen usability audit.
 * Opens PUBLIC staging routes with a clean, ephemeral browser profile.
 * Does not submit civic cases, request geolocation, upload media, or write data.
 * Screenshots contain only public site content and a synthetic QA-only draft.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const ORIGIN='https://ekiti-platform-staging.inekitikete.workers.dev';
const DEMO='https://ekiti-admin-demo-staging.inekitikete.workers.dev';
const ARTIFACTS='artifacts/live-staging-ui';
await mkdir(ARTIFACTS,{recursive:true});

const browser=await chromium.launch({
  headless:true,
  args:['--enable-unsafe-swiftshader'],
});
const evidence=[];
const now=new Date().toISOString();
const context=await browser.newContext({viewport:{width:390,height:844},
  colorScheme:'light',acceptDownloads:false,permissions:[]});
const pages=[];
const consoleErrors=[];
const violations=[];

async function makePage(width=390){
  const page=await context.newPage();
  pages.push(page);
  await page.setViewportSize({width,height:844});
  page.on('pageerror',error=>consoleErrors.push(String(error).slice(0,240)));
  page.on('request',request=>{
    const url=request.url();
    if(request.method()==='POST' && /\/api\/(reports?|incidents?|intake|cases?|submissions?)\b/i.test(url))
      violations.push('Unexpected private report request: '+url);
  });
  return page;
}
async function note(name,fn){
  try{
    const details=await fn();
    evidence.push({name,status:'PASS',details:details??null});
    console.log('PASS '+name+(details?' — '+details:''));
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    evidence.push({name,status:'FAIL',details:message.slice(0,1800)});
    console.error('FAIL '+name+' — '+message.slice(0,1000));
  }
}
async function navigate(page,path,selector){
  const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(response?.status(),200,'Page HTTP status');
  await page.locator(selector).first().waitFor({state:'visible',timeout:20000});
}
function assertNoOverflow(metrics,width){
  assert.ok(metrics.documentWidth<=width+1,
    'Horizontal overflow '+metrics.documentWidth+'px at '+width+'px viewport');
}
async function metrics(page){
  return page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewport:window.innerWidth,
    innerSearchBorder:document.querySelector('.gateway-search-field input')?
      getComputedStyle(document.querySelector('.gateway-search-field input')).borderWidth:null,
  }));
}

let deployedSha='';
await note('live release and matching admin demo manifests',async()=>{
  const [citizen,admin]=await Promise.all([
    context.request.get(ORIGIN+'/staging-build.json'),
    context.request.get(DEMO+'/staging-build.json'),
  ]);
  assert.equal(citizen.status(),200);
  assert.equal(admin.status(),200);
  const c=await citizen.json(),a=await admin.json();
  assert.match(c.commit,/^[0-9a-f]{40}$/);
  assert.equal(c.commit,a.commit);
  assert.equal(c.target,'citizen');
  assert.equal(a.target,'admin-demo');
  deployedSha=c.commit;
  return 'both workers '+deployedSha;
});
await note('search-first homepage renders at 390px with a single input',async()=>{
  const page=await makePage();
  await navigate(page,'/','h1#welcome-title');
  assert.match(await page.locator('h1#welcome-title').innerText(),/Welcome to Ekiti Civic/);
  assert.equal(await page.locator('.gateway-search-form input[type=search]').count(),1);
  const m=await metrics(page);
  assertNoOverflow(m,390);
  assert.equal(m.innerSearchBorder,'0px','Search input must not draw an inner border');
  await page.screenshot({path:ARTIFACTS+'/home-phone.png',fullPage:true});
  return JSON.stringify(m);
});
await note('homepage search navigates to Ekiti results with real external source link',async()=>{
  const page=await makePage();
  await navigate(page,'/','#ekiti-home-search');
  await page.locator('#ekiti-home-search').fill('Hotels near Ikogosi');
  await page.locator('.gateway-search-form').getByRole('button',{name:'Search Ekiti'}).click();
  await page.waitForURL(/\/search\?/, {timeout:15000});
  assert.match(page.url(),/Hotels\+near\+Ikogosi|Hotels%20near%20Ikogosi/i);
  await page.locator('.sourced-place-example').first().waitFor({state:'visible',timeout:20000});
  const link=page.getByRole('link',{name:'Ikogosi Warm Springs Resort'});
  assert.equal(await link.getAttribute('href'),'https://www.ikogosiresort.com/');
  assert.match(await page.locator('.sourced-place-examples-search').innerText(),/not approved Ekiti Civic directory entries/i);
  const m=await metrics(page);assertNoOverflow(m,390);
  await page.screenshot({path:ARTIFACTS+'/search-results-phone.png',fullPage:true});
  return 'direct source visible; '+JSON.stringify(m);
});
await note('search results tabs and keyboard search are operable',async()=>{
  const page=await makePage();
  await navigate(page,'/search?q=Hospitals+in+Ado+Ekiti','#ekiti-unified-search');
  await page.getByRole('tab',{name:'Places & services'}).click();
  assert.equal(await page.getByRole('tab',{name:'Places & services'}).getAttribute('aria-selected'),'true');
  await page.locator('#ekiti-unified-search').fill('Federal University Oye');
  await page.locator('#ekiti-unified-search').press('Enter');
  await page.waitForURL(/Federal\+University\+Oye|Federal%20University%20Oye/,{timeout:15000});
  await page.getByRole('link',{name:'Federal University Oye-Ekiti'}).waitFor({state:'visible',timeout:20000});
  return 'tabs and Enter search pass';
});
await note('Explore map lists all LGAs and syncs filter and reset',async()=>{
  const page=await makePage();
  await navigate(page,'/explore?map=1','.directory-review-map');
  await page.locator('.directory-map-area-chooser summary').click();
  assert.equal(await page.locator('.directory-map-area-list button').count(),16);
  await page.locator('#map-lga-lookup').fill('Ijero');
  assert.equal(await page.locator('.directory-map-area-list button').count(),1);
  await page.getByRole('button',{name:'Ijero',exact:true}).click();
  assert.equal(await page.locator('#explore-lga').inputValue(),'ijero');
  await page.getByRole('button',{name:'View all Ekiti'}).click();
  assert.equal(await page.locator('#explore-lga').inputValue(),'');
  const m=await metrics(page);assertNoOverflow(m,390);
  await page.screenshot({path:ARTIFACTS+'/explore-map-phone.png',fullPage:true});
  const mapAlert=await page.locator('.directory-review-map [role=alert]').allInnerTexts();
  if(mapAlert.length)throw Error('Map reports a rendering failure: '+mapAlert.join('; '));
  return '16 options; no map errors; '+JSON.stringify(m);
});
await note('reporting offers conversational private-draft entry without submission',async()=>{
  const page=await makePage();
  await navigate(page,'/report','.guided-thread');
  const method=page.getByRole('button',{name:'Write text'});
  await method.waitFor({state:'visible',timeout:20000});
  await method.click();
  const categories=page.locator('.guided-category-choices button');
  await categories.first().waitFor({state:'visible',timeout:20000});
  const name=await categories.first().innerText();
  if(/Emergency/i.test(name))throw Error('Audit refuses to open Emergency category');
  await categories.first().click();
  await page.locator('#guided-description').waitFor({state:'visible',timeout:20000});
  await page.locator('#guided-description').fill('QA-only example: a damaged public road requiring inspection.');
  await page.screenshot({path:ARTIFACTS+'/report-draft-phone.png',fullPage:true});
  const m=await metrics(page);assertNoOverflow(m,390);
  return 'text report composer reached; no report sent; '+JSON.stringify(m);
});
await note('appearance switches to dark and stays within narrow viewport',async()=>{
  const page=await makePage(280);
  await navigate(page,'/','h1#welcome-title');
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  let m=await metrics(page);assertNoOverflow(m,280);
  await page.screenshot({path:ARTIFACTS+'/dark-280.png',fullPage:true});
  return JSON.stringify(m);
});
await note('desktop homepage and search layout have no overflow',async()=>{
  const page=await makePage(1440);
  await navigate(page,'/','h1#welcome-title');
  let m=await metrics(page);assertNoOverflow(m,1440);
  await page.screenshot({path:ARTIFACTS+'/home-desktop.png',fullPage:true});
  await navigate(page,'/search?q=Hotels+near+Ikogosi','#ekiti-unified-search');
  m=await metrics(page);assertNoOverflow(m,1440);
  await page.screenshot({path:ARTIFACTS+'/search-desktop.png',fullPage:true});
  return JSON.stringify(m);
});
await note('no report submission requests issued by synthetic QA flow',async()=>{
  assert.deepEqual(violations,[]);
  return 'zero outgoing case/intake/submission POSTs';
});

const summary={
  auditedAt:now,
  origin:ORIGIN,
  deployedSha,
  tests:evidence,
  consoleErrors:[...new Set(consoleErrors)].slice(0,20),
  privacyViolations:violations,
  passed:evidence.filter(x=>x.status==='PASS').length,
  failed:evidence.filter(x=>x.status==='FAIL').length,
};
await writeFile(ARTIFACTS+'/audit.json',JSON.stringify(summary,null,2)+'\n');
for(const p of pages)await p.close().catch(()=>{});
await context.close();
await browser.close();
console.log('LIVE AUDIT SUMMARY: '+summary.passed+' passed; '+summary.failed+' failed.');
if(summary.failed)process.exitCode=1;
