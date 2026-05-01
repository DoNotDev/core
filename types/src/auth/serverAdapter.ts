// packages/core/types/src/auth/serverAdapter.ts

/**
 * @fileoverview Server Auth Adapter Interface
 * @description Provider-agnostic interface for server-side authentication.
 * Token verification, user lookup, and custom claims management.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

// =============================================================================
// Server Auth Types
// =============================================================================

/** Result of token verification */
export interface VerifiedToken {
  /** The user's unique identifier */
  uid: string;
  /** Optional: email from the token */
  email?: string;
  /** Optional: additional claims embedded in the token */
  claims?: Record<string, unknown>;
}

/** Server-side user record (minimal) */
export interface ServerUserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  customClaims?: Record<string, unknown>;
}

// =============================================================================
// IServerAuthAdapter Interface
// =============================================================================

/**
 * Provider-agnostic server-side auth adapter.
 *
 * Implementations:
 * - `FirebaseServerAuthAdapter` (Firebase Admin SDK)
 * - Future: Supabase server auth, Auth.js, custom JWT adapters
 *
 * @version 0.1.0
 * @since 0.5.0
 */
export interface IServerAuthAdapter {
  /** Verify an auth token and return the decoded user info. Throws on invalid token. */
  verifyToken(token: string): Promise<VerifiedToken>;

  /** Get a user record by UID. Returns null if not found. */
  getUser(uid: string): Promise<ServerUserRecord | null>;

  /** Set custom claims on a user (merge semantics — existing claims are preserved unless overwritten). */
  setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}
