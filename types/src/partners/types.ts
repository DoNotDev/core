// packages/core/types/src/partners/types.ts

/**
 * @fileoverview Types for Authentication Partners
 * @description Extends existing auth types with partner-based authentication. Defines partner result types, connection states, partner buttons, and partner-related interfaces.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Shared primitives for auth and oauth partner flows
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PartnerResult {
  success: boolean;
  error?: string;
  userInfo?: {
    id: string;
    name?: string;
    username?: string;
    email?: string;
    photoURL?: string;
  };
}

/**
 * Partner connection state interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PartnerConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  error: Error | null;
}
