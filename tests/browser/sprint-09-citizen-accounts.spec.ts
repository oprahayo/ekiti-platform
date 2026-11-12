import {test,expect} from '@playwright/test';

test('Sprint 09 preserves guest access and never auto-links a report on profile load',async({page})=>{
  const privateCalls:string[]=[];
  page.on('request',request=>{
    if(/auth\/v1|civic_(?:my_private_reports|link_private_report|unlink_private_report)/.test(request.url()))
      privateCalls.push(request.url());
  });
  await page.goto('/profile');
  await expect(page.getByRole('heading',{name:'Citizen Profile'})).toBeVisible();
  await expect(page.getByText('Guest browsing · Your device only')).toBeVisible();
  await expect(page.getByRole('button',{name:/My Reports/})).toBeVisible();
  await page.getByRole('button',{name:/My Reports/}).click();
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  await expect(page.getByText(/browsing as a guest/)).toBeVisible();
  await expect(page.getByText(/No personal reports are retrieved/)).toBeVisible();
  await expect(page.locator('#citizen-link-secret')).toHaveCount(0);
  await expect(page.locator('.citizen-linked-list')).toHaveCount(0);
  expect(privateCalls).toEqual([]);
  await expect(page.getByRole('link',{name:'Continue a private report draft'})).toBeVisible();
  await page.getByRole('link',{name:'Continue a private report draft'}).click();
  await expect(page).toHaveURL(/\/report$/);
  expect(privateCalls).toEqual([]);
});

test('unconfigured email/phone OTP never collects a contact or opens a sign-in request',async({page})=>{
  const authUrls:string[]=[];
  page.on('request',request=>{
    if(/auth\/v1/.test(request.url()))authUrls.push(request.url());
  });
  await page.goto('/profile');
  await page.getByRole('button',{name:'Sign in or create an account'}).click();
  await expect(page.getByRole('dialog',{name:'Sign in & Citizen Profile'})).toBeVisible();
  await expect(page.getByText(/Verified citizen sign-in is not active/)).toBeVisible();
  await expect(page.locator('#citizen-email')).toHaveCount(0);
  await expect(page.locator('#citizen-phone')).toHaveCount(0);
  await expect(page.locator('#citizen-otp')).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Continue as guest'}).click();
  expect(authUrls).toEqual([]);
});

test('direct My Reports view has honest disabled history and no fictional linked cases',async({page})=>{
  await page.goto('/profile?view=reports');
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  await expect(page.getByText(/browsing as a guest/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Continue a private report draft'})).toBeVisible();
  await expect(page.locator('.citizen-linked-list')).toHaveCount(0);
  await expect(page.locator('.citizen-report-link-form')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to profile'}).click();
  await expect(page.getByRole('button',{name:/My Reports/})).toBeVisible();
});

test('privacy page explains that OTP identity cannot link private reports without receipt proof',async({page})=>{
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'Optional citizen account and private report links'})).toBeVisible();
  await expect(page.getByText(/must never infer ownership from matching contact/)).toBeVisible();
  await expect(page.getByText(/short-lived access tokens can remain valid/)).toBeVisible();
});

test('280px mobile My Reports and recovery preview do not overflow',async({page})=>{
  await page.setViewportSize({width:280,height:700});
  await page.goto('/profile?view=reports');
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.screenshot({path:'test-results/sprint-09-review/profile-reports-280.png',fullPage:true});
  await page.getByRole('button',{name:'Back to profile'}).click();
  await page.getByRole('button',{name:'Sign in or create an account'}).click();
  await expect(page.getByText(/Verified citizen sign-in is not active/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
});
