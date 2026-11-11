import {test,expect} from '@playwright/test';

test('search-first homepage sends an Ekiti service query to reviewed directory search',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  const box=page.getByRole('searchbox',{name:'Search Ekiti State'});
  await expect(box).toBeVisible();
  await box.fill('electrician in Ikere');
  await page.getByRole('button',{name:'Search Ekiti'}).click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.getByRole('searchbox').first()).toHaveValue('electrician in Ikere');
});

test('guest can create a service listing draft and reopen it from their dashboard',async({page})=>{
  await page.goto('/listings/new');
  await page.locator('#listing-name').fill('Test electrical repairs Ekiti');
  await page.locator('#listing-category').selectOption('Electricians');
  await page.locator('#listing-lga').selectOption('ikere');
  await page.locator('#listing-description')
    .fill('This is a fictional test workshop for the inEkiti directory user journey.');
  await page.getByRole('button',{name:'Review listing draft'}).click();
  await expect(page.getByRole('heading',{name:'Review your listing'})).toBeVisible();
  await page.getByRole('button',{name:'Save private draft in this tab'}).click();
  await expect(page.getByText(/Draft saved in this browser tab, not submitted or published/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Submit for independent review'})).toHaveCount(0);
  await page.goto('/profile?view=listings');
  await expect(page.getByRole('heading',{name:'My listings'})).toBeVisible();
  await expect(page.getByText('Test electrical repairs Ekiti')).toBeVisible();
  await expect(page.getByText('No server-confirmed submissions to show.')).toBeVisible();
  await page.getByRole('button',{name:'Delete'}).click();
  await expect(page.getByText('No saved drafts in this tab.')).toBeVisible();
});

test('citizen dashboard stays readable on narrow mobile',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.goto('/profile?view=listings');
  await expect(page.getByRole('heading',{name:'My listings'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.goto('/');
  await expect(page.getByRole('searchbox',{name:'Search Ekiti State'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
});
