import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openWorkspace, register, uniqueEmail } from './helpers';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.beforeEach(async ({ page }) => {
  await register(page, 'Vera Vars', uniqueEmail('vars'));
  await openWorkspace(page);
});

test('variables are coloured by whether they resolve', async ({ page }) => {
  // Sample collection defines {{baseUrl}} as a collection variable.
  await page.getByText('Getting Started', { exact: true }).click();
  await page.getByText('Posts', { exact: true }).click();
  await page.getByText('Get a post', { exact: true }).click();

  const url = page.getByLabel('Request URL');
  await expect(url).toHaveValue('{{baseUrl}}/posts/1');
  await expect(page.locator('[data-var="baseUrl"][data-var-status="resolved"]')).toBeVisible();
  await expect(page.locator('[data-var-chip="baseUrl"][data-var-status="resolved"]')).toBeVisible();

  // Add an undefined variable → red in the field and in the chips
  await url.fill('{{baseUrl}}/posts/{{postId}}');
  await expect(page.locator('[data-var="postId"][data-var-status="unresolved"]')).toBeVisible();
  await expect(page.locator('[data-var-chip="postId"][data-var-status="unresolved"]')).toContainText('undefined');

  // Typing keeps focus in the field even as highlighting turns on/off
  await url.fill('');
  await url.pressSequentially('{{baseUrl}}/x');
  await expect(url).toBeFocused();
  await expect(url).toHaveValue('{{baseUrl}}/x');

  // Header values are highlighted too
  await page.getByRole('tab', { name: /Headers/ }).click();
  await page.getByLabel('Key').last().fill('Authorization');
  await page.getByLabel('Value').first().fill('Bearer {{token}}');
  await expect(page.locator('[data-var="token"][data-var-status="unresolved"]')).toBeVisible();
});

test('variable tables flag names and values that will not work', async ({ page }) => {
  await page.getByRole('button', { name: 'Collection actions' }).first().click();
  await page.getByRole('menuitem', { name: 'Overview' }).click();
  await page.getByRole('tab', { name: /Variables/ }).click();

  await expect(page.locator('[data-var-row-status="ok"]')).toHaveCount(1); // baseUrl
  await page.getByLabel('Variable name').last().fill('api key');
  await expect(page.locator('[data-var-row-status="error"]')).toHaveCount(1);
  await expect(page.getByText(/can’t be used as \{\{api key\}\}/)).toBeAttached();
  await page.getByLabel('Variable name').last().fill('emptyOne');
  await expect(page.locator('[data-var-row-status="warn"]')).toHaveCount(1);
});

test('import puts "Folder/Name" items into folders', async ({ page }) => {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import' });
  await dialog.locator('input[type=file][multiple]').setInputFiles(path.join(fixtures, 'folder-paths.postman.json'));
  const option = dialog.getByRole('checkbox', { name: /Create folders from names like “External\/Get users”/ });
  await expect(option).toBeChecked();
  await expect(dialog.getByText(/4 items use “Folder\/Name”/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Import collection' }).click();

  // Expand the imported collection in the sidebar
  const sidebar = page.locator('aside');
  await sidebar.getByText('Bookings API', { exact: true }).click();
  await expect(sidebar.getByText('External', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Internal', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Health check', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('GET /legacy/status', { exact: true })).toBeVisible(); // URL-like name left alone
  await expect(sidebar.getByText('Get users', { exact: true })).toBeHidden(); // inside the collapsed folder

  await sidebar.getByText('External', { exact: true }).click();
  await expect(sidebar.getByText('Get users', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Create user', { exact: true })).toBeVisible();
  await sidebar.getByText('Payments', { exact: true }).click();
  await expect(sidebar.getByText('Refund', { exact: true })).toBeVisible();
});

test('an already-imported collection can be organized into folders', async ({ page }) => {
  // Import the way older versions did: folder-path names kept as plain folder names.
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import' });
  await dialog.locator('input[type=file][multiple]').setInputFiles(path.join(fixtures, 'cms-flat-folders.postman.json'));
  await dialog.getByRole('checkbox', { name: /Create folders from names/ }).uncheck();
  await dialog.getByRole('button', { name: 'Import collection' }).click();

  const sidebar = page.locator('aside');
  await sidebar.getByText('CMS V2 Documentation', { exact: true }).click();
  await expect(sidebar.getByText('External User/Quiz', { exact: true })).toBeVisible();

  await sidebar.getByRole('button', { name: /5 items look like “Folder\/Name”/ }).click();
  await page.getByRole('dialog', { name: /Organize “CMS V2 Documentation” into folders/ }).getByRole('button', { name: 'Organize' }).click();
  await expect(page.getByText(/Organized \d+ items into folders/)).toBeVisible();

  // Top level now has just the two folders; the rest moved inside them
  await expect(sidebar.getByText('External User/Quiz', { exact: true })).toBeHidden();
  await expect(sidebar.getByRole('button', { name: /look like “Folder\/Name”/ })).toBeHidden();
  await sidebar.getByRole('button', { name: 'Folder External User' }).click();
  for (const name of ['Chat', 'Quiz', 'Networking', 'Session']) {
    await expect(sidebar.getByRole('button', { name: `Folder ${name}`, exact: true })).toBeVisible();
  }
  await sidebar.getByRole('button', { name: 'Folder Session' }).click();
  await expect(sidebar.getByRole('button', { name: 'Folder All Sessions', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Folder Physical', exact: true })).toBeVisible();
  await sidebar.getByRole('button', { name: 'Folder Internal User' }).click();
  await expect(sidebar.getByRole('button', { name: 'Folder User Groups', exact: true })).toBeVisible();
});
