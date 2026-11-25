import { expect, test } from '@playwright/test';
import { register, signIn, signOut, uniqueEmail } from './helpers';

test('register, sign out and sign back in with a cookie session', async ({ page, context }) => {
  const email = uniqueEmail('auth');
  await register(page, 'Ada Lovelace', email);

  // The session lives in an HttpOnly cookie; nothing secret is kept in localStorage.
  const cookie = (await context.cookies()).find((c) => c.name === 'magidoc_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  const stored = await page.evaluate(() => localStorage.getItem('magidoc-auth') ?? '');
  expect(stored).not.toContain('token');

  await signOut(page);
  expect((await context.cookies()).find((c) => c.name === 'magidoc_session')).toBeUndefined();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/); // protected route

  await signIn(page, email);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada');
});

test('recovery codes reset a forgotten password', async ({ page }) => {
  const email = uniqueEmail('recover');
  await register(page, 'Grace Hopper', email);

  // Dashboard nudges users without recovery codes
  await expect(page.getByText('Protect your account.')).toBeVisible();
  await page.getByRole('button', { name: 'Create recovery codes' }).click();
  const security = page.getByRole('dialog', { name: 'Security' });
  await security.getByRole('button', { name: 'Create recovery codes' }).click();
  await security.getByLabel('Confirm your current password').fill('password123');
  await security.getByRole('button', { name: 'Generate codes' }).click();

  const codesDialog = page.getByRole('dialog', { name: 'Save your recovery codes' });
  const codes = codesDialog.getByRole('listitem');
  await expect(codes).toHaveCount(10);
  const code = (await codes.first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  await expect(codesDialog.getByRole('button', { name: 'Done' })).toBeDisabled();
  await codesDialog.getByLabel('I’ve saved these codes somewhere safe').check();
  await codesDialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Protect your account.')).toBeHidden();

  await signOut(page);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Recovery code').fill(code.toLowerCase());
  await page.getByLabel('New password', { exact: true }).fill('a-brand-new-pass');
  await page.getByLabel('Confirm new password').fill('a-brand-new-pass');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/Password reset\. 9 recovery codes left/)).toBeVisible();

  await signIn(page, email, 'a-brand-new-pass');
});

test('wrong credentials show an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(uniqueEmail('nobody'));
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
});
