// packages/core/utils/src/client/features/featureConsent.ts

/**
 * @fileoverview Consent Level Constants
 * @description Cookie consent category constants for GDPR compliance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Consent category constants
 * Must match CONSENT_CATEGORY from @donotdev/types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CONSENT_LEVELS = {
  NECESSARY: 'necessary',
  FUNCTIONAL: 'functional',
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
} as const;

/**
 * Consent level type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ConsentLevel = (typeof CONSENT_LEVELS)[keyof typeof CONSENT_LEVELS];
