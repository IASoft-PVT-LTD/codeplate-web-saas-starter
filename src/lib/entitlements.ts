// What a user's plan allows. Every limit check goes through here, so the
// rules live in one place (and the pricing page reads the same config).
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db';
import { project, subscription } from '@/db/schema';
import { plans, type Plan, type PlanId } from '@/config/plans';
import { site } from '@/config/site';

/** Subscription statuses that grant the paid plan. */
export const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'] as const;

/** The plan a user is on right now (free without an active subscription). */
export async function planFor(db: Db, userId: string): Promise<Plan> {
  const [sub] = await db.select().from(subscription)
    .where(and(eq(subscription.userId, userId), inArray(subscription.status, [...ACTIVE_STATUSES])))
    .orderBy(desc(subscription.updatedAt)).limit(1);
  const id = (sub?.plan ?? 'free') as PlanId;
  return plans[id] ?? plans.free;
}

export type Usage = { projects: number };

export async function usageFor(db: Db, userId: string): Promise<Usage> {
  const [row] = await db.select({ n: count() }).from(project).where(eq(project.ownerId, userId));
  return { projects: row?.n ?? 0 };
}

/** Whether the user may create one more project, and why not if they can't. */
export async function canCreateProject(db: Db, userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [plan, usage] = await Promise.all([planFor(db, userId), usageFor(db, userId)]);
  if (usage.projects < plan.limits.projects) return { ok: true };
  return { ok: false, reason: `The ${plan.name} plan includes ${plan.limits.projects} ${site.resource.many}. Upgrade for more.` };
}
