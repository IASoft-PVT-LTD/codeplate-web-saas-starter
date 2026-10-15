# Add a field

Use when the core resource needs another piece of data (a budget, a priority, a client name, a URL…), or when its statuses should change. The example adds an optional **budget** in whole dollars to projects. If you renamed the resource (`rename-the-core-resource.md`), use your names: `invoice`, `src/lib/invoices.ts`, `invoice-form.tsx`, `/invoices`.

1. **Add the column** in `src/db/schema.ts`, inside `pgTable('project', …)`:
   ```ts
   budget: integer('budget'), // whole currency units, or null
   ```
   Pick the column type for the data: `text(...)` for words, `integer(...)` for counts and money, `boolean(...)`, `timestamp('…', { withTimezone: true })` for moments in time (always with the time zone: see rule 14 in AGENTS.md). Keep money as an integer (whole units here; for cents use a `budget_cents` column and convert in step 3), never a float. Import the column helper from `drizzle-orm/pg-core` if the file doesn't yet.

   **Nullable or a default.** A new `.notNull()` column with no `.default(…)` can't be added to a table that already has rows: the migration fails on any database with data. Make it nullable (as here) or give it a default, e.g. `integer('priority').notNull().default(2)`.

2. **Generate the migration:**
   ```
   npm run db:generate -- --name add_project_budget
   ```
   Open the new `drizzle/NNNN_add_project_budget.sql`. It should be one `ALTER TABLE "project" ADD COLUMN "budget" integer;`. Keep it (and its `drizzle/meta/` files). If drizzle-kit asks whether a column was "created or renamed", you renamed or removed a column too; see the end of this recipe.

3. **Validate it** in `src/lib/schemas.ts`, in `projectInput`. Form values arrive as strings; an empty optional field becomes `null`, the same pattern as `dueDate`:
   ```ts
   budget: z.union([z.literal(''), z.string().regex(/^\d{1,9}$/, 'Use a whole number, like 1200.')])
     .transform((v) => (v === '' ? null : Number(v))).default(null),
   ```
   Use `.default(null)` (the output value), not `.default('')`: zod 4 returns a default as is, without running the transform, so `''` would reach the integer column when the field is missing. Other shapes:
   - a choice: `priority: z.enum(['low', 'normal', 'high']).default('normal')`
   - required text: `client: z.string().trim().min(1, 'Who is it for?').max(120)`
   - a URL: `link: z.union([z.literal(''), z.url('Use a full link, starting with https://')]).transform((v) => (v === '' ? null : v)).default(null)`

   `ProjectInput` follows automatically, and `createProject()` / `updateProject()` in `src/lib/projects.ts` spread the parsed input into the row, so they need no change.

4. **Add it to the form** in `src/components/project-form.tsx`, after the due date field (inside the two-column grid). The `name` must equal the zod key; `e.budget` shows the zod message:
   ```tsx
   <Field label="Budget" htmlFor="budget" error={e.budget} hint="Optional. Whole dollars.">
     <Input id="budget" name="budget" type="number" inputMode="numeric" min={0} step={1} defaultValue={project?.budget ?? ''} />
   </Field>
   ```
   For a choice use `Select` with `<option>`s, like Status. All inputs come from `src/components/ui.tsx`.

5. **Show it in the list** (`src/app/(app)/projects/page.tsx`). Add a formatter under `metadata`:
   ```ts
   const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
   ```
   and, in the row's right-hand `<div>`, before the due date:
   ```tsx
   {p.budget !== null ? <span className="hidden sm:inline">{money.format(p.budget)}</span> : null}
   ```
   Compare with `!== null`, not truthiness, or a budget of 0 disappears. `hidden sm:inline` hides it on phones: the right-hand group doesn't shrink, so every extra item there squeezes the name (the edit page still shows it). The edit page (`src/app/(app)/projects/[id]/page.tsx`) shows the value through the form; add it to the `PageHeader` description or the dashboard (`src/app/(app)/dashboard/page.tsx`) only if the user wants it there.

6. **Seed it** in `scripts/seed.ts`: add `budget` to every row of `sample` (a number or `null`, so all rows have the same keys), e.g. `budget: 8000`. The screenshots use this data.

7. **Test it.**
   - `tests/integration/projects.test.ts`, a new `it` in the `describe('projects')` block:
     ```ts
     it('stores the budget', async () => {
       const u = await makeUser(ctx);
       const r = await createProject(ctx.db, u.id, projectInput.parse({ name: 'Budgeted', budget: '1200' }));
       if (!r.ok) throw new Error(r.reason);
       expect(r.project.budget).toBe(1200);
       expect(projectInput.parse({ name: 'No budget' }).budget).toBeNull();
       expect(projectInput.parse({ name: 'No budget', budget: '' }).budget).toBeNull();
       expect(projectInput.safeParse({ name: 'x', budget: '-5' }).success).toBe(false);
       expect(projectInput.safeParse({ name: 'x', budget: '12.50' }).success).toBe(false);
     });
     ```
   - `tests/e2e/projects.spec.ts`, in "create, edit and delete a project": after `selectOption('active')` add `await page.getByLabel('Budget').fill('1200');`, and after the list shows "Spring launch v2" add `await expect(page.getByText('$1,200')).toBeVisible();`.

8. **If there's a JSON API** (`add-an-api-endpoint.md`), it uses `projectInput` too, so it accepts the field already; add it to that endpoint's test.

## Changing the statuses

The statuses (`planned`, `active`, `done`) are a field like any other. They're a TypeScript-only enum on a `text` column, so changing the list needs no migration (changing the column's `.default(…)` does: run `npm run db:generate`). Update every place that names them:

- `src/db/schema.ts`: `text('status', { enum: [...] })` and `.default(...)`.
- `src/lib/schemas.ts`: `z.enum([...])` and its `.default(...)`.
- `src/components/project-form.tsx`: the `<option>`s and the `defaultValue` fallback.
- `src/components/status-badge.tsx`: `tones` and `labels` (tones are `neutral`, `brand`, `ok`, `warn`, `bad`).
- `src/app/(app)/dashboard/page.tsx`: the `'active'` count and the `'done'` filter.
- `scripts/seed.ts` sample rows, `tests/integration/projects.test.ts` (`status: 'active'`, `status: 'planned'`), `tests/e2e/projects.spec.ts` (`selectOption('active')`).

Rows already in a deployed database keep their old values. If you remove or rename a status, add a data migration: `npx drizzle-kit generate --custom --name rename_statuses`, then write `UPDATE "project" SET "status" = 'todo' WHERE "status" = 'planned';` in the new file.

## Renaming or removing a field

drizzle-kit asks "created or renamed?" for a renamed column, and that prompt needs an interactive terminal. Before launch (nothing deployed, see `rename-the-core-resource.md` step 2), it's simplest to remove the old column and add the new one in two separate `npm run db:generate` runs; data in the column is lost, so only do this when it holds nothing worth keeping. After launch, use `npx drizzle-kit generate --custom --name …` with `ALTER TABLE "project" RENAME COLUMN "old" TO "new";`, and update that newest `drizzle/meta/NNNN_snapshot.json` the same way `rename-the-core-resource.md` step 4b does, until `node checks/run.mjs --skip=typecheck,test,build,e2e` passes `migrations`.

## Verify

1. `npm run check`. It must end with `CODEPLATE CHECKS: PASS`. `migrations` fails if step 2 was skipped; `test` runs your new integration test; `e2e` fills the new field.
2. Screenshots:
   ```
   npm run shots -- /projects /projects/new --as=pro
   npm run shots -- /projects --as=pro --size=390x844 --dark
   ```
   Look for: the new field in the form with its label and hint, lined up with the others; the values in the list (formatted, "$8,000"); rows without a value show nothing, not "null" or "$0"; on the phone the names are no more cut off than before and nothing overflows; text readable in dark mode.
