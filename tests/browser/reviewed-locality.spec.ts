import {test,expect} from '@playwright/test';

async function beginReport(page:import('@playwright/test').Page,description:string){
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill(description);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
}
test('incident in Iludun Ekiti suggests Ilejemeje instead of asking for an LGA',async({page})=>{
  await beginReport(page,'There is a dangerous, badly broken road in Iludun Ekiti near the school.');
  await expect(page.getByText(/Possible incident location: Iludun-Ekiti/)).toBeVisible();
  await expect(page.getByText(/Likely LGA: Ilejemeje/)).toBeVisible();
  await expect(page.locator('#guided-lga')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'View location source'})).toHaveAttribute('href',/ekitistate.gov.ng/);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByText(/Iludun-Ekiti/).first()).toBeVisible();
});
test('a source-backed candidate remains easy to correct',async({page})=>{
  await beginReport(page,'Heavy flooding along the road in Eda Oniyo Ekiti has damaged several houses.');
  await expect(page.getByText(/Likely LGA: Ilejemeje/)).toBeVisible();
  await page.getByRole('button',{name:'Change location'}).click();
  await expect(page.locator('#guided-lga')).toBeVisible();
  await page.locator('#guided-lga').selectOption('ikole');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByText(/Ikole/).first()).toBeVisible();
});
test('an unrecognized location gets an honest manual fallback',async({page})=>{
  await beginReport(page,'The main road near an unnamed farm has a very deep and dangerous hole.');
  await expect(page.locator('#guided-lga')).toBeVisible();
  await expect(page.getByText(/Possible incident location/)).toHaveCount(0);
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByText(/Ado-Ekiti/).first()).toBeVisible();
});
test('reviewed search returns location context without fabricating an incident pin',async({page})=>{
  await page.route('**/api/search?**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({query:'Hotels in Ikogosi',reviewedOnly:true,places:[],knowledge:[],
      locationScope:'specific-place',localityHint:{
        name:'Ikogosi-Ekiti',lgaId:'ekiti-west',lgaName:'Ekiti West',
        source:'https://www.ekitistate.gov.ng/about-ekiti/tourism',
        confidence:'reviewed-place-name',
      }}),
  }));
  await page.goto('/search?q=Hotels+in+Ikogosi');
  await expect(page.getByRole('heading',{name:'Recognized place'})).toBeVisible();
  await expect(page.getByText(/Likely local government area: Ekiti West/)).toBeVisible();
  await expect(page.getByText(/not GPS verification/)).toBeVisible();
  await expect(page.locator('.search-result')).toHaveCount(1);
});
