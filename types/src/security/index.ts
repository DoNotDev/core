// packages/core/types/src/security/index.ts

/**
 * @fileoverview Security Types
 * @description Core security interface definitions. Implemented by @donotdev/security.
 * Keeping these in @donotdev/core avoids circular deps between packages.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Audit event types (SOC2 CC6, CC7, C1, P1-P8).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuditEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.locked'
  | 'auth.unlocked'
  | 'auth.mfa.enrolled'
  | 'auth.mfa.challenged'
  | 'auth.session.expired'
  | 'auth.password.reset'
  | 'auth.signup.consent'
  | 'auth.role.changed'
  | 'crud.create'
  | 'crud.read'
  | 'crud.update'
  | 'crud.delete'
  | 'crud.bulk'
  | 'pii.access'
  | 'pii.export'
  | 'pii.erase'
  | 'rate_limit.exceeded'
  | 'anomaly.detected'
  | 'config.changed';

/**
 * A single structured audit log entry.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuditEvent {
  type: AuditEventType;
  timestamp: string;
  userId?: string;
  collection?: string;
  docId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Persistence-backed rate limit config (server-side: maxAttempts / windowMs / blockDurationMs).
 * Used by RateLimitBackend implementations (Firestore, Postgres, Redis).
 * Distinct from the client-side RateLimitConfig in @donotdev/types/utils.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ServerRateLimitConfig {
  /** Max requests allowed within the window. */
  maxAttempts: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Block duration in milliseconds after limit is exceeded. */
  blockDurationMs: number;
}

/**
 * Result from a server-side rate limit check.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ServerRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  blockRemainingSeconds: number | null;
}

/**
 * Pluggable rate limit backend for DndevSecurity.
 * Implement to swap the default in-memory limiter with Firestore, Postgres, Redis, etc.
 *
 * @example
 * ```typescript
 * import { checkRateLimitWithFirestore } from '@donotdev/functions/shared';
 * const security = new DndevSecurity({
 *   rateLimitBackend: { check: (key, cfg) => checkRateLimitWithFirestore(key, cfg) },
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RateLimitBackend {
  check(
    key: string,
    config: ServerRateLimitConfig
  ): Promise<ServerRateLimitResult>;
}

/**
 * Minimal auth hardening interface exposed by SecurityContext.
 * Auth adapters delegate lockout to this when security is injected,
 * ensuring a single lockout source of truth that respects user config.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthHardeningContext {
  /** @throws if identifier is currently locked out */
  checkLockout(identifier: string): void;
  /** Record a failed auth attempt; may trigger lockout */
  recordFailure(identifier: string): void;
  /** Clear failure counter on successful auth */
  recordSuccess(identifier: string): void;
}

/**
 * Security context interface consumed by CrudService and auth adapters.
 * Implemented by DndevSecurity in @donotdev/security/server.
 *
 * Pass an instance via CrudService.setSecurity() or auth adapter constructors.
 * When not provided, no audit logging, rate limiting, or encryption is applied.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SecurityContext {
  /** Emit a structured audit event */
  audit(event: Omit<AuditEvent, 'timestamp'>): void | Promise<void>;
  /**
   * Check rate limit for a key + operation.
   * @throws {Error} when threshold is exceeded
   */
  checkRateLimit(key: string, operation: 'read' | 'write'): Promise<void>;
  /** Encrypt named PII fields in a data object (returns new object) */
  encryptPii<T extends Record<string, unknown>>(
    data: T,
    piiFields: string[]
  ): T;
  /** Decrypt named PII fields in a data object (returns new object) */
  decryptPii<T extends Record<string, unknown>>(
    data: T,
    piiFields: string[]
  ): T;
  /**
   * Auth hardening — when present, auth adapters delegate brute-force lockout here
   * instead of using their own hardcoded Maps, ensuring injected config is respected.
   */
  authHardening?: AuthHardeningContext;
  /**
   * Record a behavioral anomaly event (e.g. bulk deletes, bulk reads, auth failures).
   * Optional — no-op when not implemented. CrudService calls this after write mutations
   * so the anomaly detector can fire alerts when thresholds are breached.
   *
   * @param type - Anomaly type string (must match AnomalyType in @donotdev/security)
   * @param userId - User who triggered the anomaly (undefined = system / anonymous)
   */
  recordAnomaly?(type: string, userId?: string): void;
}
