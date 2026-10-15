// The core resource's data functions. Every query is scoped to the owner, so
// one user can never see or change another user's projects. Server actions
// (src/app/(app)/projects/actions.ts) call these after checking the session.
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { project } from '@/db/schema';
import type { ProjectInput } from './schemas';
import { canCreateProject } from './entitlements';

export type Project = typeof project.$inferSelect;

export async function listProjects(db: Db, ownerId: string): Promise<Project[]> {
  return db.select().from(project).where(eq(project.ownerId, ownerId)).orderBy(desc(project.updatedAt));
}

/** The project if it exists and belongs to `ownerId`, otherwise null. */
export async function getProject(db: Db, ownerId: string, id: string): Promise<Project | null> {
  const [row] = await db.select().from(project).where(and(eq(project.id, id), eq(project.ownerId, ownerId)));
  return row ?? null;
}

export async function createProject(db: Db, ownerId: string, input: ProjectInput): Promise<{ ok: true; project: Project } | { ok: false; reason: string }> {
  const allowed = await canCreateProject(db, ownerId);
  if (!allowed.ok) return allowed;
  const [row] = await db.insert(project).values({ id: crypto.randomUUID(), ownerId, ...input }).returning();
  return { ok: true, project: row };
}

/** Updates a project the user owns; false if it isn't theirs (or doesn't exist). */
export async function updateProject(db: Db, ownerId: string, id: string, input: ProjectInput): Promise<boolean> {
  const rows = await db.update(project).set({ ...input, updatedAt: new Date() })
    .where(and(eq(project.id, id), eq(project.ownerId, ownerId))).returning({ id: project.id });
  return rows.length === 1;
}

export async function deleteProject(db: Db, ownerId: string, id: string): Promise<boolean> {
  const rows = await db.delete(project).where(and(eq(project.id, id), eq(project.ownerId, ownerId))).returning({ id: project.id });
  return rows.length === 1;
}
