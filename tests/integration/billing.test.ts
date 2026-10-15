// Paddle webhooks: signatures, subscription lifecycle, duplicates, order.
// Fixtures are built the way Paddle sends them (snake_case JSON) and signed
// with a test secret.
import { beforeAll, describe, expect, it } from 'vitest';
import { handlePaddleWebhook, signPaddleBody, verifyPaddleSignature, type PaddleEvent } from '@/lib/billing';
import { planFor } from '@/lib/entitlements';
import { makeUser, setup, type Ctx } from '../helpers';

const SECRET = 'pdl_ntfset_test_secret';
let ctx: Ctx;
beforeAll(async () => {
  ctx = await setup();
});

let seq = 0;
function event(userId: string, over: { type?: string; status?: string; price?: string; sub?: string; at?: string; cancel?: boolean } = {}): PaddleEvent {
  seq += 1;
  return {
    event_id: `evt_${seq}_${Date.now()}`,
    event_type: over.type ?? 'subscription.created',
    occurred_at: over.at ?? new Date(Date.now() + seq).toISOString(),
    data: {
      id: over.sub ?? `sub_${userId}`,
      status: over.status ?? 'active',
      customer_id: 'ctm_test',
      items: [{ price: { id: over.price ?? 'pri_test_pro' } }],
      current_billing_period: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
      scheduled_change: over.cancel ? { action: 'cancel', effective_at: '2026-11-01T00:00:00Z' } : null,
      custom_data: { userId },
    },
  };
}

async function deliver(e: PaddleEvent, secret = SECRET) {
  const body = JSON.stringify(e);
  return handlePaddleWebhook(ctx.db, body, signPaddleBody(body, secret), SECRET);
}

describe('paddle webhooks', () => {
  it('rejects bad or old signatures', async () => {
    const body = '{"x":1}';
    expect(verifyPaddleSignature(body, signPaddleBody(body, SECRET), SECRET)).toBe(true);
    expect(verifyPaddleSignature(body, signPaddleBody(body, 'other'), SECRET)).toBe(false);
    expect(verifyPaddleSignature(body + ' ', signPaddleBody(body, SECRET), SECRET)).toBe(false);
    expect(verifyPaddleSignature(body, signPaddleBody(body, SECRET, Date.now() - 60_000), SECRET)).toBe(false);
    expect(verifyPaddleSignature(body, null, SECRET)).toBe(false);
    // During a secret rotation Paddle sends one h1 per secret.
    const both = `${signPaddleBody(body, 'old-secret')};h1=${signPaddleBody(body, SECRET).split('h1=')[1]}`;
    expect(verifyPaddleSignature(body, both, SECRET)).toBe(true);
    expect(verifyPaddleSignature(body, both, 'third-secret')).toBe(false);
    const u = await makeUser(ctx);
    expect((await deliver(event(u.id), 'wrong-secret')).status).toBe(401);
    expect((await planFor(ctx.db, u.id)).id).toBe('free');
  });

  it('upgrades on subscription.created and downgrades on cancel', async () => {
    const u = await makeUser(ctx);
    expect((await deliver(event(u.id))).status).toBe(200);
    expect((await planFor(ctx.db, u.id)).id).toBe('pro');
    await deliver(event(u.id, { type: 'subscription.updated', price: 'pri_test_team' }));
    expect((await planFor(ctx.db, u.id)).id).toBe('team');
    await deliver(event(u.id, { type: 'subscription.canceled', status: 'canceled', price: 'pri_test_team' }));
    expect((await planFor(ctx.db, u.id)).id).toBe('free');
  });

  it('keeps the plan until the period ends when a cancel is scheduled', async () => {
    const u = await makeUser(ctx);
    await deliver(event(u.id));
    await deliver(event(u.id, { type: 'subscription.updated', cancel: true }));
    expect((await planFor(ctx.db, u.id)).id).toBe('pro');
  });

  it('applies a retried event once and ignores older events', async () => {
    const u = await makeUser(ctx);
    const created = event(u.id, { at: '2026-10-10T10:00:00Z' });
    expect((await deliver(created)).message).toMatch(/active/);
    expect((await deliver(created)).message).toBe('already handled');
    await deliver(event(u.id, { type: 'subscription.canceled', status: 'canceled', at: '2026-10-12T10:00:00Z' }));
    const late = await deliver(event(u.id, { type: 'subscription.updated', status: 'active', at: '2026-10-11T10:00:00Z' }));
    expect(late.message).toMatch(/stale/);
    expect((await planFor(ctx.db, u.id)).id).toBe('free');
  });

  it('ignores prices and users it does not know', async () => {
    const u = await makeUser(ctx);
    expect((await deliver(event(u.id, { price: 'pri_someone_else' }))).message).toMatch(/isn't in config/);
    expect((await deliver(event('no-such-user', { sub: 'sub_x' }))).message).toMatch(/not found/);
    expect((await planFor(ctx.db, u.id)).id).toBe('free');
  });
});
