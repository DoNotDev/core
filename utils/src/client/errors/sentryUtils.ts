// packages/core/utils/src/client/errors/sentryUtils.ts

/**
 * @fileoverview Client-side Sentry integration utilities
 * @description Handles Sentry error reporting for React applications
 *
 * Sentry Integration:
 * - Uses @sentry/react for React error tracking
 * - Automatically detects if Sentry is installed
 * - Works with or without Sentry (graceful degradation)
 * - Consumer must install @sentry/react and set SENTRY_DSN env var
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { getPlatformEnvVar } from '../appConfig';

/**
 * Client-side Sentry integration
 * Uses @sentry/react for React error tracking
 */
let sentryEnabled = false;
let sentryClient: any = null;

/**
 * Initialize Sentry if configured
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns Promise<boolean> - true if Sentry was initialized, false otherwise
 */
export async function initSentry(): Promise<boolean> {
  try {
    const sentryDsn = getPlatformEnvVar('SENTRY_DSN') || '';

    if (!sentryDsn) {
      return false;
    }

    // Dynamic import to avoid build errors if @sentry/react is not installed
    const { init, captureException, captureMessage } =
      await import('@sentry/react');

    // Use proper environment detection
    const mode = getPlatformEnvVar('MODE') || 'development';

    init({
      dsn: sentryDsn,
      environment: mode,
      beforeSend(event) {
        const msg = event.exception?.values?.[0]?.value || '';
        const stack = event.exception?.values?.[0]?.stacktrace?.frames || [];
        // Browser extension noise — none of these come from app code
        if (
          msg.includes('Object Not Found Matching Id') || // Kaspersky
          msg.includes('Cannot redefine property: googletag') || // Google Publisher Tag / ad blockers
          msg.includes('vid_mate_check') || // VidMate
          msg.includes('ucapi.ucweb.com') || // UC Browser
          msg.includes('goog_') || // Google Translate widget
          msg.includes('ResizeObserver loop') || // benign browser warning, not a real error
          msg.includes('Loading chunk') || // network flake, not app bug
          msg.includes('ChunkLoadError') || // same
          msg.includes('tabs:outgoing') || // cross-tab messaging extension (Honey, etc.)
          stack.some((f: any) =>
            /^(chrome|moz|safari)-extension:/.test(f.filename || '')
          )
        )
          return null;
        return event;
      },
    });

    // Suppress browser extension console spam (Honey, PayPal, Capital One Shopping).
    // These extensions inject cross-tab BroadcastChannel code that throws when no
    // listener exists. beforeSend filters Sentry, but the console.error still fires.
    // return true from window.onerror prevents the browser's default console output.
    const originalOnError = window.onerror;
    window.onerror = (msg, source, line, col, error) => {
      if (typeof msg === 'string' && msg.includes('tabs:outgoing')) return true;
      if (originalOnError)
        return originalOnError.call(window, msg, source, line, col, error);
      return false;
    };

    sentryClient = { captureException, captureMessage };
    sentryEnabled = true;
    return true;
  } catch (error) {
    // Sentry not available, continue without it
    sentryEnabled = false;
    return false;
  }
}

/**
 * Capture error with Sentry
 * @param error Error to capture
 * @param context Additional context
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  if (sentryEnabled && sentryClient) {
    sentryClient.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture message with Sentry
 * @param message Message to capture
 * @param level Log level
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (sentryEnabled && sentryClient) {
    sentryClient.captureMessage(message, level);
  }
}

/**
 * Safely cleans up Sentry resources.
 */
export async function cleanupSentry(): Promise<void> {
  try {
    // Use type assertion to satisfy TypeScript
    const sentrySdk = (globalThis as any).Sentry;
    if (sentrySdk) {
      const client = sentrySdk.getClient();
      if (client) {
        await client.close();
      }
    }
  } catch (error) {
    console.error('Error cleaning up Sentry:', error);
  }
}
