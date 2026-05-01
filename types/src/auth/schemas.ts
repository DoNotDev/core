// packages/core/types/src/auth/schemas.ts

/**
 * @fileoverview Schema Definitions for Authentication and User Management
 * @description Single source of truth for all auth-related data validation. Defines validation schemas for authentication, user management, and related data structures.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';
import {
  USER_ROLES,
  SUBSCRIPTION_TIERS,
  FEATURES,
  PERMISSIONS,
} from './constants';
import { SUBSCRIPTION_STATUS } from '../billing';

// =============================================================================
// Auth User Schema
// =============================================================================

/**
 * Schema for authenticated user data
 * Uses constants for enum values to ensure consistency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const AuthUserSchema = v.object({
  id: v.string(),
  // Nullable to match runtime mapping from Firebase (can be null)
  email: v.optional(v.nullable(v.pipe(v.string(), v.email()))),
  displayName: v.optional(v.nullable(v.string())),
  photoURL: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  // Additional runtime properties used across the app
  emailVerified: v.optional(v.boolean()),
  lastLoginAt: v.optional(v.string()),
  // Provider data mapped from Firebase providers
  providerData: v.optional(
    v.array(
      v.object({
        providerId: v.string(),
        uid: v.string(),
        email: v.optional(v.nullable(v.pipe(v.string(), v.email()))),
        displayName: v.optional(v.nullable(v.string())),
        photoURL: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
        phoneNumber: v.optional(v.nullable(v.string())),
      })
    )
  ),
  role: v.optional(
    v.picklist(Object.values(USER_ROLES) as [string, ...string[]])
  ),
  customClaims: v.optional(v.record(v.string(), v.any())),
});

// =============================================================================
// User Subscription Schema
// =============================================================================

/**
 * Schema for user subscription data
 * Uses constants for enum values to ensure consistency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const UserSubscriptionSchema = v.object({
  userId: v.string(),
  tier: v.picklist(Object.values(SUBSCRIPTION_TIERS) as [string, ...string[]]),
  status: v.picklist(
    Object.values(SUBSCRIPTION_STATUS) as [string, ...string[]]
  ),
  isActive: v.optional(v.boolean()),
  features: v.optional(v.array(v.string())),
  subscriptionId: v.nullable(v.string()),
  customerId: v.string(),
  subscriptionEnd: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  cancelAtPeriodEnd: v.boolean(),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

// =============================================================================
// Custom Claims Schema
// =============================================================================

/**
 * Schema for Firebase Auth custom claims
 * Uses constants for enum values to ensure consistency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CustomClaimsSchema = v.object({
  role: v.optional(
    v.picklist(Object.values(USER_ROLES) as [string, ...string[]])
  ),
  subscription: v.optional(UserSubscriptionSchema),
  features: v.optional(
    v.array(v.picklist(Object.values(FEATURES) as [string, ...string[]]))
  ),
  permissions: v.optional(
    v.array(v.picklist(Object.values(PERMISSIONS) as [string, ...string[]]))
  ),
  githubAccess: v.optional(
    v.object({
      username: v.optional(v.string()),
      teamAccess: v.optional(v.array(v.string())),
      repoAccess: v.optional(v.array(v.string())),
    })
  ),
});

// =============================================================================
// Type Exports (Schema-Derived)
// =============================================================================

/**
 * Type for authenticated user data
 * Automatically derived from schema
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthUser = v.InferOutput<typeof AuthUserSchema>;

/**
 * Type for user subscription data
 * Automatically derived from schema
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type UserSubscription = v.InferOutput<typeof UserSubscriptionSchema>;

/**
 * Type for Firebase Auth custom claims
 * Automatically derived from schema
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CustomClaims = v.InferOutput<typeof CustomClaimsSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate auth user data
 * @param data - Data to validate
 * @returns Validation result with success/error information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateAuthUser(data: unknown) {
  return v.safeParse(AuthUserSchema, data);
}

/**
 * Validate user subscription data
 * @param data - Data to validate
 * @returns Validation result with success/error information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateUserSubscription(data: unknown) {
  return v.safeParse(UserSubscriptionSchema, data);
}

/**
 * Validate custom claims data
 * @param data - Data to validate
 * @returns Validation result with success/error information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateCustomClaims(data: unknown) {
  return v.safeParse(CustomClaimsSchema, data);
}

// =============================================================================
// Schema Validation (Development Only)
// =============================================================================

/**
 * Validate that all schemas are properly configured
 * Only runs when explicitly called during development
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateAuthSchemas() {
  const results = {
    authUser: v.safeParse(AuthUserSchema, {}),
    userSubscription: v.safeParse(UserSubscriptionSchema, {}),
    customClaims: v.safeParse(CustomClaimsSchema, {}),
    // Function schemas (moved from functions/auth.ts)
    getUserAuthStatus: v.safeParse(
      v.object({ userId: v.pipe(v.string(), v.minLength(1)) }),
      {}
    ),
    getCustomClaims: v.safeParse(
      v.object({
        userId: v.pipe(v.string(), v.minLength(1)),
        claimKeys: v.optional(v.array(v.string())),
      }),
      {}
    ),
    setCustomClaims: v.safeParse(
      v.object({
        userId: v.pipe(v.string(), v.minLength(1)),
        claims: v.record(v.string(), v.any()),
        merge: v.optional(v.boolean(), false),
      }),
      {}
    ),
    removeCustomClaims: v.safeParse(
      v.object({
        userId: v.pipe(v.string(), v.minLength(1)),
        claimKeys: v.pipe(v.array(v.string()), v.minLength(1)),
      }),
      {}
    ),
  };

  return {
    success: Object.values(results).every((result) => result.success),
    results,
  };
}
