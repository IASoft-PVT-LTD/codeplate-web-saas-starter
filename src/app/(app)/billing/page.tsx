import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { subscription } from '@/db/schema';
import { requireUser } from '@/lib/session';
import { planFor } from '@/lib/entitlements';
import { env, paddleConfigured } from '@/lib/env';
import { paidPlanId, planOrder, plans } from '@/config/plans';
import { Button, Card, Notice, PageHeader } from '@/components/ui';
import { PlanCard } from '@/components/plan-card';
import { CheckoutButton } from '@/components/checkout-button';
import { openPortalAction, simulateSubscriptionAction } from './actions';

export const metadata: Metadata = { title: 'Billing' };

// ?plan=<id>: the plan picked on the pricing page (carried through sign-up or
// sign-in). It's highlighted, and with Paddle set up its checkout opens.
export default async function Billing({ searchParams }: { searchParams: Promise<{ success?: string; plan?: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const [plan, [sub]] = await Promise.all([
    planFor(db, user.id),
    db.select().from(subscription).where(eq(subscription.userId, user.id)).orderBy(desc(subscription.updatedAt)).limit(1),
  ]);
  const { success, plan: picked } = await searchParams;
  const chosen = success ? null : paidPlanId(picked);
  const choosing = chosen !== null && chosen !== plan.id;
  const live = paddleConfigured();
  const simulator = !live && env.devTools;

  return (
    <>
      <PageHeader title="Billing" description={`You're on the ${plan.name} plan.`} />
      <div className="space-y-4">
        {choosing ? <Notice>You picked the <strong>{plans[chosen].name}</strong> plan. Finish upgrading below.</Notice> : null}
        {success ? <Notice tone="ok">Thanks! Your payment went through. It can take a few seconds for your plan to update.</Notice> : null}
        {!live ? (
          <Notice tone="warn">
            Paddle isn't set up yet, so real checkout is off. {simulator ? 'In development you can switch plans with the simulator buttons below. ' : ''}
            See <code>docs/recipes/set-up-paddle.md</code>.
          </Notice>
        ) : null}
        {sub && plan.id !== 'free' ? (
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{plan.name} · {sub.status}</p>
              <p className="text-sm text-ink-soft">
                {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {sub.currentPeriodEnd?.toISOString().slice(0, 10) ?? '—'}
              </p>
            </div>
            {live ? (
              <form action={openPortalAction}><Button variant="secondary" type="submit">Manage subscription</Button></form>
            ) : simulator ? (
              <form action={simulateSubscriptionAction.bind(null, 'cancel')}><Button variant="secondary" type="submit">Simulate cancel</Button></form>
            ) : null}
          </Card>
        ) : null}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {planOrder.map((id) => {
          const p = plans[id];
          const current = p.id === plan.id;
          let action: React.ReactNode = null;
          if (!current && id !== 'free') {
            if (live && p.paddlePriceId) {
              action = <CheckoutButton priceId={p.paddlePriceId} email={user.email} userId={user.id} label={`Upgrade to ${p.name}`}
                environment={env.paddle.environment} token={env.paddle.clientToken} autoOpen={choosing && id === chosen} />;
            } else if (simulator) {
              action = <form action={simulateSubscriptionAction.bind(null, id)}><Button type="submit" variant={choosing && id === chosen ? 'primary' : 'secondary'} className="w-full">Simulate {p.name} (dev)</Button></form>;
            }
          }
          return <PlanCard key={id} plan={p} current={current} highlight={choosing && id === chosen} badge="Your pick" action={action} />;
        })}
      </div>
    </>
  );
}
