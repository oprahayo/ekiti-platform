import {test,expect} from '@playwright/test';

test('Explore opens exactly one map before a compact illustrated category sheet',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const geoCalls:string[]=[];
  page.on('request',request=>{
    if(request.url().includes('/api/resolve'))geoCalls.push(request.url());
  });
  await page.goto('/explore');
  await expect(page.getByRole('heading',{name:'Explore Ekiti',exact:true})).toBeVisible();
  await expect(page.locator('.directory-map-first-stage .directory-review-map')).toBeVisible();
  await expect(page.locator('.directory-review-map-canvas')).toHaveCount(1);
  await expect(page.locator('.directory-map-first-stage .directory-category-tile')).toHaveCount(24);
  await expect(page.locator('.directory-map-sheet .directory-tile-icon')).toHaveCount(24);
  await page.locator('.directory-map-first-stage .maplibregl-canvas').waitFor({state:'visible'});
  await page.waitForTimeout(2300); // Give local boundary geometry time to paint before screenshots.
  const layout=await page.evaluate(()=>{
    const map=document.querySelector('.directory-review-map-canvas')!.getBoundingClientRect();
    const sheet=document.querySelector('.directory-map-sheet')!.getBoundingClientRect();
    return {mapTop:map.top,mapBottom:map.bottom,sheetTop:sheet.top,
      scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  expect(layout.mapTop).toBeLessThan(layout.sheetTop);
  expect(layout.sheetTop).toBeLessThan(layout.mapBottom+160);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  expect(geoCalls).toEqual([]);
  await page.screenshot({path:'test-results/explore-map-first/mobile-390.png',fullPage:true});
});

test('Explore keeps one map and a side-by-side category panel on wide screens',async({page})=>{
  await page.setViewportSize({width:1280,height:820});
  await page.goto('/explore?map=1');
  await expect(page.locator('.directory-review-map-canvas')).toHaveCount(1);
  await expect(page.locator('.directory-category-tile')).toHaveCount(24);
  await page.locator('.maplibregl-canvas').waitFor({state:'visible'});
  await page.waitForTimeout(2300);
  const layout=await page.evaluate(()=>{
    const map=document.querySelector('.directory-review-map')!.getBoundingClientRect();
    const panel=document.querySelector('.directory-map-sheet')!.getBoundingClientRect();
    return {mapX:map.left,panelX:panel.left,mapY:map.top,panelY:panel.top,
      scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  expect(layout.mapX).toBeLessThan(layout.panelX);
  expect(Math.abs(layout.mapY-layout.panelY)).toBeLessThan(12);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  await page.screenshot({path:'test-results/explore-map-first/desktop-1280.png',fullPage:true});
});

test('The reporting experience remains an interactive, private, chatbot-like draft',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/report');
  await expect(page.getByRole('log',{name:'Report conversation'})).toBeVisible();
  await page.getByRole('button',{name:'Write text'}).click();
  await expect(page.locator('.guided-category-choices')).toBeVisible();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await expect(page.locator('#guided-description')).toBeVisible();
  await expect(page.locator('.guided-choices')).toHaveCount(0);
  await page.screenshot({path:'test-results/explore-map-first/report-chat-390.png',fullPage:true});
});
