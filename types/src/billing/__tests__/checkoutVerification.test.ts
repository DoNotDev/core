import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  VerifyOrderCheckoutRequestSchema,
  VerifyOrderCheckoutResultSchema,
  validateVerifyOrderCheckoutRequest,
  validateVerifyOrderCheckoutResult,
} from '../index';
import type { VerifyOrderCheckoutRequest, VerifyOrderCheckoutResult } from '../index';

const request = { sessionId: 'cs_owner', billingConfigKey: 'shop' };
const result = {
  ...request, orderId: 'order_1', sessionStatus: 'complete', paymentStatus: 'paid',
};

describe('checkout verification public schemas', () => {
  it('exports schemas and schema-derived types without accepting identity from the request', () => {
    expect(VerifyOrderCheckoutRequestSchema).toBeDefined();
    expect(VerifyOrderCheckoutResultSchema).toBeDefined();
    const parsed = validateVerifyOrderCheckoutRequest({ ...request, userId: 'attacker', orderId: 'forged' });
    expect(parsed.success).toBe(true);
    expect(parsed.output).toEqual(request);
    expectTypeOf<VerifyOrderCheckoutRequest>().toEqualTypeOf<typeof request>();
    expectTypeOf<VerifyOrderCheckoutResult['sessionStatus']>().toEqualTypeOf<'open' | 'complete' | 'expired'>();
    expectTypeOf<VerifyOrderCheckoutResult['paymentStatus']>().toEqualTypeOf<'paid' | 'unpaid' | 'no_payment_required'>();
  });

  it.each(['sessionId', 'billingConfigKey'])('requires a nonempty request %s', (key) => {
    for (const value of [undefined, null, '', '   ', 1]) {
      expect(validateVerifyOrderCheckoutRequest({ ...request, [key]: value }).success).toBe(false);
    }
  });

  it.each(['sessionId', 'orderId', 'billingConfigKey'])('requires a nonempty result %s', (key) => {
    for (const value of [undefined, null, '', '   ', 1]) {
      expect(validateVerifyOrderCheckoutResult({ ...result, [key]: value }).success).toBe(false);
    }
  });

  it('strips customer details, metadata and fulfillment assertions from output', () => {
    const parsed = validateVerifyOrderCheckoutResult({
      ...result, customer: { email: 'private@example.com' }, metadata: { secret: 'hidden' }, fulfilled: true,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.output).toEqual(result);
  });

  it('accepts every documented session/payment state without conflating them', () => {
    for (const sessionStatus of ['open', 'complete', 'expired']) {
      for (const paymentStatus of ['paid', 'unpaid', 'no_payment_required']) {
        expect(validateVerifyOrderCheckoutResult({ ...result, sessionStatus, paymentStatus }).success).toBe(true);
      }
    }
  });

  it.each(['sessionStatus', 'paymentStatus'])('rejects invalid %s', (key) => {
    for (const value of [undefined, null, '', 'unknown']) {
      expect(validateVerifyOrderCheckoutResult({ ...result, [key]: value }).success).toBe(false);
    }
  });
});
