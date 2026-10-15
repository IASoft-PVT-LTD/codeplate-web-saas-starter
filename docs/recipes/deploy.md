# Deploy

Use when the app goes live, or gets a staging copy: (A) Vercel with Neon or Supabase Postgres, (B) a Node server you run (a VPS or Docker host) behind a reverse proxy, or (C) Cloudflare Workers through OpenNext (experimental, read its status first). Do the **Before any host** steps first, then one section, then the **Smoke test**.

You can't create hosting or database accounts, buy domains, or see dashboards. The user does that; you tell them exactly what to set, and you never invent or print secrets. Record the choices (host, database, domain, email provider, never the keys) in `docs/project.md` under Hosting.

## Before any host

1. **Run `npm run check`** on the code you'll deploy. It must end with `CODEPLATE CHECKS: PASS`.
2. **Get a real Postgres.** The embedded database (PGlite, in `.data/`) is for local development and the checks only. On serverless hosts the disk is temporary or read-only, and on a server it can't be shared, backed up or scaled. In production the app refuses to start without a `postgres://` `DATABASE_URL` (`src/db/index.ts`), so a missing variable fails loudly instead of writing to a throwaway folder. Good choices: **Neon** or **Supabase** (both with free tiers, and Neon is built into Vercel), or any managed Postgres 14+ (RDS, Cloud SQL, DigitalOcean…). Pick a region close to where the app runs; every page makes several queries.
3. **Set the environment variables** on the host (never in a committed file). These are all the variables in `.env.example`:

   | Variable | Value in production |
   |---|---|
   | `APP_URL` | The public URL, e.g. `https://app.example.com` (no trailing slash). Better Auth uses it for links in emails and OAuth callbacks, and rejects requests from other origins. |
   | `BETTER_AUTH_SECRET` | 32+ random characters: `openssl rand -base64 32`. **Required**: the app refuses to start auth without it. A different value per environment. Changing it signs everyone out. |
   | `DATABASE_URL` | `postgres://user:password@host:5432/db?sslmode=require` (see each host below for pooled vs direct). |
   | `ADMIN_EMAILS` | Comma-separated emails that may open `/admin`. |
   | `EMAIL_PROVIDER`, `RESEND_API_KEY` (or your provider's key), `EMAIL_FROM` | A real provider (`add-email-provider.md`). With `console`, production emails (password resets!) go nowhere. |
   | `NEXT_PUBLIC_PADDLE_ENV`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_PRICE_PRO`, `NEXT_PUBLIC_PADDLE_PRICE_TEAM` | From `set-up-paddle.md`: sandbox values for staging, live values for production. |
   | Any added by recipes | e.g. `GOOGLE_CLIENT_ID`/`_SECRET`, `GITHUB_CLIENT_ID`/`_SECRET` (`add-oauth-login.md`). |

   - **`NEXT_PUBLIC_*` values are baked in at build time**, in the browser code and in `src/config/plans.ts`. They must be set when `next build` runs, and changing them needs a rebuild, not just a restart.
   - **Never set `CODEPLATE_CHECKS`** on a real deployment. It turns on `/dev/outbox` (which shows every email, including password-reset links) and the billing simulator (free upgrades), and lifts the sign-in rate limit.
   - Don't set `NODE_ENV` yourself; `next build` and `next start` handle it.
4. **Migrate before the new version starts.** The embedded database migrates itself; a real Postgres doesn't. Run this from a full checkout (it needs dev dependencies), with the database's **direct** (unpooled) URL:
   ```bash
   DATABASE_URL="postgres://…direct…" npm run db:migrate
   ```
   It applies whatever in `drizzle/` hasn't run yet, and prints `migrated`. Run it on every deploy, before the new code takes traffic. Migrations here only add things, or drop what the new code no longer uses (AGENTS.md rule 1), so the old version keeps working for the moment in between. Back up the database (or use Neon/Supabase branching or point-in-time restore) before a migration that drops or rewrites data.
5. **Know the limits that come with production:**
   - Better Auth's sign-in **rate limit** (`rateLimit` in `src/lib/auth.ts`) counts in memory, per server process. On one Node server that's fine. On serverless (Vercel, Workers) every instance has its own counters, so it only slows an attacker down. To share the counters, store them in Postgres. Add this table to `src/db/schema.ts` (import `bigint` from `drizzle-orm/pg-core`), run `npm run db:generate`, add `rateLimit: schema.rateLimit` to the adapter's `schema` map in `src/lib/auth.ts`, and set `rateLimit: { enabled: env.isProd && !env.checksMode, storage: 'database' }`:
     ```ts
     /** Better Auth's rate-limit counters, shared by every server instance. */
     export const rateLimit = pgTable('rate_limit', {
       id: text('id').primaryKey(),
       key: text('key').notNull().unique(),
       count: integer('count').notNull(),
       lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
     });
     ```
   - The rate limit keys on the client IP from `X-Forwarded-For`. Vercel and Cloudflare set it; behind your own proxy, make sure the proxy sets it (section B).
6. **Point the outside services at the live URL:**
   - **Paddle** (live dashboard): the notification destination is `https://<domain>/api/paddle/webhook`; the domain is approved under **Website approval**; the default payment link is on that domain (`set-up-paddle.md`, part B).
   - **Google/GitHub sign-in:** add `https://<domain>/api/auth/callback/google` and `…/github` as redirect URIs.
   - **Email:** the sending domain is verified with the provider (SPF, DKIM, DMARC).

## A. Vercel + Neon (or Supabase)

7. **Create the project.** The user pushes the code to GitHub (or GitLab or Bitbucket), then in Vercel picks **Add New…** → **Project** and imports the repository. Vercel detects Next.js; keep the default build settings. Set the Node.js version to 22 or 24 in the project settings, since `package.json` needs Node 22 or newer.
8. **Add the database.**
   - **Neon:** in the Vercel project, **Storage** (or the **Marketplace**) → **Neon** → install, create a database, and connect it to the project. This sets `DATABASE_URL` (pooled; the host has `-pooler` in it) and `DATABASE_URL_UNPOOLED` (direct), among others. The app reads `DATABASE_URL`, which is what you want on serverless. Neon's pooler supports the prepared statements the `postgres` driver uses, so no code change is needed.
   - **Supabase:** create a project, then copy the connection string from **Connect**. On Vercel, use the **transaction pooler** (port `6543`). That pooler doesn't support prepared statements, so in `src/db/index.ts` change the Postgres client to `postgres(url, { max: 10, prepare: false })`. Use the direct or session connection (port `5432`) for migrations. Supabase's direct connection is IPv6-only unless the user buys the IPv4 add-on; the pooler works everywhere.
   - Put the database in the same region as the Vercel functions (**Settings** → **Functions** → region, `iad1` by default).
9. **Set the other variables** in **Settings** → **Environment Variables** (table in step 3). Scope them to **Production**, and give **Preview** its own values (sandbox Paddle, a separate database or Neon branch) if previews are used. Redeploy after changing variables. Note that `APP_URL` must match the URL in use: Better Auth rejects sign-ins coming from any other origin, so a preview deployment needs `APP_URL` set to its own URL, or sign-in fails there.
10. **Migrate, then deploy.** Run `DATABASE_URL="<DATABASE_URL_UNPOOLED or the direct URL>" npm run db:migrate` from the user's machine or CI, then deploy (push to the production branch, or **Redeploy**). You can also make the Vercel build command `npm run db:migrate && next build`, but then every preview build migrates whatever database its `DATABASE_URL` points at, so only do that if previews have their own database.

## B. A Node server behind a reverse proxy

11. **Build and run** (Node 22+ on the server):
    ```bash
    npm ci
    npm run build                      # with the NEXT_PUBLIC_* variables set
    DATABASE_URL="postgres://…" npm run db:migrate
    npm start -- --port 3000           # next start
    ```
    Run it under a process manager (systemd, pm2 or Docker) that restarts it and passes the environment. One long-running process keeps one connection pool (up to 10 connections, `src/db/index.ts`) and the in-memory rate limit works as intended.
12. **Or a smaller standalone build** (handy for Docker). Add `output: 'standalone'` to the config in `next.config.ts`, then:
    ```bash
    npm run build
    cp -r .next/static .next/standalone/.next/
    cp -r public .next/standalone/     # only if the project has a public/ folder (the template doesn't)
    PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
    ```
    `.next/standalone` holds only the runtime files (about 75 MB), not `tsx` or the scripts. Keep running `npm run db:migrate` from a full checkout or a CI step, and point it at the same database.
13. **Reverse proxy with HTTPS.** Caddy gets the certificate and forwards client IPs by itself. A minimal `Caddyfile`:
    ```
    app.example.com {
        reverse_proxy 127.0.0.1:3000
    }
    ```
    With nginx, use `proxy_pass http://127.0.0.1:3000;` plus `proxy_set_header Host $host;`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and `proxy_set_header X-Forwarded-Proto $scheme;`, and get a certificate with certbot. Keep port 3000 closed to the outside.
14. **Deploying a new version:** pull, `npm ci`, `npm run build`, `npm run db:migrate`, then restart the process. The old process serves traffic until the restart.

## C. Cloudflare Workers via OpenNext (experimental)

**Status, checked 2026-10-13. Read this before choosing Cloudflare.** `@opennextjs/cloudflare` 1.20.10 is the current release, and it officially supports Next `>=16.3.8`, which includes this template's 16.4.0. In a test of this template, `opennextjs-cloudflare build` succeeded (on Linux; on Windows it fails creating symlinks, so build in WSL or CI). But under `wrangler dev`, every route answered 500 with `Unexpected loadManifest(/.next/server/preview-props.json) call!`. That points to a Next 16.4 manifest the adapter doesn't handle yet. **Don't deploy to Workers until `npm run cf:preview` serves pages and passes the smoke test.** Check OpenNext's release notes for a fix, and update `@opennextjs/cloudflare` when there is one. Other caveats:
- **No PGlite and no TCP drivers:** the database must be a hosted Postgres behind **Hyperdrive**, and Nodemailer (SMTP) won't run. Use an HTTP email provider.
- **No connection sharing:** a Worker can't reuse a database connection across requests, so the code below makes one client per request.
- **Size:** the Worker must fit Cloudflare's size limit (3 MiB compressed on the free plan, 10 MiB on paid). The server bundle in the test was about 1.8 MB gzipped plus PGlite's WASM files, so plan on the paid Workers plan.
- **In-memory rate limit** is per isolate: use the database storage from step 5.

If the user still wants Cloudflare, set it up like this, and stop at step 19 if the preview fails:

15. **Install the adapter and Wrangler** (exact versions, per AGENTS.md rule 10):
    ```bash
    npm install --save-exact @opennextjs/cloudflare
    npm install --save-exact --save-dev wrangler
    ```
16. **Create `wrangler.jsonc`.** The user creates a Hyperdrive config for their Postgres (Cloudflare dashboard → **Hyperdrive**, or `npx wrangler hyperdrive create launchpad-db --connection-string="postgres://…"`) and gives you its id. The local connection string, used by `wrangler dev`, must include a password.
    ```jsonc
    {
      "$schema": "node_modules/wrangler/config-schema.json",
      "name": "launchpad",
      "main": ".open-next/worker.js",
      "compatibility_date": "2026-09-01",
      "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
      "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
      "hyperdrive": [
        {
          "binding": "HYPERDRIVE",
          "id": "<hyperdrive id from the user>",
          "localConnectionString": "postgres://postgres:postgres@localhost:5432/launchpad"
        }
      ]
    }
    ```
    Then create `open-next.config.ts`. Every page here is dynamic, so no incremental cache is needed:
    ```ts
    // OpenNext's Cloudflare adapter (docs/recipes/deploy.md). Every page here is
    // dynamic, so no incremental cache is configured.
    import { defineCloudflareConfig } from '@opennextjs/cloudflare';

    export default defineCloudflareConfig();
    ```
    Add scripts to `package.json`, keeping `build` as `next build`:
    ```json
    "cf:preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "cf:deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf:typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
    ```
    Run `npm run cf:typegen` and commit `cloudflare-env.d.ts`; it types `env.HYPERDRIVE`. Add `.open-next/`, `.wrangler/` and `.dev.vars*` to `.gitignore`.
17. **One database client per request on Workers** (`src/db/index.ts`). Add the imports `import { cache } from 'react';` and `import { getCloudflareContext } from '@opennextjs/cloudflare';`, and replace `getDb()` with:
    ```ts
    export async function getDb(): Promise<Db> {
      const hyperdrive = hyperdriveUrl();
      if (hyperdrive) return workerDb(hyperdrive);
      g.__db ??= createDb();
      return g.__db;
    }

    /** On Cloudflare Workers, Hyperdrive's connection string; null anywhere else. */
    function hyperdriveUrl(): string | null {
      try {
        // Sync mode: only the Worker sets the context. (The async mode would start
        // wrangler's local proxy under `next start` and connect to its database.)
        return getCloudflareContext().env.HYPERDRIVE?.connectionString ?? null;
      } catch {
        return null; // not on Workers: next dev, next start, tests, scripts
      }
    }

    // Workers can't share a connection between requests, so each request gets its
    // own client (cache() reuses it within one request). Hyperdrive pools for us.
    const workerDb = cache((url: string): Db => drizzlePostgres(postgres(url, { max: 5, fetch_types: false }), { schema }) as unknown as Db);
    ```
    Use the **sync** `getCloudflareContext()`. The `{ async: true }` form, run under `next start` (as the checks do), starts Wrangler's local proxy and connects to `localConnectionString` instead of the test database.
18. **One auth instance per database handle** (`src/lib/auth.ts`). The cached instance holds a connection, so on Workers it must be per request too. Replace the `const g = …` line and `getAuth()` with:
    ```ts
    // One auth instance per database handle: one per server process on Node, one
    // per request on Cloudflare Workers (where getDb() is per request).
    const auths = new WeakMap<Db, Auth>();

    /** The app's auth instance. */
    export async function getAuth(): Promise<Auth> {
      const db = await getDb();
      let auth = auths.get(db);
      if (!auth) auths.set(db, (auth = createAuth(db)));
      return auth;
    }
    ```
19. **Check, then preview locally.** `npm run check` must still pass; the checks run on Node, where none of this is active. Then put the runtime variables for local preview in `.dev.vars` (git-ignored), e.g. `BETTER_AUTH_SECRET=…` and `APP_URL=http://localhost:8787`, and run `npm run cf:preview` (on Linux, macOS, WSL or CI; not plain Windows). Run the smoke test below against it. **If pages answer 500, stop here** and tell the user Cloudflare isn't usable with this Next version yet. Offer Vercel (A) or a Node server (B) instead.
20. **Deploy.** Set the secrets in the Worker's settings (dashboard → the Worker → **Settings** → **Variables and Secrets**, or `npx wrangler secret put BETTER_AUTH_SECRET`). Make sure the `NEXT_PUBLIC_*` values are in the environment where `cf:deploy` runs, because they're needed at build time. Migrate with the direct database URL (step 4), then run `npm run cf:deploy`, and add the custom domain under the Worker's **Domains & Routes**.

## Smoke test (after every deploy)

21. Check, on the live URL:
    - `https://<domain>/api/health` answers `{"ok":true}`. Point an uptime monitor at it: it answers 503 when the database is unreachable.
    - `/`, `/pricing`, `/sign-in` and `/sign-up` load, over HTTPS, with styles.
    - `/dev/outbox` answers **404**. If it doesn't, `CODEPLATE_CHECKS` is set or the build isn't a production build: fix that before anything else.
    - Sign up with a real address. You land on `/dashboard`, and the confirmation email arrives from `EMAIL_FROM` (check spam, and SPF/DKIM). Then **Forgot password?**: the reset email arrives and its link opens on the live domain, not localhost (if not, fix `APP_URL`).
    - Create, edit and delete a project. On the Free plan, the fourth project is refused.
    - The new user is in the database (the Neon/Supabase table editor, or `psql`), which proves the app writes to the hosted database.
    - `/billing` shows real upgrade buttons and no simulator. Paddle's delivery log shows `200` for the webhook. For a live account, do one real purchase and refund it (`set-up-paddle.md`, Verify).
    - With `ADMIN_EMAILS` set, `/admin` opens for that account and is a 404 for others.
    - If OAuth is on: each "Continue with …" button signs in and returns to the live domain.
22. **Tell the user** what's live, where, and what they still need to do (DNS, Paddle website approval, email domain verification), and update `docs/project.md` (Hosting, plus a dated line in the log).

## Verify

1. `npm run check` ends with `CODEPLATE CHECKS: PASS` on the commit you deploy (and again after the Cloudflare code changes, if you made them).
2. `npm run db:migrate` against the production database printed `migrated`.
3. Every item of the smoke test (step 21) passes on the live URL.
