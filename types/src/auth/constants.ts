// packages/core/types/src/auth/constants.ts

/**
 * @fileoverview Authentication Constants
 * @description Constants for authentication domain. Defines token status types, user roles, subscription tiers, features, permissions, and authentication-related constants.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { AuthPartnerId } from '../partners';
import type { SubscriptionClaims } from './schemas';

/** Existing subscription status vocabulary; consumers may declare custom statuses. */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing',
  UNPAID: 'unpaid',
} as const;

/** Override the framework's subscription status vocabulary. */
export function overrideSubscriptionStatus(
  customStatus: Partial<typeof SUBSCRIPTION_STATUS>
) {
  Object.assign(SUBSCRIPTION_STATUS, customStatus);
}

/** Framework or consumer-defined subscription status. */
export type SubscriptionStatus =
  | (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
  | string;

/** Deterministic free baseline; epoch denotes absence of a persisted update. */
export const DEFAULT_SUBSCRIPTION: SubscriptionClaims = {
  tier: 'free',
  status: 'active',
  subscriptionEnd: null,
  updatedAt: '1970-01-01T00:00:00.000Z',
  isDefault: true,
  subscriptionId: null,
  customerId: null,
  cancelAtPeriodEnd: false,
};

/**
 * Create persisted free claims with the actual creation timestamp.
 * @param _userId - Deprecated, ignored argument retained for source compatibility.
 * Auth UIDs are not billing customer IDs; payment identifiers remain null.
 */
export function createDefaultSubscriptionClaims(_userId: string): SubscriptionClaims {
  return {
    ...DEFAULT_SUBSCRIPTION,
    updatedAt: new Date().toISOString(),
  };
}

/** Common access features apps can reference or replace with their own. */
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

/** Generic access-tier features and hierarchy, independent of billing. */
export interface SubscriptionConfig {
  /** Subscription tiers with their features and hierarchy. */
  tiers: Record<
    string,
    {
      /** Features available for this tier. */
      features: string[];
      /** Tier level for comparison (higher = more access). */
      level: number;
    }
  >;
}

/** Common access-tier configurations apps can extend or replace. */
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

// =============================================================================
// Token Types
// =============================================================================

/**
 * Token status possible values
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type TokenStatus =
  | 'valid'
  | 'expiring-soon'
  | 'expired'
  | 'error'
  | 'not-initialized';

// =============================================================================
// Primitive & Enumerated Types
// =============================================================================

// SubscriptionTier moved to subscription package - apps define their own tiers
/**
 * Authentication status type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading';

// =============================================================================
// User Role Constants
// =============================================================================

/**
 * Standard user role names
 * Apps can override these by providing their own role constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const USER_ROLES = {
  GUEST: 'guest',
  USER: 'user',
  ADMIN: 'admin',
  SUPER: 'super',
} as const;

/**
 * Override user roles for custom app needs
 * @example
 * ```typescript
 * // In your app's config
 * overrideUserRoles({
 *   GUEST: 'visitor',
 *   USER: 'member',
 *   ADMIN: 'moderator'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function overrideUserRoles(customRoles: Partial<typeof USER_ROLES>) {
  Object.assign(USER_ROLES, customRoles);
}

/**
 * Type for user role names
 * Apps can extend this with their own custom roles
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES] | string;

// =============================================================================
// Subscription Tier Constants
// =============================================================================

/**
 * Standard subscription tier names
 * Apps can override these by providing their own tier constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  PREMIUM: 'premium',
} as const;

/**
 * Override subscription tiers for custom app needs
 * @example
 * ```typescript
 * // In your app's config
 * overrideSubscriptionTiers({
 *   FREE: 'basic',
 *   PRO: 'professional',
 *   PREMIUM: 'enterprise'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function overrideSubscriptionTiers(
  customTiers: Partial<typeof SUBSCRIPTION_TIERS>
) {
  Object.assign(SUBSCRIPTION_TIERS, customTiers);
}

/**
 * Type for subscription tier names
 * Apps can extend this with their own custom tiers
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type SubscriptionTier =
  | (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS]
  | string;

// =============================================================================
// Feature Constants
// =============================================================================

/**
 * Standard feature names
 * Apps can override these by providing their own feature constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const FEATURES = {
  BASIC_ACCESS: 'basic_access',
  ADVANCED_FEATURES: 'advanced_features',
  API_ACCESS: 'api_access',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

/**
 * Override features for custom app needs
 * @example
 * ```typescript
 * // In your app's config
 * overrideFeatures({
 *   BASIC_ACCESS: 'read_access',
 *   ADVANCED_FEATURES: 'write_access',
 *   API_ACCESS: 'api_calls',
 *   PRIORITY_SUPPORT: 'dedicated_support'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function overrideFeatures(customFeatures: Partial<typeof FEATURES>) {
  Object.assign(FEATURES, customFeatures);
}

/**
 * Type for feature names
 * Apps can extend this with their own custom features
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES] | string;

// =============================================================================
// Permission Constants
// =============================================================================

/**
 * Standard permission names
 * Apps can override these by providing their own permission constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const PERMISSIONS = {
  READ_PUBLIC: 'read_public',
  READ_OWN_DATA: 'read_own_data',
  WRITE_OWN_DATA: 'write_own_data',
  READ_ALL_DATA: 'read_all_data',
  MANAGE_USERS: 'manage_users',
} as const;

/**
 * Override permissions for custom app needs
 * @example
 * ```typescript
 * // In your app's config
 * overridePermissions({
 *   READ_PUBLIC: 'view_public',
 *   READ_OWN_DATA: 'view_profile',
 *   WRITE_OWN_DATA: 'edit_profile',
 *   READ_ALL_DATA: 'view_all',
 *   MANAGE_USERS: 'admin_users'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function overridePermissions(
  customPermissions: Partial<typeof PERMISSIONS>
) {
  Object.assign(PERMISSIONS, customPermissions);
}

/**
 * Type for permission names
 * Apps can extend this with their own custom permissions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Permission =
  | (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
  | string;

// =============================================================================
// Additional Types Needed by Auth Index
// =============================================================================

/**
 * A map containing instances of authentication providers.
 * Uses schema discovery to support all AUTH_PARTNERS automatically.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ProviderInstances = Record<AuthPartnerId, any>; // why: third-party SDK provider instances with no shared shape
