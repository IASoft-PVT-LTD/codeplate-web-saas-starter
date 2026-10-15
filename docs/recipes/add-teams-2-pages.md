# Add teams, stage 2: the pages

Use after `add-teams-1-data.md` passes its checks: the Team page (members, invites, switching teams), the invite link page, navigation, and a browser test of the invite flow.

1. **Validate invites** (`src/lib/schemas.ts`), above the `/** Turns form data… */` comment over `formObject`:
    ```ts
    export const inviteInput = z.object({
      email: z.string().trim().toLowerCase().email('Enter an email address.'),
      role: z.enum(['member', 'admin']).default('member'),
    });
    ```
2. **The team page.** Create `src/app/(app)/team/actions.ts`:
    ```ts
    'use server';
    // Team changes go through Better Auth's organization plugin (auth.api), which
    // checks the caller's role: only owners and admins can invite or remove.
    // Plan limits are checked here first, in entitlements.ts, for a clear message.
    import { headers } from 'next/headers';
    import { redirect } from 'next/navigation';
    import { revalidatePath } from 'next/cache';
    import { getDb } from '@/db';
    import { getAuth } from '@/lib/auth';
    import { requireTeam } from '@/lib/session';
    import { canInvite } from '@/lib/entitlements';
    import { formObject, inviteInput } from '@/lib/schemas';

    /** Runs a Better Auth call; returns its error message, or null if it worked. */
    async function attempt(fn: () => Promise<unknown>): Promise<string | null> {
      try {
        await fn();
        return null;
      } catch (e) {
        return e instanceof Error && e.message ? e.message : 'Something went wrong. Try again.';
      }
    }

    function back(error: string | null, ok: string): never {
      revalidatePath('/', 'layout');
      redirect(error ? `/team?error=${encodeURIComponent(error)}` : `/team?ok=${encodeURIComponent(ok)}`);
    }

    export async function inviteAction(form: FormData): Promise<void> {
      const { team } = await requireTeam();
      const parsed = inviteInput.safeParse(formObject(form));
      if (!parsed.success) back(parsed.error.issues[0]?.message ?? 'Check the form.', '');
      const allowed = await canInvite(await getDb(), team.id);
      if (!allowed.ok) back(allowed.reason, '');
      const auth = await getAuth();
      const h = await headers();
      const error = await attempt(() => auth.api.createInvitation({ headers: h, body: { ...parsed.data, organizationId: team.id } }));
      back(error, `Invite sent to ${parsed.data.email}.`);
    }

    export async function cancelInviteAction(invitationId: string): Promise<void> {
      const auth = await getAuth();
      const h = await headers();
      back(await attempt(() => auth.api.cancelInvitation({ headers: h, body: { invitationId } })), 'Invite canceled.');
    }

    export async function removeMemberAction(memberId: string): Promise<void> {
      const { team } = await requireTeam();
      const auth = await getAuth();
      const h = await headers();
      back(await attempt(() => auth.api.removeMember({ headers: h, body: { memberIdOrEmail: memberId, organizationId: team.id } })), 'Removed.');
    }

    export async function switchTeamAction(teamId: string): Promise<void> {
      const auth = await getAuth();
      const h = await headers();
      // The plugin refuses teams the user isn't a member of.
      const error = await attempt(() => auth.api.setActiveOrganization({ headers: h, body: { organizationId: teamId } }));
      if (error) back(error, '');
      revalidatePath('/', 'layout');
      redirect('/dashboard');
    }

    export async function acceptInviteAction(invitationId: string): Promise<void> {
      const auth = await getAuth();
      const h = await headers();
      // Checks the invite is addressed to the signed-in email, then makes them a
      // member and switches them to the team.
      const error = await attempt(() => auth.api.acceptInvitation({ headers: h, body: { invitationId } }));
      if (error) redirect(`/invite/${invitationId}?error=${encodeURIComponent(error)}`);
      revalidatePath('/', 'layout');
      redirect('/dashboard');
    }
    ```
    Every action redirects outside the `try`, because `redirect()` works by throwing. Then create `src/app/(app)/team/page.tsx`:
    ```tsx
    import type { Metadata } from 'next';
    import { getDb } from '@/db';
    import { requireTeam } from '@/lib/session';
    import { membersOf, pendingInvitesOf, teamsFor } from '@/lib/teams';
    import { seatsLeft, teamPlan } from '@/lib/entitlements';
    import { Badge, Button, Card, Field, Input, LinkButton, Notice, PageHeader, Select, Toast } from '@/components/ui';
    import { cancelInviteAction, inviteAction, removeMemberAction, switchTeamAction } from './actions';

    export const metadata: Metadata = { title: 'Team' };

    export default async function TeamPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
      const { user, team } = await requireTeam();
      const db = await getDb();
      const [members, invites, teams, plan, left] = await Promise.all([
        membersOf(db, team.id), pendingInvitesOf(db, team.id), teamsFor(db, user.id), teamPlan(db, team.id), seatsLeft(db, team.id),
      ]);
      const { ok, error } = await searchParams;
      const manager = team.role === 'owner' || team.role === 'admin';

      return (
        <>
          <PageHeader title={team.name} description={`${members.length + invites.length} of ${plan.limits.seats} seats used on the ${plan.name} plan.`} />
          <div className="max-w-2xl space-y-6">
            {ok ? <Toast key={ok}>{ok}</Toast> : null}
            {error ? <Notice tone="bad">{error}</Notice> : null}

            <Card flush className="divide-y divide-line">
              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}{m.userId === user.id ? ' (you)' : ''}</p>
                    <p className="truncate text-sm text-ink-soft">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role}</Badge>
                    {manager && m.role !== 'owner' && m.userId !== user.id ? (
                      <form action={removeMemberAction.bind(null, m.id)}><Button variant="ghost" type="submit">Remove</Button></form>
                    ) : null}
                  </div>
                </div>
              ))}
              {invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.email}</p>
                    <p className="text-sm text-ink-soft">Invited · expires {i.expiresAt.toISOString().slice(0, 10)}</p>
                  </div>
                  {manager ? <form action={cancelInviteAction.bind(null, i.id)}><Button variant="ghost" type="submit">Cancel invite</Button></form> : null}
                </div>
              ))}
            </Card>

            {manager ? (
              <Card>
                <h2 className="mb-4 font-semibold">Invite someone</h2>
                {left > 0 ? (
                  <form action={inviteAction} className="space-y-4">
                    <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
                    <Field label="Role" htmlFor="role" hint="Admins can invite and remove people.">
                      <Select id="role" name="role" defaultValue="member"><option value="member">Member</option><option value="admin">Admin</option></Select>
                    </Field>
                    <Button type="submit">Send invite</Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-ink-soft">The {plan.name} plan includes {plan.limits.seats} {plan.limits.seats === 1 ? 'seat' : 'seats'}, and they're all taken.</p>
                    {team.role === 'owner' ? <LinkButton href="/billing">Upgrade for more</LinkButton> : <p className="text-sm text-ink-soft">Ask the team's owner to upgrade.</p>}
                  </div>
                )}
              </Card>
            ) : null}

            {teams.length > 1 ? (
              <Card>
                <h2 className="mb-4 font-semibold">Your teams</h2>
                <div className="space-y-2">
                  {teams.map((t) => (
                    <form key={t.id} action={switchTeamAction.bind(null, t.id)} className="flex items-center justify-between gap-3">
                      <span className="truncate">{t.name} <span className="text-sm text-ink-soft">· {t.role}</span></span>
                      {t.id === team.id ? <Badge tone="ok">Current</Badge> : <Button variant="secondary" type="submit">Switch</Button>}
                    </form>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </>
      );
    }
    ```
3. **The invite link page:** create `src/app/(app)/invite/[id]/page.tsx`:
    ```tsx
    import type { Metadata } from 'next';
    import { getDb } from '@/db';
    import { requireUser } from '@/lib/session';
    import { inviteFor } from '@/lib/teams';
    import { Button, Card, Notice, PageHeader } from '@/components/ui';
    import { acceptInviteAction } from '../../team/actions';

    export const metadata: Metadata = { title: 'Join a team' };

    // The link in an invite email. Signed-out visitors are sent to /sign-in by the
    // (app) layout; they come back by opening the link again.
    export default async function Invite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
      const { id } = await params;
      const { error } = await searchParams;
      const user = await requireUser();
      const invite = await inviteFor(await getDb(), id, user.email);
      if (!invite) {
        return (
          <>
            <PageHeader title="Invite not found" />
            <Notice tone="warn">This invite has expired, was canceled, or was sent to a different email than {user.email}. Ask for a new one.</Notice>
          </>
        );
      }
      return (
        <>
          <PageHeader title={`Join ${invite.teamName}`} />
          <Card className="max-w-xl space-y-4">
            {error ? <Notice tone="bad">{error}</Notice> : null}
            <p>You'll see and edit the team's work. You keep your own team too.</p>
            <form action={acceptInviteAction.bind(null, invite.id)}><Button type="submit">Join team</Button></form>
          </Card>
        </>
      );
    }
    ```
    The plugin rejects an accept from any email other than the invited one. `inviteFor` checks the same thing, so the page can explain instead of failing.
4. **Navigation** (`src/app/(app)/layout.tsx`): add `<NavLink href="/team">Team</NavLink>` after the projects link.
5. **A browser test of the invite flow.**
    - `tests/e2e/helpers.ts`: let `signUp` take an email. Change its first lines to:
      ```ts
      export async function signUp(page: Page, name = 'Sam Tester', email = `e2e-${Date.now()}-${++n}@example.com`) {
      ```
      and delete the `n += 1;` and `const email = …` lines below it. Keep `const password = …`, and keep `let n = 0;` above the function.
    - Create `tests/e2e/teams.spec.ts`:
      ```ts
      import { expect, test } from '@playwright/test';
      import { signUp, watchErrors } from './helpers';

      test('invite a teammate, who then works on the team\'s projects', async ({ page, browser }) => {
        const noErrors = watchErrors(page);
        await signUp(page, 'Olga Owner');
        await page.goto('/team');
        await expect(page.getByText('Upgrade for more')).toBeVisible(); // Free has 1 seat

        await page.goto('/billing');
        await page.getByRole('button', { name: 'Simulate Team (dev)' }).click();
        await expect(page.getByText("You're on the Team plan.")).toBeVisible();
        await page.goto('/projects/new');
        await page.getByLabel('Name').fill('Shared roadmap');
        await page.getByRole('button', { name: 'Create project' }).click();
        await expect(page.getByRole('heading', { name: 'Shared roadmap' })).toBeVisible();

        const email = `e2e-mate-${Date.now()}@example.com`;
        await page.goto('/team');
        await page.getByLabel('Email').fill(email);
        await page.getByRole('button', { name: 'Send invite' }).click();
        await expect(page.getByText(`Invite sent to ${email}.`)).toBeVisible();

        const mate = await browser.newPage();
        await signUp(mate, 'Mo Mate', email);
        await mate.goto('/dev/outbox');
        await mate.locator('article', { hasText: `To ${email}` }).filter({ hasText: 'invited you' }).first().getByRole('link').first().click();
        await mate.getByRole('button', { name: 'Join team' }).click();
        await expect(mate).toHaveURL(/\/dashboard$/);
        await mate.goto('/projects');
        await expect(mate.getByText('Shared roadmap')).toBeVisible();
        await mate.close();

        await page.goto('/team');
        await expect(page.getByText('Mo Mate')).toBeVisible();
        noErrors();
      });
      ```
6. **Record it** in `docs/project.md`: teams are on, the seat limit for each plan, and that a team gets its owner's plan. Then tell the user: invites need real email in production (`add-email-provider.md`), and deleting an account deletes the teams it owns.

**Later, if the user wants it:** a role dropdown (`auth.api.updateMemberRole`), "leave team" (`auth.api.leaveOrganization`), renaming the team (`auth.api.updateOrganization`), or letting people create extra teams (set `allowUserToCreateOrganization` to a function that checks the plan in `entitlements.ts`, and add a form that calls `auth.api.createOrganization`). Each one gets a test in `tests/integration/teams.test.ts`.

## Verify

1. `npm run check` ends with `CODEPLATE CHECKS: PASS`; `e2e` runs the invite flow in `teams.spec.ts`.
2. Screenshots: `npm run shots -- /team /dashboard --as=pro` and `npm run shots -- /team --as=free --size=390x844 --dark`. The team page shows the owner, "1 of 1 seats used", and an upgrade button. Nothing overflows on a phone.
3. Then the by-hand invite walk-through in `add-teams.md`'s Verify.
