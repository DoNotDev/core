// packages/core/types/src/billing/schemas.ts

/**
 * @fileoverview Schema Definitions for Billing and Subscription Management
 * @description Single source of truth for all billing-related data validation. Defines Valibot schemas for billing, subscriptions, checkout sessions, and related data structures.
 *
 * @version 0.2.0
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
 * Maximum line items per checkout request (framework limit).
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export const MAX_CHECKOUT_LINE_ITEMS = 100;

/**
 * One requested line: what the client wants, never what it costs.
 * Names and prices are resolved on the server.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export const CheckoutLineItemInputSchema = v.object({
  /** App product ID. For StripePayment/StripeSubscription: the billing config key. */
  productId: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10000)),
});

/**
 * Schema for creating a checkout session request.
 * The client sends what it wants (config key + line items); the server derives
 * prices, mode and user from the back config and the auth context.
 *
 * 0.1.x requests keep working unchanged: the key may come from
 * `metadata.billingConfigKey`, `lineItems` defaults to the single product, and
 * the 0.1.x fields (`priceId`, `unitAmount` + `productName`, `currency`, `mode`)
 * are kept and honoured for StripePayment/StripeSubscription items exactly as in
 * 0.1.x (priceId checked against the back config, dynamic amounts capped by
 * `maxUnitAmount`). StripeOrder ignores them. `userId` is never trusted by the
 * framework providers: they pass the authenticated user.
 * The output is always normalized (`billingConfigKey` + `lineItems` set).
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CreateCheckoutSessionRequestSchema = v.pipe(
  v.object({
    /** Key in the app's StripeBackConfig */
    billingConfigKey: v.optional(v.pipe(v.string(), v.minLength(1))),
    lineItems: v.optional(
      v.pipe(
        v.array(CheckoutLineItemInputSchema),
        v.minLength(1, 'At least one line item is required'),
        v.maxLength(
          MAX_CHECKOUT_LINE_ITEMS,
          `At most ${MAX_CHECKOUT_LINE_ITEMS} line items`
        )
      )
    ),
    successUrl: v.pipe(v.string(), v.url()),
    cancelUrl: v.pipe(v.string(), v.url()),
    customerEmail: v.optional(v.pipe(v.string(), v.email())),
    metadata: v.optional(v.record(v.string(), v.string())),
    allowPromotionCodes: v.optional(v.boolean()),
    // 0.1.x fields (single-price items only)
    /** 0.1.x: ignored by the framework providers (they pass the authenticated user) */
    userId: v.optional(v.string()),
    productId: v.optional(v.string()),
    /** 0.1.x: Stripe price ID (must match the back config priceId when it has one) */
    priceId: v.optional(v.string()),
    /** 0.1.x: amount in cents (dynamic pricing, capped by the back config `maxUnitAmount`) */
    unitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    /** 0.1.x: product name shown on Stripe checkout (dynamic pricing) */
    productName: v.optional(v.pipe(v.string(), v.minLength(1))),
    /** 0.1.x: currency code (dynamic pricing), defaults to the back config currency */
    currency: v.optional(
      v.pipe(v.string(), v.length(3, 'Currency must be 3-letter ISO code'))
    ),
    userEmail: v.optional(v.pipe(v.string(), v.email())),
    /** 0.1.x: Stripe mode. Omitted: derived from the back config item type. */
    mode: v.optional(
      v.picklist([STRIPE_MODES.PAYMENT, STRIPE_MODES.SUBSCRIPTION])
    ),
  }),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const data = dataset.value;
    /** @grill-refuted Conflicting metadata.billingConfigKey is harmless: server metadata overwrites it, hooks get ctx.billingConfigKey. */
    const billingConfigKey =
      data.billingConfigKey || data.metadata?.billingConfigKey;
    if (!billingConfigKey) {
      addIssue({ message: 'billingConfigKey is required' });
      return NEVER;
    }
    return {
      ...data,
      billingConfigKey,
      lineItems: data.lineItems ?? [
        { productId: billingConfigKey, quantity: 1 },
      ],
    };
  })
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
 * Create checkout session request type (normalized: `billingConfigKey` and `lineItems` set)
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CreateCheckoutSessionRequest = v.InferOutput<
  typeof CreateCheckoutSessionRequestSchema
>;
/**
 * Create checkout session request as sent by a client (before normalization)
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type CreateCheckoutSessionRequestInput = v.InferInput<
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
 * Validate (and normalize) a create checkout session request
 *
 * @version 0.2.0
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
 * Fields shared by StripePayment and StripeSubscription back-config items.
 */
const StripePriceBackFields = {
  name: v.string(),
  price: v.number(),
  currency: v.string(),
  /**
   * Stripe price ID charged for this item. Requests without a price use it; a
   * request priceId must match it. Omit only for 0.1.x client-supplied prices.
   */
  priceId: v.optional(v.string()),
  /** @deprecated Not read at checkout (0.1.x: same). Prefer StripeOrder for server-priced lines. */
  unitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  /** @deprecated Not read at checkout (0.1.x: same). */
  productName: v.optional(v.pipe(v.string(), v.minLength(1))),
  /**
   * Maximum unit amount in cents for 0.1.x dynamic pricing (request
   * `unitAmount` + `productName`). Required for it: security cap.
   * @deprecated Prefer StripeOrder (`resolveLineItems`) for server-priced lines.
   */
  maxUnitAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  tier: v.string(),
  duration: v.string(),
  description: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.string())),
  allowPromotionCodes: v.optional(v.boolean()),
};

/**
 * Tax handling for StripeOrder. Unit amounts are always excl. VAT
 * (`tax_behavior: 'exclusive'`).
 * - `manual`: Stripe Tax Rate IDs applied to every line
 * - `automatic`: Stripe Tax computes the tax (reverse charge from the buyer's tax ID)
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export const StripeOrderTaxSchema = v.variant('mode', [
  v.object({
    mode: v.literal('manual'),
    taxRateIds: v.pipe(
      v.array(v.pipe(v.string(), v.minLength(1))),
      v.minLength(1)
    ),
  }),
  v.object({ mode: v.literal('automatic') }),
]);

/**
 * Maximum shipping rates per Checkout Session (Stripe `shipping_options` limit).
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export const MAX_SHIPPING_RATE_IDS = 5;

/**
 * Shipping collection for StripeOrder.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export const StripeOrderShippingSchema = v.object({
  /** Uppercase ISO 3166-1 alpha-2 country codes the order can ship to (e.g. `FR`) */
  allowedCountries: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.regex(
          /^[A-Z]{2}$/,
          'allowedCountries: uppercase ISO 3166-1 alpha-2 code expected (e.g. FR)'
        )
      )
    ),
    v.minLength(1)
  ),
  /** Stripe Shipping Rate IDs offered at checkout (Stripe allows at most 5) */
  shippingRateIds: v.optional(
    v.pipe(
      v.array(v.pipe(v.string(), v.minLength(1))),
      v.maxLength(
        MAX_SHIPPING_RATE_IDS,
        `shippingRateIds: at most ${MAX_SHIPPING_RATE_IDS} (Stripe limit)`
      )
    )
  ),
});

/**
 * Back-config item for a multi-line, one-time order priced on the server
 * (`resolveLineItems` hook, TypeScript only).
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export const StripeOrderBackSchema = v.object({
  type: v.literal('StripeOrder'),
  name: v.string(),
  /** ISO 4217 currency of every resolved line */
  currency: v.pipe(v.string(), v.length(3)),
  description: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.string())),
  allowPromotionCodes: v.optional(v.boolean()),
  tax: StripeOrderTaxSchema,
  /** Collect the buyer's tax ID (VAT number) */
  taxIdCollection: v.picklist(['disabled', 'optional', 'required']),
  billingAddressCollection: v.picklist(['auto', 'required']),
  shipping: v.optional(StripeOrderShippingSchema),
  customerCreation: v.picklist(['always', 'if_required']),
  /** Generate a post-payment Stripe invoice */
  invoiceCreation: v.boolean(),
  /** Stripe Payment Method Configuration ID (card, SEPA debit...). Omit to use the account default. */
  paymentMethodConfiguration: v.optional(v.pipe(v.string(), v.minLength(1))),
});

/**
 * Schema for backend billing configuration (with hooks)
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const StripeBackConfigSchema = v.record(
  v.string(), // Billing config key
  v.variant('type', [
    v.object({ type: v.literal('StripePayment'), ...StripePriceBackFields }),
    v.object({
      type: v.literal('StripeSubscription'),
      ...StripePriceBackFields,
    }),
    StripeOrderBackSchema,
  ])
  // Hooks are TypeScript-only, not validated by Valibot
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
