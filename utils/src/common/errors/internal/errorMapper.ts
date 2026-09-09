// packages/core/utils/src/common/errors/internal/errorMapper.ts

/**
 * @fileoverview Error mapping module
 * @description Maps errors from various sources to standardized DoNotDevError format
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import { FIREBASE_ERROR_MAP } from '@donotdev/types';
import type { ErrorCode, EntityHookErrors, ErrorSource } from '@donotdev/types';

import { DoNotDevError } from '../doNotDevError';
import {
  createErrorHandler,
  commonErrorCodeMappings,
} from './serviceErrorHandler';
import type { ErrorHandlerFunction } from './serviceErrorHandler';

// -----------------------------------------------------------------------------
// Standard error messages for all error codes
// -----------------------------------------------------------------------------

/**
 * Default error messages for standard error codes
 * These provide a fallback when no specific message is available
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  'already-exists': 'The resource already exists.',
  cancelled: 'The operation was cancelled.',
  'deadline-exceeded': 'The operation timed out.',
  DELETE_ACCOUNT_REQUIRES_SERVER:
    'Account deletion requires a server endpoint. Configure a callable provider or deploy a delete-account Edge Function.',
  internal: 'An internal error occurred.',
  'invalid-argument': 'Invalid argument provided.',
  'not-found': 'The requested resource was not found.',
  'permission-denied': 'You do not have permission to perform this action.',
  'rate-limit-exceeded': 'Too many requests. Please try again later.',
  timeout: 'The operation timed out.',
  unauthenticated: 'Authentication is required for this action.',
  unavailable: 'The service is currently unavailable.',
  unimplemented: 'This feature is not implemented.',
  unknown: 'An unknown error occurred.',
  'validation-failed': 'Validation failed.',
};

// -----------------------------------------------------------------------------
// Error mapping configurations
// -----------------------------------------------------------------------------

// HTTP status code to error code mapping
const HTTP_STATUS_CODE_MAPPING: Record<number, ErrorCode> = {
  400: 'invalid-argument',
  401: 'unauthenticated',
  403: 'permission-denied',
  404: 'not-found',
  409: 'already-exists',
  422: 'validation-failed',
  429: 'rate-limit-exceeded',
  500: 'internal',
  501: 'unimplemented',
  502: 'unavailable',
  503: 'unavailable',
  504: 'timeout',
};

// Map of entity error types to standard error codes
const ENTITY_ERROR_MAPPING: Record<EntityHookErrors, ErrorCode> = {
  INTERNAL_ERROR: 'internal',
  VALIDATION_ERROR: 'validation-failed',
  PERMISSION_DENIED: 'permission-denied',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  NETWORK_ERROR: 'unavailable',
};

// -----------------------------------------------------------------------------
// Error Handler Configurations
// -----------------------------------------------------------------------------

/**
 * Configuration registry for all error handlers
 * This centralized approach ensures consistent handling
 */
const ERROR_HANDLERS: Record<ErrorSource, ErrorHandlerConfig> = {
  // Auth error configuration
  auth: {
    errorSource: 'auth',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: 'An authentication error occurred',
    errorCodeMapping: {
      // Authentication errors
      'auth/user-not-found': 'not-found',
      'auth/wrong-password': 'invalid-argument',
      'auth/email-already-in-use': 'already-exists',
      'auth/weak-password': 'validation-failed',
      'auth/invalid-email': 'validation-failed',
      'auth/account-exists-with-different-credential': 'already-exists',
      'auth/credential-already-in-use': 'already-exists',
      'auth/requires-recent-login': 'unauthenticated',
      'auth/user-disabled': 'permission-denied',
      'auth/too-many-requests': 'rate-limit-exceeded',
      'auth/network-request-failed': 'unavailable',
      'auth/popup-blocked': 'unavailable',
      'auth/popup-closed-by-user': 'invalid-argument',
      'auth/cancelled-popup-request': 'invalid-argument',
      'auth/operation-not-allowed': 'unimplemented',
      'auth/invalid-credential': 'invalid-argument',
      'auth/invalid-verification-code': 'invalid-argument',
      'auth/captcha-check-failed': 'validation-failed',
      'auth/invalid-phone-number': 'validation-failed',
      'auth/missing-phone-number': 'invalid-argument',
      'auth/quota-exceeded': 'rate-limit-exceeded',
      'auth/timeout': 'unavailable',
      'auth/web-storage-unsupported': 'unavailable',
      'auth/unauthorized-domain': 'permission-denied',
      'auth/internal-error': 'internal',
      'auth/invalid-action-code': 'invalid-argument',
      'auth/invalid-continue-uri': 'invalid-argument',
      'auth/missing-continue-uri': 'invalid-argument',
      'auth/missing-ios-bundle-id': 'invalid-argument',
      'auth/missing-android-pkg-name': 'invalid-argument',
      'auth/unauthorized-continue-uri': 'permission-denied',
      'auth/invalid-dynamic-link-domain': 'invalid-argument',
      'auth/invalid-tenant-id': 'invalid-argument',
      'auth/tenant-id-mismatch': 'invalid-argument',
      'auth/provider-already-linked': 'already-exists',
      'auth/invalid-persistence-type': 'invalid-argument',
      'auth/unsupported-persistence-type': 'unimplemented',
      'auth/invalid-provider': 'invalid-argument',
      'auth/invalid-client-id': 'invalid-argument',
      'oauth/unauthorized-app': 'permission-denied',
      'auth/provider-not-enabled': 'unimplemented',
      'auth/unknown-provider': 'invalid-argument',
      'auth/missing-provider': 'invalid-argument',
      'auth/no-user-signed-in': 'unauthenticated',
      DELETE_ACCOUNT_REQUIRES_SERVER: 'DELETE_ACCOUNT_REQUIRES_SERVER',
      // Include common Firebase error mappings
      ...commonErrorCodeMappings,
    },
    friendlyMessageMapping: {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password':
        'Password is too weak. It should be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/account-exists-with-different-credential':
        'An account already exists with the same email but different sign-in method.',
      'auth/credential-already-in-use':
        'This credential is already associated with a different user account.',
      'auth/requires-recent-login':
        'This operation requires you to sign in again for security reasons.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests':
        'Too many sign-in attempts. Please try again later.',
      'auth/network-request-failed':
        'Network connection error. Please check your internet connection.',
      'auth/popup-blocked':
        'Sign-in popup was blocked. Please allow popups for this site.',
      'auth/popup-closed-by-user':
        'Sign-in popup was closed before completion.',
      'auth/operation-not-allowed':
        'This sign-in method is not enabled for this project.',
      'auth/internal-error':
        'An internal authentication error occurred. Please try again.',
      'auth/invalid-action-code':
        'The action code is invalid. This can happen if the code is malformed, expired, or has already been used.',
      'auth/invalid-continue-uri': 'The continue URL provided is invalid.',
      'auth/missing-continue-uri':
        'A continue URL must be provided in the request.',
      'auth/missing-ios-bundle-id':
        'An iOS Bundle ID must be provided in the request.',
      'auth/missing-android-pkg-name':
        'An Android package name must be provided in the request.',
      'auth/unauthorized-continue-uri':
        'The domain of the continue URL is not allowlisted.',
      'auth/invalid-dynamic-link-domain':
        'The provided dynamic link domain is not authorized.',
      'auth/invalid-tenant-id': 'The provided tenant ID is invalid.',
      'auth/tenant-id-mismatch':
        'The tenant ID of the provider does not match the tenant ID of the current user.',
      'auth/provider-already-linked':
        'This authentication provider is already linked to the account.',
      'auth/invalid-persistence-type':
        'The specified persistence type is invalid.',
      'auth/unsupported-persistence-type':
        'The current environment does not support the specified persistence type.',
      'auth/invalid-provider':
        'The specified authentication provider is invalid.',
      'auth/invalid-client-id':
        'The authentication client ID provided is invalid.',
      'oauth/unauthorized-app':
        'This application is not authorized to use OAuth with the provided client ID.',
      'auth/provider-not-enabled':
        'This authentication provider is not enabled.',
      'auth/unknown-provider': 'Unknown authentication provider.',
      'auth/missing-provider':
        'No authentication provider specified in the request.',
      'auth/no-user-signed-in': 'No user is currently signed in.',
    },
  },

  // OAuth error configuration
  oauth: {
    errorSource: 'oauth',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: 'An OAuth error occurred',
    errorCodeMapping: {
      'oauth/invalid-request': 'invalid-argument',
      'oauth/invalid-client': 'invalid-argument',
      'oauth/invalid-grant': 'invalid-argument',
      'oauth/unauthorized-client': 'permission-denied',
      'oauth/unsupported-grant-type': 'unimplemented',
      'oauth/invalid-scope': 'invalid-argument',
      'oauth/insufficient-scope': 'permission-denied',
      'oauth/invalid-token': 'unauthenticated',
      'oauth/expired-token': 'unauthenticated',
      'oauth/redirect-uri-mismatch': 'invalid-argument',
      'oauth/access-denied': 'permission-denied',
      'oauth/server-error': 'unavailable',
      'oauth/temporarily-unavailable': 'unavailable',
      'oauth/state-mismatch': 'invalid-argument',
      'oauth/invalid-callback': 'invalid-argument',
      'oauth/client-secret-mismatch': 'permission-denied',
      'oauth/unauthorized-scope': 'permission-denied',
      'oauth/rate-limit-exceeded': 'rate-limit-exceeded',
      'oauth/token-expired': 'unauthenticated',
      'oauth/missing-token': 'invalid-argument',
      'oauth/invalid-code': 'invalid-argument',
      'oauth/invalid-redirect': 'invalid-argument',
      'oauth/provider-error': 'unavailable',
      'oauth/invalid-response': 'unavailable',
      'oauth/unauthorized-access': 'permission-denied',
      ...commonErrorCodeMappings,
    },
    friendlyMessageMapping: {
      'oauth/invalid-request':
        'The OAuth request was invalid or missing parameters.',
      'oauth/invalid-client': 'Client authentication failed.',
      'oauth/invalid-grant': 'The provided authorization grant is invalid.',
      'oauth/unauthorized-client':
        'The client is not authorized to use this grant type.',
      'oauth/unsupported-grant-type':
        'The requested grant type is not supported.',
      'oauth/invalid-scope': 'The requested scope is invalid or unknown.',
      'oauth/insufficient-scope':
        'The token does not have the required scope for this resource.',
      'oauth/invalid-token': 'The access token is invalid.',
      'oauth/expired-token': 'The access token has expired.',
      'oauth/redirect-uri-mismatch':
        'The redirect URI does not match the registered URI.',
      'oauth/access-denied': 'The resource owner denied the request.',
      'oauth/server-error':
        'The authorization server encountered an unexpected error.',
      'oauth/temporarily-unavailable':
        'The authorization server is temporarily unavailable.',
      'oauth/state-mismatch':
        'Invalid state parameter. This could be a security issue.',
      'oauth/invalid-callback':
        'The callback URL is invalid or not registered.',
      'oauth/client-secret-mismatch':
        'The client secret does not match the registered secret.',
      'oauth/unauthorized-scope':
        'The requested scope is not authorized for this client.',
      'oauth/rate-limit-exceeded': 'Too many requests. Please try again later.',
      'oauth/token-expired':
        'The OAuth token has expired and needs to be refreshed.',
      'oauth/missing-token': 'No OAuth token was provided in the request.',
      'oauth/invalid-code': 'The authorization code is invalid or expired.',
      'oauth/invalid-redirect':
        'The redirect URL is invalid or does not match the registered redirect URL.',
      'oauth/provider-error': 'The OAuth provider returned an error.',
      'oauth/invalid-response':
        'The response from the OAuth provider was invalid.',
      'oauth/unauthorized-access': 'Unauthorized access to OAuth resources.',
    },
  },

  // API error configuration
  api: {
    errorSource: 'api',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: 'API request failed',

    // Convert HTTP status code mapping to string keys for the handler
    errorCodeMapping: Object.fromEntries(
      Object.entries(HTTP_STATUS_CODE_MAPPING).map(([key, value]) => [
        key,
        value,
      ])
    ),

    friendlyMessageMapping: {}, // We'll use DEFAULT_ERROR_MESSAGES instead of duplicating

    extractErrorCode: (error: unknown): string | undefined => {
      if (typeof error !== 'object' || error === null) return undefined;

      // Extract status code if available
      let statusCode: number | undefined;

      // Axios-like error
      if (
        'response' in error &&
        (error as any).response &&
        'status' in (error as any).response
      ) {
        statusCode = (error as any).response.status;
      }
      // Fetch-like error
      else if ('status' in error && typeof (error as any).status === 'number') {
        statusCode = (error as any).status;
      }

      return statusCode?.toString();
    },

    processMetadata: (error: unknown): Record<string, any> => {
      const metadata: Record<string, any> = { originalError: error };

      if (typeof error !== 'object' || error === null) return metadata;

      // Extract status code and response data if available
      if ('response' in error && (error as any).response) {
        if ('status' in (error as any).response) {
          metadata.statusCode = (error as any).response.status;
        }
        if ('data' in (error as any).response) {
          metadata.responseData = (error as any).response.data;
        }
      } else if ('status' in error) {
        metadata.statusCode = (error as any).status;
      }

      return metadata;
    },
  },

  // Firebase error configuration
  firebase: {
    errorSource: 'firebase',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: 'A Firebase error occurred',
    errorCodeMapping: commonErrorCodeMappings,
    friendlyMessageMapping: {}, // Use default messages
  },

  // UI error configuration
  ui: {
    errorSource: 'ui',
    defaultErrorCode: 'internal',
    defaultErrorMessage: DEFAULT_ERROR_MESSAGES['internal'],
    errorCodeMapping: {},
    friendlyMessageMapping: {},

    processMetadata: (error: unknown): Record<string, any> => {
      const metadata: Record<string, any> = { originalError: error };

      if (
        typeof error === 'object' &&
        error !== null &&
        'componentStack' in error
      ) {
        metadata.componentStack = (error as any).componentStack;
      }

      return metadata;
    },
  },

  // Validation error configuration - used only as fallback,
  // as validation errors have specialized handling
  validation: {
    errorSource: 'validation',
    defaultErrorCode: 'validation-failed',
    defaultErrorMessage: DEFAULT_ERROR_MESSAGES['validation-failed'],
    errorCodeMapping: {},
    friendlyMessageMapping: {},
  },

  // Entity error configuration - used only as fallback,
  // as entity errors have specialized handling
  entity: {
    errorSource: 'entity',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: 'An entity operation error occurred',
    errorCodeMapping: {},
    friendlyMessageMapping: {},
  },

  // Unknown error configuration
  unknown: {
    errorSource: 'unknown',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: DEFAULT_ERROR_MESSAGES['unknown'],
    errorCodeMapping: {
      TypeError: 'invalid-argument',
      ReferenceError: 'internal',
      RangeError: 'invalid-argument',
    },
    friendlyMessageMapping: {},

    extractErrorCode: (error: unknown): string | undefined => {
      if (error instanceof Error) {
        return error.name;
      }
      return undefined;
    },
  },
};

// Interface for error handler configs to ensure type safety
interface ErrorHandlerConfig {
  errorSource: ErrorSource;
  defaultErrorCode: ErrorCode;
  defaultErrorMessage: string;
  errorCodeMapping: Record<string, ErrorCode>;
  friendlyMessageMapping: Record<string, string>;
  extractErrorCode?: (error: unknown) => string | undefined;
  extractErrorMessage?: (error: unknown) => string | undefined;
  processMetadata?: (error: unknown) => Record<string, any>;
}

// -----------------------------------------------------------------------------
// Specialized handlers for complex error types
// -----------------------------------------------------------------------------

/**
 * Specialized handler for validation errors (Valibot)
 */
const handleValidationError: ErrorHandlerFunction = (
  error: unknown
): DoNotDevError => {
  if (!(error instanceof v.ValiError)) {
    // Fallback to standard handler if not a Valibot error
    return createErrorHandler(ERROR_HANDLERS.validation)(error);
  }

  // Valibot: ValiError uses 'issues' property
  // TypeScript knows error is ValiError here, so we can safely access .issues
  return new DoNotDevError(
    DEFAULT_ERROR_MESSAGES['validation-failed'],
    'validation-failed',
    {
      details: {
        validationErrors: error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        originalError: error,
      },
      source: 'validation',
    }
  );
};

/**
 * Specialized handler for entity errors
 */
const handleEntityError: ErrorHandlerFunction = (
  error: unknown
): DoNotDevError => {
  // Case 1: Error with 'type' property matching EntityHookErrors
  if (
    error instanceof Error &&
    'type' in error &&
    typeof (error as any).type === 'string' &&
    (error as any).type in ENTITY_ERROR_MAPPING
  ) {
    const entityError = error as { type: EntityHookErrors; message: string };
    const errorCode = ENTITY_ERROR_MAPPING[entityError.type] || 'unknown';

    return new DoNotDevError(
      entityError.message || DEFAULT_ERROR_MESSAGES[errorCode],
      errorCode,
      {
        details: { originalError: error },
        source: 'entity',
      }
    );
  }

  // Case 2: Firebase error with code in FIREBASE_ERROR_MAP
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    FIREBASE_ERROR_MAP[(error as any).code]
  ) {
    const firebaseError = error as { code: string; message: string };
    const mappedError = FIREBASE_ERROR_MAP[firebaseError.code];
    if (mappedError) {
      const errorCode = ENTITY_ERROR_MAPPING[mappedError.type] || 'unknown';

      return new DoNotDevError(
        mappedError.message || DEFAULT_ERROR_MESSAGES[errorCode],
        errorCode,
        {
          details: {
            originalCode: firebaseError.code,
            originalError: error,
          },
          source: 'entity',
        }
      );
    }
  }

  // Fallback to standard handler
  return createErrorHandler(ERROR_HANDLERS.entity)(error);
};

// -----------------------------------------------------------------------------
// Create error handlers from configurations
// -----------------------------------------------------------------------------

/**
 * Error handler registry
 * Create all standard handlers using the factory
 */
const ERROR_HANDLER_REGISTRY: Record<ErrorSource, ErrorHandlerFunction> = {
  auth: createErrorHandler(ERROR_HANDLERS.auth),
  oauth: createErrorHandler(ERROR_HANDLERS.oauth),
  api: createErrorHandler(ERROR_HANDLERS.api),
  firebase: createErrorHandler(ERROR_HANDLERS.firebase),
  ui: createErrorHandler(ERROR_HANDLERS.ui),
  validation: handleValidationError, // Use specialized handler
  entity: handleEntityError, // Use specialized handler
  unknown: createErrorHandler(ERROR_HANDLERS.unknown),
};

// -----------------------------------------------------------------------------
// Core error mapper function
// -----------------------------------------------------------------------------

/**
 * Maps an error from any source to a standardized DoNotDevError
 *
 * This is the central error mapping function that routes errors to the appropriate
 * handler based on the detected source.
 *
 * @param error - The original error
 * @param source - The detected error source
 * @param userMessage - Optional user-friendly message
 * @returns A standardized DoNotDevError
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function mapToDoNotDevError(
  error: unknown,
  source: ErrorSource,
  userMessage?: string
): DoNotDevError {
  // If already a DoNotDevError, just return it
  if (error instanceof DoNotDevError) {
    return error;
  }

  // Use the appropriate handler from the registry
  const handler =
    ERROR_HANDLER_REGISTRY[source] || ERROR_HANDLER_REGISTRY.unknown;
  return handler(error, userMessage);
}
