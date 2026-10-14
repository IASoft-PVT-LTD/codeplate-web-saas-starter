import { expect, test } from '@playwright/test';
import { demo, signIn, signUp, watchErrors } from './helpers';

test('create, edit and delete a project', async ({ page }) => {
  const noErrors = watchErrors(page);
  await signUp(page, 'Pat Projects');
  await page.goto('/projects');
  await expect(page.getByText('No projects yet')).toBeVisible();

  await page.getByRole('link', { name: 'New project' }).first().click();
  await page.getByLabel('Name').fill('Spring launch');
  await page.getByLabel('Description').fill('Landing page and emails.');
  await page.getByLabel('Status').selectOption('active');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Project created.' })).toBeVisible();

  await page.getByLabel('Name').fill('Spring launch v2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByText('Spring launch v2')).toBeVisible();
  await page.getByText('Spring launch v2').click();
  await page.getByRole('button', { name: 'Delete project' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText('No projects yet')).toBeVisible();
  noErrors();
});

test('a project name is required', async ({ page }) => {
  await signUp(page);
  await page.goto('/projects/new');
  await page.getByLabel('Name').fill('   ');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);
});

test("people can't open each other's projects", async ({ page, browser }) => {
  await signUp(page, 'Owner One');
  await page.goto('/projects/new');
  await page.getByLabel('Name').fill('Private plans');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Private plans' })).toBeVisible();
  const url = page.url();

  const other = await browser.newPage();
  await signUp(other, 'Nosy Neighbor');
  await other.goto(url);
  await expect(other.getByRole('heading', { name: "We couldn't find that page." })).toBeVisible();
  await expect(other.getByText('Private plans')).toHaveCount(0);
  await other.close();
});

test('the free plan limit, then upgrading and canceling (billing simulator)', async ({ page }) => {
  // The seeded free user has 2 projects; the free plan allows 3.
  await signIn(page, demo.free);
  await page.goto('/projects/new');
  await page.getByLabel('Name').fill('Third project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Third project' })).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByRole('link', { name: 'Upgrade for more' })).toBeVisible();
  // The limit holds on the server too, not just in the UI.
  await page.goto('/projects/new');
  await page.getByLabel('Name').fill('Fourth project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText(/upgrade/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/new$/);

  await page.goto('/billing');
  await page.getByRole('button', { name: 'Simulate Pro (dev)' }).click();
  await expect(page.getByText("You're on the Pro plan.")).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: 'New project' })).toBeVisible();

  await page.goto('/billing');
  await page.getByRole('button', { name: 'Simulate cancel' }).click();
  await expect(page.getByText("You're on the Free plan.")).toBeVisible();
});
