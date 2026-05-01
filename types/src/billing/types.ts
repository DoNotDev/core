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
    /** Amount in cents (dynamic pricing mode, used with price_data) */
    unitAmount?: number;
    /** Product name for Stripe checkout (dynamic pricing mode) */
    productName?: string;
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
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeCheckoutRequest {
  /** Stripe price ID (fixed pricing mode) */
  priceId?: string;

  /** Amount in cents (dynamic pricing mode, used with price_data) */
  unitAmount?: number;

  /** Product name for Stripe checkout (dynamic pricing mode) */
  productName?: string;

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
 * Result of a beforeCheckout hook invocation.
 * Allows blocking checkout or overriding pricing before Stripe session creation.
 */
export interface BeforeCheckoutResult {
  /** Whether checkout is allowed to proceed */
  allowed: boolean;
  /** Reason for blocking (shown in error response) */
  reason?: string;
  /** Optional overrides applied to checkout options before Stripe session creation */
  overrides?: Partial<Pick<CheckoutOptions, 'unitAmount' | 'productName'>>;
}

/**
 * Hook called before Stripe checkout session creation.
 * Use for ownership checks, status validation, server-resolved pricing.
 *
 * @param userId - Authenticated user ID
 * @param options - Checkout options from the client request
 * @param metadata - Request metadata (sanitized)
 * @returns Whether to allow checkout, optional reason, optional overrides
 */
export type BeforeCheckoutHook = (
  userId: string,
  options: CheckoutOptions,
  metadata: Record<string, string>
) => Promise<BeforeCheckoutResult>;

// =============================================================================
// Hook API Types
// =============================================================================

/**
 * Checkout options for Stripe checkout session
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CheckoutOptions {
  /** Stripe price ID (fixed pricing mode) */
  priceId?: string;
  /** Amount in cents (dynamic pricing mode) */
  unitAmount?: number;
  /** Product name for Stripe checkout (dynamic pricing mode) */
  productName?: string;
  /** Currency code, defaults to 'eur' (dynamic pricing mode) */
  currency?: string;
  mode: 'payment' | 'subscription';
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  allowPromotionCodes?: boolean;
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

/**
 * Backend billing configuration type with hooks
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripeBackConfig = {
  [key: string]: {
    type: 'StripePayment' | 'StripeSubscription';
    name: string;
    price: number;
    currency: string;
    /** Stripe price ID (fixed pricing). Optional for dynamic pricing products. */
    priceId?: string;
    /** Default amount in cents (dynamic pricing). */
    unitAmount?: number;
    /** Product name for Stripe checkout (dynamic pricing). */
    productName?: string;
    /** Maximum allowed unit amount in cents. Security cap for client-provided amounts. */
    maxUnitAmount?: number;
    tier: string;
    duration: string;
    description?: string;
    metadata?: Record<string, string>;
    allowPromotionCodes?: boolean;
    // Hooks are TypeScript-only extensions
    onPurchaseSuccess?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
    onPurchaseFailure?: (
      userId: string,
      metadata: Record<string, string>
    ) => Promise<void>;
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
    /** Hook called before Stripe checkout session creation. Can block or override pricing. */
    beforeCheckout?: BeforeCheckoutHook;
  };
};

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
