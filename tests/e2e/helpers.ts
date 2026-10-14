import { expect, type Page } from '@playwright/test';

// Demo users from scripts/seed.ts.
export const PASSWORD = 'password123';
export const demo = { free: 'free@example.com', pro: 'pro@example.com', admin: 'admin@example.com' };

let n = 0;

/** Signs up a brand-new user through the form and lands on the dashboard. */
export async function signUp(page: Page, name = 'Sam Tester') {
  n += 1;
  const email = `e2e-${Date.now()}-${n}@example.com`;
  const password = 'correct horse battery';
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { email, password };
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Fails the test on any console error or uncaught exception in the page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return () => expect(errors, 'browser console errors').toEqual([]);
}
