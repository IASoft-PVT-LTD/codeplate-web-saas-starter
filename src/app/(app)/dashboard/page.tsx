import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/db';
import { requireUser } from '@/lib/session';
import { listProjects } from '@/lib/projects';
import { planFor } from '@/lib/entitlements';
import { Badge, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { site } from '@/config/site';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const user = await requireUser();
  const db = await getDb();
  const [projects, plan] = await Promise.all([listProjects(db, user.id), planFor(db, user.id)]);
  const active = projects.filter((p) => p.status === 'active').length;
  const due = projects.filter((p) => p.dueDate && p.status !== 'done').sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 5);
  const limit = plan.limits.projects === Infinity ? 'unlimited' : `of ${plan.limits.projects}`;

  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} description="Here's where things stand."
        actions={<LinkButton href="/projects/new">New {site.resource.one}</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-soft">{site.resource.many[0].toUpperCase() + site.resource.many.slice(1)}</p><p className="mt-1 text-3xl font-bold">{projects.length} <span className="text-base font-normal text-ink-soft">{limit}</span></p></Card>
        <Card><p className="text-sm text-ink-soft">Active</p><p className="mt-1 text-3xl font-bold">{active}</p></Card>
        <Card><p className="text-sm text-ink-soft">Plan</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold">{plan.name}{plan.id === 'free' ? <Link href="/billing" className="text-sm font-medium text-brand">Upgrade</Link> : <Badge tone="ok">Active</Badge>}</p></Card>
      </div>
      <h2 className="mb-3 mt-10 font-semibold">Due next</h2>
      {due.length === 0 ? (
        <EmptyState title="Nothing due" body={`Anything with a due date shows up here.`} />
      ) : (
        <Card flush className="divide-y divide-line overflow-hidden">
          {due.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-canvas">
              <span className="font-medium">{p.name}</span>
              <span className="flex items-center gap-3 text-sm text-ink-soft">{p.dueDate}<StatusBadge status={p.status} /></span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
