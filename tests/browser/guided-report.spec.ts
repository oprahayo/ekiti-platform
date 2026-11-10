import { test, expect } from '@playwright/test';

test('welcome gateway gives distinct report, feedback, post, explore, listing and ask routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Ekiti Civic' })).toBeVisible();
  await expect(page.getByText('Your mobile gateway to Ekiti State.')).toBeVisible();
  await expect(page.locator('.welcome-action')).toHaveCount(5);
  await expect(page.locator('#home-ask-input')).toHaveCount(0);
  for(const route of ['/report','/report?kind=feedback','/explore','/listings/new','/ask']) {
    await expect(page.locator('.welcome-action[href="'+route+'"]')).toHaveCount(1);
  }
});

test('guided report choices advance real conversation and save an honest private draft', async ({ page }) => {
  const touched: string[] = [];
  page.on('request', request => {
    if(/\/api\/(?:reports|tracking)/.test(request.url())) touched.push(request.url());
  });
  await page.goto('/report');
  await expect(page.getByText(/How would you like to share/)).toBeVisible();
  await page.getByRole('button', { name:/Write text/ }).click();
  await expect(page.getByText(/What best describes the report/)).toBeVisible();
  await page.getByRole('button',{name:'Roads'}).click();
  await page.locator('#guided-description').fill('The road beside the community health centre has a large dangerous hole.');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('#guided-lga').selectOption('ado-ekiti');
  await page.locator('#guided-community').fill('By the main market');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText(/Would you like to attach evidence now/)).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/No follow-up contact/}).click();
  await expect(page.getByRole('heading',{name:'Review your private draft'})).toBeVisible();
  await expect(page.locator('.review-list')).toContainText('Ado-Ekiti');
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  await expect(page.getByRole('heading',{name:'Draft saved locally'})).toBeVisible();
  await expect(page.getByText(/No report has been submitted/)).toBeVisible();
  const stored=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1'));
  expect(stored).toContain('Roads');
  expect(touched).toEqual([]);
  await expect(page.locator('.reference-text')).toHaveCount(0);
});

test('capture is evidence only: photo preview, optional email and no upload/notification', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', request=> {
    if(request.method() !== 'GET') sent.push(request.url());
  });
  await page.goto('/report');
  await page.getByRole('button',{name:'Photo'}).click();
  await page.getByRole('button',{name:'Water'}).click();
  await page.locator('#guided-description').fill('The water pipe is broken near the town library, leaving the street flooded.');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('#guided-lga').selectOption('ikere');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByLabel('Choose existing evidence').setInputFiles({
    name:'incident.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9d6vIukAAAAASUVORK5CYII=','base64')
  });
  await expect(page.getByText(/incident.png/)).toBeVisible();
  await page.getByRole('button',{name:'Continue with evidence'}).click();
  await page.getByRole('button',{name:/Email tracking link/}).click();
  await page.locator('#guided-contact').fill('resident@example.test');
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Review your private draft'})).toBeVisible();
  await expect(page.getByText(/delivery not active/)).toBeVisible();
  await page.getByRole('button',{name:'Save private draft on this device'}).click();
  const stored=await page.evaluate(()=>sessionStorage.getItem('ekiti-guided-draft-v1'));
  expect(stored).not.toContain('resident@example.test');
  expect(stored).not.toContain('data:image');
  expect(sent).toEqual([]);
});

test('emergency category clearly states this project cannot dispatch help', async ({ page }) => {
  await page.goto('/report');
  await page.getByRole('button',{name:/Audio note/}).click();
  await page.getByRole('button',{name:'Emergency'}).click();
  await expect(page.getByText(/contact emergency services directly/)).toBeVisible();
  await expect(page.getByText(/does not dispatch help/)).toBeVisible();
});

test('feedback and listings remain editable drafts without a public forum', async ({ page }) => {
  await page.goto('/report?kind=feedback');
  await expect(page.getByText(/Welcome\. We can prepare your feedback together/)).toBeVisible();
  await page.goto('/post');
  await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();
  await page.goto('/listings/new');
  await page.locator('#listing-name').fill('Example community tailor');
  await page.locator('#listing-category').selectOption('Hairdressers');
  await page.locator('#listing-lga').selectOption('Ikere');
  await page.locator('#listing-description').fill('An independently operated shop providing affordable clothing repairs and alterations.');
  await page.getByRole('button',{name:'Review listing draft'}).click();
  await expect(page.getByRole('heading',{name:'Listing preview prepared'})).toBeVisible();
  await expect(page.getByText(/Not published or submitted/)).toBeVisible();
  await page.getByRole('link',{name:'Browse Ekiti Yellow Pages'}).click();
  await expect(page).toHaveURL(/\/explore$/);
});

for (const width of [280,320,390,768,1280]) {
  test('gateway and guided chat fit without horizontal scrolling at '+width+'px', async ({ page }) => {
    await page.setViewportSize({ width, height:800 });
    await page.goto('/');
    await expect(page.locator('.welcome-action')).toHaveCount(5);
    const home = await page.evaluate(()=>({doc:document.documentElement.scrollWidth,view:innerWidth}));
    expect(home.doc).toBeLessThanOrEqual(home.view);
    if ([280,390,1280].includes(width))
      await page.screenshot({path:'test-results/citizen-journeys/home-'+width+'.png',fullPage:true});
    await page.goto('/report');
    await expect(page.getByText(/Welcome\. I will guide you through a report/)).toBeVisible();
    const report=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,view:innerWidth}));
    expect(report.doc).toBeLessThanOrEqual(report.view);
    if ([280,390,1280].includes(width))
      await page.screenshot({path:'test-results/citizen-journeys/report-'+width+'.png',fullPage:true});
  });
}
