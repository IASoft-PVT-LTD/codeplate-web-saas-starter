# Rename the core resource

Use when the user's product manages something other than "projects" (invoices, recipes, courses…). The example turns **project / projects** into **invoice / invoices**; substitute the user's words everywhere. Do this before adding fields or resources, so later work uses the new names.

This recipe renames only. It keeps the fields (name, description, status, due date). Change those afterwards with `add-a-field.md`.

1. **Pick the four spellings** and write them down: `invoice`, `invoices`, `Invoice`, `Invoices`. If the plural isn't just "+s" (company → companies), always replace the plural before the singular, or you'll get "companys".

2. **Decide how the database changes.** Read `docs/project.md` (Hosting, Log) and ask the user if it's unclear: *has any database outside this machine (staging or production) ever run this app's migrations?*
   - **No, nothing is deployed yet:** regenerate the migrations (step 4a). Only databases that already ran the old migrations care about history, and the only ones are the local `.data/` folders, which you delete. The new `0000_init.sql` creates `invoice` directly.
   - **Yes, or not sure:** write a rename migration (step 4b). It keeps every row. Never drop and recreate the table on a deployed database: that deletes the users' data.

3. **Rename the table** in `src/db/schema.ts`: `export const project = pgTable('project', …` becomes `export const invoice = pgTable('invoice', …`, and the index `index('project_owner_idx')` becomes `index('invoice_owner_idx')`. Delete the "Projects is a placeholder" comment above it.

4. **Write the migration.** Don't run plain `npm run db:generate` here: drizzle-kit sees a renamed table and asks "created or renamed?" in a prompt that only works in an interactive terminal (in an agent shell it fails with `Interactive prompts require a TTY terminal`).

   **4a. Nothing deployed: regenerate.** Delete the `drizzle/` folder and the local database, then generate a fresh first migration:
   ```
   rm -rf drizzle .data/pglite
   npm run db:generate -- --name init
   ```
   (PowerShell: `Remove-Item -Recurse -Force drizzle, .data/pglite`.) `drizzle/0000_init.sql` should now contain `CREATE TABLE "invoice"`. `npm run seed` refills the local database.

   **4b. Deployed: a rename migration.** Create an empty migration:
   ```
   npx drizzle-kit generate --custom --name rename_project_to_invoice
   ```
   Put this in the new `drizzle/NNNN_rename_project_to_invoice.sql` (keep the `--> statement-breakpoint` markers; the migrator runs one statement at a time):
   ```sql
   ALTER TABLE "project" RENAME TO "invoice";--> statement-breakpoint
   ALTER TABLE "invoice" RENAME CONSTRAINT "project_pkey" TO "invoice_pkey";--> statement-breakpoint
   ALTER TABLE "invoice" RENAME CONSTRAINT "project_owner_id_user_id_fk" TO "invoice_owner_id_user_id_fk";--> statement-breakpoint
   ALTER INDEX "project_owner_idx" RENAME TO "invoice_owner_idx";
   ```
   drizzle-kit copied the previous snapshot into `drizzle/meta/NNNN_snapshot.json` (the newest one) unchanged, so it still describes `project`. Update that one file to match the schema: replace every `project` with `invoice` in it. First check the only matches are the table, its index and its foreign key (`"public.project"`, `"name": "project"`, `project_owner_idx`, `project_owner_id_user_id_fk`, `"tableFrom": "project"`). Then, from any shell:
   ```
   node -e "const fs=require('fs'),f=process.argv[1];fs.writeFileSync(f,fs.readFileSync(f,'utf8').replaceAll('project','invoice'))" drizzle/meta/NNNN_snapshot.json
   ```
   Never edit the older snapshots or migrations. Confirm with `node checks/run.mjs --skip=typecheck,test,build,e2e`: the `migrations` step must pass ("schema and migrations agree"). The local `.data/pglite` database applies the rename the next time the app starts, and keeps its rows.

5. **Move the files** (use `git mv` in a git repo, so history follows):

   | From | To |
   |---|---|
   | `src/lib/projects.ts` | `src/lib/invoices.ts` |
   | `src/app/(app)/projects/` (`page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `actions.ts`) | `src/app/(app)/invoices/` |
   | `src/components/project-form.tsx` | `src/components/invoice-form.tsx` |
   | `tests/integration/projects.test.ts` | `tests/integration/invoices.test.ts` |
   | `tests/e2e/projects.spec.ts` | `tests/e2e/invoices.spec.ts` |

   The folder name is the URL: `/projects` becomes `/invoices`.

6. **Rename the identifiers and words** in these files, keeping case (`projects`→`invoices`, `Projects`→`Invoices`, `project`→`invoice`, `Project`→`Invoice`, plurals first):
   - `src/lib/invoices.ts`: `Invoice`, `listInvoices`, `getInvoice`, `createInvoice` (returns `{ ok: true; invoice }`), `updateInvoice`, `deleteInvoice`, the `invoice` table import, `InvoiceInput`, `canCreateInvoice`, and the header comment's path.
   - `src/lib/schemas.ts`: `projectInput` → `invoiceInput`, `ProjectInput` → `InvoiceInput`.
   - `src/lib/entitlements.ts`: the table import, `Usage = { invoices: number }`, `usageFor()`, `canCreateProject` → `canCreateInvoice`, and `plan.limits.invoices` in the check and its message.
   - `src/config/plans.ts`: the limits key `projects` → `invoices` (in the `Plan` type and all three plans), and the words in `blurb` and `features` (`'3 invoices'`, `'Unlimited invoices'`…).
   - `src/config/site.ts`: `resource: { one: 'invoice', many: 'invoices' }`. Rewrite `tagline` and `description` as real sentences for the product (a word swap gives "Plan invoices without the busywork").
   - `src/app/(app)/invoices/actions.ts`: `createInvoiceAction`, `updateInvoiceAction`, `deleteInvoiceAction`, the imports, `revalidatePath('/invoices')`, the redirects (`/invoices/${result.invoice.id}?created=1`, `/invoices`), and "That invoice no longer exists."
   - `src/app/(app)/invoices/page.tsx`, `new/page.tsx`, `[id]/page.tsx`: component names (`Invoices`, `NewInvoice`, `EditInvoice`), imports, local variables, and every `/projects` link.
   - `src/components/invoice-form.tsx`: `InvoiceForm`, the prop `project` → `invoice` (and its uses), the `FormState` import path `@/app/(app)/invoices/actions`, the `Invoice` type import from `@/lib/invoices`.
   - `src/app/(app)/layout.tsx`: the nav link `href="/invoices"`.
   - `src/app/(app)/dashboard/page.tsx`: `listInvoices`, the variable names, `plan.limits.invoices`, and the links to `/invoices/new` and `/invoices/${p.id}`.
   - `src/app/(app)/admin/page.tsx`: the `invoice` table import, `invoice.ownerId`, `invoicesOf`, and the column header "Invoices".
   - `src/components/status-badge.tsx` has no resource words; leave it unless you change the statuses (`add-a-field.md`).
   - UI text comes from `site.resource`, so most pages need nothing else. Fix grammar the words can't: `Give a ${site.resource.one} a due date` in the dashboard reads "Give a invoice"; write "an" where the new word needs it.

7. **Update the demo data** in `scripts/seed.ts`: the table import (`invoice`), `db.insert(invoice)`, the header comment ("2 invoices"), and rewrite the six `sample` rows so they look like the user's thing (screenshots show them). Keep the same keys and statuses, so the free user still has 2 and the limit test still works.

8. **Update the tests:**
   - `tests/integration/invoices.test.ts`: the imports, function names, `invoiceInput`, `r.invoice`, `plans.free.limits.invoices`, and the `describe('invoices', …)` name.
   - `tests/e2e/invoices.spec.ts`: every URL (`/invoices`, `/invoices/new`, the `/\/invoices$/` regexes), and the button and link names, which come from `site.resource`: "New invoice", "Create invoice", "Delete invoice", "No invoices yet".
   - `tests/e2e/pages.spec.ts`: `['/invoices', 'Invoices']` in the Pro user loop, the phone test's `page.goto('/invoices')` and heading `'Invoices'`, and the in-app 404 test's `page.goto('/invoices/no-such-id')`.

9. **Rewrite the marketing copy** in `src/config/landing.ts` for the new thing: the hero's eyebrow line, the six `features` and the placeholder quotes (`retheme.md` step 8 has the rules). Most lines read `site.resource`, but check they still make sense. `src/app/(marketing)/legal/privacy/page.tsx` already uses `site.resource.many`.

10. **Find leftovers.** Search case-insensitively in the code; every match must be gone, or a deliberate exception you can name:
    ```
    grep -rniE "projects?" src tests scripts
    ```
    (Or `rg -i project src tests scripts`, or your editor's search.) This catches `project`, `Project`, `projects`, `PROJECT` and the `/projects` URLs. Known exception: the comment in `scripts/shots.mjs` ("one dev server per project") means the folder, not the resource; update its `/projects` example line.

11. **Update the docs that name moved files:** in `AGENTS.md` (Architecture table, Rules 2 and 12, Common pitfalls), `docs/architecture.md` and `docs/customization-map.md`, change the paths and names you renamed (`src/lib/invoices.ts`, `invoices.test.ts`, `invoices.spec.ts`, `/invoices`, `InvoiceForm`). The other recipes keep saying "project"; add a line to `docs/project.md`: "The core resource is *invoice* (the recipes call it project)", plus a Log line for the rename and which migration path you took.

## Verify

1. `npm run check`. It must end with `CODEPLATE CHECKS: PASS`. If `migrations` fails, recheck step 4; if `typecheck` fails, a name in step 6 was missed (the error names the file).
2. Search again (step 10): no matches left.
3. Screenshots:
   ```
   npm run shots -- /invoices /invoices/new /dashboard --as=pro
   npm run shots -- /invoices --as=free --size=390x844 --dark
   npm run shots -- / /pricing
   ```
   Look for: the nav says "Invoices" and is highlighted on `/invoices`; the list shows the new demo rows; buttons say "New invoice" / "Create invoice"; the free user's list shows the limit notice wording correctly; the landing and pricing pages use the new word with correct grammar.
