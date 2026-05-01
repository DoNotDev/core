// packages/core/stores/src/hooks/useRateLimit.ts

/**
 * @fileoverview Rate limit hook
 * @description Hook for accessing rate limit functionality
 * NOTE: Auth-related rate limiting moved to @donotdev/auth package
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Generic rate limiting hook (infrastructure-level)
 *
 * @deprecated Use `@donotdev/security` for rate limiting instead.
 * This hook is a no-op stub kept for backward compatibility.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

let hasWarned = false;

export function useRateLimit() {
  if (!hasWarned) {
    hasWarned = true;
    console.warn(
      '[useRateLimit] Deprecated: use @donotdev/security for rate limiting. This hook is a no-op stub.'
    );
  }

  return {
    checkLimit: () => true,
    resetLimit: () => {},
  };
}
