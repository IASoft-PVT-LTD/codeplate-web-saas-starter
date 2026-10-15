# Add teams (shared workspaces)

Use when several people must work on the same projects: a team with members, roles (owner, admin, member), invites by email, and a seat limit per plan. After this, projects belong to a team instead of a user. Every user gets a personal team at sign-up, so a solo user sees no difference.

If the core resource has been renamed (`rename-the-core-resource.md`), read "project" as its new name everywhere.

**Design (why it's built this way).** Better Auth's **organization plugin** (`better-auth/plugins`, in the installed 1.7 release) handles the risky parts: invitation records with expiry, checking that only the invited email can accept, owner/admin/member permissions on every member change, and the active team stored on the session. A hand-rolled team table would mean writing and securing all of that again. The plugin calls a team an "organization". Keep that name in the database, where Better Auth expects it, and say "team" in the UI. Don't turn on the plugin's own `teams` option: those are sub-groups inside an organization. The rest stays this project's style:
- Reads (which teams am I in, who's in this team) are plain Drizzle queries in `src/lib/teams.ts`, testable with a db handle.
- Writes to members and invites go through `auth.api.*`, which checks the caller's role.
- Ownership still has one rule (AGENTS.md rule 2): data functions take a **team id**, and that id only ever comes from `requireTeam()`, which has checked membership. Never take a team id from a form or the URL.
- Billing stays per user. A team gets its **owner's** plan, which sets the team's limits (projects and seats). So the Paddle webhook doesn't change.

## Two stages

Teams touch the database, the auth setup and every project query, so the work is split in two. Each stage ends with `npm run check` passing; don't start the second until the first does.

1. **`add-teams-1-data.md`: the data and the rules.** The team tables and their migrations, the seat limit, team-scoped project queries, Better Auth's organization plugin, `requireTeam()`, and integration tests for invites, seats and roles. The app looks the same afterwards: each user works in their personal team.
2. **`add-teams-2-pages.md`: the screens.** The Team page (members, invites, switching teams), the invite link page, the navigation link and a browser test of the whole invite flow.

## Verify

After both stages:

1. `npm run check` ends with `CODEPLATE CHECKS: PASS`. `migrations` confirms both new migrations match `schema.ts`; `test` runs `teams.test.ts`, and `e2e` runs the invite flow in `teams.spec.ts`.
2. By hand with `npm run dev`: sign up, use **Simulate Team (dev)** on `/billing`, and invite a second address from `/team`. In another browser, sign up with that address, open the invite link from http://localhost:3000/dev/outbox, and click **Join team**. You now see the first user's projects. The **Your teams** card on `/team` switches between teams.
3. If you have an existing database (a deployed app), run `npm run db:migrate` against a copy first. Then check every old project has a `team_id`, and every old user is the owner of exactly one team.
