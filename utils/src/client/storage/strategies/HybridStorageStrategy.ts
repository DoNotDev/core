// packages/core/utils/src/client/storage/strategies/HybridStorageStrategy.ts

/**
 * @fileoverview Hybrid storage strategy
 * @description Implementation of storage strategy combining localStorage with cloud storage
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { IStorageStrategy, StorageOptions } from '@donotdev/types';

import { LocalStorageStrategy } from './LocalStorageStrategy';
import { handleError } from '../../errors';

/**
 * Hybrid storage strategy that combines local and cloud storage
 * Premium users get both local caching and cloud persistence
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class HybridStorageStrategy implements IStorageStrategy {
  /**
   * Local storage strategy for caching and fallback
   */
  private localStrategy: LocalStorageStrategy;

  /**
   * User ID for scoped storage
   */
  private userId: string;

  /**
   * API endpoint for cloud storage
   */
  private apiEndpoint: string;

  /**
   * Optional auth token getter for authenticated cloud requests
   */
  private getAuthToken?: () => Promise<string | null>;

  /**
   * Create a new HybridStorageStrategy
   * @param userId User ID for user-scoped storage (required)
   * @param apiEndpoint Optional API endpoint for cloud storage
   * @param getAuthToken Optional async function that returns the current auth token
   */
  constructor(
    userId: string,
    apiEndpoint: string = '/api/storage',
    getAuthToken?: () => Promise<string | null>
  ) {
    if (!userId) {
      throw handleError(
        new Error('User ID is required for HybridStorageStrategy')
      );
    }

    this.userId = userId;
    this.localStrategy = new LocalStorageStrategy(userId);
    this.apiEndpoint = apiEndpoint;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Build headers for cloud API requests, including Authorization if available
   */
  private async buildHeaders(
    contentType?: string
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  /**
   * Retrieve data from storage
   * First checks local storage for cached data, then falls back to cloud if needed
   */
  public async get<T>(
    key: string,
    options: StorageOptions = {}
  ): Promise<T | null> {
    try {
      // Try to get from local storage first (for caching/performance)
      const localData = await this.localStrategy.get<T>(key, options);

      // If found in local storage, return it
      if (localData !== null) {
        return localData;
      }

      // If not found locally, try to fetch from cloud
      return await this.getFromCloud<T>(key, options);
    } catch (error) {
      // Fall back to whatever we can get from local storage if cloud fails
      try {
        return await this.localStrategy.get<T>(key, options);
      } catch (fallbackError) {
        throw handleError(error, {
          userMessage: 'Failed to retrieve data from storage',
          context: { key, options, fallbackError },
        });
      }
    }
  }

  /**
   * Store data in both local and cloud storage.
   *
   * Local storage is the source of truth - writes always succeed locally first.
   * Cloud sync is fire-and-forget: failures are logged as warnings, never thrown.
   * This ensures offline/degraded network never crashes the consumer's app.
   *
   * **Do NOT await cloud writes here.** Same pattern as {@link remove}.
   */
  public async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    // Local is source of truth - must succeed
    await this.localStrategy.set<T>(key, value, options);

    // Cloud is fire-and-forget - never throw, never await
    this.setToCloud<T>(key, value, options).catch((error) => {
      handleError(error, {
        userMessage: 'Failed to save data to cloud storage',
        severity: 'warning',
        context: { key, options },
      });
    });
  }

  /**
   * Remove data from both local and cloud storage
   */
  public async remove(key: string): Promise<void> {
    try {
      // Remove from local storage
      await this.localStrategy.remove(key);

      // Also remove from cloud
      this.removeFromCloud(key).catch((cloudError) => {
        handleError(cloudError, {
          severity: 'warning',
          showNotification: false,
        });
      });
    } catch (error) {
      throw handleError(error, {
        userMessage: 'Failed to remove data',
        context: { key },
      });
    }
  }

  /**
   * Clear all data in the specified scope from both local and cloud storage
   */
  public async clear(scope?: 'user' | 'global' | 'session'): Promise<void> {
    try {
      // Clear from local storage
      await this.localStrategy.clear(scope);

      // Also clear from cloud
      this.clearFromCloud(scope).catch((cloudError) => {
        console.warn('Failed to clear cloud storage:', cloudError);
      });
    } catch (error) {
      throw handleError(error, {
        userMessage: 'Failed to clear storage',
        context: { scope },
      });
    }
  }

  /**
   * Build a storage key with proper namespacing and scoping
   * @param key Base key
   * @param scope Storage scope
   * @param userId User ID for user scope
   * @param allowMissingUserId If true, returns null instead of throwing when userId is missing (for graceful degradation during sign out)
   * @returns Properly formatted storage key, or null if userId is missing and allowMissingUserId is true
   */
  private buildKey(
    key: string,
    scope: 'user' | 'global' | 'session',
    userId?: string,
    allowMissingUserId: boolean = false
  ): string | null {
    const prefix = 'dndev';

    switch (scope) {
      case 'user':
        if (!userId) {
          if (allowMissingUserId) {
            // Graceful degradation: return null instead of throwing
            // This allows components to handle missing user gracefully (e.g., during sign out)
            return null;
          }
          throw handleError(
            new Error('User ID is required for user-scoped storage'),
            {
              userMessage: 'Cannot access user data: missing user ID',
              severity: 'error',
              context: { key, scope },
            }
          );
        }
        return `${prefix}:user:${userId}:${key}`;
      case 'global':
        return `${prefix}:global:${key}`;
      case 'session':
        return `${prefix}:session:${key}`;
      default:
        return `${prefix}:${key}`;
    }
  }

  /**
   * Get data from cloud storage
   * @private
   */
  private async getFromCloud<T>(
    key: string,
    options: StorageOptions
  ): Promise<T | null> {
    try {
      const { scope = 'user' } = options;
      // Allow missing userId for graceful degradation during sign out
      const fullKey = this.buildKey(key, scope, this.userId, true);

      // If userId is missing and scope is 'user', return null gracefully
      if (!fullKey) {
        return null;
      }

      // Fetch data from cloud API
      const response = await fetch(
        `${this.apiEndpoint}/${encodeURIComponent(fullKey)}`,
        { headers: await this.buildHeaders() }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw handleError(
          new Error(
            `Cloud storage API error: ${response.status} ${response.statusText}`
          ),
          {
            userMessage: 'Failed to retrieve data from cloud storage',
            severity: 'warning',
            context: { key, status: response.status },
          }
        );
      }

      const data = (await response.json()) as {
        value: T;
        expiresAt?: string;
        createdAt?: string;
      };

      // If data has expired, delete it and return null
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        this.removeFromCloud(key).catch(console.warn);
        return null;
      }

      // Cache the cloud data locally for faster access next time
      this.localStrategy.set(key, data.value, options).catch(console.warn);

      return data.value;
    } catch (error) {
      console.warn('Cloud storage get error:', error);
      return null;
    }
  }

  /**
   * Store data in cloud storage
   * @private
   */
  private async setToCloud<T>(
    key: string,
    value: T,
    options: StorageOptions
  ): Promise<void> {
    const { scope = 'user', expiry = 0 } = options;
    // Allow missing userId for graceful degradation during sign out
    const fullKey = this.buildKey(key, scope, this.userId, true);

    // If userId is missing and scope is 'user', silently skip (no-op)
    if (!fullKey) {
      return;
    }

    // Calculate expiration
    const expiresAt =
      expiry > 0 ? new Date(Date.now() + expiry * 1000).toISOString() : null;

    // Create payload
    const payload = {
      value,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    // Send to cloud API
    const response = await fetch(
      `${this.apiEndpoint}/${encodeURIComponent(fullKey)}`,
      {
        method: 'PUT',
        headers: await this.buildHeaders('application/json'),
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw handleError(
        new Error(
          `Cloud storage API error: ${response.status} ${response.statusText}`
        ),
        {
          userMessage: 'Failed to save data to cloud storage',
          severity: 'error',
          context: { key, status: response.status },
        }
      );
    }
  }

  /**
   * Remove data from cloud storage
   * @private
   */
  private async removeFromCloud(key: string): Promise<void> {
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

        const response = await fetch(
          `${this.apiEndpoint}/${encodeURIComponent(fullKey)}`,
          {
            method: 'DELETE',
            headers: await this.buildHeaders(),
          }
        );

        // We don't need to throw if deletion fails
        if (!response.ok && response.status !== 404) {
          console.warn(
            `Failed to delete from cloud storage: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        // Ignore errors for scopes that might not apply
        console.warn(
          `Error deleting from cloud storage (scope: ${scope}):`,
          error
        );
      }
    }
  }

  /**
   * Clear all data in the specified scope from cloud storage
   * @private
   */
  private async clearFromCloud(
    scope?: 'user' | 'global' | 'session'
  ): Promise<void> {
    try {
      // Determine scope prefix
      const queryParams = new URLSearchParams();
      if (scope) queryParams.append('scope', scope);
      if (scope === 'user') queryParams.append('userId', this.userId);

      const queryString = queryParams.toString();
      const endpoint = queryString
        ? `${this.apiEndpoint}/clear?${queryString}`
        : `${this.apiEndpoint}/clear`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: await this.buildHeaders(),
      });

      if (!response.ok) {
        console.warn(
          `Failed to clear cloud storage: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.warn('Cloud storage clear error:', error);
    }
  }
}
