# Add a resource

Use when users need a second kind of thing: tasks inside a project, clients, notes, line items on an invoice. The example adds **tasks that belong to a project**, shown on the project's page, plus a **Tasks** page listing open tasks across projects. If you renamed the core resource, use your names (`invoice`, `src/lib/invoices.ts`, `/invoices`).

**Who owns it.** Give the new table its own `ownerId`, even when it also belongs to a project. Every query can then filter on `ownerId` directly, the same way `src/lib/projects.ts` does, and a mistake in a join can't leak another user's rows. The cost is one check when creating: the project must belong to the user (step 3). A top-level resource (clients, notes) is the same without `projectId`.

1. **Add the table** in `src/db/schema.ts`, after `project`:
   ```ts
   /** A to-do inside a project. ownerId is copied from the project, so every query can scope by owner directly. */
   export const task = pgTable('task', {
     id: text('id').primaryKey(),
     ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
     projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
     title: text('title').notNull(),
     done: boolean('done').notNull().default(false),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   }, (t) => [index('task_owner_idx').on(t.ownerId), index('task_project_idx').on(t.projectId)]);
   ```
   `onDelete: 'cascade'` removes a project's tasks with the project, and everything when a user deletes their account. Index every column you filter on. Then:
   ```
   npm run db:generate -- --name add_tasks
   ```
   The new `drizzle/NNNN_add_tasks.sql` should hold one `CREATE TABLE "task"`, two foreign keys and two indexes.

2. **Validate input** in `src/lib/schemas.ts`, next to `projectInput`:
   ```ts
   export const taskInput = z.object({
     title: z.string().trim().min(1, 'Write the task.').max(200, 'Keep it under 200 characters.'),
   });
   export type TaskInput = z.infer<typeof taskInput>;
   ```
   Only fields the user types go in the schema. `ownerId` and `projectId` never come from the form body.

3. **Write the data functions** in a new `src/lib/tasks.ts`. Each takes `db` and the signed-in user's id, and puts the id in the `where` clause:
   ```ts
   import { and, asc, eq } from 'drizzle-orm';
   import type { Db } from '@/db';
   import { project, task } from '@/db/schema';
   import type { TaskInput } from './schemas';
   import { getProject } from './projects';

   export type Task = typeof task.$inferSelect;

   export async function listTasks(db: Db, ownerId: string, projectId: string): Promise<Task[]> {
     return db.select().from(task)
       .where(and(eq(task.ownerId, ownerId), eq(task.projectId, projectId))).orderBy(asc(task.createdAt));
   }

   /** All of the user's open tasks, with their project's name. */
   export async function listOpenTasks(db: Db, ownerId: string) {
     return db.select({ id: task.id, title: task.title, projectId: task.projectId, projectName: project.name })
       .from(task).innerJoin(project, eq(project.id, task.projectId))
       .where(and(eq(task.ownerId, ownerId), eq(task.done, false))).orderBy(asc(task.createdAt));
   }

   export async function createTask(db: Db, ownerId: string, projectId: string, input: TaskInput): Promise<{ ok: true; task: Task } | { ok: false; reason: string }> {
     // The project id comes from the URL: check it's this user's before attaching to it.
     if (!(await getProject(db, ownerId, projectId))) return { ok: false, reason: 'That project no longer exists.' };
     const [row] = await db.insert(task).values({ id: crypto.randomUUID(), ownerId, projectId, ...input }).returning();
     return { ok: true, task: row };
   }

   export async function setTaskDone(db: Db, ownerId: string, id: string, done: boolean): Promise<boolean> {
     const rows = await db.update(task).set({ done })
       .where(and(eq(task.id, id), eq(task.ownerId, ownerId))).returning({ id: task.id });
     return rows.length === 1;
   }

   export async function deleteTask(db: Db, ownerId: string, id: string): Promise<boolean> {
     const rows = await db.delete(task).where(and(eq(task.id, id), eq(task.ownerId, ownerId))).returning({ id: task.id });
     return rows.length === 1;
   }
   ```
   If the plan should limit it, add the limit first (`change-plans-and-prices.md`, "Add a limit") and call that check at the top of `createTask()`, as `createProject()` does.

4. **Add server actions** in a new `src/app/(app)/tasks/actions.ts`. Same shape as `src/app/(app)/projects/actions.ts`: `requireUser()`, parse, call `src/lib/tasks.ts`, `revalidatePath()` every page that shows tasks:
   ```ts
   'use server';
   import { revalidatePath } from 'next/cache';
   import { getDb } from '@/db';
   import { requireUser } from '@/lib/session';
   import { createTask, deleteTask, setTaskDone } from '@/lib/tasks';
   import { fieldErrors, formObject, taskInput } from '@/lib/schemas';
   import type { FormState } from '@/app/(app)/projects/actions';

   export async function createTaskAction(projectId: string, _prev: FormState, form: FormData): Promise<FormState> {
     const user = await requireUser();
     const parsed = taskInput.safeParse(formObject(form));
     if (!parsed.success) return { errors: fieldErrors(parsed.error) };
     const result = await createTask(await getDb(), user.id, projectId, parsed.data);
     if (!result.ok) return { message: result.reason };
     revalidatePath(`/projects/${projectId}`);
     revalidatePath('/tasks');
     return {};
   }

   export async function setTaskDoneAction(projectId: string, id: string, done: boolean): Promise<void> {
     const user = await requireUser();
     await setTaskDone(await getDb(), user.id, id, done);
     revalidatePath(`/projects/${projectId}`);
     revalidatePath('/tasks');
   }
   ```
   and `deleteTaskAction(projectId, id)` the same way with `deleteTask()`. Pages pass the ids with `.bind(null, …)`; a bound id is still user-controllable, which is why `src/lib/tasks.ts` checks the owner on every call.

5. **Add the form** as a small client component, `src/components/task-form.tsx` (client only because it shows the pending state and errors):
   ```tsx
   'use client';
   import { useActionState } from 'react';
   import { Button, Input, Notice } from './ui';
   import type { FormState } from '@/app/(app)/projects/actions';

   /** The "add a task" form on a project's page. React clears it after each submit. */
   export function TaskForm({ action }: { action: (prev: FormState, form: FormData) => Promise<FormState> }) {
     const [state, formAction, pending] = useActionState(action, {});
     return (
       <form action={formAction} className="space-y-2">
         {state.message ? <Notice tone="warn">{state.message}</Notice> : null}
         <div className="flex gap-2">
           <label htmlFor="task-title" className="sr-only">New task</label>
           <Input id="task-title" name="title" placeholder="Add a task" required maxLength={200} />
           <Button type="submit" disabled={pending}>Add</Button>
         </div>
         {state.errors?.title ? <p className="text-sm text-bad" role="alert">{state.errors.title}</p> : null}
       </form>
     );
   }
   ```
   For a resource with several fields, copy `src/components/project-form.tsx` instead (`Field` + inputs).

6. **Show tasks on the project page** (`src/app/(app)/projects/[id]/page.tsx`). Import `listTasks`, `TaskForm` and the three actions (`from '@/app/(app)/tasks/actions'`). Load the tasks after the ownership check:
   ```ts
   const db = await getDb();
   const project = await getProject(db, user.id, id);
   if (!project) notFound();
   const tasks = await listTasks(db, user.id, project.id);
   ```
   and add a card between the edit form and the delete card:
   ```tsx
   <Card className="mt-6 max-w-2xl">
     <h2 className="mb-4 font-semibold">Tasks</h2>
     {tasks.length > 0 ? (
       <ul className="mb-4 divide-y divide-line">
         {tasks.map((t) => (
           <li key={t.id} className="flex items-center gap-3 py-2">
             <form action={setTaskDoneAction.bind(null, project.id, t.id, !t.done)}>
               <Button variant="secondary" type="submit" className="px-2 py-1" aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}>
                 {t.done ? '✓' : '○'}
               </Button>
             </form>
             <span className={`min-w-0 flex-1 truncate ${t.done ? 'text-ink-soft line-through' : ''}`}>{t.title}</span>
             <form action={deleteTaskAction.bind(null, project.id, t.id)}>
               <Button variant="ghost" type="submit" aria-label={`Delete "${t.title}"`}>Delete</Button>
             </form>
           </li>
         ))}
       </ul>
     ) : null}
     <TaskForm action={createTaskAction.bind(null, project.id)} />
   </Card>
   ```
   Plain `<form action={serverAction}>` buttons need no client code.

7. **Add a page** for the resource, `src/app/(app)/tasks/page.tsx`. It's a server component that reads directly (`requireUser()` first, so it renders per request):
   ```tsx
   import type { Metadata } from 'next';
   import Link from 'next/link';
   import { getDb } from '@/db';
   import { requireUser } from '@/lib/session';
   import { listOpenTasks } from '@/lib/tasks';
   import { Card, EmptyState, PageHeader } from '@/components/ui';
   import { site } from '@/config/site';

   export const metadata: Metadata = { title: 'Tasks' };

   export default async function Tasks() {
     const user = await requireUser();
     const tasks = await listOpenTasks(await getDb(), user.id);
     return (
       <>
         <PageHeader title="Tasks" description={`Open tasks across all your ${site.resource.many}.`} />
         {tasks.length === 0 ? (
           <EmptyState title="No open tasks" body={`Add tasks on a ${site.resource.one}'s page.`} />
         ) : (
           <Card flush className="divide-y divide-line overflow-hidden">
             {tasks.map((t) => (
               <Link key={t.id} href={`/projects/${t.projectId}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-canvas">
                 <span className="min-w-0 truncate font-medium">{t.title}</span>
                 <span className="shrink-0 text-sm text-ink-soft">{t.projectName}</span>
               </Link>
             ))}
           </Card>
         )}
       </>
     );
   }
   ```
   A top-level resource with its own create and edit screens copies the whole `src/app/(app)/projects/` folder instead (`page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `actions.ts`) plus a form component, renamed.

8. **Add it to the navigation** in `src/app/(app)/layout.tsx`, after the projects link: `<NavLink href="/tasks">Tasks</NavLink>`. The nav scrolls sideways on phones, so another link still fits.

9. **Seed it** in `scripts/seed.ts`: import `task` from `@/db/schema`, and in the loop over `sample`, keep the project id and add a few tasks. Give them fixed ids like the projects', so screenshots can reach them:
   ```ts
   for (const [i, p] of sample.slice(0, n).entries()) {
     const projectId = `demo-${email.split('@')[0]}-${i + 1}`;
     await db.insert(project).values({ id: projectId, ownerId: u.id, ...p });
     for (const [j, title] of ['Write the brief', 'Review with the team', 'Ship it'].entries()) {
       await db.insert(task).values({ id: `${projectId}-task-${j + 1}`, ownerId: u.id, projectId, title, done: j === 0 });
     }
   }
   ```

10. **Test it.**
    - `tests/integration/tasks.test.ts` (copy the setup of `projects.test.ts`: `setup()`, `makeUser()`). Cover: create, list, mark done, delete; **ownership**: a second user can't `createTask` in the first user's project (`ok` is false), and gets `[]` / `false` from `listTasks`, `listOpenTasks`, `setTaskDone`, `deleteTask` on the first user's ids; deleting the project removes its tasks; `taskInput` rejects a blank and a 201-character title.
    - `tests/e2e/tasks.spec.ts`: `signUp()`, create a project, fill `getByLabel('New task')`, click `getByRole('button', { name: 'Add', exact: true })`, see the task; open `/tasks` and follow the link back; click `Mark "…" done` and see `/tasks` say "No open tasks"; delete it. Call `watchErrors(page)` at the start and `noErrors()` at the end.
    - `tests/e2e/pages.spec.ts`: add `['/tasks', 'Tasks']` to the Pro user's page loop.

11. **Admin and account deletion.** The cascades handle deletion. If the admin page (`src/app/(app)/admin/page.tsx`) should count tasks, copy its `project` count query.

## Verify

1. `npm run check`. It must end with `CODEPLATE CHECKS: PASS`. The ownership tests are the important ones: never weaken them.
2. Screenshots:
   ```
   npm run shots -- /tasks /dashboard --as=pro
   npm run shots -- /tasks --as=pro --size=390x844 --dark
   ```
   Look for: the Tasks link in the nav, highlighted on `/tasks`; the seeded open tasks with their project names; long titles truncate instead of pushing the project name off screen; readable in dark mode. For the project page's task list: `npm run shots -- /projects/demo-pro-1 --as=pro`.
