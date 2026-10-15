# Change plans and prices

Use when the user wants different plan names, prices, features or limits, a new limit (members, tasks, storage…), or another plan. Everything starts in `src/config/plans.ts`: the pricing page, the billing page, checkout and every limit check read it. The examples: Free goes from 3 to 5 projects, Pro from $12 to $15, and a **Business** plan is added. If you renamed the core resource, the limit key is your word (`limits.invoices`).

**What charges money is Paddle, not this file.** `price` here is display text. The amount a customer pays is the Paddle price behind `paddlePriceId`. Change both, or the pricing page and the checkout disagree. Paddle setup itself is `set-up-paddle.md`.

**From the pricing page to checkout:** a paid plan's button links to `/sign-up?plan=<id>`. Sign-up (and the Sign in link from it, for people with an account) passes the plan on to `/billing?plan=<id>`, which highlights it and, with Paddle set up, opens its checkout (`paidPlanId` and `afterAuthPath` in `plans.ts`; `tests/e2e/billing.spec.ts`). A plan id that isn't a paid plan is ignored, so a new plan carries through by itself.

## Names, prices, features

1. **Edit the plan** in `src/config/plans.ts`: `name`, `price` (text, e.g. `'$15'`), `period` (`'per month'`), `blurb`, `features`. Features are the bullet list on the pricing and billing pages, written for customers: list only what the app really does (the template's Team plan doesn't promise seats, because teams are `add-teams.md`; add "Up to 10 people" once they exist). Keep `features` true to the `limits` below them.
2. **Change the Paddle price** if the amount changed: in Paddle (sandbox first), create a new price on the product, then set its id in `.env.local` (`NEXT_PUBLIC_PADDLE_PRICE_PRO=pri_…`) and on the host. Tell the user to do the Paddle side; never put price ids or keys in code.
3. **Keep old prices working.** People who subscribed at the old price stay on the old price id. Paddle keeps sending their webhooks with it, and `applySubscriptionEvent()` (`src/lib/billing.ts`) ignores a price that no plan claims, so their renewals and cancellations would stop applying. If anyone may have bought at the old price, map it:
   - In the `Plan` type in `src/config/plans.ts`:
     ```ts
     /** Price ids this plan sold at before, which existing subscribers keep (server-side env, comma-separated). */
     oldPaddlePriceIds?: string[];
     ```
   - On the plan: `oldPaddlePriceIds: (process.env.PADDLE_OLD_PRICES_PRO ?? '').split(',').map((s) => s.trim()).filter(Boolean),`
   - In `planForPrice()`, match old ids too:
     ```ts
     const plan = Object.values(plans).find((p) => (p.paddlePriceId !== '' && p.paddlePriceId === priceId) || p.oldPaddlePriceIds?.includes(priceId));
     ```
   - In `.env.example`, under the price ids (the `env` check fails without it):
     ```
     # Old price ids a plan used to sell at, comma-separated, so existing subscribers keep their plan.
     PADDLE_OLD_PRICES_PRO=
     ```
   - In `vitest.config.ts`, add `PADDLE_OLD_PRICES_PRO: 'pri_test_pro_2025'` to `test.env`, and test it (step 4 of "Add a plan" shows the test).

## Change a limit

1. **Edit the number** in `limits` in `src/config/plans.ts` (`limits: { projects: 5 }`; `Infinity` means no limit) and the matching words in `features` (`'5 projects'`).
2. **Find copy that repeats the number.** The landing page (`src/config/landing.ts`) already reads the free limit from `plans.free.limits.projects`, so it follows. Text you or the user wrote may not: search for the old number (`grep -rn "3 project" src docs/project.md`) and read it from the config the same way wherever it appears in code.
3. **The limit message and the dashboard** (`src/lib/entitlements.ts`, `src/app/(app)/dashboard/page.tsx`) read `plan.limits`, so they follow.
4. **Update the tests that encode the rule** (rule 11: the user changed it on purpose, so the test changes; say so in your summary):
   - `tests/integration/projects.test.ts` loops to `plans.free.limits.projects`, so it follows the config.
   - `tests/e2e/projects.spec.ts`, "the free plan limit…": the seeded free user has 2 projects, and the test creates one more ("Third project") to hit the old limit of 3. Make it fill up to whatever the limit is. Import the config (`import { plans } from '@/config/plans';`) and replace the single create with:
     ```ts
     // The seeded free user has 2 projects; fill up to the free plan's limit.
     await signIn(page, demo.free);
     for (let i = 2; i < plans.free.limits.projects; i++) {
       await page.goto('/projects/new');
       await page.getByLabel('Name').fill(`Project ${i + 1}`);
       await page.getByRole('button', { name: 'Create project' }).click();
       await expect(page.getByRole('heading', { name: `Project ${i + 1}` })).toBeVisible();
     }
     ```
     If the free limit drops below 2, also change the seeded free user's count in `scripts/seed.ts` (the `2` next to `free@example.com`) and its header comment.

## Add a limit kind

Example: tasks per project (after `add-a-resource.md`). Storage, exports or anything else countable work the same way; `add-teams.md` adds a `seats` limit this way.

1. **Declare it** in the `Plan` type's `limits` in `src/config/plans.ts`, and give every plan a value (TypeScript fails until all have one):
   ```ts
   /** Max tasks in one project (Infinity = no limit). */
   tasksPerProject: number;
   ```
   `free: limits: { projects: 3, tasksPerProject: 10 }`, the paid plans `Infinity`. Add it to the plans' `features`.
2. **Write the check** in `src/lib/entitlements.ts`, next to `canCreateProject()`, counting only the user's own rows:
   ```ts
   /** Whether the user may add one more task to this project. */
   export async function canAddTask(db: Db, userId: string, projectId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
     const [plan, [row]] = await Promise.all([
       planFor(db, userId),
       db.select({ n: count() }).from(task).where(and(eq(task.ownerId, userId), eq(task.projectId, projectId))),
     ]);
     if ((row?.n ?? 0) < plan.limits.tasksPerProject) return { ok: true };
     return { ok: false, reason: `The ${plan.name} plan includes ${plan.limits.tasksPerProject} tasks per ${site.resource.one}. Upgrade for more.` };
   }
   ```
   (import `task` from `@/db/schema`).
3. **Enforce it on the server**, in the data function that creates the row (`createTask()` in `src/lib/tasks.ts`), not in the page: `const allowed = await canAddTask(db, ownerId, projectId); if (!allowed.ok) return allowed;`. The UI may also hide the button when the limit is reached, but only as a mirror (rule 4).
4. **Test it** in the resource's integration test: create up to `plans.free.limits.tasksPerProject`, expect the next to fail with a reason matching `/upgrade/i`, then insert an active `pro` subscription row (as `projects.test.ts` does) and expect it to succeed.

## Add a plan

1. **Add the id** to `PlanId` (`'free' | 'pro' | 'team' | 'business'`), the plan to `plans`, and the id to `planOrder` (the display order) in `src/config/plans.ts`:
   ```ts
   business: {
     id: 'business',
     name: 'Business',
     price: '$79',
     period: 'per month',
     blurb: 'For companies that need more.',
     features: ['Everything in Team', 'Up to 50 seats', 'Priority onboarding'],
     paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS ?? '',
     limits: { projects: Infinity },
   },
   ```
2. **Document the variable** in `.env.example` under the other price ids: `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS=` (the `env` check fails without it). The user creates the price in Paddle and sets the id in `.env.local` and on the host. `NEXT_PUBLIC_*` values are baked in at build time: rebuild after setting them.
3. **Fit the cards.** The plan grids are three columns: change `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4` in `src/app/(marketing)/pricing/page.tsx`, and to `md:grid-cols-2 xl:grid-cols-4` in `src/app/(app)/billing/page.tsx` (narrower, next to the sidebar). The pricing page highlights `id === 'pro'` as "Popular"; change that if another plan should be.
4. **Test the mapping.** Add the price to `test.env` in `vitest.config.ts` (`NEXT_PUBLIC_PADDLE_PRICE_BUSINESS: 'pri_test_business'`) and a test to `tests/integration/billing.test.ts`:
   ```ts
   it('maps every paid plan and old prices to their plan', async () => {
     const u = await makeUser(ctx);
     await deliver(event(u.id, { price: 'pri_test_business' }));
     expect((await planFor(ctx.db, u.id)).id).toBe('business');
     const old = await makeUser(ctx);
     await deliver(event(old.id, { price: 'pri_test_pro_2025' }));
     expect((await planFor(ctx.db, old.id)).id).toBe('pro');
   });
   ```
   (drop the second half if you didn't add old prices). The billing simulator offers "Simulate Business (dev)" by itself.

**Removing or renaming a plan id** strands its subscribers: `planFor()` (`src/lib/entitlements.ts`) treats an unknown plan id as Free. Never remove a plan someone pays for. To stop selling it, take it out of `planOrder` and keep it in `plans`; to rename it for customers, change `name`, not `id`.

**Yearly prices** need a second Paddle price per plan: add it like an old price (another id that maps to the same plan in `planForPrice()`), and a monthly/yearly switch on the pricing and billing pages that passes the right id to `CheckoutButton`.

## Verify

1. `npm run check`. It must end with `CODEPLATE CHECKS: PASS`. `env` catches an undocumented price variable; `test` and `e2e` run the limit and plan tests you updated.
2. Screenshots:
   ```
   npm run shots -- /pricing /
   npm run shots -- /billing /dashboard --as=pro
   npm run shots -- /projects --as=free
   npm run shots -- /pricing --size=390x844 --dark
   ```
   Look for: the new names, prices and features on `/pricing` and `/billing`, in the right order and all cards the same height; the landing page states the new free limit; the free user's dashboard shows "2 of 5"; the billing page offers the new plan in the simulator; on the phone the cards stack in one column.
