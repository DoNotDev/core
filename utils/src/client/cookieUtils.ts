// packages/core/utils/src/client/cookieUtils.ts

/**
 * @fileoverview Cookie utility functions
 * @description Browser cookie management utilities
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { CookieOptions } from '@donotdev/types';

/**
 * Set a cookie with the specified options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  if (typeof document === 'undefined') return;

  const {
    expires = 365,
    path = '/',
    domain,
    secure = true,
    sameSite = 'strict',
    priority = 'medium',
    partitioned = false,
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  // Add expiration
  if (expires) {
    const date = new Date();
    date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
    cookieString += `; expires=${date.toUTCString()}`;
  }

  // Add path (reject semicolons to prevent attribute injection)
  if (path) {
    if (path.includes(';') || path.includes('\n') || path.includes('\r')) {
      throw new Error('Invalid cookie path: must not contain ; or newlines');
    }
    cookieString += `; path=${path}`;
  }

  // Add domain (reject semicolons to prevent attribute injection)
  if (domain) {
    if (
      domain.includes(';') ||
      domain.includes('\n') ||
      domain.includes('\r')
    ) {
      throw new Error('Invalid cookie domain: must not contain ; or newlines');
    }
    cookieString += `; domain=${domain}`;
  }

  // Add secure flag
  if (secure) {
    cookieString += '; secure';
  }

  // Add SameSite attribute
  if (sameSite) {
    cookieString += `; samesite=${sameSite}`;
  }

  // Add priority (Chrome 99+)
  if (priority && priority !== 'medium') {
    cookieString += `; priority=${priority}`;
  }

  // Add partitioned flag (Chrome 114+)
  if (partitioned) {
    cookieString += '; partitioned';
  }

  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');

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

/**
 * Delete a cookie by setting it to expire in the past
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function deleteCookie(
  name: string,
  options: Partial<CookieOptions> = {}
): void {
  if (typeof document === 'undefined') return;

  const {
    path = '/',
    domain,
    secure = window.location.protocol === 'https:',
    sameSite = 'lax',
  } = options;

  let cookieString = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  if (path) {
    if (path.includes(';') || path.includes('\n') || path.includes('\r')) {
      throw new Error('Invalid cookie path: must not contain ; or newlines');
    }
    cookieString += `; path=${path}`;
  }

  if (domain) {
    if (
      domain.includes(';') ||
      domain.includes('\n') ||
      domain.includes('\r')
    ) {
      throw new Error('Invalid cookie domain: must not contain ; or newlines');
    }
    cookieString += `; domain=${domain}`;
  }

  if (secure) {
    cookieString += '; secure';
  }

  if (sameSite) {
    cookieString += `; samesite=${sameSite}`;
  }

  document.cookie = cookieString;
}
