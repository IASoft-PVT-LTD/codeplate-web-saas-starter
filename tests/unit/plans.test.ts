// The ?plan= links: only paid plans carry through to checkout.
import { describe, expect, it } from 'vitest';
import { afterAuthPath, paidPlanId, planOrder } from '@/config/plans';

describe('plan links', () => {
  it('carries paid plans to their checkout and ignores the rest', () => {
    for (const id of planOrder.filter((p) => p !== 'free')) {
      expect(paidPlanId(id)).toBe(id);
      expect(afterAuthPath(paidPlanId(id))).toBe(`/billing?plan=${id}`);
    }
    for (const junk of ['free', 'enterprise', '', undefined, ['pro'], 'PRO']) expect(paidPlanId(junk)).toBeNull();
    expect(afterAuthPath(null)).toBe('/dashboard');
  });
});
