import {test,expect} from '@playwright/test';

for(const width of [280,320,390,768,1024,1280,1440,1920]){
  test('Search-first home fits '+width+'px with a single prominent input',async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Welcome to Ekiti Civic'})).toBeVisible();
    await expect(page.getByText('Your mobile gateway to Ekiti State.')).toBeVisible();
    await expect(page.getByRole('searchbox',{name:'Search Ekiti State'})).toBeVisible();
    await expect(page.locator('.welcome-action')).toHaveCount(0);
    const layout=await page.evaluate(()=>{
      const q=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
      const hero=q('#welcome-title'),field=q('.gateway-search-field'),
        shell=q('.app-shell'),header=q('.app-header');
      return {
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        shellWidth:shell.width,inputWidth:field.width,
        titleOffset:Math.abs((hero.left+hero.width/2)-(shell.left+shell.width/2)),
        gap:hero.top-header.bottom,
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.titleOffset).toBeLessThanOrEqual(10);
    expect(layout.inputWidth).toBeGreaterThanOrEqual(width<=320?225:260);
    expect(layout.gap).toBeGreaterThan(35);
    if(width>=1024)expect(layout.shellWidth).toBeGreaterThan(width-2);
    if([280,390,1280].includes(width))
      await page.screenshot({path:'test-results/sprint-01-welcome/home-'+width+'.png',fullPage:true});
  });
}

test('all civic services live in the compact header product launcher',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Open Ekiti Civic menu').click();
  const links=[
    ['/search','Search Ekiti'],['/report','Civic report'],
    ['/report?kind=feedback','Government feedback'],
    ['/explore','Explore Ekiti'],['/explore?map=1','Ekiti map'],
    ['/listings/new','List a business'],['/track','Track a report'],
    ['/profile','My account'],
  ] as const;
  for(const [href,label] of links){
    await expect(page.getByRole('link',{name:new RegExp(label)}).first()).toHaveAttribute('href',href);
  }
  await page.locator('.civic-products-panel').getByRole('link',{name:/Civic report/}).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
  await page.goto('/');
  await page.getByLabel('Open Ekiti Civic menu').click();
  await page.locator('.civic-products-panel').getByRole('link',{name:/Explore Ekiti/}).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole('heading',{name:'Browse Categories'})).toBeVisible();
});

test('Yoruba and appearance settings remain usable from the search homepage',async({page})=>{
  await page.goto('/');
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByLabel('Open Ekiti Civic menu').click();
  await page.locator('.civic-products-language').getByRole('button',{name:'Yorùbá'}).click();
  await expect(page.getByRole('heading',{name:'Káàbọ̀ sí Ekiti Civic'})).toBeVisible();
  await page.getByRole('searchbox',{name:'Search Ekiti State'}).focus();
  await expect(page.getByRole('searchbox',{name:'Search Ekiti State'})).toBeFocused();
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'System',exact:true}).click();
  await expect(page.getByLabel('Appearance settings · System')).toBeVisible();
});
