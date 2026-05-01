'use client';
// packages/core/utils/src/client/redirectUtils.ts

/**
 * @fileoverview Redirect utilities
 * @description SSR-safe utilities for redirecting to external URLs
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { handleError } from './errors';
import { isClient } from './platformDetection';

/**
 * Safely redirect to an external URL
 *
 * SSR-safe utility for redirecting to external URLs (Stripe, OAuth providers, etc.)
 * Handles validation, error cases, and provides proper error feedback.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param url - External URL to redirect to
 * @param options - Redirect options
 * @returns Promise that resolves when redirect is initiated
 *
 * @example
 * ```tsx
 * try {
 *   await redirectToExternalUrl('https://checkout.stripe.com/pay/...');
 * } catch (error) {
 *   // Handle redirect failure
 *   handleError(error, {
 *     userMessage: 'Failed to redirect to payment page',
 *     showNotification: true,
 *   });
 * }
 * ```
 */
export async function redirectToExternalUrl(
  url: string,
  options: {
    /** Whether to open in new tab instead of redirecting */
    openInNewTab?: boolean;
    /** Whether to validate URL format */
    validateUrl?: boolean;
  } = {}
): Promise<void> {
  const { openInNewTab = false, validateUrl = true } = options;

  // SSR safety - no-op on server
  if (!isClient()) {
    throw new Error('External redirects are not available on the server');
  }

  // Validate URL if requested
  if (validateUrl) {
    try {
      const urlObj = new URL(url);

      // Ensure it's an external URL (different origin)
      if (urlObj.origin === window.location.origin) {
        throw new Error(
          'Cannot redirect to same origin - use internal navigation instead'
        );
      }

      // Ensure it's a safe protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS redirects are allowed');
      }
    } catch (error) {
      throw new Error(
        `Invalid redirect URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  try {
    if (openInNewTab) {
      // Open in new tab
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        throw new Error('Failed to open new tab - popup may be blocked');
      }
    } else {
      // Redirect current window
      window.location.href = url;
    }
  } catch (error) {
    // Handle browser security restrictions
    if (error instanceof Error && error.message.includes('popup')) {
      throw new Error('Redirect blocked by browser popup blocker');
    }

    // Handle other redirect failures
    throw new Error(
      `Redirect failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Safely redirect to an external URL with automatic error handling
 *
 * Convenience function that automatically handles errors with toast notifications.
 * Use this when you want automatic error feedback without manual error handling.
 *
 * @param url - External URL to redirect to
 * @param options - Redirect options
 * @param errorMessage - Custom error message for toast
 *
 * @example
 * ```tsx
 * // Automatic error handling with toast
 * await redirectToExternalUrlWithErrorHandling(
 *   'https://checkout.stripe.com/pay/...',
 *   {},
 *   'Failed to redirect to payment page'
 * );
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function redirectToExternalUrlWithErrorHandling(
  url: string,
  options: Parameters<typeof redirectToExternalUrl>[1] = {},
  errorMessage: string = 'Failed to redirect to external URL'
): Promise<void> {
  try {
    await redirectToExternalUrl(url, options);
  } catch (error) {
    handleError(error, {
      userMessage: errorMessage,
      showNotification: true,
      context: { operation: 'external_redirect', url },
    });
    throw error; // Re-throw so caller knows redirect failed
  }
}

/**
 * Check if external redirects are available
 *
 * Useful for conditional rendering or fallback behavior.
 *
 * @returns True if external redirects are available (client-side)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function canRedirectExternally(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get current origin for redirect URL construction
 *
 * SSR-safe way to get the current origin for building redirect URLs.
 *
 * @returns Current origin or null if not available
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getCurrentOrigin(): string | null {
  if (!isClient()) {
    return null;
  }

  return window.location.origin;
}
