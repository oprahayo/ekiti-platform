import { test, expect } from '@playwright/test';

test('Sprint 05: resident can prepare a private draft but no live report, tracking or receipt is silently sent', async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const privatePosts:string[]=[];
  page.on('request',req=>{
    if(req.method()==='POST' && /\/api\/(reports|tracking)(?:\?|$)/.test(req.url()))
      privatePosts.push(req.url());
  });
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill(
    'The bridge approach has damaged pavement along the road by the local market.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.getByText(/This is not a submission/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Save private draft on this device'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/I understand this is a local draft/}).check();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  await expect(page.getByRole('heading',{name:'Draft saved locally'})).toBeVisible();
  expect(privatePosts).toEqual([]);
  const stored=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1')||'');
  expect(stored).toContain('damaged pavement');
  expect(stored).not.toContain('receipt');
  const unavailable=await page.request.post('/api/reports',{
    headers:{Origin:new URL(page.url()).origin},data:{kind:'Issue',description:'not submitted'},
  });
  expect(unavailable.status()).toBe(404);
  expect(await unavailable.json()).toEqual({error:'Unknown route'});
});

test('Sprint 05: a forged tracking request is not accepted while release is disabled',async({page})=>{
  await page.goto('/track');
  await expect(page.getByText(/Online reporting is not active/)).toBeVisible();
  const unavailable=await page.request.post('/api/tracking',{
    headers:{Origin:new URL(page.url()).origin},data:{
      reference:'ed3b7b7c-1f31-4a15-a768-39703dfccbac',secret:'f'.repeat(64),
    },
  });
  expect(unavailable.status()).toBe(404);
  expect(await unavailable.json()).toEqual({error:'Unknown route'});
});
