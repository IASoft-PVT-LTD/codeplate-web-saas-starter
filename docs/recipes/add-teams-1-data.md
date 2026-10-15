# Add teams, stage 1: the data and the rules

Use as the first half of `add-teams.md` (read its design notes first): the team tables, team-scoped projects, Better Auth's organization plugin and the seat limit, with integration tests. Nothing new is on screen yet; `add-teams-2-pages.md` adds the pages.

If the core resource has been renamed (`rename-the-core-resource.md`), read "project" as its new name everywhere below.

1. **Add the tables** (`src/db/schema.ts`). Better Auth's Drizzle adapter maps model fields to these TypeScript keys. Column names are snake_case, like the existing auth tables. Write them by hand: Better Auth's CLI generator would write a second schema file in another style.
   - Add `uniqueIndex` to the import from `drizzle-orm/pg-core`.
   - In `session`, after `userId`, add:
     ```ts
       activeOrganizationId: text('active_organization_id'), // the team the user is working in (organization plugin)
     ```
   - Add this section before `// --- The core resource`, because `project` will reference it:
     ```ts
     // --- Teams (Better Auth organization plugin) -----------------------------------------
     // The plugin calls a team an "organization". Every user gets a personal team at
     // sign-up (src/lib/teams.ts). docs/recipes/add-teams.md.

     export const organization = pgTable('organization', {
       id: text('id').primaryKey(),
       name: text('name').notNull(),
       slug: text('slug').notNull().unique(),
       logo: text('logo'),
       metadata: text('metadata'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     });

     export const member = pgTable('member', {
       id: text('id').primaryKey(),
       organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
       userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
       role: text('role').notNull().default('member'), // owner, admin or member
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     }, (t) => [uniqueIndex('member_team_user_idx').on(t.organizationId, t.userId), index('member_user_idx').on(t.userId)]);

     export const invitation = pgTable('invitation', {
       id: text('id').primaryKey(),
       organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
       email: text('email').notNull(),
       role: text('role'),
       status: text('status').notNull().default('pending'), // pending, accepted, rejected, canceled
       expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
     }, (t) => [index('invitation_team_idx').on(t.organizationId), index('invitation_email_idx').on(t.email)]);
     ```
   - In `project`, add a **nullable** `teamId` for now, after `ownerId`:
     ```ts
       teamId: text('team_id').references(() => organization.id, { onDelete: 'cascade' }),
     ```
2. **Generate the first migration, and backfill it:**
   ```bash
   npx drizzle-kit generate --name=teams
   ```
   This writes `drizzle/0001_teams.sql` (the number may differ). It hasn't shipped yet, so append a hand-written backfill to the end of it, starting on a new line (drizzle-kit ends the file without one). That gives existing users a personal team that owns their projects, before the next migration makes `team_id` required. On a fresh database it does nothing.
   ```sql
   --> statement-breakpoint
   -- Hand-written backfill: a personal team for every existing user, owning their projects.
   INSERT INTO "organization" ("id", "name", "slug") SELECT 'team_' || "id", "name" || '''s team', 'team-' || "id" FROM "user";--> statement-breakpoint
   INSERT INTO "member" ("id", "organization_id", "user_id", "role") SELECT 'member_' || "id", 'team_' || "id", "id", 'owner' FROM "user";--> statement-breakpoint
   UPDATE "project" SET "team_id" = 'team_' || "owner_id";
   ```
   Keep each `--> statement-breakpoint`: the migrator splits statements on it.
3. **Make `teamId` required and drop `ownerId`** (`src/db/schema.ts`, `project`): delete the `ownerId` line, change the `teamId` line to:
   ```ts
     teamId: text('team_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
   ```
   and change the index to `(t) => [index('project_team_idx').on(t.teamId)]`. Then run:
   ```bash
   npx drizzle-kit generate --name=projects_belong_to_teams
   ```
   Do steps 1 and 3 as two separate generates. Adding `team_id` and dropping `owner_id` in one go makes drizzle-kit ask interactively whether the column was renamed, and that prompt hangs a non-interactive run.
4. **Give plans a seat limit** (`src/config/plans.ts`). In `Plan['limits']`, add:
   ```ts
       /** People in a team, the owner included (pending invites count too). */
       seats: number;
   ```
   and change the comment on `projects` to "Max projects a team can have". Set `limits` to `{ projects: 3, seats: 1 }` for Free, `{ projects: Infinity, seats: 1 }` for Pro and `{ projects: Infinity, seats: 10 }` for Team, or whatever the user chose. Put `seats` after `projects` in each plan's `limits`, and add it to any other plan the user has. Now that teams exist, make the Team plan's words say so: `blurb: 'For teams that work on projects together.'`, and add `'Up to 10 people in your team'` to its `features` after `'Everything in Pro'`.
5. **Create `src/lib/teams.ts`.** These are the team reads, plus the personal team made at sign-up:
   ```ts
   // Teams (shared workspaces) on Better Auth's organization plugin, which calls
   // a team an "organization". Reads come straight from our tables; changes to
   // members and invites go through auth.api, which checks roles.
   // docs/recipes/add-teams.md explains the design.
   import { and, asc, count, eq, inArray } from 'drizzle-orm';
   import type { Db } from '@/db';
   import { invitation, member, organization, user } from '@/db/schema';

   export type Role = 'owner' | 'admin' | 'member';
   export type Team = { id: string; name: string; role: Role };

   /** Makes a new user's personal team, with them as its owner. */
   export async function createPersonalTeam(db: Db, u: { id: string; name: string }): Promise<string> {
     const id = crypto.randomUUID();
     await db.insert(organization).values({ id, name: `${u.name}'s team`, slug: `team-${u.id}` });
     await db.insert(member).values({ id: crypto.randomUUID(), organizationId: id, userId: u.id, role: 'owner' });
     return id;
   }

   /** The teams a user belongs to, oldest first (their personal team comes first). */
   export async function teamsFor(db: Db, userId: string): Promise<Team[]> {
     const rows = await db.select({ id: organization.id, name: organization.name, role: member.role })
       .from(member).innerJoin(organization, eq(member.organizationId, organization.id))
       .where(eq(member.userId, userId)).orderBy(asc(member.createdAt));
     return rows as Team[];
   }

   /** The team if the user is a member of it, otherwise null. */
   export async function teamFor(db: Db, userId: string, teamId: string): Promise<Team | null> {
     const [row] = await db.select({ id: organization.id, name: organization.name, role: member.role })
       .from(member).innerJoin(organization, eq(member.organizationId, organization.id))
       .where(and(eq(member.userId, userId), eq(member.organizationId, teamId)));
     return (row as Team | undefined) ?? null;
   }

   /** Who owns the team (their plan is the team's plan). */
   export async function teamOwnerId(db: Db, teamId: string): Promise<string | null> {
     const [row] = await db.select({ userId: member.userId }).from(member)
       .where(and(eq(member.organizationId, teamId), eq(member.role, 'owner'))).orderBy(asc(member.createdAt)).limit(1);
     return row?.userId ?? null;
   }

   /** Members plus pending invites: the seats in use. */
   export async function seatsUsed(db: Db, teamId: string): Promise<{ members: number; invites: number }> {
     const [[m], [i]] = await Promise.all([
       db.select({ n: count() }).from(member).where(eq(member.organizationId, teamId)),
       db.select({ n: count() }).from(invitation).where(and(eq(invitation.organizationId, teamId), eq(invitation.status, 'pending'))),
     ]);
     return { members: m?.n ?? 0, invites: i?.n ?? 0 };
   }

   export async function membersOf(db: Db, teamId: string) {
     return db.select({ id: member.id, userId: user.id, name: user.name, email: user.email, role: member.role })
       .from(member).innerJoin(user, eq(member.userId, user.id))
       .where(eq(member.organizationId, teamId)).orderBy(asc(member.createdAt));
   }

   export async function pendingInvitesOf(db: Db, teamId: string) {
     return db.select({ id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt })
       .from(invitation).where(and(eq(invitation.organizationId, teamId), eq(invitation.status, 'pending')))
       .orderBy(asc(invitation.createdAt));
   }

   /** A pending, unexpired invite addressed to this email, with its team's name. */
   export async function inviteFor(db: Db, inviteId: string, email: string) {
     const [row] = await db.select({ id: invitation.id, teamName: organization.name, expiresAt: invitation.expiresAt })
       .from(invitation).innerJoin(organization, eq(invitation.organizationId, organization.id))
       .where(and(eq(invitation.id, inviteId), eq(invitation.email, email.toLowerCase()), eq(invitation.status, 'pending')));
     return row && row.expiresAt > new Date() ? row : null;
   }

   /** Deletes the teams a user owns, with their projects. Runs before the account is deleted. */
   export async function deleteOwnedTeams(db: Db, userId: string): Promise<void> {
     const owned = await db.select({ id: member.organizationId }).from(member)
       .where(and(eq(member.userId, userId), eq(member.role, 'owner')));
     if (owned.length) await db.delete(organization).where(inArray(organization.id, owned.map((o) => o.id)));
   }
   ```
6. **Team limits** (`src/lib/entitlements.ts`). Usage and project limits are now per team, and seats come from the owner's plan. Replace the file with:
   ```ts
   // What a plan allows. Every limit check goes through here, so the rules live
   // in one place (and the pricing page reads the same config). Billing is per
   // user; a team gets its owner's plan.
   import { and, count, desc, eq, inArray } from 'drizzle-orm';
   import type { Db } from '@/db';
   import { project, subscription } from '@/db/schema';
   import { plans, type Plan, type PlanId } from '@/config/plans';
   import { site } from '@/config/site';
   import { seatsUsed, teamOwnerId } from './teams';

   /** Subscription statuses that grant the paid plan. */
   export const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'] as const;

   /** The plan a user is on right now (free without an active subscription). */
   export async function planFor(db: Db, userId: string): Promise<Plan> {
     const [sub] = await db.select().from(subscription)
       .where(and(eq(subscription.userId, userId), inArray(subscription.status, [...ACTIVE_STATUSES])))
       .orderBy(desc(subscription.updatedAt)).limit(1);
     const id = (sub?.plan ?? 'free') as PlanId;
     return plans[id] ?? plans.free;
   }

   /** A team's plan: its owner's. */
   export async function teamPlan(db: Db, teamId: string): Promise<Plan> {
     const owner = await teamOwnerId(db, teamId);
     return owner ? planFor(db, owner) : plans.free;
   }

   export type Usage = { projects: number };

   export async function usageFor(db: Db, teamId: string): Promise<Usage> {
     const [row] = await db.select({ n: count() }).from(project).where(eq(project.teamId, teamId));
     return { projects: row?.n ?? 0 };
   }

   /** Whether the team may create one more project, and why not if it can't. */
   export async function canCreateProject(db: Db, teamId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
     const [plan, usage] = await Promise.all([teamPlan(db, teamId), usageFor(db, teamId)]);
     if (usage.projects < plan.limits.projects) return { ok: true };
     return { ok: false, reason: `The ${plan.name} plan includes ${plan.limits.projects} ${site.resource.many}. Upgrade for more.` };
   }

   /** Seats not taken by members (pending invites still count against these). */
   export async function openSeats(db: Db, teamId: string): Promise<number> {
     const [plan, used] = await Promise.all([teamPlan(db, teamId), seatsUsed(db, teamId)]);
     return Math.max(0, plan.limits.seats - used.members);
   }

   /** Seats left for new invites: each member and each pending invite takes one. */
   export async function seatsLeft(db: Db, teamId: string): Promise<number> {
     const [open, used] = await Promise.all([openSeats(db, teamId), seatsUsed(db, teamId)]);
     return Math.max(0, open - used.invites);
   }

   /** Whether the team may invite one more person, and why not if it can't. */
   export async function canInvite(db: Db, teamId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
     if ((await seatsLeft(db, teamId)) > 0) return { ok: true };
     const plan = await teamPlan(db, teamId);
     return { ok: false, reason: `The ${plan.name} plan includes ${plan.limits.seats} ${plan.limits.seats === 1 ? 'seat' : 'seats'}. Upgrade for more.` };
   }
   ```
7. **Turn on the plugin** (`src/lib/auth.ts`):
   - Imports:
     ```ts
     import { organization } from 'better-auth/plugins';
     import { createPersonalTeam, deleteOwnedTeams, teamsFor } from './teams';
     import { openSeats, teamPlan } from './entitlements';
     ```
   - Tell the adapter about the new tables. Its `schema` becomes:
     ```ts
           schema: {
             user: schema.user, session: schema.session, account: schema.account, verification: schema.verification,
             organization: schema.organization, member: schema.member, invitation: schema.invitation,
           },
     ```
   - Replace the `user: { deleteUser: { enabled: true } },` line, and the comment above it, with:
     ```ts
     databaseHooks: {
       // Every new user gets a personal team, so every project has a team.
       user: { create: { after: async (u) => { await createPersonalTeam(db, u); } } },
       // A new session starts in the user's first team.
       session: { create: { before: async (s) => ({ data: { ...s, activeOrganizationId: (await teamsFor(db, s.userId))[0]?.id ?? null } }) } },
     },
     // Users can delete their own account from Settings. Teams they own go with it
     // (with their projects); memberships elsewhere cascade.
     user: { deleteUser: { enabled: true, beforeDelete: async (u) => { await deleteOwnedTeams(db, u.id); } } },
     ```
     The `after` hook runs once the user row is saved, for email sign-ups and Google/GitHub ones alike. The session hook puts new sessions in a team straight away.
   - Replace `plugins: [nextCookies()],` with:
     ```ts
     plugins: [
       organization({
         // Personal teams come from the sign-up hook above; nobody creates more through the API.
         allowUserToCreateOrganization: false,
         // A team (and its projects) goes only with its owner's account (deleteOwnedTeams).
         disableOrganizationDeletion: true,
         // Seats come from the team owner's plan (config/plans.ts, checked in entitlements.ts).
         membershipLimit: async (_user, team) => (await teamPlan(db, team.id)).limits.seats,
         // How many invites may be pending at once (Better Auth counts the pending ones).
         invitationLimit: async ({ organization: team }) => openSeats(db, team.id),
         sendInvitationEmail: async ({ id, email, organization: team, inviter }) => {
           await sendMail(db, {
             to: email,
             subject: `${inviter.user.name} invited you to ${team.name} on ${site.name}`,
             text: `${inviter.user.name} (${inviter.user.email}) invited you to join ${team.name} on ${site.name}.\n\nSign in or sign up with this email address, then open:\n${env.appUrl}/invite/${id}\n\nThe invite expires in 48 hours.`,
           });
         },
       }),
       nextCookies(), // keep last
     ],
     ```
     `membershipLimit` is checked when someone accepts an invite. `invitationLimit` caps pending invites, so members plus pending invites never exceed the plan's seats. `sendInvitationEmail` goes through `src/lib/mailer.ts`, so invites show in `/dev/outbox` locally and go through the real provider in production (`add-email-provider.md`).
8. **Know the active team** (`src/lib/session.ts`):
   - Imports: add `import { getDb } from '@/db';` above `import { getAuth } from './auth';`, and `import { createPersonalTeam, teamFor, teamsFor, type Team } from './teams';` with the other local imports.
   - Add `activeTeamId: string | null` to `CurrentUser`, and in `currentUser()` return `activeTeamId: s.session.activeOrganizationId ?? null` too. The plugin adds that field to the session type.
   - Add, above `isAdmin`:
     ```ts
     /**
      * The signed-in user and the team they're working in, or a redirect to
      * /sign-in. The membership is checked here, so pages and actions can pass
      * team.id to the data functions in src/lib/.
      */
     export async function requireTeam(): Promise<{ user: CurrentUser; team: Team }> {
       const user = await requireUser();
       const db = await getDb();
       const active = user.activeTeamId ? await teamFor(db, user.id, user.activeTeamId) : null;
       const team = active ?? (await teamsFor(db, user.id))[0] ?? (await teamFor(db, user.id, await createPersonalTeam(db, user)));
       return { user, team: team! };
     }
     ```
9. **Scope projects to the team** (`src/lib/projects.ts`). Rename the `ownerId` parameter to `teamId` in every function, use `project.teamId` in every `where`, and insert `{ id: crypto.randomUUID(), teamId, ...input }`. Reword the header comment too: every query is scoped to a team, and the team id comes only from `requireTeam()` (it no longer mentions owners).
10. **Pass the team, not the user, everywhere a project is read or written.** Both ids are strings, so **TypeScript won't catch a missed one**. Change every call site:
    - `src/app/(app)/projects/actions.ts`: import `requireTeam` instead of `requireUser`; in each action, `const { team } = await requireTeam();` and pass `team.id` to `createProject`, `updateProject` and `deleteProject`.
    - `src/app/(app)/projects/page.tsx`: `const { team } = await requireTeam();`, then `listProjects(db, team.id)` and `canCreateProject(db, team.id)`.
    - `src/app/(app)/projects/[id]/page.tsx`: `const { team } = await requireTeam();`, then `getProject(await getDb(), team.id, id)`.
    - `src/app/(app)/dashboard/page.tsx`: `const { user, team } = await requireTeam();`, then `listProjects(db, team.id)` and `teamPlan(db, team.id)` in place of `planFor(db, user.id)` (import `teamPlan`).
    - `src/app/(app)/admin/page.tsx`: count projects per team owner. Import `and`, `eq` and `member`, and replace the `counts` query with:
      ```ts
        // Projects per team owner (a team's projects count for the person who owns it).
        const counts = await db.select({ ownerId: member.userId, n: count() }).from(project)
          .innerJoin(member, and(eq(member.organizationId, project.teamId), eq(member.role, 'owner'))).groupBy(member.userId);
      ```
    - `scripts/seed.ts`: import `teamsFor` from `'@/lib/teams'`. Before the `for (const [i, p] of sample…)` loop, add `const [team] = await teamsFor(db, u.id); // made by the sign-up hook in lib/auth.ts`, and insert `teamId: team.id` instead of `ownerId: u.id`.
    - Check for leftovers. `npm run typecheck` catches any remaining `project.ownerId`, but not a `user.id` passed where a team id belongs, so search for those too: `grep -n "user\.id" "src/app/(app)/projects/actions.ts" "src/app/(app)/projects/page.tsx" "src/app/(app)/projects/[id]/page.tsx" "src/app/(app)/dashboard/page.tsx"` must find nothing.
    - Billing (`src/app/(app)/billing/*`) stays on `user.id`. The person paying is the owner, and their plan applies to the teams they own.
11. **Tests.**
    - `tests/helpers.ts`: import `teamsFor` from `'@/lib/teams'`. Make `makeUser` also return the personal team: before its `return`, add `const [team] = await teamsFor(ctx.db, row.id);` and return `{ id: row.id, email, password, teamId: team.id }`. Add a helper for `auth.api` calls that need a signed-in user:
      ```ts
      /** Request headers with a session cookie for `u`, for auth.api calls that need a signed-in user. */
      export async function signedIn(ctx: Ctx, u: { email: string; password: string }): Promise<Headers> {
        const { headers } = await ctx.auth.api.signInEmail({ body: { email: u.email, password: u.password }, returnHeaders: true });
        return new Headers({ cookie: headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') });
      }
      ```
    - `tests/integration/projects.test.ts`: everywhere `u.id`, `alice.id` or `bob.id` is the second argument of a project function (`createProject`, `listProjects`, `getProject`, `updateProject`, `deleteProject`) or of `canCreateProject`, pass `u.teamId` (`alice.teamId`, `bob.teamId`) instead. Keep `u.id` for the `subscription` insert and the `planFor` call, which are per user.
    - Create `tests/integration/teams.test.ts`:
      ```ts
      // Teams: personal team at sign-up, invites by email, seat limits from the
      // owner's plan, roles, and projects shared within a team only.
      import { beforeAll, describe, expect, it } from 'vitest';
      import { subscription } from '@/db/schema';
      import { createProject, listProjects } from '@/lib/projects';
      import { canInvite, teamPlan } from '@/lib/entitlements';
      import { membersOf, teamFor, teamsFor } from '@/lib/teams';
      import { projectInput } from '@/lib/schemas';
      import { firstUrl, lastMail, makeUser, setup, signedIn, type Ctx } from '../helpers';

      let ctx: Ctx;
      beforeAll(async () => {
        ctx = await setup();
      });

      /** Puts a user on the Team plan, the way the Paddle webhook would. */
      async function onTeamPlan(userId: string) {
        await ctx.db.insert(subscription).values({ id: `sub_${userId}`, userId, paddleCustomerId: 'ctm_1', priceId: 'pri_test_team', plan: 'team', status: 'active' });
      }

      /** The owner invites `email`; returns the invite id from the emailed link. */
      async function invite(owner: { email: string; password: string; teamId: string }, email: string, role: 'member' | 'admin' = 'member') {
        await ctx.auth.api.createInvitation({ headers: await signedIn(ctx, owner), body: { email, role, organizationId: owner.teamId } });
        const link = firstUrl((await lastMail(ctx, email)).text);
        expect(link).toContain('/invite/');
        return link.split('/invite/')[1];
      }

      describe('teams', () => {
        it('gives every new user a personal team they own', async () => {
          const u = await makeUser(ctx, { name: 'Ana' });
          const teams = await teamsFor(ctx.db, u.id);
          expect(teams).toEqual([{ id: u.teamId, name: "Ana's team", role: 'owner' }]);
        });

        it('shares projects with invited members, and nobody else', async () => {
          const owner = await makeUser(ctx);
          const mate = await makeUser(ctx);
          const outsider = await makeUser(ctx);
          await onTeamPlan(owner.id);
          const r = await createProject(ctx.db, owner.teamId, projectInput.parse({ name: 'Shared roadmap' }));
          if (!r.ok) throw new Error(r.reason);

          const id = await invite(owner, mate.email);
          await ctx.auth.api.acceptInvitation({ headers: await signedIn(ctx, mate), body: { invitationId: id } });
          expect((await teamFor(ctx.db, mate.id, owner.teamId))?.role).toBe('member');
          expect((await listProjects(ctx.db, owner.teamId)).map((p) => p.name)).toEqual(['Shared roadmap']);
          expect(await teamFor(ctx.db, outsider.id, owner.teamId)).toBeNull();
          expect(await listProjects(ctx.db, outsider.teamId)).toEqual([]);
        });

        it('only lets the invited email accept', async () => {
          const owner = await makeUser(ctx);
          const other = await makeUser(ctx);
          await onTeamPlan(owner.id);
          const id = await invite(owner, 'someone-else@example.com');
          await expect(ctx.auth.api.acceptInvitation({ headers: await signedIn(ctx, other), body: { invitationId: id } })).rejects.toThrow();
          expect(await teamFor(ctx.db, other.id, owner.teamId)).toBeNull();
        });

        it('limits seats by the owner\'s plan', async () => {
          const free = await makeUser(ctx);
          expect((await teamPlan(ctx.db, free.teamId)).id).toBe('free');
          expect((await canInvite(ctx.db, free.teamId)).ok).toBe(false);
          // The plugin enforces it too, even if someone calls the API directly.
          await expect(ctx.auth.api.createInvitation({ headers: await signedIn(ctx, free), body: { email: 'x@example.com', role: 'member', organizationId: free.teamId } })).rejects.toThrow();

          const owner = await makeUser(ctx);
          await onTeamPlan(owner.id);
          expect((await canInvite(ctx.db, owner.teamId)).ok).toBe(true);
        });

        it('deletes the teams a user owns, with their projects, when they delete their account', async () => {
          const owner = await makeUser(ctx);
          await createProject(ctx.db, owner.teamId, projectInput.parse({ name: 'Doomed' }));
          await ctx.auth.api.deleteUser({ headers: await signedIn(ctx, owner), body: { password: owner.password } });
          expect(await listProjects(ctx.db, owner.teamId)).toEqual([]);
          expect(await membersOf(ctx.db, owner.teamId)).toEqual([]);
        });

        it("doesn't let plain members invite or remove people", async () => {
          const owner = await makeUser(ctx);
          const mate = await makeUser(ctx);
          await onTeamPlan(owner.id);
          await ctx.auth.api.acceptInvitation({ headers: await signedIn(ctx, mate), body: { invitationId: await invite(owner, mate.email) } });
          const asMate = await signedIn(ctx, mate);
          await expect(ctx.auth.api.createInvitation({ headers: asMate, body: { email: 'y@example.com', role: 'member', organizationId: owner.teamId } })).rejects.toThrow();
          const ownerRow = (await membersOf(ctx.db, owner.teamId)).find((m) => m.userId === owner.id)!;
          await expect(ctx.auth.api.removeMember({ headers: asMate, body: { memberIdOrEmail: ownerRow.id, organizationId: owner.teamId } })).rejects.toThrow();
        });
      });
      ```

## Verify

1. `npm run check` ends with `CODEPLATE CHECKS: PASS`. `migrations` confirms both new migrations match `schema.ts`, `test` runs the new `teams.test.ts`, and the existing screen tests show projects still work for each user's personal team.
2. The `grep` from step 10 finds no `user.id` in the project pages, actions or dashboard.
3. `npm run shots -- /dashboard /projects --as=pro`: the demo user still sees their six projects (the seed puts them in the user's personal team).

Then continue with `add-teams-2-pages.md`.
