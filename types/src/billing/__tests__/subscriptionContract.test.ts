import * as v from 'valibot';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  COMMON_TIER_CONFIGS,
  DEFAULT_SUBSCRIPTION,
  SUBSCRIPTION_STATUS,
  createDefaultSubscriptionClaims,
} from '../../auth/constants';
import {
  CustomClaimsSchema,
  SubscriptionClaimsSchema,
  validateSubscriptionClaims,
} from '../../auth/schemas';
import type { CommonSubscriptionFeatures, SubscriptionConfig } from '../../auth/constants';
import * as billingConstants from '../constants';
import * as billingSchemas from '../schemas';

const generic = {
  tier: 'licensed-member',
  status: 'custom-status',
  subscriptionEnd: null,
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('auth-owned subscription contract', () => {
  afterEach(() => vi.useRealTimers());
  it('accepts generic nested wire claims without userId or paid fields', () => {
    expect(v.parse(CustomClaimsSchema, { subscription: generic })).toEqual({ subscription: generic });
    expect(validateSubscriptionClaims(generic).success).toBe(true);
  });

  it('keeps old billing exports as identical auth-owned symbols', () => {
    expect(billingSchemas.SubscriptionClaimsSchema).toBe(SubscriptionClaimsSchema);
    expect(billingSchemas.validateSubscriptionClaims).toBe(validateSubscriptionClaims);
    expect(billingConstants.SUBSCRIPTION_STATUS).toBe(SUBSCRIPTION_STATUS);
    expect(billingConstants.COMMON_TIER_CONFIGS).toBe(COMMON_TIER_CONFIGS);
    expectTypeOf<billingConstants.SubscriptionConfig>().toEqualTypeOf<SubscriptionConfig>();
    expectTypeOf<billingConstants.CommonSubscriptionFeatures>().toEqualTypeOf<CommonSubscriptionFeatures>();
    expect(billingConstants.DEFAULT_SUBSCRIPTION).toBe(DEFAULT_SUBSCRIPTION);
    expect(billingConstants.createDefaultSubscriptionClaims).toBe(createDefaultSubscriptionClaims);
  });

  it('keeps billing records a required paid extension of the canonical shape', () => {
    expect(v.safeParse(billingSchemas.SubscriptionDataSchema, { ...generic, userId: 'user-a' }).success).toBe(false);
    const paid = {
      ...generic, userId: 'user-a', subscriptionId: 'sub_paid',
      customerId: 'cus_paid', cancelAtPeriodEnd: false,
    };
    expect(v.parse(billingSchemas.SubscriptionDataSchema, paid)).toEqual(paid);
    expect(v.safeParse(SubscriptionClaimsSchema, paid).success).toBe(true);
  });

  it('timestamps persisted defaults without fabricating billing identifiers from the auth UID', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:34:56.789Z'));
    const persisted = createDefaultSubscriptionClaims('user-a');
    expect(persisted).toEqual({
      ...DEFAULT_SUBSCRIPTION,
      customerId: null,
      updatedAt: new Date().toISOString(),
    });
    expect(persisted.subscriptionId).toBeNull();
    expect(billingConstants.createDefaultSubscriptionClaims('another-user').customerId).toBeNull();
    expect(validateSubscriptionClaims(persisted).success).toBe(true);
    expect(DEFAULT_SUBSCRIPTION.updatedAt).toBe('1970-01-01T00:00:00.000Z');
    expect(validateSubscriptionClaims(DEFAULT_SUBSCRIPTION).success).toBe(true);
  });
});
