// packages/core/utils/src/client/storage/strategies/LocalStorageStrategy.ts

/**
 * @fileoverview Local storage strategy
 * @description Implementation of storage strategy using browser's localStorage
 *
 * This strategy provides client-side storage using the browser's localStorage API.
 * It's available to all users regardless of subscription tier and provides
 * basic data persistence with optional encryption support.
 *
 * **Key Features:**
 * - Browser localStorage integration
 * - User-scoped and global storage support
 * - Optional data encryption
 * - Error handling and validation
 * - Memory-efficient storage management
 *
 * **Storage Scopes:**
 * - `user`: User-specific data (requires userId)
 * - `global`: Shared data across all users
 * - `session`: Temporary data (not implemented in this strategy)
 *
 * **Security:**
 * - Optional encryption for sensitive data
 * - User isolation for user-scoped data
 * - Input validation and sanitization
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { StorageOptions } from '@donotdev/types';

import { BaseStorageStrategy } from './BaseStorageStrategy';
import { handleError } from '../../errors';
import { isClient } from '../../platformDetection';
import { encryptData, decryptData } from '../StorageEncryption';

/**
 * Storage strategy using browser's localStorage
 *
 * Provides client-side storage using the browser's localStorage API.
 * Available to all users regardless of subscription tier.
 *
 * **Capabilities:**
 * - User-scoped storage (when userId is provided)
 * - Global storage for shared data
 * - Optional encryption for sensitive data
 * - Automatic key scoping and validation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Limitations:**
 * - Limited by browser storage quotas
 * - Data is lost when localStorage is cleared
 * - No cloud synchronization
 * - No cross-device data sharing
 */
export class LocalStorageStrategy extends BaseStorageStrategy {
  /**
   * User ID for user-scoped storage
   * Can be null for non-authenticated users (only global/session storage available)
   */
  private userId: string | null = null;

  /**
   * Create a new LocalStorageStrategy
   * @param userId Optional user ID for user-scoped storage
   */
  constructor(userId: string | null = null) {
    super();
    this.userId = userId;
  }

  /**
   * Set the current user ID
   * @param userId User ID or null
   */
  public setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Retrieve data from localStorage
   */
  public async get<T>(
    key: string,
    options: StorageOptions = {}
  ): Promise<T | null> {
    const { scope = 'user', encryption = false } = options;
    // Allow missing userId for graceful degradation during sign out
    const fullKey = this.buildKey(key, scope, this.userId, true);

    // If userId is missing and scope is 'user', return null gracefully
    if (!fullKey) {
      return null;
    }

    try {
      if (!isClient()) return null;
      const data = localStorage.getItem(fullKey);
      if (!data) return null;

      const parsed = JSON.parse(data);

      // Check expiration
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        await this.remove(key);
        return null;
      }

      let value = parsed.value;

      // Decrypt if needed
      if (encryption && typeof value === 'string') {
        value = await decryptData(value);
      }

      return value as T;
    } catch (error) {
      throw handleError(error, {
        userMessage: 'Failed to retrieve data from local storage',
        context: { key, options },
      });
    }
  }

  /**
   * Store data in localStorage
   */
  public async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    const { scope = 'user', encryption = false, expiry = 0 } = options;
    // Allow missing userId for graceful degradation during sign out
    const fullKey = this.buildKey(key, scope, this.userId, true);

    // If userId is missing and scope is 'user', silently skip (no-op)
    if (!fullKey) {
      return;
    }

    try {
      let storedValue = value;

      // Encrypt if needed
      if (encryption) {
        storedValue = (await encryptData(
          value as string | object | number | boolean
        )) as T;
      }

      // Calculate expiration
      const expiresAt =
        expiry > 0 ? new Date(Date.now() + expiry * 1000).toISOString() : null;

      const data = JSON.stringify({
        value: storedValue,
        expiresAt,
        createdAt: new Date().toISOString(),
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(fullKey, data);
      }
    } catch (error: any) {
      const errorMessage =
        error?.name === 'QuotaExceededError' || error?.code === 22
          ? 'Storage quota exceeded. Please free up space or login to sync to cloud.'
          : error?.name === 'SecurityError' || error?.code === 18
            ? 'Storage access denied. Please enable localStorage or login to sync to cloud.'
            : 'Failed to store data in local storage';

      throw handleError(error, {
        userMessage: errorMessage,
        context: { key, options },
      });
    }
  }

  /**
   * Remove data from localStorage
   */
  public async remove(key: string): Promise<void> {
    // Try to remove from all scopes to be safe
    const scopes: Array<'user' | 'global' | 'session'> = [
      'user',
      'global',
      'session',
    ];

    for (const scope of scopes) {
      try {
        // Allow missing userId for graceful degradation during sign out
        const fullKey = this.buildKey(key, scope, this.userId, true);
        // Skip if userId is missing and scope is 'user'
        if (!fullKey) continue;

        if (typeof window !== 'undefined') {
          localStorage.removeItem(fullKey);
        }
      } catch (error) {
        // Ignore errors for scopes that might not apply
      }
    }
  }

  /**
   * Clear all data in the specified scope
   */
  public async clear(scope?: 'user' | 'global' | 'session'): Promise<void> {
    // If no scope specified, only clear our app's keys
    if (!scope) {
      const allKeys =
        typeof window !== 'undefined' ? Object.keys(localStorage) : [];
      const appKeys = allKeys.filter((key) => key.startsWith('dndev:'));

      for (const key of appKeys) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
      }
      return;
    }

    // Clear specific scope
    const prefix =
      scope === 'user' && this.userId
        ? `dndev:user:${this.userId}:`
        : `dndev:${scope}:`;

    const allKeys =
      typeof window !== 'undefined' ? Object.keys(localStorage) : [];
    const scopeKeys = allKeys.filter((key) => key.startsWith(prefix));

    for (const key of scopeKeys) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    }
  }
}
