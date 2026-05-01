// packages/core/types/src/utils/rateLimiter.ts

/**
 * @fileoverview Rate Limiter Types
 * @description Type definitions for rate limiting. Defines rate limit configuration, rate limit state, rate limit result, and rate limiting-related interfaces.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// =============================================================================
// Rate Limiter Types
// =============================================================================

/**
 * Configuration options for rate limiting
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RateLimitConfig {
  /** Maximum number of allowed attempts within the window */
  maxAttempts: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Duration to block after maxAttempts is reached (ms) */
  blockDurationMs: number;

  /**
   * Whether to increase block duration exponentially for repeated blocks
   * @default true
   */
  useExponentialBackoff?: boolean;

  /**
   * Key for storage - should be unique per application or feature
   * @default "dndev_auth_ratelimit"
   */
  storageKey: string;

  /**
   * Maximum block duration in milliseconds
   * @default 86400000 (24 hours)
   */
  maxBlockDurationMs?: number;
}

/**
 * Result of a rate limit check
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RateLimitResult {
  /** Whether the operation is allowed */
  allowed: boolean;

  /** Number of attempts remaining before being rate limited */
  remaining: number;

  /** When the rate limit window or block will reset */
  resetAt: Date | null;

  /** Seconds remaining in block (null if not blocked) */
  blockRemainingSeconds: number | null;
}

/**
 * Internal structure used by RateLimiter to store attempt timestamps and block info.
 * @private
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AttemptRecord {
  /** Array of attempts with timestamps and optional identifiers */
  attempts: Array<{
    /** When the attempt was made */
    timestamp: number;
    /** Optional identifier (e.g., email, username) */
    identifier?: string;
  }>;

  /** Timestamp when the block expires, or null if not blocked */
  blockUntil: number | null;

  /** Number of consecutive times blocking occurred (for exponential backoff) */
  blockCount: number;
}

/**
 * Rate limiter interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RateLimiter {
  /**
   * Check if an operation is allowed and record an attempt
   * @param identifier Optional identifier (e.g. email, username)
   * @returns Rate limit result
   */
  consume(identifier?: string): RateLimitResult;

  /**
   * Check rate limit without recording an attempt
   * @param identifier Optional identifier
   * @returns Rate limit result
   */
  check(identifier?: string): RateLimitResult;

  /**
   * Reset rate limiting state
   */
  reset(): void;

  /**
   * Reset rate limiting for a specific identifier
   * @param identifier The identifier to reset
   */
  resetForIdentifier(identifier: string): void;
}

/**
 * Rate limiting state for a specific operation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RateLimitState {
  /** Number of attempts made in the current window */
  attempts: number;

  /** ISO date string when the current rate limit window started */
  windowStart: string;

  /** ISO date string when the block expires, or null if not blocked */
  blockUntil: string | null;
}

/**
 * Rate limit manager interface for application-wide use
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RateLimitManager {
  /**
   * Get a rate limiter for a specific operation
   * @param operation Operation to rate limit
   * @param config Optional configuration overrides
   */
  getLimiter(operation: string, config?: Partial<RateLimitConfig>): RateLimiter;

  /**
   * Reset all rate limiters
   */
  resetAll(): void;
}
