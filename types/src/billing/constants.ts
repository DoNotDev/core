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
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing',
  UNPAID: 'unpaid',
} as const;

/**
 * Override subscription status for custom app needs
 * @example
 * ```typescript
 * // In your app's config
 * overrideSubscriptionStatus({
 *   ACTIVE: 'subscribed',
 *   CANCELED: 'cancelled',
 *   TRIALING: 'trial'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function overrideSubscriptionStatus(
  customStatus: Partial<typeof SUBSCRIPTION_STATUS>
) {
  Object.assign(SUBSCRIPTION_STATUS, customStatus);
}

/**
 * Type for subscription status names
 * Apps can extend this with their own custom statuses
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type SubscriptionStatus =
  | (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
  | string;

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
export type CommonSubscriptionFeatures =
  | 'basic-usage'
  | 'limited-storage'
  | 'standard-support'
  | 'cloud-sync'
  | 'advanced-analytics'
  | 'priority-support'
  | 'custom-branding'
  | 'team-collaboration'
  | 'ai-assistant'
  | 'custom-models'
  | 'unlimited-generations'
  | 'advanced-integrations';

/**
 * Subscription claims stored in Firebase Auth custom claims
 * Type definition - schema in schemas.ts validates against this structure
 */
export type SubscriptionClaims = {
  tier: string;
  subscriptionId: string | null;
  customerId: string;
  status: SubscriptionStatus; // Allows framework values OR custom consumer values
  subscriptionEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
  isDefault?: boolean;
};

/**
 * Factory function to create default subscription claims
 * @param userId - User ID for the subscription
 * @returns Default subscription claims for free tier
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createDefaultSubscriptionClaims(
  userId: string
): SubscriptionClaims {
  return {
    tier: 'free',
    status: 'active',
    subscriptionId: null,
    customerId: userId,
    subscriptionEnd: null,
    cancelAtPeriodEnd: false,
    updatedAt: new Date().toISOString(),
    isDefault: true,
  };
}

/**
 * Generic subscription configuration interface
 * Apps define their specific subscription tiers and features
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SubscriptionConfig {
  /** Subscription tiers with their features and hierarchy */
  tiers: Record<
    string,
    {
      /** Features available for this tier */
      features: string[];
      /** Tier level for comparison (higher = more access) */
      level: number;
    }
  >;
}

/**
 * Common tier configurations that apps can use as a starting point
 * Apps can extend this or create their own completely custom configs
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const COMMON_TIER_CONFIGS = {
  free: {
    features: ['basic-usage', 'limited-storage', 'standard-support'],
    level: 0,
  },
  pro: {
    features: [
      'basic-usage',
      'limited-storage',
      'standard-support',
      'cloud-sync',
      'advanced-analytics',
      'priority-support',
      'custom-branding',
      'team-collaboration',
    ],
    level: 1,
  },
  ai: {
    features: [
      'basic-usage',
      'limited-storage',
      'standard-support',
      'cloud-sync',
      'advanced-analytics',
      'priority-support',
      'custom-branding',
      'team-collaboration',
      'ai-assistant',
      'custom-models',
      'unlimited-generations',
      'advanced-integrations',
    ],
    level: 2,
  },
};

/**
 * Default subscription for new users (free tier)
 * Framework consumers can override these defaults
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DEFAULT_SUBSCRIPTION: SubscriptionClaims = {
  tier: 'free',
  subscriptionId: null,
  customerId: '', // Will be set to user ID
  status: 'active',
  subscriptionEnd: null,
  cancelAtPeriodEnd: false,
  updatedAt: new Date().toISOString(),
  isDefault: true,
};
