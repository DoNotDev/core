// packages/core/types/src/oauth/types.ts

/**
 * @fileoverview OAuth Types
 * @description Type definitions for OAuth domain. Defines base credentials, user profiles, OAuth partner types, and OAuth-related interfaces.
 * Uses unified FeatureStatus enum for feature state management.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type { FeatureStatus } from '../common';
import type { OAuthPartner, OAuthPartnerId } from '../partners/schemas';
import type { PartnerConnectionState, PartnerResult } from '../partners/types';

import type { OAuthPurpose } from './constants';

// =============================================================================
// Base types
// =============================================================================

/**
 * Base credentials interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseCredentials {
  expiresAt?: number;
  scope?: string[];
}

/**
 * Base user profile interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseUserProfile {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  photoURL?: string;
}

/**
 * Base partner state interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BasePartnerState {
  config: any;
  error: Error | null;
}

// =============================================================================
// OAuth partner types (moved from oauthPartners.ts)
// =============================================================================

/**
 * OAuth credentials interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthCredentials extends BaseCredentials {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

/**
 * OAuth partner result interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthPartnerResult extends PartnerResult {
  partnerId: OAuthPartnerId;
  purpose: OAuthPurpose;
  credentials?: OAuthCredentials;
}

/**
 * OAuth partner state interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthPartnerState extends PartnerConnectionState {
  partnerId: OAuthPartnerId;
  config: OAuthPartner;
  credentials: OAuthCredentials | null;
}

/**
 * OAuth API request options interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthApiRequestOptions extends RequestInit {
  autoRefresh?: boolean;
  requireConnection?: boolean;
}

// =============================================================================
// Additional OAuth Types (migrated from oauthTypes.ts)
// =============================================================================

/**
 * OAuth connection status type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'expired';

/**
 * OAuth result type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthResult =
  | {
      success: true;
      partner: string;
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresIn?: number;
      scope?: string;
      tokenType?: string;
      profile?: Record<string, any>;
    }
  | {
      success: false;
      error: string;
      errorDescription?: string;
      attemptedPartner?: string;
    };

/**
 * Exchange token parameters interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ExchangeTokenParams {
  provider: OAuthPartnerId;
  purpose: OAuthPurpose;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

/**
 * OAuth connection info interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthConnectionInfo {
  id: string;
  userId: string;
  provider: OAuthPartnerId;
  purpose: OAuthPurpose;
  connected: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
  credentials?: OAuthCredentials;
  profile?: BaseUserProfile;
}

/**
 * OAuth connection interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthConnection {
  partnerId: OAuthPartnerId;
  status: OAuthConnectionStatus;
  connectedAt?: Date;
  lastError?: string;
  userData?: any;
  lastTokenUpdate?: Date;
}

/**
 * OAuth connection request interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthConnectionRequest {
  provider: OAuthPartnerId;
  purpose: OAuthPurpose;
  credentials: OAuthCredentials;
  profile?: BaseUserProfile;
}

/**
 * OAuth partner hook result interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthPartnerHookResult {
  partnerState: OAuthPartnerState;
  isConnecting: boolean;
  isConnected: boolean;
  error: Error | null;
  credentials: OAuthCredentials | null;
  connect: (options?: {
    purpose?: OAuthPurpose;
    redirectUri?: string;
    scopes?: string[];
    additionalParams?: Record<string, string>;
    onSuccess?: (result: OAuthPartnerResult) => void;
    onError?: (error: Error) => void;
  }) => Promise<void>;
  disconnect: () => Promise<boolean>;
  refreshToken: () => Promise<OAuthCredentials | null>;
  request: <T = any>(
    url: string,
    options?: OAuthApiRequestOptions
  ) => Promise<T>;
}

/**
 * OAuth callback hook result interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthCallbackHookResult {
  isCallback: boolean;
  processing: boolean;
  result: OAuthResult | null;
  partnerName: string | null;
  success: boolean;
  error: Error | null;
}

/**
 * Exchange token request interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ExchangeTokenRequest {
  provider: OAuthPartnerId;
  purpose: OAuthPurpose;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  state?: string;
  instance?: string;
  idempotencyKey?: string;
}

/**
 * Token response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  created_at?: number;
}

/**
 * OAuth refresh request interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthRefreshRequest {
  provider: OAuthPartnerId;
  refreshToken: string;
  redirectUri: string;
}

/**
 * OAuth refresh response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthRefreshResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

// =============================================================================
// GitHub types (from schemas)
// =============================================================================

import type { githubRepoConfigSchema, githubPermissionSchema } from './schemas';

/**
 * GitHub repository configuration type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type GitHubRepoConfig = v.InferOutput<typeof githubRepoConfigSchema>;

/**
 * GitHub permission type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type GitHubPermission = v.InferOutput<typeof githubPermissionSchema>;

// =============================================================================
// Connect Options
// =============================================================================

/**
 * Options for `useOAuth('connect')`.
 * Allows scope customization and extra auth URL parameters.
 *
 * @example
 * ```typescript
 * const connect = useOAuth('connect');
 * // Simple (defaults):
 * await connect('github');
 * // With scope override:
 * await connect('github', { purpose: 'api-access', scopes: ['repo', 'user:email'] });
 * ```
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */
export interface ConnectOptions {
  /** OAuth purpose — defaults to 'api-access' */
  purpose?: OAuthPurpose;
  /** Override default scopes from schema. Only these scopes will be requested. */
  scopes?: string[];
  /** Extra query parameters to append to the auth URL */
  additionalParams?: Record<string, string>;
}

// =============================================================================
// Exchange Token Response
// =============================================================================

/**
 * Normalized response from server-side token exchange.
 * Callable providers (Firebase, Supabase) return this shape.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */
export interface ExchangeTokenResponse {
  success: boolean;
  credentials: OAuthCredentials;
  profile?: BaseUserProfile;
}

// =============================================================================
// Hook API Types
// =============================================================================

/**
 * OAuth API type - complete interface for useOAuth hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthAPI {
  /**
   * Unified feature status - single source of truth for OAuth state.
   * Replaces deprecated `loading` boolean flag.
   * - `initializing`: OAuth is loading/initializing
   * - `ready`: OAuth fully operational
   * - `degraded`: OAuth unavailable (feature not installed/consent not given)
   * - `error`: OAuth encountered error
   */
  status: FeatureStatus;
  error: string | null;
  partners: Record<OAuthPartnerId, any>;
  connectedPartners: OAuthPartnerId[];
  connect: (
    partnerId: OAuthPartnerId,
    options?: ConnectOptions
  ) => Promise<void>;
  disconnect: (partnerId: OAuthPartnerId) => Promise<void>;
  isConnected: (partnerId: OAuthPartnerId) => boolean;
  getCredentials: (partnerId: OAuthPartnerId) => OAuthCredentials | null;
  handleCallback: (
    partnerId: OAuthPartnerId,
    code: string,
    state?: string
  ) => Promise<void>;
  isAvailable: boolean;
}
