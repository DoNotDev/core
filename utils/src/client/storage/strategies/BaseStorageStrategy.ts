// packages/core/utils/src/client/storage/strategies/BaseStorageStrategy.ts

/**
 * @fileoverview Base storage strategy
 * @description Abstract base class for storage strategies
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { StorageOptions, IStorageStrategy } from '@donotdev/types';

import { handleError } from '../../errors';

/**
 * Abstract base class for storage strategies
 * Provides common functionality and defines interface for concrete strategies
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export abstract class BaseStorageStrategy implements IStorageStrategy {
  /**
   * Build a storage key with proper namespacing and scoping
   * @param key Base key
   * @param scope Storage scope
   * @param userId User ID for user scope
   * @param allowMissingUserId If true, returns null instead of throwing when userId is missing (for graceful degradation during sign out)
   * @returns Properly formatted storage key, or null if userId is missing and allowMissingUserId is true
   */
  protected buildKey(
    key: string,
    scope: 'user' | 'global' | 'session',
    userId?: string | null,
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
   * Abstract method to retrieve data from storage
   */
  abstract get<T>(key: string, options?: StorageOptions): Promise<T | null>;

  /**
   * Abstract method to store data
   */
  abstract set<T>(
    key: string,
    value: T,
    options?: StorageOptions
  ): Promise<void>;

  /**
   * Abstract method to remove data from storage
   */
  abstract remove(key: string): Promise<void>;

  /**
   * Abstract method to clear all data in the specified scope
   */
  abstract clear(scope?: 'user' | 'global' | 'session'): Promise<void>;
}
