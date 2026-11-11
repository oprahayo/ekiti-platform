import {test,expect} from '@playwright/test';

test('Sprint 03 category-dependent prompts and optional answers survive back navigation',async({page})=>{
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await expect(page.getByText('What is the main road problem?')).toBeVisible();
  await expect(page.getByRole('group',{name:'Is anyone in immediate danger right now?'})).toBeVisible();
  await page.getByRole('button',{name:'Potholes or damaged surface'}).click();
  await expect(page.getByRole('button',{name:'Potholes or damaged surface'})).toHaveAttribute('aria-pressed','true');
  await page.locator('#guided-description').fill('The road surface outside the town market has severe potholes.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/Back/}).click();
  await expect(page.getByRole('button',{name:'Potholes or damaged surface'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Back/}).click();
  await page.getByRole('button',{name:'Water',exact:true}).click();
  await expect(page.getByText('What is wrong with the water service?')).toBeVisible();
  await expect(page.getByRole('button',{name:'Potholes or damaged surface'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'No water supply'})).toHaveAttribute('aria-pressed','false');
});

test('immediate danger warning is visible without delayed emergency-response dispatch claims',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Electricity',exact:true}).click();
  await page.getByRole('group',{name:'Is anyone in immediate danger right now?'}).getByRole('button',{name:'Yes',exact:true}).click();
  await expect(page.getByText(/Ekiti Civic cannot dispatch help/)).toBeVisible();
  await page.getByRole('button',{name:'Exposed wire or electrical danger'}).click();
  await page.locator('#guided-description').fill('A fallen power cable is across the road near the main junction.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.locator('.review-list')).toContainText('Exposed wire or electrical danger');
  await expect(page.locator('.review-list')).toContainText('Immediate danger reported');
  await expect(page.locator('.review-list')).toContainText('manual review needed');
  await expect(page.getByText(/not monitored or dispatched/)).toBeVisible();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  const stored=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1')??'');
  expect(stored).toContain('"subcategory":"hazard"');
  expect(stored).toContain('"immediateDanger":"yes"');
  expect(stored).not.toContain('email');
  expect(stored).not.toContain('latitude');
});

test('similarity is only to the current tabs saved draft, never another residents private report',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('ekiti-guided-draft-v1',JSON.stringify({
      purpose:'report',method:'Text',category:'Roads',
      description:'Potholes beside the central market have damaged road surfaces for weeks',
      lgaId:'ado-ekiti',community:'',savedAt:new Date().toISOString(),
    }));
  });
  await page.goto('/report');
  await expect(page.getByRole('button',{name:'Continue saved draft'})).toBeVisible();
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill('Road surfaces beside the central market have potholes for several weeks');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.getByText('Possible repeat of your own saved draft')).toBeVisible();
  await expect(page.getByText(/No other residents' reports were searched/)).toBeVisible();
  await expect(page.getByText(/This is not a submission/)).toBeVisible();
});

test('bilingual follow-up fits narrow phone without introducing another dashboard',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'YOR'}).click();
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Drainage'}).click();
  await expect(page.getByText('Kí ló ń ṣẹlẹ̀ sí ọ̀nà ìṣàn omi?')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.screenshot({path:'test-results/sprint-03-review/report-280.png',fullPage:true});
});
