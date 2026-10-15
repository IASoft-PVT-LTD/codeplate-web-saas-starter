// The plan picked on the pricing page survives sign-up (or sign-in) and lands
// on its checkout. The checks run without Paddle, so the billing simulator
// stands in for Paddle's checkout overlay.
import { expect, test } from '@playwright/test';
import { plans } from '@/config/plans';
import { demo, PASSWORD, watchErrors } from './helpers';

test('pricing → sign up → checkout for the plan picked', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/pricing');
  await page.getByRole('link', { name: `Get ${plans.pro.name}` }).click();
  await expect(page).toHaveURL(/\/sign-up\?plan=pro$/);
  await expect(page.getByText(`You picked the ${plans.pro.name} plan.`)).toBeVisible();
  await page.getByLabel('Name').fill('Polly Plan');
  await page.getByLabel('Email').fill(`e2e-plan-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/billing\?plan=pro$/);
  await expect(page.getByText(`You picked the ${plans.pro.name} plan. Finish upgrading below.`)).toBeVisible();
  await expect(page.getByText('Your pick')).toBeVisible();
  await page.getByRole('button', { name: `Simulate ${plans.pro.name} (dev)` }).click();
  await expect(page.getByText(`You're on the ${plans.pro.name} plan.`)).toBeVisible();
  noErrors();
});

test('pricing → sign in (existing account) → checkout for the plan picked', async ({ page }) => {
  await page.goto('/pricing');
  await page.getByRole('link', { name: `Get ${plans.team.name}` }).click();
  // Wait for the sign-up page: until then "Sign in" is the header's plain link.
  await expect(page).toHaveURL(/\/sign-up\?plan=team$/);
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/sign-in\?plan=team$/);
  await expect(page.getByText(`Sign in to finish upgrading to ${plans.team.name}.`)).toBeVisible();
  await page.getByLabel('Email').fill(demo.free);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/billing\?plan=team$/);
  await expect(page.getByText(`You picked the ${plans.team.name} plan.`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Simulate ${plans.team.name} (dev)` })).toBeVisible();
});

test('a free or unknown plan on the link just signs people up', async ({ page }) => {
  await page.goto('/sign-up?plan=enterprise');
  await expect(page.getByText('You picked')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
});
