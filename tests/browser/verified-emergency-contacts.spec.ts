import {test,expect} from '@playwright/test';

test('Ekiti emergency category immediately displays verified call-first help and keeps report available',async({page})=>{
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Emergency',exact:true}).click();
  const notice=page.getByRole('alert',{name:'Emergency contact guidance'});
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link',{name:'Call 112'})).toHaveAttribute('href','tel:112');
  await expect(notice.getByRole('link',{name:'Ekiti State emergency guidance'}))
    .toHaveAttribute('href','https://ekitistate.gov.ng/help/');
  await expect(notice).toContainText('not an emergency call or guaranteed response');
  await expect(page.getByLabel('Ekiti Civic is typing')).toHaveCount(0);
  await page.locator('#guided-description').fill('There is an emergency on the main public road near our community today.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('#guided-lga')).toBeVisible();
});

test('non-emergency reports do not show a child-related questionnaire by default',async({page})=>{
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await expect(page.getByText('Optional safety and privacy details')).toBeVisible();
  await expect(page.getByRole('alert',{name:'Emergency contact guidance'})).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:'I need extra privacy protection for someone affected'})).not.toBeVisible();
  await expect(page.locator('#guided-description')).toBeVisible();
  await page.getByText('Optional safety and privacy details').click();
  await expect(page.getByRole('checkbox',{name:'I need extra privacy protection for someone affected'})).toBeVisible();
});
