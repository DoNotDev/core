// packages/core/types/src/events/StripeEvents.ts

/**
 * @fileoverview Stripe Events
 * @description Event constants and types for Stripe webhook events. Defines Stripe-related event names and types for event-driven architecture.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Stripe event constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const STRIPE_EVENTS = {
  PAYMENT_INTENT_SUCCEEDED: 'stripe.payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'stripe.payment_intent.payment_failed',
  CHECKOUT_SESSION_COMPLETED: 'stripe.checkout.session.completed',
  CUSTOMER_CREATED: 'stripe.customer.created',
  CUSTOMER_UPDATED: 'stripe.customer.updated',
  CUSTOMER_DELETED: 'stripe.customer.deleted',
  INVOICE_CREATED: 'stripe.invoice.created',
  INVOICE_PAID: 'stripe.invoice.paid',
  INVOICE_PAYMENT_FAILED: 'stripe.invoice.payment_failed',
  SUBSCRIPTION_CREATED: 'stripe.subscription.created',
  SUBSCRIPTION_UPDATED: 'stripe.subscription.updated',
  SUBSCRIPTION_DELETED: 'stripe.subscription.deleted',
} as const;

/**
 * Type for Stripe event keys
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripeEventKey = keyof typeof STRIPE_EVENTS;

/**
 * Type for Stripe event names
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StripeEventName = (typeof STRIPE_EVENTS)[StripeEventKey];

/**
 * Stripe payment intent event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripePaymentIntentEventData {
  paymentIntentId: string;
  customerId?: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

/**
 * Stripe checkout session event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeCheckoutSessionEventData {
  sessionId: string;
  customerId?: string;
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

/**
 * Stripe customer event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeCustomerEventData {
  customerId: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

/**
 * Stripe invoice event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeInvoiceEventData {
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  hostedInvoiceUrl?: string;
  metadata?: Record<string, string>;
  timestamp: string;
}

/**
 * Stripe webhook event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeWebhookEventData {
  eventId: string;
  eventType: string;
  data: any;
  livemode: boolean;
  timestamp: string;
}

/**
 * Stripe event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StripeEventData {
  eventId?: string;
  eventType?: string;
  customerId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}
