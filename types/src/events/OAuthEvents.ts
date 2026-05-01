// packages/core/types/src/events/OAuthEvents.ts

/**
 * @fileoverview OAuth Events
 * @description Event constants and types for OAuth EDA system. Defines OAuth-related event names and types for event-driven architecture.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * OAuth event constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const OAUTH_EVENTS = {
  OAUTH_STARTED: 'oauth.started',
  OAUTH_SUCCESS: 'oauth.success',
  OAUTH_ERROR: 'oauth.error',
  OAUTH_CANCELLED: 'oauth.cancelled',
  OAUTH_TOKEN_EXCHANGED: 'oauth.token.exchanged',
  OAUTH_TOKEN_REFRESHED: 'oauth.token.refreshed',
  OAUTH_PARTNER_LINKED: 'oauth.partner.linked',
  OAUTH_PARTNER_UNLINKED: 'oauth.partner.unlinked',
} as const;

/**
 * Type for OAuth event keys
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthEventKey = keyof typeof OAUTH_EVENTS;

/**
 * Type for OAuth event names
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthEventName = (typeof OAUTH_EVENTS)[OAuthEventKey];

/**
 * OAuth event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthEventData {
  userId?: string;
  partnerId?: string;
  token?: string;
  error?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}
