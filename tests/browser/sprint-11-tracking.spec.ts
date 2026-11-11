import {test,expect} from '@playwright/test';

test('Sprint 11 guest My Reports does not request timeline, notification or review endpoints',async({page})=>{
  const sensitive:string[]=[];
  page.on('request',request=>{
    if(/civic_my_case_timeline|civic_set_case_notice_preference|civic_request_case_review/.test(request.url()))
      sensitive.push(request.url());
  });
  await page.goto('/profile?view=reports');
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  await expect(page.getByText(/browsing as a guest/)).toBeVisible();
  await expect(page.getByText(/No personal reports are retrieved/)).toBeVisible();
  await expect(page.getByRole('button',{name:'View private platform timeline'})).toHaveCount(0);
  await expect(page.locator('.citizen-platform-events')).toHaveCount(0);
  await expect(page.locator('input[id^="notice-"]')).toHaveCount(0);
  expect(sensitive).toEqual([]);
});

test('tracking remains explicitly a fictional example and does not look up any private history',async({page})=>{
  const sensitive:string[]=[];
  page.on('request',request=>{
    if(/civic_my_case_timeline|civic_my_private_reports|api\/tracking/.test(request.url()))
      sensitive.push(request.url());
  });
  await page.goto('/track');
  await expect(page.getByRole('heading',{name:'Check a report'})).toBeVisible();
  await expect(page.getByText(/No live case lookup yet/)).toBeVisible();
  await page.getByRole('button',{name:'Show a fictional tracking example'}).click();
  await expect(page.getByRole('heading',{name:/Example timeline · not a real case/})).toBeVisible();
  await expect(page.getByText(/No government agency has been contacted/)).toBeVisible();
  expect(sensitive).toEqual([]);
});

test('privacy explains platform-only event labels, notification off-default and review-request limitations',async({page})=>{
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'Private platform timelines and notification preferences'})).toBeVisible();
  await expect(page.getByText(/not official office delivery, viewing, response or acknowledgement/)).toBeVisible();
  await expect(page.getByText(/does not send, queue or deliver a message/)).toBeVisible();
  await expect(page.getByText(/does not promise that staff will see or respond/)).toBeVisible();
});

test('280px guest profile and fictional tracking remain readable',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.goto('/profile?view=reports');
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.screenshot({path:'test-results/sprint-11-review/profile-guest-280.png',fullPage:true});
  await page.goto('/track');
  await expect(page.getByRole('heading',{name:'Check a report'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
});
