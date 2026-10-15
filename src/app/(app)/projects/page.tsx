import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/db';
import { requireUser } from '@/lib/session';
import { listProjects } from '@/lib/projects';
import { canCreateProject } from '@/lib/entitlements';
import { Card, EmptyState, LinkButton, Notice, PageHeader } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { site } from '@/config/site';

const title = site.resource.many[0].toUpperCase() + site.resource.many.slice(1);
export const metadata: Metadata = { title };

export default async function Projects() {
  const user = await requireUser();
  const db = await getDb();
  const [projects, allowed] = await Promise.all([listProjects(db, user.id), canCreateProject(db, user.id)]);
  const newButton = allowed.ok
    ? <LinkButton href="/projects/new">New {site.resource.one}</LinkButton>
    : <LinkButton href="/billing">Upgrade for more</LinkButton>;

  return (
    <>
      <PageHeader title={title} description={`Everything you're working on.`} actions={newButton} />
      {!allowed.ok ? <div className="mb-6"><Notice tone="warn">{allowed.reason}</Notice></div> : null}
      {projects.length === 0 ? (
        <EmptyState title={`No ${site.resource.many} yet`} body={`Create your first ${site.resource.one} to get started.`} action={newButton} />
      ) : (
        <Card flush className="divide-y divide-line overflow-hidden">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-canvas">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                {p.description ? <p className="truncate text-sm text-ink-soft">{p.description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm text-ink-soft">
                {p.dueDate ? <span className="hidden sm:inline">Due {p.dueDate}</span> : null}
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
