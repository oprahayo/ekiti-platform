import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('downloads the latest private draft with the current location and no submission', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#lga').selectOption('efon');
  await page.locator('#ward').selectOption({ label: 'EFON IX' });
  // Reviewed Efon polygon interior. A confirmed lookup must not leak its coordinates into the file.
  await page.locator('#lat').fill('7.677235411135371');
  await page.locator('#lon').fill('4.943747799903621');
  await page.getByRole('button', { name: 'Confirm incident position' }).click();
  await expect(page.locator('#evidence')).toContainText('Boundary lookup: Efon');
  await page.getByText('Prepare a report draft').click();
  await expect(page.locator('#draft-privacy')).toContainText('Downloading does not submit');
  await expect(page.locator('#draft-privacy')).toContainText('Clearing the form will not delete');
  const sent: string[] = [];
  page.on('request', (request) => sent.push(request.url()));
  await page.getByLabel('Report type').selectOption('Commendation');
  await page.getByLabel('What happened?').fill('   ');
  await page.getByRole('button', { name: 'Download draft' }).click();
  await expect(page.getByLabel('What happened?')).toBeFocused();
  await page.getByLabel('What happened?').fill('Thank you for the repairs.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download draft' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('ekiti-report-draft.txt');
  const content = await readFile((await file.path())!, 'utf8');
  expect(content).not.toMatch(/7\.677235|4\.943747/);
  expect(content).toContain('Boundary lookup: Efon');
  expect(content).toContain('Unsubmitted');
  expect(content).toContain('Commendation\nThank you for the repairs.');
  expect(content).toContain('Efon · manual');
  expect(content).toContain('Electoral ward (manual): EFON IX');
  expect(sent.filter((url) => url.startsWith('http'))).toEqual([]);
  await page.getByRole('button', { name: 'Clear report text and type' }).click();
  await expect(page.getByLabel('What happened?')).toHaveValue('');
  await expect(page.locator('#ward option:checked')).toHaveText('EFON IX');
});

test('staging smoke probe passes against the local Worker and restricted PostGIS origin', async ({
  baseURL,
}) => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    'scripts/smoke-staging.mjs',
    baseURL!,
  ]);
  expect(stdout).toContain('Efon boundary lookup and unmapped ward passed');
});
