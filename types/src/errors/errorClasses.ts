// packages/core/types/src/errors/errorClasses.ts

/**
 * @fileoverview Error Types Used Throughout the DoNotDev Platform
 * @description Centralized definition of error types to ensure consistency across packages. Defines standard error codes, error classes, and error handling types.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Error types used throughout the DoNotDev platform
 * Single source of truth: const objects + derived types.
 */

/**
 * Standard error codes used within the DoNotDev platform.
 * Mapped to HTTP status codes or used for specific error handling logic.
 */
export const ERROR_CODES = {
  ALREADY_EXISTS: 'already-exists',
  CANCELLED: 'cancelled',
  DEADLINE_EXCEEDED: 'deadline-exceeded',
  DELETE_ACCOUNT_REQUIRES_SERVER: 'DELETE_ACCOUNT_REQUIRES_SERVER',
  INTERNAL: 'internal',
  INVALID_ARGUMENT: 'invalid-argument',
  NOT_FOUND: 'not-found',
  PERMISSION_DENIED: 'permission-denied',
  RATE_LIMIT_EXCEEDED: 'rate-limit-exceeded',
  TIMEOUT: 'timeout',
  UNAUTHENTICATED: 'unauthenticated',
  UNAVAILABLE: 'unavailable',
  UNIMPLEMENTED: 'unimplemented',
  UNKNOWN: 'unknown',
  VALIDATION_FAILED: 'validation-failed',
} as const;

/** Standardized error code derived from ERROR_CODES constant. */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Severity levels for error notifications and logging
 */
export const ERROR_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success',
} as const;

/** Error severity level for notifications and logging. */
export type ErrorSeverity =
  (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY];

/**
 * Error types used in entity hooks
 */
export const ENTITY_HOOK_ERRORS = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

/** Error type for entity hook operations (CRUD mutations). */
export type EntityHookErrors =
  (typeof ENTITY_HOOK_ERRORS)[keyof typeof ENTITY_HOOK_ERRORS];

/**
 * Maps Firebase error codes to entity hook error types
 * Used for consistent error handling across the platform
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const FIREBASE_ERROR_MAP: Record<
  string,
  { type: EntityHookErrors; message: string }
> = {
  [ERROR_CODES.PERMISSION_DENIED]: {
    type: ENTITY_HOOK_ERRORS.PERMISSION_DENIED,
    message: 'You do not have permission to perform this action',
  },
  [ERROR_CODES.NOT_FOUND]: {
    type: ENTITY_HOOK_ERRORS.NOT_FOUND,
    message: 'The requested resource was not found',
  },
  [ERROR_CODES.ALREADY_EXISTS]: {
    type: ENTITY_HOOK_ERRORS.ALREADY_EXISTS,
    message: 'The resource already exists',
  },
  [ERROR_CODES.INVALID_ARGUMENT]: {
    type: ENTITY_HOOK_ERRORS.VALIDATION_ERROR,
    message: 'Invalid argument provided',
  },
};

/**
 * Error class for standardized entity hook errors
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class EntityHookError extends Error {
  public type: EntityHookErrors;
  public originalError?: unknown;

  constructor(
    type: EntityHookErrors,
    message: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'EntityHookError';
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * Error source types for tracking where errors originate
 */
export const ERROR_SOURCE = {
  AUTH: 'auth',
  OAUTH: 'oauth',
  FIREBASE: 'firebase',
  API: 'api',
  VALIDATION: 'validation',
  ENTITY: 'entity',
  UI: 'ui',
  UNKNOWN: 'unknown',
} as const;

/** Origin of an error for tracking and reporting. */
export type ErrorSource = (typeof ERROR_SOURCE)[keyof typeof ERROR_SOURCE];

/**
 * Standardized error class for the DoNotDev platform
 * Single source of truth with optional fields for all use cases
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class DoNotDevError extends Error {
  /** The error code categorizing this error */
  public readonly code: ErrorCode;

  /** Optional additional details or context about the error */
  public readonly details?: Record<string, any>;

  /** The source system where the error originated */
  public readonly source?: ErrorSource;

  /** Original error if this is wrapping another error */
  public readonly originalError?: Error;

  /** Additional context for the error */
  public readonly context?: Record<string, any>;

  /** Whether this error should be displayed to the user */
  public readonly displayable?: boolean;

  /** Flag to track if a user message has been provided */
  public readonly userMessageProvided?: boolean;

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL,
    options?: {
      details?: Record<string, any>;
      source?: ErrorSource;
      originalError?: Error;
      context?: Record<string, any>;
      displayable?: boolean;
      userMessageProvided?: boolean;
    }
  ) {
    super(message);
    Object.setPrototypeOf(this, DoNotDevError.prototype);
    this.code = code;
    this.details = options?.details;
    this.source = options?.source;
    this.originalError = options?.originalError;
    this.context = options?.context;
    this.displayable = options?.displayable ?? true;
    this.userMessageProvided = options?.userMessageProvided;
    this.name = this.constructor.name;

    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }

  public toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }

  public toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      source: this.source,
      originalError: this.originalError,
      context: this.context,
      displayable: this.displayable,
      userMessageProvided: this.userMessageProvided,
    };
  }
}
