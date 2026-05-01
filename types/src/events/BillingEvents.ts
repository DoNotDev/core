// packages/core/types/src/events/BillingEvents.ts

/**
 * @fileoverview Billing Events
 * @description Event constants and types for billing EDA system. Defines billing-related event names and types for event-driven architecture.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Billing event constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const BILLING_EVENTS = {
  // Service initialization
  BILLING_INITIALIZED: 'billing.initialized',
  BILLING_ERROR: 'billing.error',

  // Checkout session events
  CHECKOUT_SESSION_CREATED: 'billing.checkout_session.created',
  CHECKOUT_SESSION_FAILED: 'billing.checkout_session.failed',

  // Subscription events
  SUBSCRIPTION_CREATED: 'billing.subscription.created',
  SUBSCRIPTION_UPDATED: 'billing.subscription.updated',
  SUBSCRIPTION_CANCELLED: 'billing.subscription.cancelled',
  SUBSCRIPTION_RENEWED: 'billing.subscription.renewed',
  SUBSCRIPTION_EXPIRED: 'billing.subscription.expired',
  SUBSCRIPTION_TRIAL_ENDED: 'billing.subscription.trial_ended',

  // Payment events
  PAYMENT_SUCCEEDED: 'billing.payment.succeeded',
  PAYMENT_FAILED: 'billing.payment.failed',
  PAYMENT_REFUNDED: 'billing.payment.refunded',

  // Payment method events
  PAYMENT_METHOD_ADDED: 'billing.payment_method.added',
  PAYMENT_METHOD_UPDATED: 'billing.payment_method.updated',
  PAYMENT_METHOD_REMOVED: 'billing.payment_method.removed',
  PAYMENT_METHOD_DEFAULT_CHANGED: 'billing.payment_method.default_changed',

  // Invoice events
  INVOICE_CREATED: 'billing.invoice.created',
  INVOICE_UPDATED: 'billing.invoice.updated',
  INVOICE_PAID: 'billing.invoice.paid',
  INVOICE_FAILED: 'billing.invoice.failed',

  // Webhook events
  WEBHOOK_RECEIVED: 'billing.webhook.received',
  WEBHOOK_PROCESSED: 'billing.webhook.processed',
  WEBHOOK_ERROR: 'billing.webhook.error',
} as const;

/**
 * Type for billing event keys
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BillingEventKey = keyof typeof BILLING_EVENTS;

/**
 * Type for billing event names
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BillingEventName = (typeof BILLING_EVENTS)[BillingEventKey];

/**
 * Billing event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BillingEventData {
  provider?: string;
  config?: Record<string, unknown>;
  invoice?: Record<string, unknown>;
  paymentMethod?: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Subscription event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SubscriptionEventData {
  subscription: Record<string, unknown>;
  previousSubscription?: Record<string, unknown>;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Payment event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PaymentEventData {
  paymentId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  subscription?: Record<string, unknown>;
  invoice?: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface WebhookEventData {
  provider: string;
  eventType: string;
  data: Record<string, unknown>;
  signature?: string;
  timestamp: Date;
}
