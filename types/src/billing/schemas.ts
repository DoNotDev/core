// packages/core/types/src/billing/schemas.ts

/**
 * @fileoverview Schema Definitions for Billing and Subscription Management
 * @description Single source of truth for all billing-related data validation. Defines Valibot schemas for billing, subscriptions, checkout sessions, and related data structures.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';
import {
  SUBSCRIPTION_STATUS,
  STRIPE_MODES,
  type SubscriptionClaims,
} from './constants';

// =============================================================================
// Billing Request Schemas
// =============================================================================

/**
 * Schema for creating a checkout session request
 * Uses constants for enum values to ensure consistency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CreateCheckoutSessionRequestSchema = v.pipe(
  v.object({
    userId: v.optional(v.string()), // Optional: server uses context.uid from Firebase Auth
    productId: v.optional(v.string()),
    /** Stripe price ID (fixed pricing mode) */
    priceId: v.optional(v.string()),
    /** Amount in cents (dynamic pricing mode) */
    unitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    /** Product name shown on Stripe checkout (dynamic pricing mode) */
    productName: v.optional(v.pipe(v.string(), v.minLength(1))),
    /** Currency code, defaults to 'eur' (dynamic pricing mode) */
    currency: v.optional(
      v.pipe(v.string(), v.length(3, 'Currency must be 3-letter ISO code'))
    ),
    successUrl: v.pipe(v.string(), v.url()),
    cancelUrl: v.pipe(v.string(), v.url()),
    customerEmail: v.optional(v.pipe(v.string(), v.email())),
    userEmail: v.optional(v.pipe(v.string(), v.email())),
    metadata: v.optional(v.record(v.string(), v.string())),
    allowPromotionCodes: v.optional(v.boolean()),
    mode: v.optional(
      v.picklist([STRIPE_MODES.PAYMENT, STRIPE_MODES.SUBSCRIPTION])
    ),
  }),
  v.check(
    (data) => !!(data.priceId || (data.unitAmount && data.productName)),
    'Either priceId or (unitAmount + productName) is required'
  )
);

/**
 * Schema for creating a checkout session response
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CreateCheckoutSessionResponseSchema = v.object({
  sessionId: v.string(),
  sessionUrl: v.nullable(v.pipe(v.string(), v.url())),
});

// =============================================================================
// Subscription Schemas
// =============================================================================

/**
 * Schema for subscription data from billing providers
 * Uses constants for enum values to ensure consistency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const SubscriptionDataSchema = v.object({
  userId: v.string(),
  tier: v.string(),
  status: v.picklist(
    Object.values(SUBSCRIPTION_STATUS) as [string, ...string[]]
  ),
  subscriptionId: v.nullable(v.string()),
  customerId: v.string(),
  subscriptionEnd: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  cancelAtPeriodEnd: v.boolean(),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

/**
 * Schema for subscription claims stored in Firebase Auth custom claims
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const SubscriptionClaimsSchema = v.object({
  tier: v.string(),
  subscriptionId: v.nullable(v.string()),
  customerId: v.string(),
  status: v.picklist(
    Object.values(SUBSCRIPTION_STATUS) as [string, ...string[]]
  ),
  subscriptionEnd: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  cancelAtPeriodEnd: v.boolean(),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  isDefault: v.optional(v.boolean()),
});

// =============================================================================
// Webhook Schemas
// =============================================================================

/**
 * Schema for webhook event data
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const WebhookEventSchema = v.object({
  id: v.string(),
  type: v.string(),
  data: v.object({
    object: v.any(),
  }),
  created: v.pipe(v.string(), v.isoTimestamp()),
});

/**
 * Schema for Stripe checkout session metadata
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CheckoutSessionMetadataSchema = v.looseObject({
  userId: v.optional(v.string()),
  firebaseUid: v.optional(v.string()),
  productType: v.optional(v.string()),
}); // Allow additional metadata fields

// =============================================================================
// Type Exports (Schema-Derived)
// =============================================================================

/**
 * Create checkout session request type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CreateCheckoutSessionRequest = v.InferOutput<
  typeof CreateCheckoutSessionRequestSchema
>;
/**
 * Create checkout session response type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CreateCheckoutSessionResponse = v.InferOutput<
  typeof CreateCheckoutSessionResponseSchema
>;
/**
 * Subscription data type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type SubscriptionData = v.InferOutput<typeof SubscriptionDataSchema>;
/**
 * Subscription claims type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
// Type is defined in constants.ts to break circular dependency
// Schema validates against SubscriptionClaims type from constants
/**
 * Webhook event type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type WebhookEvent = v.InferOutput<typeof WebhookEventSchema>;
/**
 * Checkout session metadata type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CheckoutSessionMetadata = v.InferOutput<
  typeof CheckoutSessionMetadataSchema
>;

// Product Declaration Types
/**
 * Stripe payment type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripePayment = v.InferOutput<typeof StripePaymentSchema> & {
  onPurchaseSuccess?: (userId: string, metadata: any) => Promise<void>;
  onPurchaseFailure?: (userId: string, metadata: any) => Promise<void>;
};

/**
 * Stripe subscription type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripeSubscription = v.InferOutput<
  typeof StripeSubscriptionSchema
> & {
  onSubscriptionCreated?: (userId: string, metadata: any) => Promise<void>;
  onSubscriptionRenewed?: (userId: string, metadata: any) => Promise<void>;
  onSubscriptionCancelled?: (userId: string, metadata: any) => Promise<void>;
  onPaymentFailed?: (userId: string, metadata: any) => Promise<void>;
};

/**
 * Product declaration type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ProductDeclaration = v.InferOutput<
  typeof ProductDeclarationSchema
> & {
  onPurchaseSuccess?: (userId: string, metadata: any) => Promise<void>;
  onPurchaseFailure?: (userId: string, metadata: any) => Promise<void>;
  onSubscriptionCreated?: (userId: string, metadata: any) => Promise<void>;
  onSubscriptionRenewed?: (userId: string, metadata: any) => Promise<void>;
  onSubscriptionCancelled?: (userId: string, metadata: any) => Promise<void>;
  onPaymentFailed?: (userId: string, metadata: any) => Promise<void>;
};

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate create checkout session request
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateCreateCheckoutSessionRequest(data: unknown) {
  return v.safeParse(CreateCheckoutSessionRequestSchema, data);
}

/**
 * Validate create checkout session response
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateCreateCheckoutSessionResponse(data: unknown) {
  return v.safeParse(CreateCheckoutSessionResponseSchema, data);
}

/**
 * Validate subscription data
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateSubscriptionData(data: unknown) {
  return v.safeParse(SubscriptionDataSchema, data);
}

/**
 * Validate subscription claims
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateSubscriptionClaims(data: unknown) {
  return v.safeParse(SubscriptionClaimsSchema, data);
}

/**
 * Validate webhook event
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateWebhookEvent(data: unknown) {
  return v.safeParse(WebhookEventSchema, data);
}

/**
 * Validate checkout session metadata
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateCheckoutSessionMetadata(data: unknown) {
  return v.safeParse(CheckoutSessionMetadataSchema, data);
}

// =============================================================================
// Product Declaration Schemas (New Pattern)
// =============================================================================

/**
 * Schema for one-time payment products
 * Core fields only - no assumptions about integrations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const StripePaymentSchema = v.object({
  type: v.literal('StripePayment'),
  name: v.pipe(v.string(), v.minLength(1, 'Product name is required')),
  description: v.optional(v.string()),
  price: v.string(), // Display price (e.g., "2,000€") - not used for Stripe, only for display
  currency: v.optional(
    v.pipe(v.string(), v.length(3, 'Currency must be 3-letter ISO code')),
    'EUR'
  ),
  /** Stripe price ID (fixed pricing). Optional when using dynamic pricing. */
  priceId: v.optional(
    v.pipe(v.string(), v.minLength(1, 'Stripe price ID is required'))
  ),
  /** Default amount in cents (dynamic pricing). Used when no priceId. */
  unitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  /** Product name for Stripe checkout (dynamic pricing). */
  productName: v.optional(v.pipe(v.string(), v.minLength(1))),
  /** Maximum allowed unit amount in cents. Security cap for client-provided amounts. */
  maxUnitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  tier: v.pipe(v.string(), v.minLength(1, 'Tier is required')),
  duration: v.pipe(v.string(), v.minLength(1, 'Duration is required')), // 'lifetime', '6months', etc.
  allowPromotionCodes: v.optional(v.boolean()),

  // Optional: Custom metadata
  metadata: v.optional(v.record(v.string(), v.string())),

  // Extension hooks - users define custom logic (TypeScript only)
  // onPurchaseSuccess?: (userId: string, metadata: any) => Promise<void>;
  // onPurchaseFailure?: (userId: string, metadata: any) => Promise<void>;
});

/**
 * Schema for recurring subscription products
 * Core fields only - no assumptions about integrations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const StripeSubscriptionSchema = v.object({
  type: v.literal('StripeSubscription'),
  name: v.pipe(v.string(), v.minLength(1, 'Product name is required')),
  description: v.optional(v.string()),
  price: v.string(), // Display price (e.g., "2,000€") - not used for Stripe, only for display
  currency: v.optional(
    v.pipe(v.string(), v.length(3, 'Currency must be 3-letter ISO code')),
    'EUR'
  ),
  /** Stripe price ID. Required for subscriptions (price_data not supported for recurring). */
  priceId: v.pipe(v.string(), v.minLength(1, 'Stripe price ID is required')),
  tier: v.pipe(v.string(), v.minLength(1, 'Tier is required')),
  duration: v.picklist([
    '1month',
    '3months',
    '6months',
    '1year',
    '2years',
    'lifetime',
  ]),
  allowPromotionCodes: v.optional(v.boolean()),

  // Optional: Custom metadata
  metadata: v.optional(v.record(v.string(), v.string())),

  // Extension hooks - users define custom logic (TypeScript only)
  // onSubscriptionCreated?: (userId: string, metadata: any) => Promise<void>;
  // onSubscriptionRenewed?: (userId: string, metadata: any) => Promise<void>;
  // onSubscriptionCancelled?: (userId: string, metadata: any) => Promise<void>;
  // onPaymentFailed?: (userId: string, metadata: any) => Promise<void>;
});

/**
 * Union schema for all product types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const ProductDeclarationSchema = v.variant('type', [
  StripePaymentSchema,
  StripeSubscriptionSchema,
]);

/**
 * Schema for product declarations object
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const ProductDeclarationsSchema = v.record(
  v.string(), // Product key
  ProductDeclarationSchema
);

/**
 * Schema for frontend billing configuration (display only)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const StripeFrontConfigSchema = v.record(
  v.string(), // Product key
  v.object({
    name: v.string(),
    price: v.string(), // Display price (e.g., "2,000€")
    currency: v.string(),
    description: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    /** Stripe price ID (fixed pricing). Optional for dynamic pricing products. */
    priceId: v.optional(v.string()),
    /** Amount in cents (dynamic pricing). For display purposes. */
    unitAmount: v.optional(v.number()),
    /** Product name (dynamic pricing). For display purposes. */
    productName: v.optional(v.string()),
    allowPromotionCodes: v.optional(v.boolean()),
  })
);

/**
 * Schema for backend billing configuration (with hooks)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const StripeBackConfigSchema = v.record(
  v.string(), // Product key
  v.object({
    type: v.picklist(['StripePayment', 'StripeSubscription']),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    /** Stripe price ID (fixed pricing). Optional for dynamic pricing products. */
    priceId: v.optional(v.string()),
    /** Default amount in cents (dynamic pricing). */
    unitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    /** Product name for Stripe checkout (dynamic pricing). */
    productName: v.optional(v.pipe(v.string(), v.minLength(1))),
    /** Maximum allowed unit amount in cents. Security cap. */
    maxUnitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    tier: v.string(),
    duration: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
    allowPromotionCodes: v.optional(v.boolean()),
    // Hooks are TypeScript-only, not validated by Valibot
  })
);

/**
 * Helper to validate frontend config at runtime
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateStripeFrontConfig(config: unknown) {
  return v.parse(StripeFrontConfigSchema, config);
}

/**
 * Helper to validate backend config at runtime
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateStripeBackConfig(config: unknown) {
  return v.parse(StripeBackConfigSchema, config);
}

// =============================================================================
// Schema Validation (Development Only)
// =============================================================================

/**
 * Validate all billing schemas
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateBillingSchemas() {
  const results = {
    createCheckoutSessionRequest: v.safeParse(
      CreateCheckoutSessionRequestSchema,
      {}
    ),
    createCheckoutSessionResponse: v.safeParse(
      CreateCheckoutSessionResponseSchema,
      {}
    ),
    subscriptionData: v.safeParse(SubscriptionDataSchema, {}),
    subscriptionClaims: v.safeParse(SubscriptionClaimsSchema, {}),
    webhookEvent: v.safeParse(WebhookEventSchema, {}),
    checkoutSessionMetadata: v.safeParse(CheckoutSessionMetadataSchema, {}),
  };

  return {
    success: Object.values(results).every((result) => result.success),
    results,
  };
}
