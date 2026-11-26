import { expect, test } from '@playwright/test';
import { openWorkspace, register, uniqueEmail } from './helpers';

test.beforeEach(async ({ page }) => {
  await register(page, 'Isla Status', uniqueEmail('status'));
  await openWorkspace(page);
});

test('requests can be marked Not yet / Integrating / Integrated and filtered', async ({ page }) => {
  const sidebar = page.locator('aside');
  await sidebar.getByText('Getting Started', { exact: true }).click();
  await sidebar.getByRole('button', { name: 'Folder Posts' }).click();

  const row = (name: string) => sidebar.getByRole('button', { name, exact: true });
  const statusButton = (name: string) => row(name).getByRole('button', { name: /^Integration status:/ });

  // Unmarked → Integrated from the sidebar icon
  await expect(statusButton('GET Get a post')).toHaveAccessibleName('Integration status: Not marked. Change status');
  await statusButton('GET Get a post').click();
  await page.getByRole('menuitemradio', { name: 'Integrated' }).click();
  await expect(statusButton('GET Get a post')).toHaveAccessibleName('Integration status: Integrated. Change status');

  // Integrating via the request's ⋯ menu
  await row('POST Create a post').getByRole('button', { name: 'Request actions' }).click();
  await page.getByRole('menuitemradio', { name: 'Status: Integrating' }).click();
  await expect(statusButton('POST Create a post')).toHaveAccessibleName('Integration status: Integrating. Change status');

  // The open request shows the same status in its header, and can change it there
  await row('GET List posts').click();
  const headerStatus = page.locator('main').getByRole('button', { name: /^Integration status:/ });
  await expect(headerStatus).toHaveText('Set status');
  await headerStatus.click();
  await expect(page.getByRole('menuitemradio', { name: 'Not yet' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('menuitemradio', { name: 'Not yet' }).click();
  await expect(headerStatus).toHaveText('Not yet');
  await expect(statusButton('GET List posts')).toHaveAccessibleName('Integration status: Not yet. Change status');

  // Filter the sidebar by status
  await sidebar.getByRole('button', { name: /Filter by integration status/ }).click();
  await page.getByRole('menuitemradio', { name: 'Integrated' }).click();
  await expect(row('GET Get a post')).toBeVisible();
  await expect(row('POST Create a post')).toBeHidden();
  await expect(row('GET List users')).toBeHidden();
  await sidebar.getByRole('button', { name: /Filter by integration status/ }).click();
  await page.getByRole('menuitemradio', { name: 'Not marked' }).click();
  await expect(row('GET List users')).toBeVisible();
  await expect(row('GET Get a post')).toBeHidden();
  await sidebar.getByRole('button', { name: 'Clear status filter' }).click();
  await expect(row('GET Get a post')).toBeVisible();

  // Saved on the server: survives a reload, and the overview shows progress
  await page.reload();
  await sidebar.getByText('Getting Started', { exact: true }).click();
  await sidebar.getByRole('button', { name: 'Folder Posts' }).click();
  await expect(statusButton('GET Get a post')).toHaveAccessibleName('Integration status: Integrated. Change status');
  await sidebar.getByRole('button', { name: 'Collection actions' }).first().click();
  await page.getByRole('menuitem', { name: 'Overview' }).click();
  const progress = page.getByRole('region', { name: 'Integration progress' });
  await expect(progress).toContainText('1 of 4 integrated');
  await expect(progress).toContainText('25%');

  // Clearing a status
  await statusButton('GET Get a post').click();
  await page.getByRole('menuitem', { name: 'Clear status' }).click();
  await expect(statusButton('GET Get a post')).toHaveAccessibleName('Integration status: Not marked. Change status');
  await expect(progress).toContainText('0 of 4 integrated');
});

test('the sidebar can be dragged wider, is remembered, and works with the keyboard', async ({ page }) => {
  const aside = page.locator('aside');
  const handle = page.getByRole('separator', { name: 'Resize sidebar' });
  const width = async () => Math.round((await aside.boundingBox())!.width);

  expect(await width()).toBe(280);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + 200, { steps: 5 });
  await page.mouse.up();
  expect(await width()).toBe(400);
  await expect(handle).toHaveAttribute('aria-valuenow', '400');

  await page.reload();
  expect(await width()).toBe(400);

  await handle.focus();
  await page.keyboard.press('Home');
  expect(await width()).toBe(220);
  await page.keyboard.press('ArrowRight');
  expect(await width()).toBe(236);

  await handle.dblclick();
  expect(await width()).toBe(280);
});
