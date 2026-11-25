import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openWorkspace, register, uniqueEmail } from './helpers';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.beforeEach(async ({ page }) => {
  await register(page, 'Sam Sender', uniqueEmail('ws'));
  await openWorkspace(page);
});

test('send a request through the server-side runner', async ({ page }) => {
  await page.getByRole('button', { name: /New request/ }).first().click();
  // Targets MagiDoc's own health endpoint so the test needs no internet access.
  await page.getByLabel('Request URL').fill('http://localhost:8080/actuator/health');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('200 OK')).toBeVisible();
  await expect(page.getByText('"UP"').first()).toBeVisible();
});

test('import two files and auto-merge them into one collection', async ({ page }) => {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import' });
  await dialog.locator('input[type=file][multiple]').setInputFiles([
    path.join(fixtures, 'users.magidoc.json'),
    path.join(fixtures, 'users-v2.postman.json'),
  ]);
  await expect(dialog.getByRole('list', { name: 'Files to import' }).getByRole('listitem')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Merge 2 files into new collection' }).click();
  // List users (/users) and List all users (/users?_limit=5) are the same endpoint → updated, not duplicated
  await expect(page.getByText('4 added, 1 updated, 2 folders added')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Collection name' })).toHaveValue('Users API + Users API v2');
});

test('share a note in the text space', async ({ page }) => {
  await page.getByRole('button', { name: 'Text space' }).click();
  await page.getByRole('button', { name: 'New text' }).click();
  await page.getByRole('menuitem', { name: 'New note' }).click();
  await page.getByRole('dialog', { name: 'New note' }).getByRole('textbox').fill('On-call handbook');
  await page.keyboard.press('Enter');

  await page.getByRole('textbox').last().fill('## Escalation\n\nCall **#ops** first.');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByText('Unsaved changes')).toBeHidden();

  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.getByRole('heading', { name: 'Escalation' })).toBeVisible();
  await page.getByLabel('Search texts').fill('#ops');
  await expect(page.getByRole('button', { name: /^On-call handbook/ })).toBeVisible();
});

test('WebSocket echo round-trip @external', async ({ page }) => {
  test.skip(!process.env.E2E_EXTERNAL, 'Needs internet access (set E2E_EXTERNAL=1)');
  await page.getByRole('button', { name: 'WebSocket' }).click();
  await page.getByRole('button', { name: 'New WebSocket connection' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Echo');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('region', { name: 'Message composer' }).getByRole('textbox').fill('hello magidoc');
  await page.getByRole('region', { name: 'Message composer' }).getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('log').getByLabel('Received')).toHaveCount(2, { timeout: 15_000 }); // greeting + echo
});
