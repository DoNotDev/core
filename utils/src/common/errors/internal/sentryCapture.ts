// packages/core/utils/src/common/errors/internal/sentryCapture.ts

/**
 * @fileoverview Sentry integration module
 * @description Handles capturing errors to Sentry with appropriate context.
 * Works universally on both client and server - uses globalThis.Sentry which
 * is set by both @sentry/react and @sentry/node when initialized.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ErrorSource } from '@donotdev/types';

import type { DoNotDevError } from '../doNotDevError';

/** Scope API used from `Sentry.withScope` (common to @sentry/react and @sentry/node). */
interface SentryScopeLike {
  setTag(key: string, value: string): void;
  setExtra(key: string, value: unknown): void;
  setUser(user: { id?: unknown; email?: unknown }): void;
}

/** Subset of the global Sentry SDK used here (common to @sentry/react and @sentry/node). */
interface SentryGlobalLike {
  withScope(callback: (scope: SentryScopeLike) => void): void;
  captureException(error: unknown): void;
}

/**
 * Captures an error to Sentry with additional context
 * Works on both client (@sentry/react) and server (@sentry/node)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param error - The error to capture
 * @param source - The detected error source
 * @param context - Additional context to include
 */
export function captureErrorToSentry(
  error: DoNotDevError,
  source: ErrorSource,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- why: exported signature; narrowing it is a breaking change for importers (deferred to a major, any-audit 2026-11-11)
  context: Record<string, any> = {}
): void {
  // Check if Sentry is available (works for both browser AND Node Sentry)
  // why: `globalThis.Sentry` is set at runtime by the Sentry SDK and is not declared on globalThis
  const Sentry = (globalThis as { Sentry?: SentryGlobalLike }).Sentry;
  if (!Sentry) {
    return;
  }

  // Capture with additional context
  Sentry.withScope((scope) => {
    // Set error source as a tag for easy filtering
    scope.setTag('errorSource', source);

    // Set error code as a tag
    scope.setTag('errorCode', error.code);

    // Add error details as extra context
    if (error.details) {
      Object.entries(error.details).forEach(([key, value]) => {
        // Skip large or circular objects
        if (typeof value !== 'function' && key !== 'originalError') {
          try {
            scope.setExtra(key, value);
          } catch (e) {
            // If can't serialize, just add type info
            scope.setExtra(key, `[${typeof value}]`);
          }
        }
      });
    }

    // Add custom context provided by caller
    Object.entries(context).forEach(([key, value]) => {
      if (typeof value !== 'function') {
        try {
          scope.setExtra(`context.${key}`, value);
        } catch (e) {
          scope.setExtra(`context.${key}`, `[${typeof value}]`);
        }
      }
    });

    // If the error has user information, add it
    if (error.details?.userId || context.userId) {
      scope.setUser({
        id: error.details?.userId || context.userId,
        email: error.details?.userEmail || context.userEmail,
      });
    }

    // Capture the exception
    Sentry.captureException(error);
  });
}
