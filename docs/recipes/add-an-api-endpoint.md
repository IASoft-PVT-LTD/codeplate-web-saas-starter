# Add an API endpoint

Use when something other than the app's own pages needs the data as JSON: a mobile app, a browser extension, a script, a partner integration. The example adds `GET`/`POST /api/projects` and `GET`/`PUT`/`DELETE /api/projects/:id`, authenticated with the user's Better Auth session. If you renamed the core resource, use your names (`invoice`, `src/lib/invoices.ts`, `/api/invoices`).

Not needed for the app's own screens: those use server actions (`src/app/(app)/projects/actions.ts`).

**Where the code goes.** The route files in `src/app/api/` stay thin. The logic goes in `src/lib/`, written against a `Request` and the auth instance instead of `next/headers`, so the integration tests can call it with the in-memory database.

1. **Add the shared helpers** in a new `src/lib/api.ts` (once; every endpoint uses them):
   ```ts
   // Helpers for the JSON API in src/app/api/. They take the auth instance and the
   // Request (not next/headers), so integration tests can call them directly.
   import type { Auth } from './auth';

   /** The user behind the request's session cookie, or null. */
   export async function apiUser(auth: Auth, request: Request): Promise<{ id: string; email: string } | null> {
     const s = await auth.api.getSession({ headers: request.headers });
     return s ? { id: s.user.id, email: s.user.email } : null;
   }

   /** A JSON error: { error, ...extra } with the given status. */
   export function apiError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
     return Response.json({ error, ...extra }, { status });
   }

   /**
    * The parsed JSON body, or undefined if the request isn't JSON. Requiring
    * content-type: application/json also stops plain cross-site form posts.
    */
   export async function jsonBody(request: Request): Promise<unknown> {
     if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return undefined;
     try {
       return await request.json();
     } catch {
       return undefined;
     }
   }
   ```

2. **Write the endpoint logic** in a new `src/lib/projects-api.ts`. Each function: who's signed in, validate with the same zod schema as the form (`projectInput` in `src/lib/schemas.ts`), then call the owner-scoped functions in `src/lib/projects.ts`, which also apply the plan limits:
   ```ts
   import type { Db } from '@/db';
   import type { Auth } from './auth';
   import { apiError, apiUser, jsonBody } from './api';
   import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects';
   import { fieldErrors, projectInput } from './schemas';

   /** GET /api/projects: the signed-in user's projects. */
   export async function listProjectsApi(db: Db, auth: Auth, request: Request): Promise<Response> {
     const user = await apiUser(auth, request);
     if (!user) return apiError(401, 'Sign in first.');
     return Response.json({ projects: await listProjects(db, user.id) });
   }

   /** POST /api/projects: create one (plan limits apply). */
   export async function createProjectApi(db: Db, auth: Auth, request: Request): Promise<Response> {
     const user = await apiUser(auth, request);
     if (!user) return apiError(401, 'Sign in first.');
     const body = await jsonBody(request);
     if (body === undefined) return apiError(415, 'Send JSON with content-type: application/json.');
     const parsed = projectInput.safeParse(body);
     if (!parsed.success) return apiError(422, 'Some fields are invalid.', { fields: fieldErrors(parsed.error) });
     const result = await createProject(db, user.id, parsed.data);
     if (!result.ok) return apiError(403, result.reason);
     return Response.json({ project: result.project }, { status: 201 });
   }

   /** GET /api/projects/:id */
   export async function getProjectApi(db: Db, auth: Auth, request: Request, id: string): Promise<Response> {
     const user = await apiUser(auth, request);
     if (!user) return apiError(401, 'Sign in first.');
     const project = await getProject(db, user.id, id);
     // Someone else's project is "not found", never "forbidden": don't confirm it exists.
     return project ? Response.json({ project }) : apiError(404, 'Not found.');
   }
   ```
   `updateProjectApi` (PUT: parse like POST, `updateProject()`, 404 when it returns false, then return the row from `getProject()`) and `deleteProjectApi` (`deleteProject()`, 404 when false, else `new Response(null, { status: 204 })`) follow the same shape. PUT replaces every field; fields left out get their schema defaults. Return only what the client needs: here the row is the user's own, but never return other tables' secrets (password hashes, tokens, Paddle ids) by selecting `*` from them.

3. **Add the route files.** `src/app/api/projects/route.ts`:
   ```ts
   // JSON API for projects, authenticated by the Better Auth session cookie.
   // The logic and its tests are in lib/projects-api.ts.
   import { getDb } from '@/db';
   import { getAuth } from '@/lib/auth';
   import { createProjectApi, listProjectsApi } from '@/lib/projects-api';

   export async function GET(request: Request): Promise<Response> {
     return listProjectsApi(await getDb(), await getAuth(), request);
   }

   export async function POST(request: Request): Promise<Response> {
     return createProjectApi(await getDb(), await getAuth(), request);
   }
   ```
   and `src/app/api/projects/[id]/route.ts`, typed with Next 16's global `RouteContext` helper (`params` is a Promise; await it):
   ```ts
   import { getDb } from '@/db';
   import { getAuth } from '@/lib/auth';
   import { deleteProjectApi, getProjectApi, updateProjectApi } from '@/lib/projects-api';

   export async function GET(request: Request, ctx: RouteContext<'/api/projects/[id]'>): Promise<Response> {
     const { id } = await ctx.params;
     return getProjectApi(await getDb(), await getAuth(), request, id);
   }
   ```
   plus `PUT` and `DELETE` the same way. `RouteContext` comes from the generated route types: run `npx next typegen` (the checks do) before `npm run typecheck`. Reading the request makes these handlers dynamic, so `next build` doesn't try to run them.

4. **Integration test** in `tests/integration/projects-api.test.ts`. Sign in through Better Auth to get a real session cookie, then call the functions with a `Request`:
   ```ts
   async function cookieFor(u: { email: string; password: string }): Promise<string> {
     const res = await ctx.auth.api.signInEmail({ body: { email: u.email, password: u.password }, asResponse: true });
     return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
   }

   function req(cookie: string | null, body?: unknown, contentType = 'application/json'): Request {
     const headers: Record<string, string> = {};
     if (cookie) headers.cookie = cookie;
     if (body !== undefined) headers['content-type'] = contentType;
     return new Request('http://localhost/api/projects', {
       method: body === undefined ? 'GET' : 'POST',
       headers,
       body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
     });
   }
   ```
   (`setup()` and `makeUser()` come from `tests/helpers.ts`; `makeUser()` returns the password.) Cover:
   - no cookie → 401 on GET and POST;
   - POST → 201 with the row, then GET lists it, GET by id → 200, PUT renames, DELETE → 204, GET by id → 404;
   - `{ name: '' }` → 422 with `fields.name`; a form-encoded body and broken JSON → 415;
   - **ownership**: a second user's GET list is empty, and GET/PUT/DELETE on the first user's id → 404, after which the owner still sees the row unchanged;
   - **plan limit**: `plans.free.limits.projects` POSTs → 201, the next → 403 with a message matching `/upgrade/i`.

5. **Screen test** in `tests/e2e/api.spec.ts`, against the real server (checks the routing and the cookie):
   ```ts
   import { expect, test } from '@playwright/test';
   import { demo, signIn } from './helpers';

   test('the projects API needs a session and returns only your projects', async ({ page, request }) => {
     expect((await request.get('/api/projects')).status()).toBe(401);
     await signIn(page, demo.pro);
     // page.request shares the signed-in browser's cookies.
     const res = await page.request.get('/api/projects');
     expect(res.status()).toBe(200);
     expect((await res.json()).projects).toHaveLength(6);
     const created = await page.request.post('/api/projects', { data: { name: 'Made by the API' } });
     expect(created.status()).toBe(201);
     const { project } = await created.json();
     expect((await page.request.delete(`/api/projects/${project.id}`)).status()).toBe(204);
   });
   ```
   Delete what the test creates: the screen tests share one database, and the Pro user's 6 seeded projects are counted elsewhere.

6. **Clients that aren't a browser.** The session cookie works for the app's own front end and for anything that can keep cookies. For a mobile app or script, Better Auth's `bearer` plugin (in the installed `better-auth`) accepts `Authorization: Bearer <token>`: add `bearer()` (from `better-auth/plugins`) to `plugins` in `src/lib/auth.ts`, before `nextCookies()`; the client reads the token from the `set-auth-token` header of the sign-in response (`POST /api/auth/sign-in/email`). `apiUser()` then works unchanged. Long-lived **API keys** are not part of the installed `better-auth` (there's no API-key plugin under `node_modules/better-auth/dist/plugins/`). Don't build your own key scheme without the user agreeing; if they need keys, discuss adding a separate, permissively licensed package (rule 10) and its migration.

7. **Rate limits.** Better Auth's rate limit covers only `/api/auth/*`. Your endpoint has none: plan limits cap how much a user can create, but not how often they call. Before launch, add a rate-limit rule at the host or CDN (Vercel Firewall, Cloudflare WAF rate limiting) for `/api/`, and note it in `docs/project.md`. An in-memory counter in the route only works on a single long-running server, not on serverless hosts.

8. **Document it** for the user: add the endpoints, the request and response shapes, and the status codes (401, 403, 404, 415, 422) to `README.md` or a `docs/api.md`.

## Verify

1. `npm run check`. It must end with `CODEPLATE CHECKS: PASS`. The build output lists `ƒ /api/projects` and `ƒ /api/projects/[id]` as dynamic routes; `test` and `e2e` run the new tests.
2. Try it by hand while `npm run dev` runs: `curl -i http://localhost:3000/api/projects` must answer `401` with a JSON error, never an HTML page or a redirect.
3. An API has no screen; if you also changed a page to call it, take screenshots of that page as `AGENTS.md` describes (`npm run shots -- /projects --as=pro`).
