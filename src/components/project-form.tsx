'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice, Select, Textarea, Toast } from './ui';
import type { FormState } from '@/app/(app)/projects/actions';
import type { Project } from '@/lib/projects';

/** The create/edit form. `action` is a server action bound to the project (for edits). */
export function ProjectForm({ action, project, submitLabel }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  project?: Project;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-5">
      {state.message ? <Notice tone="warn">{state.message}</Notice> : null}
      {state.saved ? <Toast key={state.saved}>Saved.</Toast> : null}
      <Field label="Name" htmlFor="name" error={e.name}>
        <Input id="name" name="name" defaultValue={project?.name} required maxLength={80} />
      </Field>
      <Field label="Description" htmlFor="description" error={e.description}>
        <Textarea id="description" name="description" defaultValue={project?.description} maxLength={2000} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status" htmlFor="status" error={e.status}>
          <Select id="status" name="status" defaultValue={project?.status ?? 'planned'}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <Field label="Due date" htmlFor="dueDate" error={e.dueDate} hint="Optional.">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={project?.dueDate ?? ''} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
    </form>
  );
}
