// Plans, prices and limits. The single source of truth: the pricing page,
// the billing page, checkout and every limit check read from here.
// docs/recipes/change-plans-and-prices.md explains how to change them.
// `blurb` and `features` are shown to customers: list only what the app
// really does, and keep the numbers in step with `limits`.

export type PlanId = 'free' | 'pro' | 'team';

export type Plan = {
  id: PlanId;
  name: string;
  /** Shown on the pricing page; Paddle charges what the price says. */
  price: string;
  period: string;
  blurb: string;
  features: string[];
  /** Paddle price id, from an environment variable (empty = can't be bought). */
  paddlePriceId: string;
  limits: {
    /** Max projects a user can have (Infinity = no limit). */
    projects: number;
  };
};

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    blurb: 'For trying things out.',
    features: ['3 projects', 'Statuses and due dates', 'Email support'],
    paddlePriceId: '',
    limits: { projects: 3 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: 'per month',
    blurb: 'For people who run a lot of projects.',
    features: ['Unlimited projects', 'Everything in Free', 'Priority support'],
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO ?? '',
    limits: { projects: Infinity },
  },
  team: {
    id: 'team',
    name: 'Team',
    price: '$29',
    period: 'per month',
    blurb: 'For businesses that buy for their team.',
    features: ['Everything in Pro', 'Invoices with your company details', 'Priority onboarding'],
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_TEAM ?? '',
    limits: { projects: Infinity },
  },
};

export const planOrder: PlanId[] = ['free', 'pro', 'team'];

/** Price ids the dev billing simulator uses (development only). */
export const devPriceId = (id: PlanId) => `pri_dev_${id}`;

/** The plan a Paddle price id belongs to (undefined if it's not one of ours). */
export function planForPrice(priceId: string): Plan | undefined {
  const plan = Object.values(plans).find((p) => p.paddlePriceId !== '' && p.paddlePriceId === priceId);
  if (plan || (process.env.NODE_ENV === 'production' && process.env.CODEPLATE_CHECKS !== '1')) return plan;
  return Object.values(plans).find((p) => devPriceId(p.id) === priceId);
}

/** A paid plan's id from a URL (?plan=pro on sign-up, sign-in and billing); null for free or anything else. */
export function paidPlanId(value: unknown): PlanId | null {
  return typeof value === 'string' && value !== 'free' && (planOrder as string[]).includes(value) ? (value as PlanId) : null;
}

/** Where to go after signing up or in: the chosen plan's checkout, or the dashboard. */
export function afterAuthPath(plan: PlanId | null): string {
  return plan ? `/billing?plan=${plan}` : '/dashboard';
}
