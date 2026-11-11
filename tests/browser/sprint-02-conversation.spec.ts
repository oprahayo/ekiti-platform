import { test, expect } from '@playwright/test';

test('central civic welcome uses five distinctive colour-layered digital icons, not a second tracking CTA', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Welcome to Ekiti Civic'})).toBeVisible();
  await expect(page.locator('.welcome-primary')).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'Search Ekiti State'})).toBeVisible();
  await expect(page.locator('.welcome-action-icon')).toHaveCount(5);
  await expect(page.locator('.welcome-action-icon[data-icon="report"]')).toHaveCount(1);
  await expect(page.locator('.welcome-action-icon[data-icon="feedback"]')).toHaveCount(1);
  await expect(page.locator('.welcome-action-icon[data-icon="explore"]')).toHaveCount(1);
  await expect(page.locator('.welcome-action-icon[data-icon="listing"]')).toHaveCount(1);
  await expect(page.locator('.welcome-action-icon[data-icon="ask"]')).toHaveCount(1);
  const gradients=await page.locator('.welcome-action-icon').evaluateAll(nodes =>
    nodes.map(svg=>({
      colors:new Set(Array.from(svg.querySelectorAll('stop')).map(x=>x.getAttribute('stop-color'))).size,
      shapeCount:svg.querySelectorAll('path,rect,circle').length,
    })),
  );
  for(const icon of gradients) {
    expect(icon.colors).toBeGreaterThanOrEqual(3);
    expect(icon.shapeCount).toBeGreaterThanOrEqual(3);
  }
  const measurements=await page.evaluate(()=>{
    const r=(sel:string)=>document.querySelector(sel)!.getBoundingClientRect();
    const title=r('#welcome-title'),header=r('.app-header'),primary=r('.welcome-primary');
    return {titleTop:title.top,headerBottom:header.bottom,
      primaryCenter:primary.top+primary.height/2,viewport:innerHeight,
      docWidth:document.documentElement.scrollWidth,viewWidth:innerWidth};
  });
  expect(measurements.titleTop-measurements.headerBottom).toBeGreaterThan(30);
  expect(measurements.primaryCenter/measurements.viewport).toBeGreaterThan(.34);
  expect(measurements.primaryCenter/measurements.viewport).toBeLessThan(.68);
  expect(measurements.docWidth).toBeLessThanOrEqual(measurements.viewWidth);
  await expect(page.getByRole('link',{name:'Track',exact:true})).toBeVisible();
  await expect(page.getByText('Have a report reference? Check tracking')).toHaveCount(0);
});

test('backtracking restores prior answers and removes only the reverted chat messages', async ({page})=>{
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await expect(page.getByRole('button',{name:'Roads'})).toBeVisible();
  await page.getByRole('button',{name:'Roads'}).click();
  const message='The bridge connecting two neighbourhoods is cracking after heavy rainfall.';
  await page.locator('#guided-description').fill(message);
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.locator('#guided-lga')).toBeVisible();
  const prior=await page.locator('.guided-bubble').count();
  await page.getByRole('button',{name:/Back/}).click();
  await expect(page.locator('#guided-description')).toHaveValue(message);
  expect(await page.locator('.guided-bubble').count()).toBe(prior-2);
  await page.getByRole('button',{name:/Back/}).click();
  await expect(page.getByRole('button',{name:'Roads'})).toBeVisible();
  await page.getByRole('button',{name:'Water'}).click();
  await expect(page.locator('#guided-description')).toBeVisible();
  await expect(page.locator('#guided-description')).toHaveValue(message);
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.locator('.review-list')).toContainText('Water');
  await expect(page.locator('.review-list')).not.toContainText('Roads');
  await page.getByRole('button',{name:'Change category'}).click();
  await expect(page.getByRole('button',{name:'Security'})).toBeVisible();
});

test('chat sound preference survives reload but stays off until enabled',async ({page})=>{
  await page.goto('/report');
  await expect(page.getByRole('button',{name:'Chat sounds off'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Chat sounds off'}).click();
  await expect(page.getByRole('button',{name:'Chat sounds on'})).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.getByRole('button',{name:'Chat sounds on'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Chat sounds on'}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Chat sounds off'})).toHaveAttribute('aria-pressed','false');
});

test('saved private report can be explicitly resumed after reload without email, phone or media',async ({page})=>{
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Drainage'}).click();
  const narrative='The main drainage channel has become blocked and flooded several streets.';
  await page.locator('#guided-description').fill(narrative);
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('#guided-lga').selectOption('ikere');
  await page.locator('#guided-community').fill('Along the primary school');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/Email tracking link/}).click();
  await page.locator('#guided-contact').fill('private.person@example.test');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Review your private draft'})).toBeVisible();
  await page.getByLabel('I understand this is a local draft, not a report submission, and I choose to save it here.').check();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  await expect(page.getByRole('heading',{name:'Draft saved locally'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Continue saved draft'})).toBeVisible();
  const serialized=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1')||'');
  expect(serialized).toContain('Drainage');
  expect(serialized).not.toContain('private.person@example.test');
  expect(serialized).not.toContain('base64');
  await page.getByRole('button',{name:'Continue saved draft'}).click();
  await expect(page.getByRole('heading',{name:'Review your private draft'})).toBeVisible();
  await expect(page.locator('.review-list')).toContainText(narrative);
  await expect(page.locator('.review-list')).toContainText('Ikere');
  await expect(page.locator('.review-list')).toContainText('None requested');
  await page.getByRole('button',{name:'Change category'}).click();
  await expect(page.getByRole('button',{name:'Security'})).toBeVisible();
});

test('Yoruba prompts work and reduced motion does not delay response',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'YOR'}).click();
  await expect(page.getByText(/Báwo ni o ṣe fẹ́ ṣàlàyé/)).toBeVisible();
  await page.getByRole('button',{name:'Write text'}).click();
  await expect(page.getByText(/Irú ìṣẹ̀lẹ̀ wo ni èyí/)).toBeVisible();
  await expect(page.getByLabel('Ekiti Civic is typing')).toHaveCount(0);
  await page.getByRole('button',{name:'Emergency'}).click();
  await expect(page.getByText(/contact emergency services directly/)).toBeVisible();
});

for(const width of [280,390,1280]){
  test('Sprint 02 visual review at '+width+'px',async ({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    await expect(page.locator('.welcome-action-icon')).toHaveCount(5);
    await page.screenshot({path:'test-results/sprint-02-review/home-'+width+'.png',fullPage:true});
    await page.goto('/report');
    await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
    await page.screenshot({path:'test-results/sprint-02-review/report-'+width+'.png',fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
