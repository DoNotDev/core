// packages/core/types/src/events/AuthEvents.ts

/**
 * @fileoverview Auth Events
 * @description Event constants and types for auth EDA system. Defines authentication-related event names and types for event-driven architecture.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Authentication event constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const AUTH_EVENTS = {
  AUTH_STATE_CHANGED: 'auth.state.changed',
  USER_SIGNED_IN: 'auth.user.signed_in',
  USER_SIGNED_OUT: 'auth.user.signed_out',
  USER_UPDATED: 'auth.user.updated',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  SUBSCRIPTION_UPDATED: 'auth.subscription.updated',
  SUBSCRIPTION_CHANGED: 'auth.subscription.changed',
  SUBSCRIPTION_CANCELLED: 'auth.subscription.cancelled',
  SUBSCRIPTION_EXPIRED: 'auth.subscription.expired',
  PERMISSIONS_UPDATED: 'auth.permissions.updated',
  ACCOUNT_LINKED: 'auth.account.linked',
  ACCOUNT_UNLINKED: 'auth.account.unlinked',
  ACCOUNT_LINKING_REQUIRED: 'auth.account.linking_required',
  AUTH_SUCCESS: 'auth.success',
  EMAIL_VERIFICATION_SENT: 'auth.email.verification_sent',
  PASSWORD_RESET_SENT: 'auth.password.reset_sent',
  AUTH_ERROR: 'auth.error',
} as const;

/**
 * Type for authentication event keys
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthEventKey = keyof typeof AUTH_EVENTS;

/**
 * Type for authentication event names
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthEventName = (typeof AUTH_EVENTS)[AuthEventKey];

/**
 * Authentication event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthEventData {
  userId?: string;
  authUser?: any;
  userProfile?: any;
  subscription?: any;
  token?: string;
  permissions?: string[];
  partnerId?: string;
  error?: string;
  errorCode?: string;
  isLoading?: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}
