# Next.js SaaS Starter: agent brief

You are building a web product for the user, starting from this template. This brief tells you how the project works, what to ask before changing anything, the rules that keep it working, and how to check every change. Read it all once. Then follow **Interview** before your first edit.

## Start here

This folder is a complete, working SaaS web app called **Launchpad** (a placeholder name). It's built with **Next.js 16** (App Router, TypeScript strict), **Postgres** through **Drizzle ORM**, **Better Auth** and **Paddle Billing**:

- **Accounts:** sign up, sign in, sign out, password reset by email, optional email verification, profile, change password, delete account.
- **The core resource:** "projects", with list, create, edit and delete. Every query is scoped to its owner. It's a stand-in for the user's own thing (invoices, recipes, courses…): rename it with `docs/recipes/rename-the-core-resource.md`.
- **Plans:** Free / Pro / Team in `src/config/plans.ts`, with a limit (Free gets 3 projects) enforced on the server.
- **Billing:** Paddle checkout overlay, a signed and idempotent webhook that records subscriptions, and Paddle's customer portal. A paid plan picked on the pricing page is carried through sign-up (or sign-in) to its checkout. Without Paddle keys, a **billing simulator** on `/billing` switches plans in development.
- **Pages:** landing (hero illustration, features, sample quotes marked as placeholders, pricing teaser), pricing, terms and privacy stubs, dashboard, billing, settings, a small admin page, error, loading and 404 pages, and `/api/health`. A generated share image (`opengraph-image.tsx`), `sitemap.xml` and `robots.txt`.
- **Runs with nothing to set up.** An embedded Postgres (PGlite) stores data in `.data/`. Emails are printed and kept at `/dev/outbox`.

**Run it:** `npm install`, then `npm run dev` and open http://localhost:3000. `npm run seed` adds demo users (see **Seeing your work**).

**Verify any change** with one command from this folder. It must end with `CODEPLATE CHECKS: PASS`:

```
npm run check
```

The screen tests find a browser by themselves: Playwright's Chromium (`npm run setup` installs it), else an installed Chrome or Edge, else they download Chromium once. Set `PW_CHANNEL=chrome` (or `msedge`) to choose. Node 22.15 or newer is required; 24 is what the template is tested with.

**Next.js 16 is newer than most training data.** Its docs ship in `node_modules/next/dist/docs/`. Read the relevant page there before using an API you're unsure of. In particular, `params`, `searchParams`, `headers()` and `cookies()` are async (await them).

## Interview

Before you change anything, read `docs/project.md`.

- **If it still contains `<!-- codeplate:project-stub -->`, interview the user first.** Ask only what you need, in one short message, and suggest defaults so they can just say "yes":
  1. **The product.** What does it do, and for whom? A name?
  2. **The core thing.** What do users create and manage? (Replaces "projects": invoices, recipes, courses…) Which fields does it need?
  3. **Plans and prices.** Keep Free / Pro / Team? What does each cost, and what does the free plan limit?
  4. **Sign-in.** Email and password only, or also Google / GitHub? Must people verify their email before signing in?
  5. **Brand.** Colors, logo, tone of voice. Any site they like the look of?
  6. **Hosting.** Where will it run (Vercel, Cloudflare, a Node server)? Which Postgres (Neon, Supabase, their own)? This only matters at deploy time.

  Then replace the stub in `docs/project.md` with their answers as short decisions, and remove the marker.
- **Otherwise, the project has started.** `docs/project.md` holds the decisions made so far. Follow them, and add new decisions as the user makes them. This file is how the next session knows what was agreed.

Work in small steps. Make one change, verify it, show the result (see **Seeing your work**), then continue. The usual first steps are `rename-the-core-resource.md`, `add-a-field.md`, `change-plans-and-prices.md` and `retheme.md`.

`README.md` and `codeplate.json` describe the template. Once the user has named their product, rewrite `README.md` for it (what it is, how to run it), and leave `codeplate.json` and `LICENSE.md` in place. `LICENSE.md` explains the user's rights to the template code.

## Architecture

Pages are thin. Logic lives in `src/lib/`, takes a database handle, and has integration tests. See `docs/architecture.md` for the details and the request flow.

| Path | What lives there |
|---|---|
| `src/app/(marketing)/` | Public pages: landing, pricing, legal. |
| `src/app/(auth)/` | Sign in, sign up, forgot and reset password (client components calling Better Auth). |
| `src/app/(app)/` | Signed-in pages: dashboard, projects, billing, settings, admin. `layout.tsx` requires a session. Server actions sit next to their pages in `actions.ts`. |
| `src/app/api/` | `auth/[...all]` (Better Auth), `paddle/webhook`, `health`. |
| `src/app/dev/outbox/` | Development only: emails the app "sent". |
| `src/config/` | **`site.ts`** (name, tagline, the resource's display names, share-image colors), **`landing.ts`** (the landing page's words) and **`plans.ts`** (plans, prices, limits). |
| `src/db/` | `schema.ts` (every table) and `index.ts` (`getDb()`: PGlite or Postgres from `DATABASE_URL`). |
| `drizzle/` | SQL migrations generated from `schema.ts`. |
| `src/lib/` | `auth.ts`, `session.ts` (`requireUser`, `requireAdmin`), `projects.ts` (owner-scoped queries), `entitlements.ts` (plan limits), `billing.ts` (Paddle webhook), `schemas.ts` (zod input validation), `mailer.ts`, `env.ts`. |
| `src/components/` | `ui.tsx` (Button, Card, Field, Input, Notice, Toast…), `hero-art.tsx` (the landing illustration), `error-panel.tsx` and app components. |
| `src/app/globals.css` | Brand colors and fonts as Tailwind theme tokens. |
| `tests/unit/`, `tests/integration/` | Vitest: UI states and config (unit), and `src/lib/` on an in-memory Postgres (integration). |
| `tests/e2e/` | Playwright screen tests against a production build. |
| `checks/run.mjs` | The checks runner behind `npm run check`. |
| `scripts/` | `seed.ts`, `migrate.ts`, `shots.mjs` (screenshots), `e2e-server.mjs`. |

## Rules

1. **Every database change is a migration.** Edit `src/db/schema.ts`, then run `npm run db:generate` and keep the new file in `drizzle/`. Never edit a migration that has shipped; add a new one. The checks fail if the schema has changes with no migration.
2. **Scope every query to its owner.** Data functions in `src/lib/` take the signed-in user's id and put it in the `where` clause, as `src/lib/projects.ts` does. A server action never trusts an id from the form to decide ownership. Pages and actions get the user from `requireUser()`.
3. **Validate everything users submit** with a zod schema in `src/lib/schemas.ts`, in the server action, before touching the database.
4. **Plan limits live in one place.** Limits are in `src/config/plans.ts`, checks in `src/lib/entitlements.ts`, and they're enforced on the server (the UI only mirrors them). Never gate a feature only in the UI.
5. **Paddle is the source of truth for payments.** The `subscription` table changes only through `applySubscriptionEvent()` (the webhook, or the dev simulator, which uses the same path). Never mark someone as paid any other way.
6. **No secrets in code.** Configuration comes from environment variables read in `src/lib/env.ts` (or the file that needs them). Every variable is listed with a comment in `.env.example`; the checks fail if one is missing. Never create or commit `.env` files with real values; tell the user what to put in `.env.local`.
7. **Server first.** Pages are server components that read data directly. Add `'use client'` only to the components that need state or browser APIs, and keep them small. Mutations are server actions (or route handlers for webhooks and APIs).
8. **Use the design tokens.** Style with the Tailwind tokens from `src/app/globals.css` (`bg-brand`, `text-ink`, `border-line`, `bg-paper`…) and the components in `src/components/ui.tsx`. Don't hard-code colors in components. Confirm a success with a `Toast` ("Saved."); show a problem with a `Notice` next to the form, where it stays.
9. **Keep dev-only tools dev-only.** `/dev/outbox` and the billing simulator run when `NODE_ENV` isn't `production`, or when `CODEPLATE_CHECKS=1` (only the checks set it). Never set `CODEPLATE_CHECKS` on a real deployment.
10. **Keep the licensing clean.** Use only code you write here, packages from npm with permissive licenses (MIT, Apache-2.0, BSD, ISC), and assets the user owns or that are CC0. Don't paste code from tutorials or other projects. Pin new dependencies to exact versions (`npm install --save-exact`).
11. **Never weaken a check to make it pass.** If a check fails, fix the cause. If the user deliberately changed something a test covers (say, Free now gets 5 projects), update that test to the new rule and say so.
12. **Add tests for new logic.** A new data function or rule in `src/lib/` gets an integration test in `tests/integration/` (copy the style of `projects.test.ts`). A new page or flow gets a screen test in `tests/e2e/` (copy `projects.spec.ts`).
13. **Keep the CodePlate credit.** This template's free license (`LICENSE.md`) asks that anything the user shares shows "Built with CodePlate (codeplate.io)" where people can see it. It's in the footer of the public pages (`src/app/(marketing)/layout.tsx`). Keep it when you rebrand. The credit is only optional if `LICENSE.md` is the **CodePlate Pro License**: a copy downloaded with an active CodePlate paid plan comes with it, and names its license ID in `CODEPLATE-LICENSE.txt`. If the user asks to remove the credit and `LICENSE.md` is still the free license, tell them that.
14. **Timestamps are `timestamp with time zone`.** Declare new columns as `timestamp('x', { withTimezone: true })`. The embedded database's session time zone is the computer's, so a plain `timestamp` mixes local times (`defaultNow()`) with UTC ones (dates the app writes); `tests/integration/timezones.test.ts` runs in Tokyo time to catch it.

## Verify

After every change:

1. **Run `npm run check`.** The last line must be `CODEPLATE CHECKS: PASS`. It runs these steps and lists each one's result:
   - `env`: every `process.env` variable the code reads is in `.env.example`
   - `migrations`: `src/db/schema.ts` matches the migrations in `drizzle/`
   - `typecheck`: route types and `tsc` (strict)
   - `lint`: ESLint (`eslint.config.mjs`): React hook rules, Next's rules, unused code. Fix with the message; `npx eslint --fix .` fixes some by itself
   - `test`: unit tests and the integration tests (auth, ownership, plan limits, Paddle webhooks)
   - `build`: `next build`
   - `e2e`: browser tests of every page and the main flows (sign up, reset password, create/edit/delete, limits, upgrade, admin), against the production build with a fresh database

   For a quicker loop while working: `npm run typecheck`, `npm run lint`, `npm test`, or `node checks/run.mjs --skip=build,e2e`. Always finish with a full `npm run check`. Failed screen tests leave screenshots and traces in `.data/test-results/`.
2. **Look at it.** For anything visible, take screenshots and open the PNGs (see **Seeing your work**). Taking them isn't enough. Check:
   - every piece of text is readable against its background
   - nothing overlaps or is cut off, on a phone width too (`--size=390x844`)
   - light and dark mode (`--dark`), since the app follows the system setting
3. **Tell the user** what changed and show the screenshots. Suggest they try it with `npm run dev`.

## Recipes

Step-by-step guides for common requests. Follow the matching recipe when one fits; each ends with its own verification.

- `docs/recipes/rename-the-core-resource.md`: turn "projects" into the user's thing (table, routes, words).
- `docs/recipes/add-a-field.md`: a new field on the core resource, from schema to form.
- `docs/recipes/add-a-resource.md`: a second resource with its own pages, owned by the user or by a project.
- `docs/recipes/change-plans-and-prices.md`: plans, prices, features and limits.
- `docs/recipes/set-up-paddle.md`: connect Paddle (sandbox, then live): products, prices, webhook, keys.
- `docs/recipes/add-oauth-login.md`: sign in with Google or GitHub.
- `docs/recipes/add-teams.md`: shared workspaces with members, roles and invites, in two checked stages (`add-teams-1-data.md`, then `add-teams-2-pages.md`).
- `docs/recipes/add-email-provider.md`: send real email (Resend, or any other provider).
- `docs/recipes/add-an-api-endpoint.md`: a JSON API route, with auth and tests.
- `docs/recipes/retheme.md`: name, logo, colors, fonts and copy.
- `docs/recipes/deploy.md`: go live on Vercel, Cloudflare or a Node server, with a hosted Postgres.

`docs/customization-map.md` answers "I want to change X — which file?" for everything else.

## Seeing your work

You can't watch the browser, but you can take screenshots of any page:

```
npm run shots -- /                                  (signed out)
npm run shots -- /dashboard /billing --as=pro       (signed in as a demo user)
npm run shots -- /projects --as=free --size=390x844 --dark
```

- It starts its own dev server on port 3199 with a throwaway database and the demo users, so stop `npm run dev` first (Next allows one dev server per folder).
- PNGs go to `shots/` (git-ignored) and the tool prints each path. Open them and look.
- `--as` is `free`, `pro` or `admin`. In Git Bash on Windows, write paths without the leading slash (`dashboard billing`).
- Detail pages: the demo projects have fixed ids, `demo-free-1`, `demo-free-2`, `demo-pro-1` … `demo-pro-6` (`npm run shots -- /projects/demo-pro-1 --as=pro`). When you add a resource, give its seeded rows fixed ids the same way.
- The tool prints the browser's errors and warnings for each page. A red "Issue" badge in a dev screenshot means there's one: read the printed message and fix it.
- Demo users (from `npm run seed`, local only): `free@example.com`, `pro@example.com`, `admin@example.com`, all with the password `password123`. For `/admin`, put `admin@example.com` in `ADMIN_EMAILS`.
- With `npm run dev` running, emails the app sends show up at http://localhost:3000/dev/outbox.

## Common pitfalls

- **`next dev` (or `npm run shots`) won't start, or hangs:** another dev server is probably running in this folder. Next allows one per project folder: stop it and retry.
- **Changed `schema.ts` and the app errors on a missing column:** run `npm run db:generate`. The embedded database applies new migrations the next time the app starts.
- **Throwing in a server component at build time:** `next build` renders pages that don't read the request. Read `headers()` (or call `requireUser()`) before touching the database in a page, so the page renders per request. Check secrets lazily (as `authSecret()` does), never at import.
- **`redirect()` inside `try`/`catch`:** it works by throwing; let it propagate.
- **A 404 inside the app answers with status 200.** `(app)/loading.tsx` streams the signed-in pages, so the status is sent before `notFound()` runs; Next adds a `noindex` tag and shows `(app)/not-found.tsx`. In screen tests, check the heading, not the status. Public pages (no loading file) still answer 404.
- **Server action changes don't show:** call `revalidatePath()` for the pages that show the changed data, as `src/app/(app)/projects/actions.ts` does.
- **Client components can't read server-only environment variables.** Only `NEXT_PUBLIC_*` variables reach the browser, and they're baked in at build time.
