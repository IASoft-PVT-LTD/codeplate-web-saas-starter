// Paddle Billing: webhook verification, applying subscription events, and the
// customer portal. Paddle is the source of truth for payments; our
// `subscription` table mirrors it through webhooks, and entitlements.ts reads
// the table. docs/recipes/set-up-paddle.md walks through the dashboard side.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { subscription, user, webhookEvent } from '@/db/schema';
import { planForPrice } from '@/config/plans';
import { env } from './env';

/**
 * Paddle's signature header: "ts=<unix seconds>;h1=<hex hmac-sha256 of `${ts}:${body}`>".
 * While a secret is being rotated Paddle sends one h1 per secret; any match is enough.
 */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, now = Date.now(), toleranceSeconds = 5): boolean {
  if (!header || !secret) return false;
  const pairs = header.split(';').map((p) => p.split('=') as [string, string]);
  const ts = Number(pairs.find(([k]) => k === 'ts')?.[1]);
  const signatures = pairs.filter(([k, v]) => k === 'h1' && v).map(([, v]) => v);
  if (!Number.isFinite(ts) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - ts) > toleranceSeconds) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex'));
  return signatures.some((h) => {
    const got = Buffer.from(h);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Signs a body the way Paddle does (tests and the dev simulator use it). */
export function signPaddleBody(rawBody: string, secret: string, now = Date.now()): string {
  const ts = Math.floor(now / 1000);
  return `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')}`;
}

/** The parts of a Paddle subscription event we use (snake_case, as Paddle sends it). */
export type PaddleEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    items: { price: { id: string } }[];
    current_billing_period: { starts_at: string; ends_at: string } | null;
    scheduled_change: { action: string; effective_at: string } | null;
    custom_data: { userId?: string } | null;
  };
};

export type WebhookResult = { status: number; message: string };

/**
 * Handles one webhook delivery: verify, de-duplicate, apply. Paddle retries
 * anything that isn't 2xx, so only answer non-2xx for problems a retry can fix.
 */
export async function handlePaddleWebhook(db: Db, rawBody: string, signature: string | null, secret = env.paddle.webhookSecret): Promise<WebhookResult> {
  if (!verifyPaddleSignature(rawBody, signature, secret)) return { status: 401, message: 'bad signature' };
  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, message: 'bad json' };
  }
  const seen = await db.select().from(webhookEvent).where(eq(webhookEvent.id, event.event_id));
  if (seen.length > 0) return { status: 200, message: 'already handled' };
  const result = event.event_type.startsWith('subscription.')
    ? await applySubscriptionEvent(db, event)
    : { status: 200, message: `ignored ${event.event_type}` };
  if (result.status < 300) {
    await db.insert(webhookEvent).values({ id: event.event_id, type: event.event_type, occurredAt: new Date(event.occurred_at) });
  }
  return result;
}

/** Creates or updates our copy of a Paddle subscription. */
export async function applySubscriptionEvent(db: Db, event: PaddleEvent): Promise<WebhookResult> {
  const s = event.data;
  const priceId = s.items[0]?.price.id ?? '';
  const plan = planForPrice(priceId);
  if (!plan) return { status: 200, message: `price ${priceId} isn't in config/plans.ts; ignored` };
  const existing = await db.select().from(subscription).where(eq(subscription.id, s.id));
  const userId = s.custom_data?.userId ?? existing[0]?.userId;
  if (!userId) return { status: 200, message: 'no userId in custom_data; ignored' };
  const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (!owner) return { status: 200, message: `user ${userId} not found; ignored` };
  // Paddle can deliver events out of order: never let an older event overwrite a newer one.
  const occurred = new Date(event.occurred_at);
  if (existing[0] && existing[0].updatedAt > occurred) return { status: 200, message: 'stale event; ignored' };
  const row = {
    userId,
    paddleCustomerId: s.customer_id,
    priceId,
    plan: plan.id,
    status: s.status,
    currentPeriodEnd: s.current_billing_period ? new Date(s.current_billing_period.ends_at) : null,
    cancelAtPeriodEnd: s.scheduled_change?.action === 'cancel',
    updatedAt: occurred,
  };
  await db.insert(subscription).values({ id: s.id, ...row }).onConflictDoUpdate({ target: subscription.id, set: row });
  return { status: 200, message: `subscription ${s.id} is ${s.status} on ${plan.id}` };
}

function apiBase(): string {
  return env.paddle.environment === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

/** A one-time link to Paddle's customer portal (update card, cancel, invoices). */
export async function customerPortalUrl(customerId: string, subscriptionId: string): Promise<string> {
  const res = await fetch(`${apiBase()}/customers/${customerId}/portal-sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.paddle.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ subscription_ids: [subscriptionId] }),
  });
  if (!res.ok) throw new Error(`Paddle portal session failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { data: { urls: { general: { overview: string } } } };
  return body.data.urls.general.overview;
}
