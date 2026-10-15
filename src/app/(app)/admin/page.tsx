import type { Metadata } from 'next';
import { count, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { project, subscription, user } from '@/db/schema';
import { requireAdmin } from '@/lib/session';
import { Badge, Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Admin' };

// Only emails in ADMIN_EMAILS see this page; everyone else gets a 404.
export default async function Admin() {
  await requireAdmin();
  const db = await getDb();
  const users = await db.select({
    id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, verified: user.emailVerified,
  }).from(user).orderBy(desc(user.createdAt)).limit(100);
  const subs = await db.select().from(subscription);
  const counts = await db.select({ ownerId: project.ownerId, n: count() }).from(project).groupBy(project.ownerId);
  const [{ total }] = await db.select({ total: count() }).from(user);
  const subOf = new Map(subs.map((s) => [s.userId, s]));
  const projectsOf = new Map(counts.map((c) => [c.ownerId, c.n]));

  return (
    <>
      <PageHeader title="Admin" description={`${total} users · ${subs.filter((s) => s.status === 'active').length} active subscriptions`} />
      <Card flush className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-ink-soft">
            <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Projects</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const s = subOf.get(u.id);
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-medium">{u.name}</p><p className="text-ink-soft">{u.email}{u.verified ? '' : ' · unverified'}</p></td>
                  <td className="px-4 py-3 text-ink-soft">{u.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">{s ? <Badge tone={s.status === 'active' ? 'ok' : 'neutral'}>{s.plan} · {s.status}</Badge> : <Badge>free</Badge>}</td>
                  <td className="px-4 py-3">{projectsOf.get(u.id) ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
