'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { subscription } from '@/db/schema';
import { requireUser } from '@/lib/session';
import { applySubscriptionEvent, customerPortalUrl } from '@/lib/billing';
import { env, paddleConfigured } from '@/lib/env';
import { devPriceId, type PlanId } from '@/config/plans';

/** Sends the user to Paddle's portal to update their card, cancel, or get invoices. */
export async function openPortalAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const [sub] = await db.select().from(subscription).where(eq(subscription.userId, user.id)).orderBy(desc(subscription.updatedAt)).limit(1);
  if (!sub) redirect('/billing');
  redirect(await customerPortalUrl(sub.paddleCustomerId, sub.id));
}

/**
 * DEVELOPMENT ONLY, when Paddle isn't configured: pretends Paddle sent a
 * subscription webhook, through the same code path real webhooks use, so
 * plans and limits can be tried without a Paddle account.
 */
export async function simulateSubscriptionAction(planId: PlanId | 'cancel'): Promise<void> {
  if (!env.devTools || paddleConfigured()) throw new Error('The billing simulator only runs in development without Paddle keys.');
  const user = await requireUser();
  const db = await getDb();
  const subId = `sub_dev_${user.id}`;
  const canceling = planId === 'cancel';
  const [existing] = await db.select().from(subscription).where(and(eq(subscription.id, subId)));
  const priceId = canceling ? existing?.priceId ?? '' : devPriceId(planId);
  const now = new Date();
  await applySubscriptionEvent(db, {
    event_id: `evt_dev_${now.getTime()}`,
    event_type: canceling ? 'subscription.canceled' : 'subscription.updated',
    occurred_at: now.toISOString(),
    data: {
      id: subId,
      status: canceling ? 'canceled' : 'active',
      customer_id: 'ctm_dev',
      items: [{ price: { id: priceId } }],
      current_billing_period: { starts_at: now.toISOString(), ends_at: new Date(now.getTime() + 30 * 86400_000).toISOString() },
      scheduled_change: null,
      custom_data: { userId: user.id },
    },
  });
  revalidatePath('/', 'layout');
  redirect('/billing');
}
