import * as v from 'valibot';

import {
  DEFAULT_SUBSCRIPTION,
  SUBSCRIPTION_STATUS,
  SubscriptionClaimsSchema,
  type UserSubscription,
} from '@donotdev/types';

/**
 * Validate and project the canonical subscription object itself.
 * Pass `customClaims.subscription` / `app_metadata.subscription`, NOT the full
 * custom-claims or metadata envelope. Null/undefined alone mean absent access
 * claims and yield a deterministic free baseline. Malformed present claims throw.
 * Declared tier and paid compatibility fields are preserved; activity follows
 * the existing active-only semantics, without expiry/trial/grace policy.
 */
export function resolveUserSubscription(
  userId: string,
  claims: unknown
): UserSubscription {
  const subscription = v.parse(
    SubscriptionClaimsSchema,
    claims === null || claims === undefined ? DEFAULT_SUBSCRIPTION : claims
  );
  return {
    ...subscription,
    userId,
    isActive: subscription.status === SUBSCRIPTION_STATUS.ACTIVE,
    features: subscription.features ?? [],
  };
}
