// packages/core/utils/src/server/cookieUtils.ts

/**
 * @fileoverview Server-side cookie utilities
 * @description Cookie parsing for SSR environments (Next.js, etc.)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Parse a cookie from HTTP Cookie header string
 * Server-side equivalent of getCookie()
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param cookieHeader - HTTP Cookie header string
 * @param name - Cookie name to extract
 * @returns Cookie value or null if not found
 *
 * @example
 * ```typescript
 * const consent = parseServerCookie(request.headers.cookie, 'dndev-cookie-consent');
 * ```
 */
export function parseServerCookie(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;

  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = cookieHeader.split(';');

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    if (!cookie) continue;

    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length);
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
    }
  }

  return null;
}
