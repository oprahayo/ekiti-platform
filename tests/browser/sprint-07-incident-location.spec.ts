import {test,expect} from '@playwright/test';

const ado={id:'ado-ekiti',name:'Ado-Ekiti'};
const ikere={id:'ikere',name:'Ikere'};
const verified={
  stateBoundaryStatus:'inside',stateOnBoundary:false,consistency:'consistent',
  requiresConfirmation:false,
  lga:{status:'matched',match:ado,candidates:[ado]},
  ward:{status:'matched',match:{
    id:'test-ward-01',name:'Example Verified Ward',parentId:'ado-ekiti',
    sourceId:'verified-test-source',onBoundary:false,
  },candidates:[]},
};
async function startAtLocation(page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Roads',exact:true}).click();
  await page.locator('#guided-description').fill('The bridge approach has dangerous large holes beside the public market.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('#guided-lga')).toBeVisible();
}
async function completeDraft(page){
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.getByRole('heading',{name:'Review your private draft'})).toBeVisible();
}

test('Sprint 07 never calls GPS or boundary resolver until resident chooses an incident-point check',async({page})=>{
  let requests=0;
  await page.route('**/api/resolve',async route=>{requests++;await route.fulfill({json:verified});});
  await startAtLocation(page);
  await expect(page.getByRole('button',{name:'I am at the incident'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Check known coordinates'})).toBeVisible();
  expect(requests).toBe(0);
  await page.locator('#guided-lga').selectOption('ikere');
  await completeDraft(page);
  await expect(page.locator('.review-list')).toContainText('LGA selected manually; coordinates not checked or saved');
  expect(requests).toBe(0);
});

test('coordinate lookup confirms a VERIFIED suggestion without saving GPS or ward data',async({page})=>{
  const bodies=[];
  await page.route('**/api/resolve',async route=>{
    bodies.push(JSON.parse(route.request().postData()||'{}'));
    await route.fulfill({status:200,json:verified});
  });
  await startAtLocation(page);
  await page.getByRole('button',{name:'Check known coordinates'}).click();
  await page.locator('#incident-latitude').fill('7.623456');
  await page.locator('#incident-longitude').fill('5.223456');
  await expect(page.locator('#guided-lga')).toHaveValue('');
  expect(bodies).toHaveLength(0);
  await page.getByRole('button',{name:'Check incident coordinates'}).click();
  await expect(page.getByText('Verified boundary suggests Ado-Ekiti')).toBeVisible();
  await expect(page.getByText('Matched ward: Example Verified Ward.')).toBeVisible();
  await expect(page.locator('#guided-lga')).toHaveValue('');
  await page.getByRole('button',{name:'Use suggested LGA'}).click();
  await expect(page.locator('#guided-lga')).toHaveValue('ado-ekiti');
  expect(bodies).toEqual([{latitude:7.623456,longitude:5.223456,confirmed:true}]);
  await completeDraft(page);
  await expect(page.locator('.review-list')).toContainText('Verified-boundary suggestion confirmed by you');
  await expect(page.locator('.review-list')).toContainText('Example Verified Ward');
  await page.getByRole('checkbox',{name:/I understand this is a local draft/}).check();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  await expect(page.getByRole('heading',{name:'Draft saved locally'})).toBeVisible();
  const stored=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1')||'');
  expect(stored).toContain('"lgaId":"ado-ekiti"');
  expect(stored).not.toContain('7.623456');
  expect(stored).not.toContain('5.223456');
  expect(stored).not.toContain('ward');
  expect(stored).not.toContain('coordinates');
  expect(stored).not.toContain('sourceId');
  expect(stored).not.toContain('location');
  await page.reload();
  await page.getByRole('button',{name:'Continue saved draft'}).click();
  await expect(page.locator('.review-list')).toContainText('LGA selected manually; coordinates not checked or saved');
});

test('outside-Ekiti coordinates never assign an Ekiti LGA; manual reporting remains available',async({page})=>{
  await page.route('**/api/resolve',async route=>route.fulfill({json:{
    stateBoundaryStatus:'outside',lga:{status:'outside_scope',match:null,candidates:[]},
    ward:{status:'outside_scope',match:null,candidates:[]},consistency:'unverified',
  }}));
  await startAtLocation(page);
  await page.getByRole('button',{name:'Check known coordinates'}).click();
  await page.locator('#incident-latitude').fill('41.3');
  await page.locator('#incident-longitude').fill('2.1');
  await page.getByRole('button',{name:'Check incident coordinates'}).click();
  await expect(page.getByText(/This point appears outside Ekiti State/)).toBeVisible();
  await expect(page.locator('#guided-lga')).toHaveValue('');
  await page.locator('#guided-lga').selectOption('ikere');
  await completeDraft(page);
  await expect(page.locator('.review-list')).toContainText('Ikere');
  await expect(page.locator('.review-list')).toContainText('LGA selected manually');
});

test('ambiguous LGA boundary cannot preselect, conflict fails closed, input validation blocks network',async({page})=>{
  let requests=0;
  await page.route('**/api/resolve',async route=>{
    requests++;
    await route.fulfill({json:{
      stateBoundaryStatus:'inside',lga:{status:'ambiguous',
        match:null,candidates:[ado,ikere]},ward:{status:'unmapped',match:null},
      consistency:'unverified',requiresConfirmation:true,
    }});
  });
  await startAtLocation(page);
  await page.getByRole('button',{name:'Check known coordinates'}).click();
  await page.locator('#incident-latitude').fill('91');
  await page.locator('#incident-longitude').fill('5.2');
  await page.getByRole('button',{name:'Check incident coordinates'}).click();
  await expect(page.getByText(/Enter valid latitude/)).toBeVisible();
  expect(requests).toBe(0);
  await page.locator('#incident-latitude').fill('7.5');
  await page.getByRole('button',{name:'Check incident coordinates'}).click();
  await expect(page.getByText(/point is on an uncertain LGA boundary/)).toBeVisible();
  await expect(page.getByText(/Possible areas: Ado-Ekiti, Ikere/)).toBeVisible();
  await expect(page.locator('#guided-lga')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Use suggested LGA'})).toHaveCount(0);
  await page.locator('#guided-lga').selectOption('ikere');
  await expect(page.locator('#guided-lga')).toHaveValue('ikere');
});

test('on-scene permission is prompted only on explicit action, and does not reuse Explore state',async({page,context})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:7.625,longitude:5.25});
  let requests=0;
  await page.route('**/api/resolve',async route=>{
    requests++;await route.fulfill({json:verified});
  });
  await startAtLocation(page);
  await page.getByRole('button',{name:'I am at the incident'}).click();
  expect(requests).toBe(0);
  await page.getByRole('button',{name:'Check this incident position'}).click();
  await expect(page.getByText('Verified boundary suggests Ado-Ekiti')).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.locator('#guided-lga')).toHaveValue('');
});

test('safeguarding flags suppress sensitive coordinate checks; 280px remains usable',async({page})=>{
  await page.setViewportSize({width:280,height:760});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/report');
  await page.getByRole('button',{name:'Write text'}).click();
  await page.getByRole('button',{name:'Security',exact:true}).click();
  await page.getByRole('checkbox',{name:'It involves a child or a vulnerable person'}).check();
  await page.locator('#guided-description').fill(
    'Someone reported threats near the public facility, no names should be shared.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByText(/exact location checks are disabled/)).toBeVisible();
  await expect(page.getByRole('button',{name:'I am at the incident'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Check known coordinates'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(280);
  await page.screenshot({path:'test-results/sprint-07-review/incident-280.png',fullPage:true});
});
