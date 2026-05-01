// packages/core/utils/src/common/auth/AuthHardening.ts

/**
 * @fileoverview AuthHardening
 * @description Brute-force lockout + session timeout enforcement.
 * Covers SOC2 CC6.1 (authentication), CC6.2 (account lockout).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { AuthHardeningContext } from '@donotdev/types';

interface LockoutEntry {
  attempts: number;
  lastAttempt: number;
  /** null = not locked; number = locked until this timestamp */
  lockedUntil: number | null;
}

/** Configuration for brute-force lockout and session timeout enforcement. */
export interface AuthHardeningConfig {
  /**
   * Max consecutive failed sign-in attempts before lockout.
   * @default 5
   */
  maxAttempts?: number;
  /**
   * Lockout duration in milliseconds.
   * @default 900_000 (15 minutes)
   */
  lockoutMs?: number;
  /**
   * Idle session timeout in milliseconds. After this period of inactivity,
   * the session is considered expired.
   * @default 28_800_000 (8 hours)
   */
  sessionTimeoutMs?: number;
}

/** Result of a lockout status check for an identifier. */
export interface LockoutResult {
  attempts: number;
  locked: boolean;
  lockedUntil: number | null;
}

/**
 * In-memory brute-force lockout tracker and session timeout enforcer (SOC2 CC6.1, CC6.2).
 *
 * For distributed deployments, store lockout state in Redis using the same interface.
 *
 * @example
 * ```typescript
 * const hardening = new AuthHardening({ maxAttempts: 3, lockoutMs: 30 * 60 * 1000 });
 *
 * // Before sign-in:
 * hardening.checkLockout(email); // throws if locked
 *
 * // On failure:
 * hardening.recordFailure(email);
 *
 * // On success:
 * hardening.recordSuccess(email);
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
/** Max identifiers tracked before a lazy eviction sweep is triggered. */
const EVICTION_THRESHOLD = 10_000;

export class AuthHardening implements AuthHardeningContext {
  private readonly store = new Map<string, LockoutEntry>();
  private readonly maxAttempts: number;
  private readonly lockoutMs: number;
  /** Expose for auth adapters to enforce idle session timeout */
  readonly sessionTimeoutMs: number;

  constructor(config: AuthHardeningConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? 5;
    this.lockoutMs = config.lockoutMs ?? 15 * 60 * 1000;
    this.sessionTimeoutMs = config.sessionTimeoutMs ?? 8 * 60 * 60 * 1000;
  }

  /**
   * Call BEFORE a sign-in attempt.
   * @throws {Error} if the identifier is currently locked.
   */
  checkLockout(identifier: string): void {
    const entry = this.store.get(identifier);
    if (!entry?.lockedUntil) return;

    if (Date.now() < entry.lockedUntil) {
      const remainingMin = Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
      throw new Error(
        `Account temporarily locked after too many failed attempts. Try again in ${remainingMin} minute${remainingMin === 1 ? '' : 's'}.`
      );
    }

    // Lockout expired — clear it
    this.store.delete(identifier);
  }

  /**
   * Call AFTER a failed sign-in attempt.
   * @returns current attempt count and whether the account is now locked.
   */
  recordFailure(identifier: string): LockoutResult {
    const now = Date.now();

    // Lazy eviction: sweep cleared lockouts before adding a new entry
    if (!this.store.has(identifier) && this.store.size >= EVICTION_THRESHOLD) {
      this._evictExpired(now);
    }

    const entry = this.store.get(identifier) ?? {
      attempts: 0,
      lastAttempt: 0,
      lockedUntil: null,
    };

    entry.attempts += 1;
    entry.lastAttempt = now;

    if (entry.attempts >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutMs;
    }

    this.store.set(identifier, entry);

    return {
      attempts: entry.attempts,
      locked: entry.lockedUntil !== null && Date.now() < entry.lockedUntil,
      lockedUntil: entry.lockedUntil,
    };
  }

  private _evictExpired(now: number): void {
    for (const [k, v] of this.store) {
      // Evict entries whose lockout has expired and have no recent activity
      if (v.lockedUntil !== null && now > v.lockedUntil) {
        this.store.delete(k);
      } else if (
        v.lockedUntil === null &&
        now - v.lastAttempt > this.lockoutMs
      ) {
        // Evict non-locked entries that haven't had an attempt within the lockout window
        this.store.delete(k);
      }
    }
  }

  /**
   * Call AFTER a successful sign-in — resets the failure counter.
   */
  recordSuccess(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Check if a session has expired based on last activity timestamp.
   * @param lastActivityMs - `Date.now()` at last activity
   */
  isSessionExpired(lastActivityMs: number): boolean {
    return Date.now() - lastActivityMs > this.sessionTimeoutMs;
  }

  /** Current entry for an identifier (for audit logging). */
  getEntry(identifier: string): LockoutEntry | undefined {
    return this.store.get(identifier);
  }
}
