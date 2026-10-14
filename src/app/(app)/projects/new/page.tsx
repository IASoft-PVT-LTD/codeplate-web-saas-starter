import type { Metadata } from 'next';
import { Card, PageHeader } from '@/components/ui';
import { ProjectForm } from '@/components/project-form';
import { createProjectAction } from '../actions';
import { site } from '@/config/site';

export const metadata: Metadata = { title: `New ${site.resource.one}` };

export default function NewProject() {
  return (
    <>
      <PageHeader title={`New ${site.resource.one}`} />
      <Card className="max-w-2xl"><ProjectForm action={createProjectAction} submitLabel={`Create ${site.resource.one}`} /></Card>
    </>
  );
}
