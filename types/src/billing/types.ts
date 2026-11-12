// packages/core/types/src/billing/types.ts

/**
 * @fileoverview Billing Types
 * @description Type definitions for billing domain. Defines billing provider types, checkout modes, billing adapter interfaces, subscription types, and billing-related interfaces.
 * Uses unified FeatureStatus enum for feature state management.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type * as v from 'valibot';

import type { FeatureStatus } from '../common';
import type {
  CheckoutLineItemInputSchema,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  StripeBackConfigSchema,
  StripeFrontConfigSchema,
} from './schemas';

/** Billing provider types - Stripe only
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BillingProvider = 'stripe';

/** Unified checkout mode type used everywhere
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CheckoutMode = 'payment' | 'subscription';

/** Billing adapter interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BillingAdapter {
  createCheckoutSession(
    request: CreateCheckoutSessionRequest
  ): Promise<CreateCheckoutSessionResponse>;
  getProvider(): Promise<BillingProvider>;
  isAvailable(): Promise<boolean>;
}

/** Billing event types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BillingEvent =
  | { type: 'subscription_updated'; data: unknown }
  | { type: 'payment_succeeded'; data: unknown }
  | { type: 'payment_failed'; data: unknown };

/** Payment method types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PaymentMethodType =
  | 'card'
  | 'bank_account'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay';

/** Payment method interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  createdAt: string;
  updatedAt: string;
}

/** Billing provider configuration interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BillingProviderConfig {
  provider: BillingProvider;
  apiKey?: string;
  webhookSecret?: string;
  publishableKey?: string;
  testMode?: boolean;
}

/** Invoice interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  createdAt: string;
  dueDate?: string;
  paidAt?: string;
  description?: string;
  items: InvoiceItem[];
}

/**
 * Invoice item interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
}

/**
 * Subscription interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface Subscription {
  id: string;
  userId: string;
  status:
    | 'active'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'trialing'
    | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stripe webhook event data
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    /** Raw Stripe object payload — shape depends on event type */
    object: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key?: string;
  };
}

/**
 * Schema for creating checkout session
 */
// Schema definitions now live in ./schemas and types are inferred there

/**
 * Schema for processing payment success
 */
// Schema definitions now live in ./schemas and types are inferred there

/**
 * Checkout session creation request
 */
// Types are exported from ./schemas; no re-exports here

/**
 * Checkout session response
 */
// Types are exported from ./schemas; no re-exports here

/**
 * Refresh subscription request
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RefreshSubscriptionRequest {
  userId: string;
}

/**
 * Stripe provider interface for billing operations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeProvider {
  createCheckoutSession(params: {
    priceId?: string;
    /** Currency code, defaults to 'eur' */
    currency?: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    customerEmail?: string;
    allowPromotionCodes?: boolean;
  }): Promise<CreateCheckoutSessionResponse>;

  getSubscription(userId: string): Promise<Subscription | null>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<Subscription>;
}

/**
 * Refresh subscription response
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RefreshSubscriptionResponse {
  success: boolean;
  subscription: Subscription;
}

/**
 * Process payment success request
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ProcessPaymentSuccessRequest {
  sessionId: string;
}

/**
 * Process payment success response
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ProcessPaymentSuccessResponse {
  success: boolean;
  sessionId: string;
}

// =============================================================================
// Stripe-Specific Types
// =============================================================================

/**
 * Billing-specific error codes for functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BillingErrorCode =
  | 'unknown'
  | 'unauthenticated'
  | 'invalid_request'
  | 'stripe_error'
  | 'subscription_not_found'
  | 'checkout_session_not_found'
  | 'webhook_verification_failed'
  | 'rate_limit_exceeded'
  | 'insufficient_permissions'
  | 'invalid_webhook_signature'
  | 'checkout_blocked';

/**
 * Stripe checkout session creation request
 *
 * 0.1.x request shape, still accepted. New code sends
 * `CreateCheckoutSessionRequestInput` (`billingConfigKey`, plus `lineItems` for StripeOrder).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeCheckoutRequest {
  /** Stripe price ID (fixed pricing mode) */
  priceId?: string;

  /** Currency code, defaults to 'eur' (dynamic pricing mode) */
  currency?: string;

  /** User email for the subscription */
  userEmail: string;

  /** URL to redirect to on successful payment */
  successUrl: string;

  /** URL to redirect to on cancelled payment */
  cancelUrl: string;

  /** Optional metadata to attach to the session */
  metadata?: Record<string, string>;

  /** Customer email address */
  customerEmail?: string;

  /** Whether to allow promotion codes */
  allowPromotionCodes?: boolean;

  /** Trial period in days */
  trialPeriodDays?: number;

  /** Collection method for the subscription */
  collectionMethod?: 'charge_automatically' | 'send_invoice';

  /** Payment method types to allow */
  paymentMethodTypes?: string[];

  /** Billing address collection requirement */
  billingAddressCollection?: 'auto' | 'required';

  /** Tax ID collection requirement */
  taxIdCollection?: {
    enabled: boolean;
  };

  /** Checkout mode - payment or subscription */
  mode?: CheckoutMode;
}

/**
 * Stripe checkout session response
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeCheckoutResponse {
  /** Stripe session ID */
  sessionId: string;

  /** URL to redirect the user to complete payment */
  sessionUrl: string | null;

  /** Whether the session was created successfully */
  success: boolean;

  /** Error message if creation failed */
  error?: string;
}

/**
 * Stripe subscription data structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeSubscriptionData {
  /** Stripe subscription ID */
  id: string;

  /** Customer ID */
  customer: string;

  /** Subscription status */
  status:
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid';

  /** Current period start timestamp */
  current_period_start: number;

  /** Current period end timestamp */
  current_period_end: number;

  /** Whether the subscription will cancel at period end */
  cancel_at_period_end: boolean;

  /** When the subscription was canceled */
  canceled_at?: number;

  /** Trial start timestamp */
  trial_start?: number;

  /** Trial end timestamp */
  trial_end?: number;

  /** When the subscription was created */
  created: number;

  /** When the subscription was last updated */
  updated: number;

  /** Subscription items */
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: {
          interval: 'day' | 'week' | 'month' | 'year';
          interval_count: number;
        };
        product: string;
      };
      quantity: number;
    }>;
  };

  /** Default payment method */
  default_payment_method?: string;

  /** Collection method */
  collection_method: 'charge_automatically' | 'send_invoice';

  /** Days until due for invoices */
  days_until_due?: number;

  /** Subscription metadata */
  metadata: Record<string, string>;
}

/**
 * Stripe payment method data structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripePaymentMethod {
  /** Stripe payment method ID */
  id: string;

  /** Customer ID */
  customer: string;

  /** Payment method type */
  type:
    | 'card'
    | 'bank_account'
    | 'us_bank_account'
    | 'sepa_debit'
    | 'ideal'
    | 'sofort'
    | 'bancontact'
    | 'p24'
    | 'giropay'
    | 'eps'
    | 'alipay'
    | 'wechat_pay';

  /** Card details (if type is 'card') */
  card?: {
    brand:
      | 'amex'
      | 'diners'
      | 'discover'
      | 'jcb'
      | 'mastercard'
      | 'unionpay'
      | 'visa'
      | 'unknown';
    country: string;
    exp_month: number;
    exp_year: number;
    fingerprint: string;
    funding: 'credit' | 'debit' | 'prepaid' | 'unknown';
    last4: string;
    three_d_secure_usage?: {
      supported: boolean;
    };
    wallet?: {
      type:
        | 'amex_express_checkout'
        | 'apple_pay'
        | 'google_pay'
        | 'masterpass'
        | 'samsung_pay'
        | 'visa_checkout';
      dynamic_last4?: string;
    };
  };

  /** Bank account details (if type is 'bank_account') */
  bank_account?: {
    account_holder_type: 'individual' | 'company';
    bank_name: string;
    country: string;
    currency: string;
    fingerprint: string;
    last4: string;
    routing_number: string;
    status:
      | 'new'
      | 'validated'
      | 'verified'
      | 'verification_failed'
      | 'errored';
  };

  /** Billing details */
  billing_details: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };

  /** When the payment method was created */
  created: number;

  /** Whether this is the default payment method */
  is_default?: boolean;

  /** Payment method metadata */
  metadata: Record<string, string>;
}

/**
 * Stripe invoice data structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeInvoice {
  /** Stripe invoice ID */
  id: string;

  /** Customer ID */
  customer: string;

  /** Invoice amount */
  amount_due: number;

  /** Invoice amount paid */
  amount_paid: number;

  /** Invoice amount remaining */
  amount_remaining: number;

  /** Currency code */
  currency: string;

  /** Invoice status */
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

  /** When the invoice was created */
  created: number;

  /** When the invoice is due */
  due_date?: number;

  /** When the invoice was paid */
  paid_at?: number;

  /** When the invoice was voided */
  voided_at?: number;

  /** Invoice description */
  description?: string;

  /** Invoice line items */
  lines: {
    data: Array<{
      id: string;
      amount: number;
      currency: string;
      description?: string;
      quantity: number;
      unit_amount: number;
      price?: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring?: {
          interval: 'day' | 'week' | 'month' | 'year';
          interval_count: number;
        };
        product: string;
      };
    }>;
  };

  /** Invoice metadata */
  metadata: Record<string, string>;

  /** Subscription ID (if applicable) */
  subscription?: string;

  /** Total amount */
  total: number;

  /** Tax amount */
  tax?: number;

  /** Tax rate applied */
  tax_rate?: number;
}

/**
 * Stripe customer data structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeCustomer {
  /** Stripe customer ID */
  id: string;

  /** Customer email */
  email?: string;

  /** Customer name */
  name?: string;

  /** Customer description */
  description?: string;

  /** Customer phone */
  phone?: string;

  /** Customer address */
  address?: {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postal_code?: string;
    state?: string;
  };

  /** Customer balance */
  balance: number;

  /** Currency code */
  currency?: string;

  /** When the customer was created */
  created: number;

  /** When the customer was last updated */
  updated: number;

  /** Customer metadata */
  metadata: Record<string, string>;

  /** Default payment method */
  default_source?: string;

  /** Whether the customer is deleted */
  deleted?: boolean;

  /** Customer tax IDs */
  tax_ids?: {
    data: Array<{
      id: string;
      type:
        | 'eu_vat'
        | 'br_cnpj'
        | 'br_cpf'
        | 'gb_vat'
        | 'nz_gst'
        | 'au_abn'
        | 'au_arn'
        | 'in_gst'
        | 'no_vat'
        | 'za_vat'
        | 'ch_vat'
        | 'mx_rfc'
        | 'sg_uen'
        | 'ru_inn'
        | 'ru_kpp'
        | 'ca_bn'
        | 'hk_br'
        | 'es_cif'
        | 'tw_vat'
        | 'th_vat'
        | 'jp_cn'
        | 'jp_rn'
        | 'li_uid'
        | 'my_itn'
        | 'us_ein'
        | 'kr_brn'
        | 'ca_gst_hst'
        | 'ca_qst'
        | 'ca_pst_bc'
        | 'ca_pst_mb'
        | 'ca_pst_sk'
        | 'my_sst'
        | 'sg_gst'
        | 'ae_trn'
        | 'cl_tin'
        | 'sa_vat'
        | 'id_npwp';
      value: string;
    }>;
  };
}

/**
 * Stripe product data structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeProduct {
  /** Stripe product ID */
  id: string;

  /** Product name */
  name: string;

  /** Product description */
  description?: string;

  /** Product images */
  images: string[];

  /** Product metadata */
  metadata: Record<string, string>;

  /** Whether the product is active */
  active: boolean;

  /** When the product was created */
  created: number;

  /** When the product was last updated */
  updated: number;

  /** Product type */
  type: 'service' | 'good';

  /** Product URL */
  url?: string;

  /** Product statement descriptor */
  statement_descriptor?: string;

  /** Product unit label */
  unit_label?: string;

  /** Product tax code */
  tax_code?: string;
}

/**
 * Stripe price data structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripePrice {
  /** Stripe price ID */
  id: string;

  /** Product ID */
  product: string;

  /** Price amount in cents */
  unit_amount: number;

  /** Currency code */
  currency: string;

  /** Price type */
  type: 'one_time' | 'recurring';

  /** Recurring interval (if type is 'recurring') */
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
    trial_period_days?: number;
    usage_type: 'licensed' | 'metered';
  };

  /** Whether the price is active */
  active: boolean;

  /** When the price was created */
  created: number;

  /** When the price was last updated */
  updated: number;

  /** Price metadata */
  metadata: Record<string, string>;

  /** Price nickname */
  nickname?: string;

  /** Price tiers (for graduated pricing) */
  tiers?: Array<{
    up_to: number | 'inf';
    unit_amount: number;
    flat_amount?: number;
  }>;

  /** Price tiers mode */
  tiers_mode?: 'graduated' | 'volume';

  /** Price transform quantity */
  transform_quantity?: {
    divide_by: number;
    round: 'up' | 'down';
  };

  /** Price lookup key */
  lookup_key?: string;
}

// =============================================================================
// Checkout Hook Types
// =============================================================================

/**
 * Result of a beforeCheckout hook invocation. Blocks or allows checkout.
 * StripeOrder prices come from `resolveLineItems`, never from here.
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BeforeCheckoutResult {
  /** Whether checkout is allowed to proceed */
  allowed: boolean;
  /** Reason for blocking (shown in error response) */
  reason?: string;
}

/**
 * Second argument of a `beforeCheckout` hook: the normalized request plus the
 * 0.1.x checkout options, so 0.1.x guards (`options.mode === 'subscription'`,
 * `options.priceId`) keep working.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type BeforeCheckoutOptions = Omit<
  CreateCheckoutSessionRequest,
  'userId' | 'mode' | 'priceId' | 'metadata' | 'allowPromotionCodes'
> & {
  /** Authenticated user ID (never the client value) */
  userId: string;
  /** Stripe mode of the session (request `mode`, else derived from the item type; StripeOrder: `payment`) */
  mode: CheckoutMode;
  /** Stripe price charged (request priceId, else the back config priceId). Undefined for dynamic pricing and StripeOrder. */
  priceId?: string;
  /** Request metadata as sent (before sanitization; 0.1.x behaviour) */
  metadata: Record<string, string>;
  /** Request value, default `true` (0.1.x behaviour) */
  allowPromotionCodes: boolean;
};

/**
 * Hook called before Stripe checkout session creation.
 * Use for ownership checks and status validation.
 *
 * @example
 * ```typescript
 * const beforeCheckout: BeforeCheckoutHook = async (userId, options) =>
 *   options.mode === 'subscription' && options.billingConfigKey !== 'pro_monthly'
 *     ? { allowed: false, reason: 'Unknown plan' }
 *     : { allowed: true };
 * ```
 *
 * @param userId - Authenticated user ID
 * @param options - Normalized request + 0.1.x checkout options (`mode`, `priceId`, `unitAmount`, `currency`...)
 * @param metadata - Request metadata (sanitized)
 * @returns Whether to allow checkout, optional reason (and 0.1.x dynamic-pricing overrides)
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BeforeCheckoutHook = (
  userId: string,
  options: BeforeCheckoutOptions,
  metadata: Record<string, string>
) => Promise<BeforeCheckoutResult>;

/**
 * One requested checkout line (client input).
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type CheckoutLineItemInput = v.InferOutput<
  typeof CheckoutLineItemInputSchema
>;

/**
 * One line priced by the app's `resolveLineItems` hook.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface ResolvedLineItem {
  /** App product ID, copied to the Stripe product metadata and returned in `onOrderPaid` */
  productId: string;
  /** Name shown on the Stripe checkout page and invoice */
  name: string;
  description?: string;
  /** Unit price excl. VAT, in the smallest currency unit (cents) */
  unitAmount: number;
  quantity: number;
  /**
   * Automatic tax only: Stripe tax code of this line (`price_data.product_data.tax_code`),
   * e.g. `txcd_92010001` for a shipping line sent as an order line. Omit to use the
   * account's default product tax code.
   * @since 0.2.3
   */
  taxCode?: string;
}

/**
 * Output of `resolveLineItems`: the server-side order and its priced lines.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface ResolvedOrder {
  /** App order ID (created by the hook, e.g. a pending order row) */
  orderId: string;
  lineItems: ResolvedLineItem[];
  /** Per-order session options decided by the server (omit to use the back config). */
  session?: ResolvedOrderSession;
}

/**
 * Checkout session options a StripeOrder decides per order in `resolveLineItems`
 * (they depend on the buyer or the order, not on the back config).
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface ResolvedOrderSession {
  /**
   * Manual tax only: Tax Rate IDs applied to every line of this order instead of
   * `tax.taxRateIds` (each must be exclusive). `[]` = no tax (e.g. EU B2B reverse charge).
   */
  taxRateIds?: string[];
  /** Payment methods offered for this order. Replaces `paymentMethodConfiguration`. */
  paymentMethodTypes?: Array<'card' | 'sepa_debit'>;
  /** Session expiry, Unix seconds. Stripe: 30 minutes to 24 hours after creation. */
  expiresAt?: number;
  /** Footer printed on the post-payment invoice (e.g. a legal mention). Needs `invoiceCreation`. */
  invoiceFooter?: string;
  /**
   * Existing Stripe Customer ID (`cus_...`) the session is created for. Its tax IDs and
   * address then drive Stripe Tax and the invoice. Replaces `customer_email` and
   * `customerCreation` (Stripe only applies those when it creates a Customer). Checkout
   * updates the Customer from the session: address under automatic tax, shipping when
   * shipping is collected, name when tax ID collection is enabled (Stripe requirement).
   * @since 0.2.3
   */
  customerId?: string;
}

/**
 * Context passed to `resolveLineItems`.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface ResolveLineItemsContext {
  userId: string;
  billingConfigKey: string;
  /** Request metadata (sanitized) */
  metadata: Record<string, string>;
}

/**
 * Postal address as reported by Stripe.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface CheckoutAddress {
  line1: string | null;
  line2: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  /** ISO 3166-1 alpha-2 */
  country: string | null;
}

/**
 * Provider-neutral snapshot of a completed/expired Stripe Checkout Session,
 * passed to order hooks.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface CheckoutSessionSnapshot {
  id: string;
  /** 'paid' | 'unpaid' | 'no_payment_required' */
  paymentStatus: string;
  currency: string | null;
  /** Amounts in the smallest currency unit */
  amountSubtotal: number | null;
  amountTax: number | null;
  amountShipping: number | null;
  amountDiscount: number | null;
  amountTotal: number | null;
  customerId: string | null;
  customer: {
    email: string | null;
    name: string | null;
    phone: string | null;
    /** Business name, when collected */
    businessName: string | null;
    address: CheckoutAddress | null;
    taxIds: Array<{ type: string; value: string | null }>;
    /** 'none' | 'exempt' | 'reverse' */
    taxExempt: string | null;
  } | null;
  shipping: { name: string; address: CheckoutAddress } | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  metadata: Record<string, string>;
}

/**
 * One paid line, read back from Stripe (amounts as charged).
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface PaidLineItem {
  productId: string;
  name: string;
  quantity: number;
  /** Amounts in the smallest currency unit */
  amountSubtotal: number;
  amountDiscount: number;
  amountTax: number;
  amountTotal: number;
}

/**
 * Context passed to order webhook hooks.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface OrderHookContext {
  userId: string;
  orderId: string;
  billingConfigKey: string;
  /**
   * Stripe event ID. Delivery is at-least-once: the same event can reach a hook
   * again (retry after a failed or unrecorded run). Key side effects on
   * `orderId` (or `eventId`) so a replay is a no-op.
   */
  eventId: string;
}

/**
 * Provider-neutral snapshot of a Stripe customer tax ID (`customer.tax_id.updated`).
 *
 * @version 0.2.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export interface TaxIdSnapshot {
  /** Stripe TaxId ID (`txi_...`) */
  id: string;
  /** Stripe Customer ID (`cus_...`) owning the tax ID, null when not owned by a Customer */
  customerId: string | null;
  /** Stripe tax ID type, e.g. `eu_vat` */
  type: string;
  /** Tax ID value, e.g. `DE123456789` */
  value: string;
  /** ISO 3166-1 alpha-2 country of the tax ID */
  country: string | null;
  /** Government verification (null when Stripe does not verify this type) */
  verification: {
    /** 'pending' | 'verified' | 'unverified' | 'unavailable' */
    status: 'pending' | 'verified' | 'unverified' | 'unavailable';
    verifiedName: string | null;
    verifiedAddress: string | null;
  } | null;
}

/**
 * Context passed to `onTaxIdUpdated`.
 *
 * @version 0.2.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export interface TaxIdHookContext {
  /** Back config key of the StripeOrder item whose hook runs */
  billingConfigKey: string;
  /**
   * Stripe event ID. Delivery is at-least-once: key side effects on `taxId.id` +
   * `verification.status` (or `eventId`) so a replay is a no-op.
   */
  eventId: string;
}

// =============================================================================
// Hook API Types
// =============================================================================

/**
 * Client checkout options (useStripeBilling `checkout`).
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CheckoutOptions {
  /** Key in the app's StripeBackConfig. 0.1.x callers may pass it as `metadata.billingConfigKey`. */
  billingConfigKey?: string;
  /** Requested lines. Defaults to `[{ productId: billingConfigKey, quantity: 1 }]` (single product / subscription). */
  lineItems?: CheckoutLineItemInput[];
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  /** Single-price items: show the promotion code field (default true). StripeOrder: set in the back config. */
  allowPromotionCodes?: boolean;
  /** Stripe price ID (single-price items). Must match the back config priceId when it has one; defaults to it. */
  priceId?: string;
  /** Currency for dynamic pricing (default 'eur'). */
  currency?: string;
  /** Stripe mode for single-price items. Defaults to the back config item type. */
  mode?: CheckoutMode;
}

/**
 * Billing API type - complete interface for useStripeBilling hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BillingAPI {
  /**
   * Unified feature status - single source of truth for billing state.
   * Replaces deprecated `loading` boolean flag.
   * - `initializing`: Billing is loading/initializing
   * - `ready`: Billing fully operational
   * - `degraded`: Billing unavailable (feature not installed/consent not given)
   * - `error`: Billing encountered error
   */
  status: FeatureStatus;
  error: string | null;
  /**
   * Whether a billing operation is in progress.
   * For redirect operations (checkout, portal), the hook automatically shows
   * a fullscreen overlay with operation-specific messaging.
   */
  loading: boolean;
  checkout: (options: CheckoutOptions) => Promise<StripeCheckoutResponse>;
  cancelSubscription: () => Promise<{ success: boolean; endsAt: string }>;
  changePlan: (
    newPriceId: string,
    billingConfigKey: string
  ) => Promise<{ success: boolean }>;
  refreshStatus: () => Promise<void>;
  openCustomerPortal: (returnUrl?: string) => Promise<void>;
  clearError: () => void;
  isAvailable: boolean;
}

/**
 * Frontend billing configuration type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripeFrontConfig = v.InferOutput<typeof StripeFrontConfigSchema>;

type StripeBackConfigItemData = v.InferOutput<
  typeof StripeBackConfigSchema
>[string];

/**
 * Hooks shared by every back-config item.
 */
interface StripeBackItemCommonHooks {
  /** Called before Stripe checkout session creation. Can block checkout. */
  beforeCheckout?: BeforeCheckoutHook;
}

/**
 * One-time payment item (single Stripe price) granting a tier.
 * The tier is granted once the payment is settled: at checkout completion when
 * `payment_status` is `paid` / `no_payment_required`, else on
 * `checkout.session.async_payment_succeeded` (e.g. SEPA debit).
 * Hooks run at least once per Stripe event and may run again for the same
 * purchase: make them idempotent. Their errors are logged, not retried.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type StripePaymentBackItem = Extract<
  StripeBackConfigItemData,
  { type: 'StripePayment' }
> &
  StripeBackItemCommonHooks & {
    onPurchaseSuccess?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
    onPurchaseFailure?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
  };

/**
 * Recurring subscription item (single Stripe price) granting a tier.
 * Granted once the first payment is settled (same rule as StripePayment).
 * Hooks run at least once per Stripe event and may run again for the same
 * event: make them idempotent. Their errors are logged, not retried.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type StripeSubscriptionBackItem = Extract<
  StripeBackConfigItemData,
  { type: 'StripeSubscription' }
> &
  StripeBackItemCommonHooks & {
    onSubscriptionCreated?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
    onSubscriptionRenewed?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
    onSubscriptionCancelled?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
    onPaymentFailed?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
  };

/**
 * Multi-line, one-time order priced on the server.
 * Order hooks are delivered at least once and must be idempotent on
 * `ctx.orderId` / `ctx.eventId`: a hook re-runs when it threw (the webhook
 * answers non-2xx and Stripe retries) and also after it succeeded when the
 * framework could not record the event as processed. A store write cannot be
 * atomic with an arbitrary hook, so exactly-once is not possible.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type StripeOrderBackItem = Extract<
  StripeBackConfigItemData,
  { type: 'StripeOrder' }
> &
  StripeBackItemCommonHooks & {
    /** Resolve requested lines to names and unit prices (excl. VAT) and create the app order. */
    resolveLineItems: (
      items: CheckoutLineItemInput[],
      ctx: ResolveLineItemsContext
    ) => Promise<ResolvedOrder>;
    /** Payment confirmed (card at completion, or async method such as SEPA debit later). */
    onOrderPaid: (
      session: CheckoutSessionSnapshot,
      lineItems: PaidLineItem[],
      ctx: OrderHookContext
    ) => Promise<void>;
    /** Async payment (e.g. SEPA debit) failed after checkout completion. */
    onOrderPaymentFailed?: (
      session: CheckoutSessionSnapshot,
      ctx: OrderHookContext
    ) => Promise<void>;
    /** Checkout session expired without payment. */
    onOrderExpired?: (
      session: CheckoutSessionSnapshot,
      ctx: OrderHookContext
    ) => Promise<void>;
    /**
     * Stripe event `customer.tax_id.updated` (e.g. government verification finished:
     * `taxId.verification.status` became `verified` / `unverified` / `unavailable`).
     * Not tied to an order: it runs once per event for every StripeOrder item that
     * defines it (one function shared by several items runs once). Errors propagate:
     * the webhook answers non-2xx and Stripe retries. Subscribe the webhook endpoint
     * to `customer.tax_id.updated`.
     * @since 0.2.3
     */
    onTaxIdUpdated?: (
      taxId: TaxIdSnapshot,
      ctx: TaxIdHookContext
    ) => Promise<void>;
  };

/**
 * Backend billing configuration type with hooks
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripeBackConfig = Record<
  string,
  StripePaymentBackItem | StripeSubscriptionBackItem | StripeOrderBackItem
>;

/**
 * Stripe configuration interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeConfig {
  /** Stripe secret key for server-side operations */
  secretKey: string;

  /** Stripe publishable key for client-side operations */
  publishableKey: string;

  /** Stripe webhook secret for webhook verification */
  webhookSecret: string;

  /** Whether to use test mode */
  testMode: boolean;

  /** API version to use */
  apiVersion?: string;

  /** Maximum number of retries for failed requests */
  maxNetworkRetries?: number;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Additional configuration options */
  options?: {
    /** Whether to enable telemetry */
    telemetry?: boolean;

    /** App information */
    appInfo?: {
      name: string;
      version: string;
      url?: string;
    };
  };
}

// =============================================================================
// Server billing contracts (implemented by @donotdev/functions per platform)
// =============================================================================

/**
 * Auth operations the server billing code needs: read a user's custom claims
 * and write them back (subscription tier lives in the claims).
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */
export interface BillingAuthProvider {
  getUser(userId: string): Promise<{
    customClaims?: Record<string, unknown>;
  }>;
  setCustomUserClaims(
    userId: string,
    claims: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Subscription fields written to a user by the webhook and subscription helpers
 * (the stored record, {@link SubscriptionData}, adds userId and updatedAt).
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */
export interface SubscriptionUpdate {
  tier: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  subscriptionEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  subscriptionId?: string | null;
  customerId?: string;
}

/**
 * Writes a subscription update for a user.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */
export type UpdateSubscriptionFn = (
  userId: string,
  data: SubscriptionUpdate,
  authProvider: BillingAuthProvider
) => Promise<void>;

/**
 * Checkout Session created by a provider.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */
export interface CheckoutSessionResult {
  id: string;
  url: string | null;
}

/**
 * 0.1.x single-price session params, sent to a {@link StripeCheckoutProvider}.
 *
 * @version 0.2.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */
export interface CheckoutSessionParams {
  priceId?: string;
  /** Currency code, defaults to 'eur' */
  currency?: string;
  customerEmail?: string;
  metadata: Record<string, string>;
  allowPromotionCodes: boolean;
  successUrl: string;
  cancelUrl: string;
  mode?: 'payment' | 'subscription';
}

/**
 * 0.1.x provider interface for Stripe checkout operations. Supports
 * StripePayment/StripeSubscription items only; StripeOrder needs the full-session
 * provider of @donotdev/functions (StripeSessionProvider).
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */
export interface StripeCheckoutProvider {
  createCheckoutSession(
    params: CheckoutSessionParams
  ): Promise<CheckoutSessionResult>;
}
