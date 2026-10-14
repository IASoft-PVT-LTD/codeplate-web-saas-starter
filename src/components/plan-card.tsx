import type { Plan } from '@/config/plans';
import { Badge, Card } from './ui';

/** A plan's name, price and features; `action` is the button under it. `highlight` rings it, with `badge` (default "Popular"). */
export function PlanCard({ plan, highlight, badge = 'Popular', current, action }: { plan: Plan; highlight?: boolean; badge?: string; current?: boolean; action?: React.ReactNode }) {
  return (
    <Card className={`flex flex-col ${highlight ? 'ring-2 ring-brand' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {current ? <Badge tone="brand">Current plan</Badge> : highlight ? <Badge tone="brand">{badge}</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-ink-soft">{plan.blurb}</p>
      <p className="mt-6"><span className="text-4xl font-bold">{plan.price}</span> <span className="text-ink-soft">{plan.period}</span></p>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {plan.features.map((f) => <li key={f} className="flex gap-2"><span className="text-ok">✓</span>{f}</li>)}
      </ul>
      {action ? <div className="mt-8">{action}</div> : null}
    </Card>
  );
}
