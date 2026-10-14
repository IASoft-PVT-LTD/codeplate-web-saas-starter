import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { requireUser } from '@/lib/session';
import { getProject } from '@/lib/projects';
import { Button, Card, PageHeader, Toast } from '@/components/ui';
import { ProjectForm } from '@/components/project-form';
import { deleteProjectAction, updateProjectAction } from '../actions';
import { site } from '@/config/site';

export const metadata: Metadata = { title: `Edit ${site.resource.one}` };

export default async function EditProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const user = await requireUser();
  const project = await getProject(await getDb(), user.id, id);
  if (!project) notFound();

  return (
    <>
      {created ? <Toast>{site.resource.one[0].toUpperCase() + site.resource.one.slice(1)} created.</Toast> : null}
      <PageHeader title={project.name} description={`Created ${project.createdAt.toISOString().slice(0, 10)}`} />
      <Card className="max-w-2xl"><ProjectForm action={updateProjectAction.bind(null, project.id)} project={project} submitLabel="Save changes" /></Card>
      <Card className="mt-6 max-w-2xl">
        <h2 className="font-semibold">Delete this {site.resource.one}</h2>
        <p className="mt-1 text-sm text-ink-soft">This can't be undone.</p>
        <form action={deleteProjectAction.bind(null, project.id)} className="mt-4">
          <Button variant="danger" type="submit">Delete {site.resource.one}</Button>
        </form>
      </Card>
    </>
  );
}
