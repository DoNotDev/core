// packages/core/types/src/billing/constants.ts

/**
 * @fileoverview Billing Constants
 * @description Constants for billing domain. Defines subscription status values, Stripe modes, and billing-related constants.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// =============================================================================
// Subscription Status Constants
// =============================================================================

/**
 * Standard subscription status values from billing providers
 * Apps can override these by providing their own status constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export { SUBSCRIPTION_STATUS, overrideSubscriptionStatus } from '../auth/constants';
/** Compatibility alias for the auth-owned status type. */
export type { SubscriptionStatus } from '../auth/constants';

// =============================================================================
// Payment Mode Constants
// =============================================================================

/**
 * Standard payment mode values for Stripe checkout
 * Apps can override these by providing their own mode constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const STRIPE_MODES = {
  PAYMENT: 'payment',
  SUBSCRIPTION: 'subscription',
} as const;

/**
 * Override payment modes for custom app needs
 * @example
 * ```typescript
 * // In your app's config
 * overridePaymentModes({
 *   PAYMENT: 'one_time',
 *   SUBSCRIPTION: 'recurring'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function overridePaymentModes(
  customModes: Partial<typeof STRIPE_MODES>
) {
  Object.assign(STRIPE_MODES, customModes);
}

/**
 * Type for payment mode names
 * Apps can extend this with their own custom modes
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PaymentMode =
  | (typeof STRIPE_MODES)[keyof typeof STRIPE_MODES]
  | string;

// =============================================================================
// Subscription Tier Constants
// =============================================================================
// Note: SUBSCRIPTION_TIERS and SubscriptionTier are defined in auth/constants.ts
// to avoid duplication and conflicts

// =============================================================================
// Subscription Duration Constants
// =============================================================================

/**
 * Standard subscription duration values
 * Apps can override these by providing their own duration constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const SUBSCRIPTION_DURATIONS = {
  ONE_MONTH: '1month',
  THREE_MONTHS: '3months',
  SIX_MONTHS: '6months',
  ONE_YEAR: '1year',
  TWO_YEARS: '2years',
  LIFETIME: 'lifetime',
} as const;

/**
 * Type for subscription duration names
 * Apps can extend this with their own custom durations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type SubscriptionDuration =
  | (typeof SUBSCRIPTION_DURATIONS)[keyof typeof SUBSCRIPTION_DURATIONS]
  | string;

/**
 * Common subscription features that apps can reference
 * Apps can use these or define their own custom features
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type { CommonSubscriptionFeatures } from '../auth/constants';

/**
 * Subscription claims stored in Firebase Auth custom claims
 * Type definition - schema in schemas.ts validates against this structure
 */
export type { SubscriptionClaims } from '../auth/schemas';

/**
 * Factory function to create default subscription claims
 * @param userId - User ID for the subscription
 * @returns Default subscription claims for free tier
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export { createDefaultSubscriptionClaims } from '../auth/constants';

/**
 * Generic subscription configuration interface
 * Apps define their specific subscription tiers and features
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type { SubscriptionConfig } from '../auth/constants';

/**
 * Common tier configurations that apps can use as a starting point
 * Apps can extend this or create their own completely custom configs
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export { COMMON_TIER_CONFIGS } from '../auth/constants';

/**
 * Default subscription for new users (free tier)
 * Framework consumers can override these defaults
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export { DEFAULT_SUBSCRIPTION } from '../auth/constants';
