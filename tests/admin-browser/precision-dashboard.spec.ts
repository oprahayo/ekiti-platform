import { test, expect } from '@playwright/test';

test('default desktop is a map-led Ekiti civic response dashboard, not a phone shell', async ({page}) => {
  await page.setViewportSize({width:1440,height:920});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Workspace overview'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Incident reports'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Ekiti LGA map and sample report counts'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Sample operational indicators'})).toBeVisible();
  const map=await page.locator('.precision-map-grid .ekiti-ops-map').boundingBox();
  const signals=await page.locator('.precision-map-grid .precision-signals').boundingBox();
  expect(map).not.toBeNull();
  expect(signals).not.toBeNull();
  expect(map!.width).toBeGreaterThan(signals!.width);
  expect(signals!.x).toBeGreaterThan(map!.x+map!.width);
  await expect(page.locator('.precision-table-section tbody tr')).toHaveCount(6);
  await expect(page.getByText('Not connected',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/admin-review/precision-desktop.png',fullPage:true});
});

test('dashboard search, queue and case review are functional on sample records',async({page})=>{
  await page.goto('/');
  const search=page.getByRole('searchbox',{name:'Search sample incident reports'});
  await search.fill('Ikere');
  await expect(page.locator('.precision-table-section tbody tr')).toHaveCount(1);
  await expect(page.locator('.precision-table-section tbody')).toContainText('DEMO-1002');
  await search.fill('');
  await page.locator('#precision-status').selectOption('escalated');
  await expect(page.locator('.precision-table-section tbody tr')).toHaveCount(1);
  await page.locator('#precision-status').selectOption('all');
  await page.locator('#precision-area').selectOption('Ado-Ekiti');
  await expect(page.locator('.precision-table-section tbody tr')).toHaveCount(1);
  await page.locator('.precision-open-case').click();
  await expect(page.locator('.detail-panel')).toContainText('DEMO-1001');
  await expect(page.getByText('No confirmed external receipt')).toBeVisible();
  await expect(page.getByText('No authenticated view event')).toBeVisible();
});

test('280px mobile dashboard has functioning navigation and no body overflow',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Workspace overview'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Incident reports'})).toBeVisible();
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(281);
  const sidebar=page.getByRole('navigation',{name:'Primary admin navigation'});
  await expect(sidebar.getByRole('button')).toHaveCount(4);
  await page.screenshot({path:'test-results/admin-review/precision-mobile-280.png',fullPage:true});
});
