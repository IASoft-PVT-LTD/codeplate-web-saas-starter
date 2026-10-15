import { expect, test } from '@playwright/test';
import { demo, signIn, signUp, watchErrors } from './helpers';

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('sign up, sign out, sign back in', async ({ page }) => {
  const noErrors = watchErrors(page);
  const { email, password } = await signUp(page, 'Sam Tester');
  await expect(page.getByRole('heading', { name: 'Hi, Sam' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page, email, password);
  noErrors();
});

test('a wrong password is refused', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(demo.free);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('status')).toContainText(/(invalid|wrong) email or password/i);
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('reset a forgotten password with the emailed link', async ({ page }) => {
  const { email } = await signUp(page, 'Rita Reset');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText("we've sent a link")).toBeVisible();

  // The console mailer keeps the mail in the dev outbox.
  await page.goto('/dev/outbox');
  const mail = page.locator('article', { hasText: `To ${email}` }).first();
  await mail.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel('New password').fill('a brand new password');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/sign-in\?reset=1$/);
  await signIn(page, email, 'a brand new password');
});
