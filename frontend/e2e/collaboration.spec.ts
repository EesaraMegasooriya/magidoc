import { expect, test } from '@playwright/test';
import { openWorkspace, register, uniqueEmail } from './helpers';

test('a teammate joins a workspace with its join code', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, 'Olivia Owner', uniqueEmail('owner'));
  await openWorkspace(owner);
  await owner.getByRole('button', { name: 'Invite', exact: true }).click();
  await owner.getByRole('button', { name: 'Create join code' }).click();
  const code = (await owner.getByLabel('Join code', { exact: true }).textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const workspaceUrl = owner.url();

  const mateCtx = await browser.newContext();
  const mate = await mateCtx.newPage();
  await register(mate, 'Tom Teammate', uniqueEmail('mate'));
  await mate.getByRole('button', { name: 'Join workspace' }).first().click();
  const dialog = mate.getByRole('dialog', { name: 'Join a workspace' });
  await dialog.getByLabel('Join code').fill(code.replace('-', '').toLowerCase()); // auto-formats
  await expect(dialog.getByLabel('Join code')).toHaveValue(code);
  await dialog.getByLabel('Join code').press('Enter');
  await expect(mate).toHaveURL(new URL(workspaceUrl).pathname);
  await expect(mate.getByRole('button', { name: 'Switch workspace' })).toContainText('Editor');

  // The owner sees the new member
  await owner.reload();
  await owner.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(owner.getByText('Tom Teammate')).toBeVisible();

  await ownerCtx.close();
  await mateCtx.close();
});

test('an incorrect join code is explained inline', async ({ page }) => {
  await register(page, 'Wendy Wrong', uniqueEmail('wrong'));
  await page.getByRole('button', { name: 'Join workspace' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Join a workspace' });
  await dialog.getByLabel('Join code').fill('ZZZZZZZZ');
  await dialog.getByRole('button', { name: 'Join workspace' }).click();
  await expect(dialog.getByRole('alert')).toContainText('No workspace matches this code');
});
