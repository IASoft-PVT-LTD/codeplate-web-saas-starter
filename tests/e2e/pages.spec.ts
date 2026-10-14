import { expect, test } from '@playwright/test';
import { landing } from '@/config/landing';
import { demo, signIn, signUp, watchErrors } from './helpers';

// Every public page renders with a heading and no browser errors.
for (const path of ['/', '/pricing', '/sign-in', '/sign-up', '/forgot-password', '/legal/terms', '/legal/privacy']) {
  test(`public page ${path}`, async ({ page }) => {
    const noErrors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    noErrors();
  });
}

test('unknown pages get the 404 page', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: "We couldn't find that page." })).toBeVisible();
});

test('every app page renders for a Pro user', async ({ page }) => {
  const noErrors = watchErrors(page);
  await signIn(page, demo.pro);
  for (const [path, heading] of [['/dashboard', 'Hi, Paolo'], ['/projects', 'Projects'], ['/billing', 'Billing'], ['/settings', 'Settings']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  noErrors();
});

test('the admin page is for admins only', async ({ page }) => {
  // Pages in the app stream behind (app)/loading.tsx, so a 404 there arrives
  // with status 200 (and a noindex tag): check what the page shows instead.
  await signIn(page, demo.free);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: "We couldn't find that page." })).toBeVisible();
  await expect(page.getByText(demo.pro)).toHaveCount(0);

  await page.context().clearCookies();
  await signIn(page, demo.admin);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();
  await expect(page.getByText(demo.pro)).toBeVisible();
});

test('the app works on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, demo.pro);
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal scroll on a phone').toBeLessThanOrEqual(0);
});

test('the health check answers', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
});

test('the CodePlate credit is in the footer (required by the free license)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Built with CodePlate (codeplate.io)' })).toBeVisible();
});

test('the landing page has its sections, and marks sample quotes as placeholders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: landing.features.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: landing.pricing.title })).toBeVisible();
  const placeholders = landing.proof.quotes.filter((q) => q.placeholder).length;
  await expect(page.getByText('Placeholder', { exact: true })).toHaveCount(placeholders);
  // Link previews: the share image exists and the page points to it.
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toContain('/opengraph-image');
  const img = await page.request.get(new URL(og!).pathname);
  expect(img.headers()['content-type']).toBe('image/png');
});

test('robots.txt and the sitemap list the public pages', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: ');
  expect(robots).toContain('Disallow: /api/');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/pricing</loc>');
});

test('a page that throws shows the error page with a retry', async ({ page }) => {
  await page.goto('/dev/crash');
  await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test("a missing record inside the app keeps the app's navigation", async ({ page }) => {
  await signIn(page, demo.pro);
  await page.goto('/projects/no-such-id');
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { name: "We couldn't find that page." })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Billing' })).toBeVisible(); // the sidebar
});

test('saving settings confirms with a toast', async ({ page }) => {
  await signUp(page, 'Tia Toast');
  await page.goto('/settings');
  await page.getByLabel('Name').fill('Tia T.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
});
