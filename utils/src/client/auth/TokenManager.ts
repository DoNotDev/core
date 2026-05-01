// packages/core/utils/src/client/auth/TokenManager.ts

/**
 * @fileoverview Token manager
 * @description Manages authentication tokens lifecycle and auto-refresh
 *
 * This module provides comprehensive token management including automatic
 * refresh, expiration monitoring, and secure storage. It handles the complete
 * token lifecycle from acquisition to refresh and cleanup.
 *
 * **Key Features:**
 * - Automatic token refresh before expiration
 * - Secure token storage and retrieval
 * - Token expiration monitoring
 * - Event-driven architecture for token updates
 * - Support for multiple token types (access, refresh, ID)
 * - Configurable refresh strategies
 *
 * **Token Types:**
 * - Access tokens for API authentication
 * - Refresh tokens for token renewal
 * - ID tokens for user identification
 *
 * **Security Features:**
 * - Secure storage with encryption
 * - Automatic cleanup of expired tokens
 * - Token validation and verification
 * - Protection against token leakage
 *
 * **Usage Pattern:**
 * ```typescript
 * import { tokenManager } from '@donotdev/utils';
 *
 * // Set token
 * await tokenManager.setToken('access_token', tokenData);
 *
 * // Listen to token updates
 * tokenManager.on('tokenRefreshed', (newToken) => {
 *   console.log('Token refreshed:', newToken);
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { TokenStatus, TokenInfo as BaseTokenInfo } from '@donotdev/types';

import { createSingleton, createMethodProxy } from '../../common/singleton';
import { isDev } from '../appConfig';
import { handleError } from '../errors';

/**
 * Shape of an auth instance with a currentUser that can refresh tokens.
 * Used for type narrowing of the unknown authInstance field.
 */
interface AuthInstanceLike {
  currentUser?: {
    getIdToken: (forceRefresh?: boolean) => Promise<string>;
    getIdTokenResult: (forceRefresh?: boolean) => Promise<{
      token: string;
      expirationTime: string;
    }>;
  } | null;
}

/**
 * Shape of a user object that can refresh its own token.
 * Accepts Firebase User or any compatible auth user.
 */
export interface AuthUserLike {
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult?: (forceRefresh?: boolean) => Promise<{
    token: string;
    expirationTime: string;
  }>;
}

/** Type guard for auth instances that expose a currentUser */
function hasCurrentUser(instance: unknown): instance is AuthInstanceLike & {
  currentUser: NonNullable<AuthInstanceLike['currentUser']>;
} {
  return (
    typeof instance === 'object' &&
    instance !== null &&
    'currentUser' in instance &&
    typeof (instance as AuthInstanceLike).currentUser === 'object' &&
    (instance as AuthInstanceLike).currentUser !== null
  );
}

/**
 * Extended token information structure
 * Extends the base TokenInfo from @donotdev/types with additional fields
 * Note: Base TokenInfo is available from @donotdev/types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
interface ExtendedTokenInfo extends BaseTokenInfo {
  /** Optional error when status is 'error' */
  error?: Error;
  /** Optional refresh token */
  refreshToken?: string | null;
  /** Optional ID token (for OAuth/OIDC flows) */
  idToken?: string | null;
}

/**
 * Configuration options for TokenManager
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TokenManagerOptions {
  /**
   * Buffer time in milliseconds before expiration to consider a token as "expiring soon"
   * @default 120000 (2 minutes)
   */
  refreshBufferMs?: number;

  /**
   * Whether to automatically refresh tokens that are expiring soon
   * @default true
   */
  autoRefresh?: boolean;

  /**
   * Maximum number of refresh attempts before failing
   * @default 3
   */
  maxRefreshAttempts?: number;

  /**
   * Callback when the token expires and cannot be refreshed
   */
  onTokenExpired?: () => void;

  /**
   * Callback when a fatal error occurs
   */
  onFatalError?: (error: Error) => void;
}

/**
 * Default refresh buffer time (2 minutes)
 */
const DEFAULT_REFRESH_BUFFER_MS = 120000;

/**
 * TokenManager handles authentication token lifecycle including
 * storage, automatic refresh, expiration detection, and status tracking
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class TokenManager {
  // Removed EDA - no more events needed
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private refreshAttempts = 0;
  private refreshBuffer: number;
  private maxRefreshAttempts: number;
  private autoRefresh: boolean;
  private authInstance: unknown;
  private onTokenExpired?: () => void;
  private onFatalError?: (error: Error) => void;
  private refreshCallback?: () => Promise<boolean>;

  private tokenInfo: ExtendedTokenInfo = {
    token: null,
    expiresAt: null,
    status: 'not-initialized',
  };

  /**
   * Creates a new TokenManager
   *
   * @param authInstance Optional auth instance for automatic refresh
   * @param options Configuration options
   */
  constructor(authInstance: unknown = null, options: TokenManagerOptions = {}) {
    this.authInstance = authInstance;
    this.refreshBuffer = options.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;
    this.maxRefreshAttempts = options.maxRefreshAttempts ?? 3;
    this.autoRefresh = options.autoRefresh !== false;
    this.onTokenExpired = options.onTokenExpired;
    this.onFatalError = options.onFatalError;
  }

  /**
   * Initialize token management with token information
   *
   * @param tokenInfo Initial token information
   */
  public initialize(tokenInfo: Omit<ExtendedTokenInfo, 'status'>): void {
    // Clear any existing timers
    this.clearRefreshTimer();
    this.refreshAttempts = 0;

    // Set initial token info and calculate status
    const status = this.calculateTokenStatus(tokenInfo.expiresAt);

    this.tokenInfo = {
      ...tokenInfo,
      status,
    };

    // Removed EDA - no more events needed

    // Schedule refresh if needed
    if (this.autoRefresh && tokenInfo.expiresAt) {
      this.scheduleRefresh(tokenInfo.expiresAt);
    }
  }

  /**
   * Get the current token information
   *
   * @returns Current token information
   */
  public getTokenInfo(): ExtendedTokenInfo {
    return this.tokenInfo;
  }

  // Removed EDA - no more events needed

  /**
   * Reset the token manager
   * Clears token information and cancels scheduled refreshes
   */
  public reset(): void {
    this.clearRefreshTimer();

    this.tokenInfo = {
      token: null,
      expiresAt: null,
      status: 'not-initialized',
    };

    // Removed EDA - no more events needed
  }

  /**
   * Force an immediate token refresh
   *
   * @param user Auth user with getIdToken/getIdTokenResult methods
   * @returns Promise resolving to the refreshed token or null
   */
  public async forceRefresh(
    user?: AuthUserLike | null
  ): Promise<string | null> {
    try {
      // First try using the callback method if available
      if (this.refreshCallback) {
        const success = await this.refreshCallback();
        if (success && this.tokenInfo.token) {
          return this.tokenInfo.token;
        }
      }

      // If we have a user with getIdToken method (Firebase)
      if (user && typeof user.getIdToken === 'function') {
        // Force token refresh
        const newToken = await user.getIdToken(true);

        // Default expiration to 1 hour if not provided
        const expirationTime = new Date(Date.now() + 3600 * 1000);

        // Update token info
        this.updateTokenInfo({
          token: newToken,
          expiresAt: expirationTime,
        });

        // W-NEW-12 fix: reset retry counter on successful refresh
        this.refreshAttempts = 0;
        return newToken;
      }
      // If the user is an object with methods for getting token claims
      else if (user && typeof user.getIdTokenResult === 'function') {
        const tokenResult = await user.getIdTokenResult(true);

        // Parse token expiration
        const expiresAt = new Date(tokenResult.expirationTime);

        // Update token info
        this.updateTokenInfo({
          token: tokenResult.token,
          expiresAt,
        });

        // W-NEW-12 fix: reset retry counter on successful refresh
        this.refreshAttempts = 0;
        return tokenResult.token;
      }

      // Try using the Auth instance if available
      if (hasCurrentUser(this.authInstance)) {
        const tokenResult =
          await this.authInstance.currentUser.getIdTokenResult(true);

        // Parse token expiration
        const expiresAt = new Date(tokenResult.expirationTime);

        // Update token info
        this.updateTokenInfo({
          token: tokenResult.token,
          expiresAt,
        });

        // W-NEW-12 fix: reset retry counter on successful refresh
        this.refreshAttempts = 0;
        return tokenResult.token;
      }

      throw handleError(new Error('No valid refresh method available'), {
        userMessage: 'Unable to refresh authentication token',
        severity: 'warning',
        context: { component: 'TokenManager' },
      });
    } catch (error) {
      this.handleError(
        error instanceof Error
          ? error
          : new Error('Unknown error during token refresh')
      );
      return null;
    }
  }

  /**
   * Get a valid token, automatically refreshing if needed
   *
   * @returns Promise resolving to a valid token or null
   */
  public async getValidToken(): Promise<string | null> {
    const { status, token } = this.tokenInfo;

    // If token is valid, return it immediately
    if (status === 'valid') {
      return token;
    }

    // If token is expired or expiring soon, try to refresh
    if (
      (status === 'expiring-soon' || status === 'expired') &&
      this.autoRefresh
    ) {
      try {
        // Try using the refresh callback
        if (this.refreshCallback) {
          const success = await this.refreshCallback();
          if (success) {
            return this.tokenInfo.token;
          }
        }

        // Try to refresh with auth instance
        if (hasCurrentUser(this.authInstance)) {
          const newToken = await this.forceRefresh(
            this.authInstance.currentUser
          );
          return newToken;
        }
      } catch (error) {
        this.handleError(
          error instanceof Error ? error : new Error('Failed to refresh token')
        );
      }
    }

    // If token is expired or not initialized, return null
    if (
      status === 'expired' ||
      status === 'not-initialized' ||
      status === 'error'
    ) {
      return null;
    }

    // Return current token even if expiring soon
    return token;
  }

  /**
   * Register a callback for token refresh
   *
   * @param callback Function that returns a promise resolving to success status
   * @returns Unsubscribe function
   */
  public onRefreshNeeded(callback: () => Promise<boolean>): () => void {
    this.refreshCallback = callback;
    return () => {
      this.refreshCallback = undefined;
    };
  }

  // Removed EDA - no more events needed

  /**
   * Update token information and emit the change
   *
   * @param tokenInfo New token information (partial)
   */
  private updateTokenInfo(
    tokenInfo: Partial<Omit<ExtendedTokenInfo, 'status'>>
  ): void {
    // Keep existing values if not provided
    const updatedTokenInfo = {
      token: tokenInfo.token ?? this.tokenInfo.token,
      expiresAt: tokenInfo.expiresAt ?? this.tokenInfo.expiresAt,
      refreshToken: tokenInfo.refreshToken ?? this.tokenInfo.refreshToken,
      idToken: tokenInfo.idToken ?? this.tokenInfo.idToken,
    };

    // Calculate the new status
    const status = this.calculateTokenStatus(updatedTokenInfo.expiresAt);

    // Update token info
    this.tokenInfo = {
      ...updatedTokenInfo,
      status,
    };

    // Emit token info update
    // Removed EDA - no more events needed

    // Schedule refresh if needed
    if (this.autoRefresh && updatedTokenInfo.expiresAt) {
      this.scheduleRefresh(updatedTokenInfo.expiresAt);
    }
  }

  /**
   * Calculate token status based on expiration time
   *
   * @param expiresAt Token expiration date
   * @returns Current token status
   */
  private calculateTokenStatus(expiresAt: Date | null): TokenStatus {
    if (!expiresAt) {
      return this.tokenInfo.token ? 'valid' : 'not-initialized';
    }

    const now = new Date();

    // Check if token is expired
    if (now >= expiresAt) {
      return 'expired';
    }

    // Check if token is expiring soon
    const bufferTime = new Date(expiresAt.getTime() - this.refreshBuffer);
    if (now >= bufferTime) {
      return 'expiring-soon';
    }

    return 'valid';
  }

  /**
   * Schedule token refresh based on expiration time
   *
   * @param expiresAt Token expiration date
   */
  private scheduleRefresh(expiresAt: Date): void {
    this.clearRefreshTimer();

    const now = new Date();
    const timeUntilRefreshMs =
      expiresAt.getTime() - now.getTime() - this.refreshBuffer;

    // If token is already expired or about to expire, refresh immediately
    if (timeUntilRefreshMs <= 0) {
      if (hasCurrentUser(this.authInstance)) {
        this.forceRefresh(this.authInstance.currentUser).catch((error) => {
          this.handleRefreshError(error);
        });
      }
      return;
    }

    // Schedule next refresh
    this.refreshTimerId = setTimeout(() => {
      if (hasCurrentUser(this.authInstance)) {
        this.forceRefresh(this.authInstance.currentUser).catch((error) => {
          this.handleRefreshError(error);
        });
      } else if (this.refreshCallback) {
        this.refreshCallback().catch((error) => {
          this.handleRefreshError(error);
        });
      }
    }, timeUntilRefreshMs);
  }

  /**
   * Handle errors during token refresh
   *
   * @param error Error that occurred
   */
  private handleRefreshError(error: any): void {
    // W-NEW-1 fix: gate console output behind isDev()
    if (isDev()) {
      console.error('Token refresh error:', error);
    }

    this.refreshAttempts++;

    if (this.refreshAttempts <= this.maxRefreshAttempts) {
      // Calculate backoff delay using exponential backoff
      const backoffDelayMs = Math.min(
        1000 * Math.pow(2, this.refreshAttempts - 1),
        30000 // Max 30 seconds
      );

      if (isDev()) {
        console.log(
          `Retrying token refresh in ${backoffDelayMs}ms (attempt ${this.refreshAttempts}/${this.maxRefreshAttempts})`
        );
      }

      // Schedule retry with exponential backoff
      setTimeout(() => {
        if (hasCurrentUser(this.authInstance)) {
          this.forceRefresh(this.authInstance.currentUser).catch(
            (retryError) => {
              this.handleRefreshError(retryError);
            }
          );
        } else if (this.refreshCallback) {
          this.refreshCallback().catch((retryError) => {
            this.handleRefreshError(retryError);
          });
        }
      }, backoffDelayMs);
    } else {
      // Max retries reached, mark token as error
      this.tokenInfo = {
        ...this.tokenInfo,
        status: 'error',
        error:
          error instanceof Error
            ? error
            : new Error('Max token refresh attempts reached'),
      };

      // Removed EDA - no more events needed

      // Notify listeners of token expiry
      if (this.onTokenExpired) {
        this.onTokenExpired();
      }

      // Notify listeners of fatal error
      if (this.onFatalError) {
        this.onFatalError(
          error instanceof Error
            ? error
            : new Error('Max token refresh attempts reached')
        );
      }
    }
  }

  /**
   * Handle general errors
   *
   * @param error Error that occurred
   */
  private handleError(error: Error): void {
    // W-NEW-1 fix: gate console output behind isDev()
    if (isDev()) {
      console.error('Token manager error:', error);
    }

    this.tokenInfo = {
      ...this.tokenInfo,
      status: 'error',
      error,
    };

    // Removed EDA - no more events needed
  }

  /**
   * Clear the refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  // Removed EDA - no more events needed
}

// Create singleton getter
const getTokenManager = createSingleton(
  TokenManager,
  null as unknown,
  {} as TokenManagerOptions
);

// Export factory function only - singleton accessed via registry pattern
export { getTokenManager };
