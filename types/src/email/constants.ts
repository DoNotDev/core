// packages/core/types/src/email/constants.ts

/**
 * @fileoverview Email Constants
 * @description Provider IDs, error codes, and defaults for email feature.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

/** Supported email providers */
export const EMAIL_PROVIDERS = {
  RESEND: 'resend',
} as const;

/** Email error codes */
export const EMAIL_ERROR_CODES = {
  UNKNOWN: 'unknown',
  UNAUTHENTICATED: 'unauthenticated',
  INVALID_REQUEST: 'invalid_request',
  PROVIDER_ERROR: 'provider_error',
  TEMPLATE_NOT_FOUND: 'template_not_found',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  MISSING_API_KEY: 'missing_api_key',
} as const;
