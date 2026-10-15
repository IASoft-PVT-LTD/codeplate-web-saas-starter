// The core resource: create, list, update, delete, ownership, and plan limits.
import { beforeAll, describe, expect, it } from 'vitest';
import { createProject, deleteProject, getProject, listProjects, updateProject } from '@/lib/projects';
import { canCreateProject, planFor } from '@/lib/entitlements';
import { projectInput } from '@/lib/schemas';
import { plans } from '@/config/plans';
import { subscription } from '@/db/schema';
import { makeUser, setup, type Ctx } from '../helpers';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setup();
});

const input = (name: string) => projectInput.parse({ name });

describe('projects', () => {
  it('creates, lists, updates and deletes', async () => {
    const u = await makeUser(ctx);
    const r = await createProject(ctx.db, u.id, projectInput.parse({ name: 'Website', dueDate: '2026-12-31' }));
    if (!r.ok) throw new Error(r.reason);
    expect(r.project.dueDate).toBe('2026-12-31');
    expect((await listProjects(ctx.db, u.id)).map((p) => p.name)).toEqual(['Website']);
    expect(await updateProject(ctx.db, u.id, r.project.id, projectInput.parse({ name: 'New website', status: 'active' }))).toBe(true);
    expect((await getProject(ctx.db, u.id, r.project.id))?.status).toBe('active');
    expect(await deleteProject(ctx.db, u.id, r.project.id)).toBe(true);
    expect(await listProjects(ctx.db, u.id)).toEqual([]);
  });

  it("never shows or changes another user's projects", async () => {
    const alice = await makeUser(ctx);
    const bob = await makeUser(ctx);
    const r = await createProject(ctx.db, alice.id, input('Secret'));
    if (!r.ok) throw new Error(r.reason);
    expect(await listProjects(ctx.db, bob.id)).toEqual([]);
    expect(await getProject(ctx.db, bob.id, r.project.id)).toBeNull();
    expect(await updateProject(ctx.db, bob.id, r.project.id, input('Hacked'))).toBe(false);
    expect(await deleteProject(ctx.db, bob.id, r.project.id)).toBe(false);
    expect((await getProject(ctx.db, alice.id, r.project.id))?.name).toBe('Secret');
  });

  it('enforces the free plan limit and lifts it on a paid plan', async () => {
    const u = await makeUser(ctx);
    for (let i = 0; i < plans.free.limits.projects; i++) {
      expect((await createProject(ctx.db, u.id, input(`P${i}`))).ok).toBe(true);
    }
    const blocked = await createProject(ctx.db, u.id, input('One too many'));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toMatch(/upgrade/i);
    await ctx.db.insert(subscription).values({ id: `sub_${u.id}`, userId: u.id, paddleCustomerId: 'ctm_1', priceId: 'pri_test_pro', plan: 'pro', status: 'active' });
    expect((await planFor(ctx.db, u.id)).id).toBe('pro');
    expect((await canCreateProject(ctx.db, u.id)).ok).toBe(true);
  });

  it('validates input', () => {
    expect(projectInput.safeParse({ name: '' }).success).toBe(false);
    expect(projectInput.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
    expect(projectInput.safeParse({ name: 'ok', dueDate: '31/12/2026' }).success).toBe(false);
    expect(projectInput.parse({ name: ' ok ', dueDate: '' })).toMatchObject({ name: 'ok', dueDate: null, status: 'planned' });
  });
});
