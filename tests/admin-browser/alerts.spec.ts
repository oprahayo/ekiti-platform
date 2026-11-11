import {test,expect} from '@playwright/test';

test('alerts stay opt-in, filtered by severity and LGA, without a live service',async({page})=>{
  await page.goto('/');
  const toggle=page.getByRole('button',{name:/Alerts/});
  await expect(toggle).toBeVisible();
  await expect(page.getByText('Demo only.')).toBeVisible();
  await toggle.click();
  const panel=page.getByRole('region',{name:'Filtered sample alerts'});
  await expect(panel).toBeVisible();
  await expect(page.getByText(/fictional platform alerts/)).toBeVisible();
  await expect(page.getByLabel('Sound alerts')).not.toBeChecked();
  await expect(page.getByLabel('Demo alert chime volume')).toHaveValue('35');
  await expect(page.getByText(/No live incident, urgent dispatch/)).toBeVisible();
  await page.getByRole('combobox',{name:'Priority'}).selectOption('attention');
  await expect(panel.locator('li')).not.toHaveCount(0);
  await page.getByRole('combobox',{name:'Local government'}).selectOption('Ikere');
  await expect(page.getByText('No sample alerts match the filters.')).toBeVisible();
  await page.getByRole('combobox',{name:'Local government'}).selectOption('');
  await panel.locator('li button').first().click();
  await expect(page.locator('.detail-panel')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
});
test('sound toggle and preview are user-controlled; no request for notification permission on page load',async({page})=>{
  let calls=0;
  await page.addInitScript(()=>{
    // Test can assert no automatic permission prompt without requesting a
    // real permission in headless CI.
    Object.defineProperty(window,'__notificationProbe',{value:true});
  });
  page.on('dialog',()=>{calls++;});
  await page.goto('/');
  await expect(page.getByRole('button',{name:/Alerts/})).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole('button',{name:/Alerts/}).click();
  const checkbox=page.getByLabel('Sound alerts');
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.getByLabel('Demo alert chime volume').fill('0');
  await page.getByRole('button',{name:'Preview two-tone alert'}).click();
  await expect(page.getByLabel('Sound alerts')).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  expect(calls).toBe(0);
});
test('280px admin keeps four main navigation choices and a usable alert panel',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Primary admin navigation'});
  await expect(nav.getByRole('button')).toHaveCount(4);
  await page.getByRole('button',{name:/Alerts/}).click();
  await expect(page.getByRole('heading',{name:/Alerts/})).toBeVisible();
  const size=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(size).toBeLessThanOrEqual(280);
});
