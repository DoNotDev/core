// packages/core/utils/src/client/auth/ClaimsCache.ts

/**
 * @fileoverview ClaimsCache - Offline claims caching service
 * @description CSR/SSR safe claims caching with graceful degradation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { IStorageManager } from '@donotdev/types';

import { isClient } from '../platformDetection';
import { getStorageManager } from '../storage/StorageManager';

/**
 * Claims cache options interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ClaimsCacheOptions {
  /** Enable offline trust (default: false) */
  offlineTrustEnabled?: boolean;
  /** Storage key prefix (default: 'dndev-claims') */
  storageKey?: string;
  /** User ID for scoped storage */
  userId?: string | null;
}

/**
 * Claims cache result interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ClaimsCacheResult<T> {
  claims: T;
  source: 'network' | 'cache' | 'server-default';
  timestamp: number;
}

/**
 * Claims type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Claims = Record<string, any>;

/**
 * ClaimsCache service
 *
 * Handles offline claims caching with graceful degradation:
 * - Server: Returns {} (safe default, no claims checking on server)
 * - Online: Always verify with server, update cache
 * - Offline: Use cached claims if offlineTrustEnabled=true
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class ClaimsCache {
  private offlineTrustEnabled: boolean;
  private storageKey: string;
  private userId: string | null;
  private storage: IStorageManager;

  constructor(options: ClaimsCacheOptions = {}) {
    this.offlineTrustEnabled = options.offlineTrustEnabled ?? false;
    this.storageKey = options.storageKey ?? 'dndev-claims';
    this.userId = options.userId ?? null;
    this.storage = getStorageManager();
  }

  /**
   * CSR/SSR safe client detection
   */
  private isClient(): boolean {
    return isClient();
  }

  /**
   * CSR/SSR safe network detection
   * Server: Returns false (can't detect network)
   * Client: Returns navigator.onLine
   */
  private isOnline(): boolean {
    if (!this.isClient()) {
      return false;
    }
    return navigator.onLine;
  }

  /**
   * Get claims with graceful degradation
   *
   * Server: Returns {} (safe default, no claims checking on server)
   * Online: Always verify with server, update cache
   * Offline: Use cached claims if offlineTrustEnabled=true
   *
   * @param verifyFn - Function to verify claims with server
   * @returns Claims object
   */
  async getClaims<T extends Claims = Claims>(
    verifyFn: () => Promise<T>
  ): Promise<T> {
    if (!this.isClient()) {
      return {} as T;
    }

    const online = this.isOnline();

    if (online) {
      try {
        const claims = await verifyFn();
        await this.setClaims(claims);
        return claims;
      } catch (error) {
        if (this.offlineTrustEnabled) {
          const cachedClaims = await this.getCachedClaims<T>();
          if (cachedClaims) {
            console.warn(
              '[ClaimsCache] Network verification failed, using stale cache'
            );
            return cachedClaims;
          }
        }
        throw error;
      }
    } else {
      if (!this.offlineTrustEnabled) {
        return {} as T;
      }

      const cachedClaims = await this.getCachedClaims<T>();
      if (cachedClaims) {
        return cachedClaims;
      }

      return {} as T;
    }
  }

  /**
   * Get cached claims from storage
   */
  private async getCachedClaims<
    T extends Claims = Claims,
  >(): Promise<T | null> {
    if (!this.isClient()) return null;

    try {
      const key = this.getStorageKey();
      const cached = await this.storage.get<ClaimsCacheResult<T>>(key);

      if (!cached || !cached.claims) return null;

      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - cached.timestamp > maxAge) {
        await this.clearClaims();
        return null;
      }

      return cached.claims;
    } catch (error) {
      console.warn('[ClaimsCache] Failed to read cached claims:', error);
      return null;
    }
  }

  /**
   * Set claims in cache
   */
  async setClaims<T extends Claims = Claims>(claims: T): Promise<void> {
    if (!this.isClient()) return;

    try {
      const key = this.getStorageKey();
      const cacheData: ClaimsCacheResult<T> = {
        claims,
        source: 'network',
        timestamp: Date.now(),
      };
      await this.storage.set(key, cacheData);
    } catch (error) {
      console.warn('[ClaimsCache] Failed to cache claims:', error);
    }
  }

  /**
   * Clear cached claims
   */
  async clearClaims(): Promise<void> {
    if (!this.isClient()) return;

    try {
      const key = this.getStorageKey();
      await this.storage.remove(key);
    } catch (error) {
      console.warn('[ClaimsCache] Failed to clear claims:', error);
    }
  }

  /**
   * Get storage key with user scoping
   */
  private getStorageKey(): string {
    if (this.userId) {
      return `${this.storageKey}-${this.userId}`;
    }
    return this.storageKey;
  }

  /**
   * Update user ID (for user-scoped storage)
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Update offline trust setting
   */
  setOfflineTrustEnabled(enabled: boolean): void {
    this.offlineTrustEnabled = enabled;
  }
}
