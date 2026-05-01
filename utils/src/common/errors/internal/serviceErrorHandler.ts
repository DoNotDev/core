// packages/core/utils/src/common/errors/internal/serviceErrorHandler.ts

/**
 * @fileoverview Standard error handling factory
 * @description Creates error handlers that map any source error to DoNotDevError format
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ErrorCode, ErrorSource } from '@donotdev/types';

import { DoNotDevError } from '../doNotDevError';

/**
 * Type for error handler functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ErrorHandlerFunction = (
  error: unknown,
  userMessage?: string
) => DoNotDevError;

/**
 * Core configuration for error handlers
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ErrorHandlerConfig {
  // Basic identification
  errorSource: ErrorSource;
  defaultErrorCode: ErrorCode;
  defaultErrorMessage: string;

  // Error mappings
  errorCodeMapping?: Record<string, ErrorCode>;
  friendlyMessageMapping?: Record<string, string>;

  // Optional customization functions
  extractErrorCode?: (error: unknown) => string | undefined;
  extractErrorMessage?: (error: unknown) => string | undefined;
  processMetadata?: (error: unknown) => Record<string, any>;
}

/**
 * Creates an error handler that converts any type of error to DoNotDevError format
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param config Configuration for the error handler
 * @returns A function that converts errors to DoNotDevErrors
 */
export function createErrorHandler(
  config: ErrorHandlerConfig
): ErrorHandlerFunction {
  return (error: unknown, userMessage?: string): DoNotDevError => {
    // If already a DoNotDevError, return as is
    if (error instanceof DoNotDevError) {
      return error;
    }

    // Handle non-object errors
    if (typeof error !== 'object' || error === null) {
      const message =
        typeof error === 'string' ? error : config.defaultErrorMessage;
      return new DoNotDevError(
        userMessage || message,
        config.defaultErrorCode,
        {
          details: { originalError: error },
          source: config.errorSource,
        }
      );
    }

    // Extract error code if available
    let errorCode: string | undefined;
    if (config.extractErrorCode) {
      errorCode = config.extractErrorCode(error);
    } else if ('code' in error && typeof (error as any).code === 'string') {
      errorCode = (error as any).code;
    }

    // Map to standard error code
    let standardErrorCode: ErrorCode = config.defaultErrorCode;
    if (
      errorCode &&
      config.errorCodeMapping &&
      errorCode in config.errorCodeMapping
    ) {
      standardErrorCode = config.errorCodeMapping[errorCode] as ErrorCode;
    }

    // Extract error message if available
    let message: string | undefined;
    if (config.extractErrorMessage) {
      message = config.extractErrorMessage(error);
    } else if (
      'message' in error &&
      typeof (error as any).message === 'string'
    ) {
      message = (error as any).message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    // Use friendly message if available
    if (
      errorCode &&
      config.friendlyMessageMapping &&
      errorCode in config.friendlyMessageMapping
    ) {
      message = config.friendlyMessageMapping[errorCode];
    }

    // Fall back to default message if needed
    if (!message) {
      message = config.defaultErrorMessage;
    }

    // Process metadata if available
    let metadata: Record<string, any>;
    if (config.processMetadata) {
      metadata = config.processMetadata(error);
    } else {
      metadata = { originalError: error };
      if (errorCode) {
        metadata.originalCode = errorCode;
      }
    }

    // Always include original error
    if (!('originalError' in metadata)) {
      metadata.originalError = error;
    }

    return new DoNotDevError(userMessage || message, standardErrorCode, {
      details: metadata,
      source: config.errorSource,
    });
  };
}

/**
 * Common error code mappings for most services
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const commonErrorCodeMappings: Record<string, ErrorCode> = {
  'permission-denied': 'permission-denied',
  unavailable: 'unavailable',
  'not-found': 'not-found',
  'already-exists': 'already-exists',
  unauthenticated: 'unauthenticated',
  'invalid-argument': 'invalid-argument',
  'failed-precondition': 'invalid-argument',
  'resource-exhausted': 'rate-limit-exceeded',
  'deadline-exceeded': 'timeout',
  cancelled: 'cancelled',
  'not-implemented': 'unimplemented',
};
