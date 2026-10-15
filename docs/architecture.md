# Architecture

A Next.js 16 App Router app. Server components render pages and read the database directly; server actions handle forms; route handlers serve auth, the Paddle webhook and the health check. The logic that matters (who owns what, what a plan allows, how payments change a plan) lives in plain functions in `src/lib/` that take a database handle, so the integration tests can run them against an in-memory Postgres.

## Layers

```
src/app/            pages, layouts, server actions, route handlers   (thin)
  │  calls
src/lib/            session, projects, entitlements, billing, schemas, mailer, env
  │  uses
src/db/             schema.ts (tables) + index.ts (getDb: PGlite or Postgres)
src/config/         site.ts (names, words), landing.ts (landing copy), plans.ts (plans, prices, limits)
```

- **Pages never contain business rules.** A page asks `src/lib/` for data and renders it. A rule written in a page can't be tested and gets duplicated.
- **`src/lib/` never imports from `src/app/`** or React. Its functions take `db` as their first argument.
- **`src/config/` is data.** The pricing page, billing page, checkout and limit checks all read `plans.ts`; the UI words for the core resource come from `site.ts`.

## Route groups

| Group | Pages | Who |
|---|---|---|
| `(marketing)` | `/`, `/pricing`, `/legal/terms`, `/legal/privacy` | everyone; header with sign-in links |
| `(auth)` | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | everyone; centered card layout |
| `(app)` | `/dashboard`, `/projects`, `/projects/new`, `/projects/[id]`, `/billing`, `/settings`, `/admin` | signed in (`(app)/layout.tsx` calls `requireUser()`); `/admin` needs `ADMIN_EMAILS` |
| `api` | `/api/auth/*`, `/api/paddle/webhook`, `/api/health` | Better Auth, Paddle, uptime monitors |
| `dev` | `/dev/outbox`, `/dev/crash` (throws, to show the error page) | development and checks only |

The parentheses keep the URL clean: `(app)/dashboard/page.tsx` serves `/dashboard`.

Special files: `src/app/error.tsx` and `global-error.tsx` catch errors on public pages and in the root layout; `(app)/error.tsx`, `(app)/loading.tsx` and `(app)/not-found.tsx` do the same inside the app's layout, so the sidebar stays. `opengraph-image.tsx`, `sitemap.ts` and `robots.ts` are the link-preview image, `/sitemap.xml` and `/robots.txt`.

## A request, end to end: creating a project

1. `/projects/new` renders `ProjectForm` (a client component, for the pending state and field errors) with `createProjectAction` as its form action.
2. On submit, Next runs `createProjectAction(prev, formData)` on the server (`src/app/(app)/projects/actions.ts`):
   1. `requireUser()` reads the session cookie through Better Auth, or redirects to `/sign-in`.
   2. `projectInput.safeParse()` (`src/lib/schemas.ts`) validates and normalizes the fields; errors go back to the form.
   3. `createProject(db, user.id, input)` (`src/lib/projects.ts`) asks `canCreateProject()` (`src/lib/entitlements.ts`) whether the plan allows one more, then inserts the row with `ownerId = user.id`.
   4. `revalidatePath('/projects')`, then `redirect()` to the new project's page.
3. Every other query in `projects.ts` filters on `ownerId`, so a guessed id from another user finds nothing (the page shows a 404).

## Auth

Better Auth (`src/lib/auth.ts`) with the Drizzle adapter. Sessions are rows in the `session` table, identified by an HTTP-only cookie. The browser side (`src/lib/auth-client.ts`) calls `/api/auth/*` for sign up, sign in, sign out and password reset.

- `src/lib/session.ts`: `currentUser()`, `requireUser()`, `isAdmin()`, `requireAdmin()`. Server code gets the user only through these.
- Email verification is sent on sign-up. It's required before sign-in only when `site.requireEmailVerification` is true.
- Password reset: Better Auth makes a token, `sendResetPassword` mails a link to `/api/auth/reset-password/<token>`, which redirects to `/reset-password?token=…`.
- Rate limiting is on in production (a few attempts per IP every 10 seconds on the sign-in routes), counted in memory per server process.
- `BETTER_AUTH_SECRET` signs the session cookies. It's checked when auth starts, not at import, so `next build` works without it; production refuses to run without one.

## Billing

```
/pricing "Get Pro" ─▶ /sign-up?plan=pro (or /sign-in?plan=pro) ─▶ /billing?plan=pro (opens its checkout)
user clicks Upgrade ─▶ Paddle.js checkout overlay (customData.userId)
                              │ pays
Paddle ── subscription.* webhook ─▶ /api/paddle/webhook
                                       │ handlePaddleWebhook(): verify signature, skip seen event ids
                                       ▼
                                applySubscriptionEvent(): price → plan, upsert `subscription`
                                       │
entitlements.planFor(user) ◀───────────┘  (active, trialing or past_due → that plan; else Free)
```

- The `subscription` table mirrors Paddle. Paddle can send events more than once and out of order: `webhook_event` records handled event ids, and an event older than the stored row is ignored.
- The webhook answers 401 for a bad signature (Paddle retries) and 200 for anything a retry can't fix (unknown price, unknown user), so Paddle doesn't retry forever.
- **Billing simulator:** when Paddle isn't configured and dev tools are on, `/billing` shows "Simulate …" buttons. They call `applySubscriptionEvent()` with a fake event, through the same code path as a real webhook.
- The customer portal link comes from Paddle's API (`customerPortalUrl()`), for card changes, cancellation and invoices.

## Database

- `src/db/schema.ts` defines every table. `drizzle/` holds the SQL migrations generated from it (`npm run db:generate`).
- `getDb()` returns one connection per server process:
  - `DATABASE_URL` unset or `pglite:<folder>`: PGlite, a WASM build of Postgres, storing data on disk (default `.data/pglite`). It applies the migrations itself on first use.
  - `pglite:memory`: in memory (the integration tests).
  - `postgres://…`: a real Postgres. Run `npm run db:migrate` before a new version starts.
- PGlite is real Postgres, so the same SQL and migrations run locally, in the checks and in production.

## Email

`src/lib/mailer.ts` `sendMail()`. With `EMAIL_PROVIDER=console` (the default) mails are printed and stored in the `outbox` table, which `/dev/outbox` lists. With `resend`, they're sent through Resend's API.

## Configuration

Server code reads environment variables in `src/lib/env.ts` (plus `NEXT_PUBLIC_*` price ids in `src/config/plans.ts`). `.env.example` lists every variable with a comment. `env.devTools` is true outside production, and in the checks (`CODEPLATE_CHECKS=1`).

## Tests and checks

| Layer | Where | Runs against |
|---|---|---|
| Integration | `tests/integration/*.test.ts` (Vitest) | `src/lib/` on a fresh in-memory PGlite per file; `tests/helpers.ts` makes users and reads the outbox |
| Screens | `tests/e2e/*.spec.ts` (Playwright) | `next start` (production build) on a fresh on-disk PGlite with the demo users (`scripts/e2e-server.mjs`) |
| Checks | `checks/run.mjs` (`npm run check`) | env docs, migrations, types, integration, build, screens |

Paddle and email providers are never called by the checks: webhooks are signed with a test secret, and mail goes to the outbox.
