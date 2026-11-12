import {test,expect} from '@playwright/test';

test('Map stays opt-in and offers all 16 verified LGA names as a keyboard-operable list',async({page})=>{
  const gps:string[]=[];
  page.on('request',request=>{if(request.url().includes('/api/resolve'))gps.push(request.url())});
  await page.goto('/explore');
  await expect(page.locator('.directory-review-map')).toHaveCount(0);
  await page.getByRole('button',{name:'View interactive Ekiti directory map'}).click();
  await expect(page.getByRole('region',{name:'Reviewed Ekiti directory map'})).toBeVisible();
  await page.locator('.directory-map-area-chooser summary').click();
  await expect(page.getByRole('searchbox',{name:'Search the 16 LGAs'})).toBeVisible();
  await expect(page.locator('.directory-map-area-list button')).toHaveCount(16);
  await expect(page.getByText(/not yet a complete map of Ekiti towns or villages/)).toBeVisible();
  await expect(page.getByRole('link',{name:/GRID3/})).toHaveAttribute('href','https://grid3.org/geospatial-data-nigeria');
  expect(gps).toEqual([]);
});

test('LGA keyboard search filters real names without creating town pins',async({page})=>{
  await page.goto('/explore?map=1');
  await expect(page.locator('.directory-review-map')).toBeVisible();
  await page.locator('.directory-map-area-chooser summary').click();
  const input=page.getByRole('searchbox',{name:'Search the 16 LGAs'});
  await input.fill('ijero');
  await expect(page.locator('.directory-map-area-list button')).toHaveCount(1);
  await expect(page.locator('.directory-map-area-list button').first()).toHaveText('Ijero');
  await page.locator('.directory-map-area-list button').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#explore-lga')).toHaveValue('ijero');
  await expect(page.getByText(/Selected area: Ijero/)).toBeVisible();
  await expect(page.getByRole('button',{name:'View all Ekiti'})).toBeVisible();
  await page.getByRole('button',{name:'View all Ekiti'}).click();
  await expect(page.locator('#explore-lga')).toHaveValue('');
  await expect(page.getByRole('button',{name:'View all Ekiti'})).toHaveCount(0);
  await expect(page.locator('.directory-review-map')).toContainText('0 independently reviewed places pinned');
});

test('LGA finder handles punctuation, unknown places and manual LGA synchronization',async({page})=>{
  await page.goto('/explore?map=1');
  await page.locator('.directory-map-area-chooser summary').click();
  const input=page.locator('#map-lga-lookup');
  await input.fill('ido/osi');
  await expect(page.locator('.directory-map-area-list button')).toHaveCount(1);
  await page.locator('.directory-map-area-list button').first().click();
  await expect(page.locator('#explore-lga')).toHaveValue('ido-osi');
  await expect(page.locator('.directory-map-area-list button').first()).toHaveAttribute('aria-pressed','true');
  await input.fill('nonexistent village');
  await expect(page.getByText(/No matching LGA name/)).toBeVisible();
  await expect(page.locator('.directory-map-area-list button')).toHaveCount(0);
  await page.locator('.directory-manual-area summary').click();
  await page.locator('#explore-lga').selectOption('moba');
  await expect(page.getByText(/Selected area: Moba/)).toBeVisible();
});

test('Map LGA finder fits mobile and dark mode without horizontal overflow',async({page})=>{
  for(const width of [280,320,390,428,768,1024]){
    await page.setViewportSize({width,height:800});
    await page.goto('/explore?map=1');
    await page.locator('.directory-map-area-chooser summary').click();
    await expect(page.locator('.directory-map-area-list button')).toHaveCount(16);
    const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(scroll).toBeLessThanOrEqual(width);
  }
  await page.getByLabel(/Appearance settings/).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByRole('searchbox',{name:'Search the 16 LGAs'})).toBeVisible();
});
