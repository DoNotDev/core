// packages/core/utils/src/common/errors/handleError.ts

/**
 * @fileoverview Universal error handler for DoNotDev applications
 * @description Centralized error handling with logging, reporting, and user notifications.
 * Works on both client and server environments.
 *
 * This module provides a comprehensive error handling system that ensures
 * consistent error management across the entire application. It handles
 * error detection, mapping, logging, reporting, and user notifications.
 *
 * **Key Features:**
 * - Universal error handling for any error type
 * - Automatic error source detection and mapping
 * - Centralized logging and reporting (Sentry integration)
 * - User-friendly error notifications (client-only, graceful fallback)
 * - Context preservation and debugging information
 * - Configurable error handling behavior
 *
 * **Error Flow:**
 * 1. Detect error source and type
 * 2. Map to standardized DoNotDevError
 * 3. Log error with context information
 * 4. Report to external services (Sentry)
 * 5. Show user notification (optional, client-only)
 * 6. Return standardized error object
 *
 * **Usage Pattern:**
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   throw handleError(error, {
 *     userMessage: 'Operation failed',
 *     context: { operation: 'dataSync' }
 *   });
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ErrorCode } from '@donotdev/types';

import { DoNotDevError } from './doNotDevError';
import { detectErrorSource } from './internal/errorDetection';
import { mapToDoNotDevError } from './internal/errorMapper';
import { captureErrorToSentry } from './internal/sentryCapture';

/**
 * Simple development mode check
 * Inlined to avoid circular dependencies with client/appConfig
 */
function isDev(): boolean {
  // Check Vite's DEV flag first
  // @ts-ignore - import.meta.env available in Vite, guarded at runtime
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.DEV === true) {
      return true;
    }
    // @ts-ignore
    if (import.meta.env.MODE && import.meta.env.MODE !== 'production') {
      return true;
    }
  }

  // Check process.env for Node.js/Next.js
  if (typeof process !== 'undefined' && process.env) {
    const env = (process.env.NODE_ENV || 'development').toLowerCase();
    return env !== 'production';
  }

  return false; // Default to production if environment unknown
}

/** Options for the handleError utility. */
export interface HandleErrorOptions {
  // User-friendly message to display
  userMessage?: string;

  // Additional context details to include with the error
  context?: Record<string, any>;

  // Whether to automatically log the error (default: true)
  log?: boolean;

  // Whether to automatically send to Sentry (default: true)
  reportToSentry?: boolean;

  // Whether to add to error store for UI notification (default: true)
  showNotification?: boolean;

  // Severity level for the error/logging (default: 'error')
  severity?: 'error' | 'warning' | 'info' | 'success';

  // Timeout for the notification (default: 5000)
  notificationTimeout?: number;
}

/**
 * Universal error handler for DoNotDev applications
 *
 * Handles errors from any source, converting them to standardized DoNotDevError
 * objects, logging appropriately, and optionally adding to UI notification system.
 *
 * @param error - The original error from any source
 * @param optionsOrMessage - Optional configuration or user-friendly message
 * @returns Standardized DoNotDevError
 *
 * @example
 * try {
 *   await fetchData();
 * } catch (error) {
 *   throw handleError(error, 'Failed to fetch data');
 * }
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function handleError(
  error: unknown,
  optionsOrMessage?: HandleErrorOptions | string
): DoNotDevError {
  // Process options
  const options: HandleErrorOptions =
    typeof optionsOrMessage === 'string'
      ? { userMessage: optionsOrMessage }
      : optionsOrMessage || {};

  const {
    userMessage,
    context = {},
    log = true,
    reportToSentry = true,
    showNotification = false,
    severity = 'error',
  } = options;

  // Detect the source of the error
  const errorSource = detectErrorSource(error);

  // Convert to standardized DoNotDevError
  let standardError =
    error instanceof DoNotDevError
      ? error
      : mapToDoNotDevError(error, errorSource, userMessage);

  // If user message provided and not already set, only override if original is generic
  if (userMessage && !standardError.userMessageProvided) {
    const isGenericMessage =
      standardError.message.includes('Error') ||
      standardError.message.includes('Failed') ||
      standardError.message.length < 10;

    if (isGenericMessage) {
      // Use userMessage as main message for generic errors
      standardError = new DoNotDevError(userMessage, standardError.code, {
        details: {
          ...standardError.details,
          originalMessage: standardError.message,
        },
        source: errorSource,
        userMessageProvided: true,
      });
    } else {
      // Keep original message, add userMessage as context for specific errors
      standardError = new DoNotDevError(
        standardError.message,
        standardError.code,
        {
          details: {
            ...standardError.details,
            userMessage: userMessage,
          },
          source: errorSource,
          userMessageProvided: true,
        }
      );
    }
  }

  // Log the error if specified
  if (log) {
    const isDevelopment =
      isDev() ||
      (typeof window !== 'undefined' && (window as any).__DNDEV_DEBUG);

    // Basic info to log in all environments
    const logInfo = {
      code: standardError.code,
      message: standardError.message,
      source: errorSource,
    };

    // Choose appropriate console method based on severity
    switch (severity) {
      case 'warning':
        console.warn(
          `[DoNotDev] ${standardError.code}: ${standardError.message}`,
          isDevelopment
            ? { ...logInfo, details: standardError.details }
            : logInfo
        );
        break;
      case 'info':
        console.info(
          `[DoNotDev] ${standardError.code}: ${standardError.message}`,
          isDevelopment
            ? { ...logInfo, details: standardError.details }
            : logInfo
        );
        break;
      case 'success':
        console.log(
          `[DoNotDev] ${standardError.code}: ${standardError.message}`,
          isDevelopment
            ? { ...logInfo, details: standardError.details }
            : logInfo
        );
        break;
      case 'error':
      default:
        console.error(
          `[DoNotDev] ${standardError.code}: ${standardError.message}`,
          isDevelopment
            ? {
                ...logInfo,
                details: standardError.details,
                stack: standardError.stack,
              }
            : logInfo
        );
    }
  }

  // Report to Sentry if enabled
  if (reportToSentry) {
    captureErrorToSentry(standardError, errorSource, context);
  }

  // Show toast notification if specified (client-only)
  // Note: Toast functionality requires client-side code to call showNotification() directly
  // This is intentionally a no-op on server to avoid bundling client dependencies
  if (showNotification && typeof window !== 'undefined') {
    console.warn(
      '[handleError] showNotification requires client-side toast setup'
    );
  }

  // Return the standardized error for further handling if needed
  return standardError;
}

/**
 * Creates a wrapped function that handles errors automatically
 *
 * @param fn - Function to wrap with error handling
 * @param options - Error handling options or user message
 * @returns Wrapped function with error handling
 *
 * @example
 * const safeFetchData = withErrorHandling(fetchData, 'Failed to fetch data');
 * await safeFetchData();
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  options?: HandleErrorOptions | string
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, options);
    }
  };
}

/**
 * Display a notification message (client-only)
 * This is a stub - actual implementation should be in client-side code
 * that imports toast directly from @donotdev/components
 *
 * @param message Message to display
 * @param severity Severity level
 * @param timeout Optional timeout in milliseconds
 * @returns ID of the notification
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function showNotification(
  message: string,
  severity: 'error' | 'warning' | 'info' | 'success' = 'info',
  timeout?: number
): string {
  const id = Date.now().toString();

  // Server-side: no-op
  if (typeof window === 'undefined') {
    return id;
  }

  // Client-side: log warning - consumers should use toast directly
  console.warn(
    '[showNotification] Use toast from @donotdev/components directly for notifications'
  );

  return id;
}
