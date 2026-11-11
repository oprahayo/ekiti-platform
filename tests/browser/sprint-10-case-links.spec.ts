import {test,expect} from '@playwright/test';

const ticket='a'.repeat(64);

test('Sprint 10 guest Profile has no private message form and sends no delivery request',async({page})=>{
  const outgoing:string[]=[];
  page.on('request',r=>{
    if(/civic_request_case_link|civic_redeem_case_link|auth\/v1/.test(r.url()))
      outgoing.push(r.url());
  });
  await page.goto('/profile?view=reports');
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  await expect(page.getByText(/browsing as a guest/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Request one-time case link'})).toHaveCount(0);
  await expect(page.locator('#citizen-delivery-secret')).toHaveCount(0);
  await expect(page.locator('.citizen-linked-list')).toHaveCount(0);
  expect(outgoing).toEqual([]);
});

test('one-time link fragment is scrubbed from address before any redemption; default-off',async({page})=>{
  const outgoing:string[]=[];
  page.on('request',r=>{
    if(/civic_redeem_case_link|civic_request_case_link|auth\/v1/.test(r.url()))
      outgoing.push(r.url());
  });
  await page.goto('/case-link#ticket='+ticket);
  await expect(page.getByRole('heading',{name:'Open your private case link'})).toBeVisible();
  await expect(page.getByText(/have not been activated/)).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>window.location.hash)).toBe('');
  await expect.poll(async()=>page.evaluate(()=>window.location.search)).toBe('');
  const body=await page.locator('body').innerText();
  expect(body).not.toContain(ticket);
  expect(await page.evaluate(()=>JSON.stringify(sessionStorage))).not.toContain(ticket);
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(ticket);
  await expect(page.getByRole('button',{name:'Redeem one-time link'})).toHaveCount(0);
  expect(outgoing).toEqual([]);
});

test('invalid, absent or malformed fragments are scrubbed; no download or report details appear',async({page})=>{
  await page.goto('/case-link#ticket=demo');
  await expect(page.getByRole('heading',{name:'Open your private case link'})).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>window.location.hash)).toBe('');
  await expect(page.locator('a[download]')).toHaveCount(0);
  await expect(page.locator('.case-timeline')).toHaveCount(0);
  await page.goto('/case-link?receipt=unsafe#ticket='+ticket);
  await expect.poll(async()=>page.evaluate(()=>window.location.search)).toBe('');
  await expect.poll(async()=>page.evaluate(()=>window.location.hash)).toBe('');
});

test('mobile private-link view remains readable without sideways scrolling',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.goto('/case-link#ticket='+ticket);
  await expect(page.getByRole('heading',{name:'Open your private case link'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.screenshot({path:'test-results/sprint-10-review/case-link-280.png',fullPage:true});
  await page.goto('/profile?view=reports');
  await expect(page.getByRole('heading',{name:'My private reports'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
});

test('Privacy disclosure makes no government delivery or completed SMS assertion',async({page})=>{
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'One-time email/SMS case links'})).toBeVisible();
  await expect(page.getByText(/provider acceptance does not prove the message reached the recipient/)).toBeVisible();
  await expect(page.getByText(/no actual email or SMS provider is connected/)).toBeVisible();
});
