'use server';
// Server actions for the core resource. Each one: who's signed in, validate
// the input (lib/schemas.ts), then call lib/projects.ts, which scopes every
// query to the owner.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { requireUser } from '@/lib/session';
import { createProject, deleteProject, updateProject } from '@/lib/projects';
import { fieldErrors, formObject, projectInput } from '@/lib/schemas';

/** `message` is a problem to show next to the form; `saved` (a timestamp) shows the "Saved." toast. */
export type FormState = { errors?: Record<string, string>; message?: string; saved?: number };

export async function createProjectAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = projectInput.safeParse(formObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const result = await createProject(await getDb(), user.id, parsed.data);
  if (!result.ok) return { message: result.reason };
  revalidatePath('/projects');
  redirect(`/projects/${result.project.id}?created=1`);
}

export async function updateProjectAction(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = projectInput.safeParse(formObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const ok = await updateProject(await getDb(), user.id, id, parsed.data);
  if (!ok) return { message: 'That project no longer exists.' };
  revalidatePath('/projects');
  return { saved: Date.now() };
}

export async function deleteProjectAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteProject(await getDb(), user.id, id);
  revalidatePath('/projects');
  redirect('/projects');
}
