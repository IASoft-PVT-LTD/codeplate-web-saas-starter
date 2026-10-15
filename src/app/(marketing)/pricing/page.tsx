import type { Metadata } from 'next';
import { PlanCard } from '@/components/plan-card';
import { LinkButton } from '@/components/ui';
import { planOrder, plans } from '@/config/plans';

export const metadata: Metadata = { title: 'Pricing' };

export default function Pricing() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple pricing</h1>
        <p className="mt-4 text-ink-soft">Start free. Upgrade when you need more. Cancel any time.</p>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {planOrder.map((id) => (
          <PlanCard key={id} plan={plans[id]} highlight={id === 'pro'}
            action={<LinkButton href={id === 'free' ? '/sign-up' : `/sign-up?plan=${id}`} variant={id === 'pro' ? 'primary' : 'secondary'} className="w-full">
              {id === 'free' ? 'Start free' : `Get ${plans[id].name}`}
            </LinkButton>} />
        ))}
      </div>
      <p className="mt-10 text-center text-sm text-ink-soft">Prices in USD. Payments are handled by Paddle, our merchant of record, which also takes care of sales tax and VAT.</p>
    </section>
  );
}
