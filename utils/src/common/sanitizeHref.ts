// packages/core/utils/src/common/sanitizeHref.ts

/**
 * @fileoverview Href sanitization utility
 * @description Blocks dangerous URI schemes (javascript:, data:, vbscript:) in href attributes.
 * Allows http, https, mailto, tel, and relative URLs.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

/** Schemes explicitly allowed in href attributes */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'blob:']);

/**
 * Sanitize a URL for use in href attributes.
 * Blocks javascript:, data:, vbscript: and other dangerous schemes.
 * Allows safe schemes and relative URLs.
 *
 * @param href - The URL to sanitize
 * @returns The original URL if safe, empty string if dangerous
 */
export function sanitizeHref(href: string): string {
  if (!href || typeof href !== 'string') return '';

  const trimmed = href.trim();

  // Relative URLs are safe (start with /, ./, ../, #, or ?)
  if (/^[/.?#]/.test(trimmed)) return trimmed;

  // Check scheme
  try {
    const url = new URL(trimmed);
    if (SAFE_SCHEMES.has(url.protocol)) return trimmed;
  } catch {
    // Not a valid absolute URL — treat as relative (safe)
    return trimmed;
  }

  // Dangerous scheme (javascript:, data:, vbscript:, etc.)
  return '';
}
