import {test,expect} from '@playwright/test';

async function toReview(page,category='Roads'){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:category,exact:true}).click();
  await page.locator('#guided-description').fill('The public road has a dangerous damaged section near the main market.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.getByRole('heading',{name:'Review your private draft'})).toBeVisible();
}

test('save is opt-in, notice is clear, and storage contains no media or contact',async({page})=>{
  await toReview(page);
  await expect(page.getByRole('button',{name:'Save private draft on this device'})).toBeDisabled();
  expect(await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1'))).toBeNull();
  await expect(page.getByText(/This choice only authorizes this device's local draft save/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Privacy and safety details'})).toHaveAttribute('target','_blank');
  await page.getByLabel('I understand this is a local draft, not a report submission, and I choose to save it here.').check();
  await expect(page.getByRole('button',{name:'Save private draft on this device'})).toBeEnabled();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  await expect(page.getByRole('heading',{name:'Draft saved locally'})).toBeVisible();
  const stored=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1')??'');
  expect(stored).toContain('damaged section');
  expect(stored).not.toContain('contact');
  expect(stored).not.toContain('latitude');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete this draft and start another'}).click();
  expect(await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1'))).toBeNull();
});

test('vulnerable-person and retaliation choices restrict photo/video/audio capture without storing the flags',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'Photo',exact:true}).click();
  await page.getByRole('button',{name:'Security',exact:true}).click();
  await page.getByText('Optional safety and privacy details').click();
  await page.getByRole('checkbox',{name:'I need extra privacy protection for someone affected'}).check();
  await page.getByRole('checkbox',{name:'I am worried about threats, identification or retaliation'}).check();
  await expect(page.getByText(/Media capture is disabled for this sensitive draft/)).toBeVisible();
  await page.locator('#guided-description').fill('A threatening situation was witnessed near a public facility yesterday.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('#guided-lga').selectOption('ikere');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByText(/photo, video and audio capture are disabled/)).toBeVisible();
  await expect(page.getByLabel('Choose existing evidence')).toHaveCount(0);
  await expect(page.getByLabel('Take a photo')).toHaveCount(0);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.locator('.review-list')).toContainText('Sensitive details noted in this tab only');
  await page.getByLabel('I understand this is a local draft, not a report submission, and I choose to save it here.').check();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  const saved=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1')??'');
  expect(saved).not.toContain('vulnerable_person');
  expect(saved).not.toContain('retaliation');
  expect(saved).not.toContain('photoBytes');
});

test('privacy page deletes explicitly saved guided and legacy drafts and does not claim server erasure',async({page})=>{
  await page.goto('/privacy');
  await page.evaluate(()=>{
    sessionStorage.setItem('ekiti-guided-draft-v1','{"purpose":"report","description":"private draft"}');
    localStorage.setItem('ekiti-conversation-draft-v1','legacy draft');
    localStorage.setItem('ekiti-report-preview-v2','older draft');
  });
  await expect(page.getByRole('heading',{name:'Privacy and safety'})).toBeVisible();
  await expect(page.getByText(/legal operator, privacy contact and processing policy are not yet verified/)).toBeVisible();
  await expect(page.getByText(/This control is not a future server-side data-erasure request/)).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete saved report drafts in this browser'}).click();
  await expect(page.getByText(/Saved report draft keys were cleared/)).toBeVisible();
  const values=await page.evaluate(()=>({
    session:sessionStorage.getItem('ekiti-guided-draft-v1'),
    legacy:localStorage.getItem('ekiti-conversation-draft-v1'),
    older:localStorage.getItem('ekiti-report-preview-v2'),
  }));
  expect(values).toEqual({session:null,legacy:null,older:null});
});

test('expired explicit guided draft is automatically cleaned up on revisit, not uploaded',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('ekiti-guided-draft-v1',JSON.stringify({
      purpose:'report',method:'Text',category:'Roads',
      description:'The road is badly damaged and has many holes near the market.',
      lgaId:'ado-ekiti',community:'',savedAt:'2025-10-01T00:00:00.000Z',
    }));
  });
  await page.goto('/report');
  await expect(page.getByRole('button',{name:'Continue saved draft'})).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1'))).toBeNull();
});

for(const width of [280,390]){
  test('Sprint 04 privacy route stays readable at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:780});
    await page.goto('/privacy');
    await expect(page.getByRole('heading',{name:'Privacy and safety'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:'test-results/sprint-04-review/privacy-'+width+'.png',fullPage:true});
  });
}
