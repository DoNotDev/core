import { describe, expect, it } from 'vitest';

import { resolveUserSubscription } from '../subscription';

const generic = {
  tier: 'partner-access',
  status: 'active',
  subscriptionEnd: null,
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('resolveUserSubscription', () => {
  it('projects non-paid claims without adding payment fields', () => {
    expect(resolveUserSubscription('user-a', generic)).toEqual({
      ...generic,
      userId: 'user-a',
      isActive: true,
      features: [],
    });
  });

  it('preserves paid compatibility projections, nullable identifiers and optional fields', () => {
    const paid = {
      ...generic,
      tier: 'enterprise',
      subscriptionEnd: '2027-06-01T00:00:00.000Z',
      subscriptionId: 'sub_paid',
      customerId: 'cus_paid',
      cancelAtPeriodEnd: true,
      features: ['custom-feature'],
      isDefault: false,
    };
    expect(resolveUserSubscription('user-a', paid)).toEqual({
      ...paid,
      userId: 'user-a',
      isActive: true,
    });
    expect(resolveUserSubscription('user-a', {
      ...paid, subscriptionId: null, customerId: null,
    })).toMatchObject({ subscriptionId: null, customerId: null });
  });

  it.each([null, undefined])('uses a stable baseline for absent claims: %s', (claims) => {
    const first = resolveUserSubscription('user-a', claims);
    expect(first).toEqual(resolveUserSubscription('user-a', claims));
    expect(first).toMatchObject({
      userId: 'user-a', tier: 'free', status: 'active', isActive: true,
      subscriptionEnd: null, features: [], updatedAt: '1970-01-01T00:00:00.000Z',
    });
    first.features?.push('mutated');
    expect(resolveUserSubscription('user-b', claims).features).toEqual([]);
  });

  it.each(['canceled', 'trialing', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid', 'custom-status'])(
    'retains the declared tier and treats %s as inactive', (status) => {
      expect(resolveUserSubscription('user-a', { ...generic, status })).toMatchObject({
        tier: generic.tier, status, isActive: false,
      });
    }
  );

  it('does not introduce expiry policy or trust supplied projection fields', () => {
    expect(resolveUserSubscription('user-a', {
      ...generic, subscriptionEnd: '2000-01-01T00:00:00.000Z',
      userId: 'other-user', isActive: false,
    })).toMatchObject({ userId: 'user-a', isActive: true });
  });

  it.each([
    {}, false, '', [], 42,
    { subscription: generic },
    { ...generic, tier: null },
    { ...generic, status: null },
    { ...generic, subscriptionEnd: undefined },
    { ...generic, subscriptionEnd: 'bad-date' },
    { ...generic, updatedAt: undefined },
    { ...generic, updatedAt: 'bad-date' },
    { ...generic, features: 'feature' },
    { ...generic, customerId: 42 },
    { ...generic, subscriptionId: false },
    { ...generic, cancelAtPeriodEnd: 'false' },
  ])('fails loudly for malformed present claims: %j', (claims) => {
    expect(() => resolveUserSubscription('user-a', claims)).toThrow();
  });
});
