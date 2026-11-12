import {test,expect} from '@playwright/test';

test('Sprint 06 keeps existing on-device recorder explicitly local and no automatic evidence uploads',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const network:string[]=[];
  page.on('request',request=>{
    if(request.url().includes('/api/evidence/'))network.push(request.url());
  });
  await page.goto('/report');
  await page.getByRole('button',{name:'Audio note'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill(
    'The road surface is badly damaged and presents a danger near the local market.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Record on device'}).click();
  await expect(page.getByText(/not live-streamed, backed up, or sent to Ekiti Civic/)).toBeVisible();
  await expect(page.getByText(/Never rely on it as emergency evidence storage/)).toBeVisible();
  expect(network).toEqual([]);
  const denied=await page.request.post('/api/evidence/sessions',{
    headers:{Origin:new URL(page.url()).origin},
    data:{reference:'ed3b7b7c-1f31-4a15-a768-39703dfccbac',
      secret:'0'.repeat(64),kind:'Audio',mimeType:'audio/webm',
      evidenceConsent:true,evidencePolicyVersion:'unapproved'},
  });
  expect(denied.status()).toBe(404);
  expect(await denied.json()).toEqual({error:'Unknown route'});
});

test('every proposed evidence endpoint denies requests without the independent release',async({page})=>{
  await page.goto('/');
  const origin=new URL(page.url()).origin;
  for(const path of ['/api/evidence/sessions','/api/evidence/sessions/90e541b2-b6e2-4438-85dd-d5c3dc34f981/status',
    '/api/evidence/sessions/90e541b2-b6e2-4438-85dd-d5c3dc34f981/complete']){
    const result=await page.request.post(path,{headers:{Origin:origin},data:{}});
    expect(result.status(),path).toBe(404);
  }
});
