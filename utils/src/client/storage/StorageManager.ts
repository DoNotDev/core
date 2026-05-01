// packages/core/utils/src/client/storage/StorageManager.ts

/**
 * @fileoverview Storage manager
 * @description Main storage manager implementation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  IStorageManager,
  IStorageStrategy,
  StorageOptions,
} from '@donotdev/types';

interface StorageUserData {
  userId: string | null;
  isPro: boolean;
}
import {
  BaseStorageStrategy,
  LocalStorageStrategy,
  HybridStorageStrategy,
} from './strategies';
import { createSingleton, createMethodProxy } from '../../common/singleton';
import { handleError } from '../errors';

/**
 * Storage manager implementation
 * Handles storage operations with automatic strategy selection based on user tier
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class StorageManager implements IStorageManager {
  /**
   * Current storage strategy
   */
  private strategy: IStorageStrategy;
  private initialized = false;
  private userId: string | null = null;
  private isPro: boolean = false;

  /**
   * Create a new StorageManager
   * @param initialStrategy Initial storage strategy
   */
  constructor(initialStrategy: IStorageStrategy = new LocalStorageStrategy()) {
    this.strategy = initialStrategy;
    // Don't initialize listeners in constructor
  }

  /**
   * Lazily initialize the event listeners
   */
  private initialize(): void {
    if (this.initialized) return;

    try {
      // Removed EDA - no more events needed
      // User data is now managed directly through the store

      this.initialized = true;
    } catch (error) {
      handleError(error, { severity: 'warning', showNotification: false });
      // Continue without event listeners - still functional but won't auto-update
    }
  }

  /**
   * Set the storage strategy
   * @param strategy New storage strategy
   */
  public setStrategy(strategy: IStorageStrategy): void {
    this.initialize(); // Ensure initialization
    this.strategy = strategy;
  }

  /**
   * Update user information and select appropriate strategy
   * @param userId User ID or null
   * @param isPro Whether user has pro/enterprise tier
   */
  public updateUser(userId: string | null, isPro: boolean): void {
    this.initialize(); // Ensure initialization

    if (isPro && userId) {
      // Pro/enterprise users get hybrid storage
      this.strategy = new HybridStorageStrategy(userId);
    } else {
      // Free users get local storage only
      this.strategy = new LocalStorageStrategy(userId);
    }
  }

  private updateStrategy() {
    // Update storage strategy based on user state
    if (this.isPro && this.userId) {
      this.strategy = new HybridStorageStrategy(this.userId);
    } else {
      this.strategy = new LocalStorageStrategy(this.userId);
    }
  }

  /**
   * Retrieve data from storage
   */
  public async get<T>(
    key: string,
    options: StorageOptions = {}
  ): Promise<T | null> {
    this.initialize(); // Ensure initialization
    return this.strategy.get<T>(key, options);
  }

  /**
   * Store data
   */
  public async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    this.initialize(); // Ensure initialization
    return this.strategy.set<T>(key, value, options);
  }

  /**
   * Remove data from storage
   */
  public async remove(key: string): Promise<void> {
    this.initialize(); // Ensure initialization
    return this.strategy.remove(key);
  }

  /**
   * Clear all data in the specified scope
   */
  public async clear(scope?: 'user' | 'global' | 'session'): Promise<void> {
    this.initialize(); // Ensure initialization
    return this.strategy.clear(scope);
  }

  /**
   * Store sensitive data with encryption
   */
  public async setSecure<T>(
    key: string,
    value: T,
    options: Omit<StorageOptions, 'encryption'> = {}
  ): Promise<void> {
    this.initialize(); // Ensure initialization
    return this.set(key, value, { ...options, encryption: true });
  }

  /**
   * Retrieve sensitive data with decryption
   */
  public async getSecure<T>(
    key: string,
    options: Omit<StorageOptions, 'encryption'> = {}
  ): Promise<T | null> {
    this.initialize(); // Ensure initialization
    return this.get<T>(key, { ...options, encryption: true });
  }
}

// Create singleton getter
const getStorageManager = createSingleton(StorageManager);

// Export factory function only - singleton accessed via registry pattern
export { getStorageManager };

// For TypeScript type safety
export type { IStorageManager, StorageOptions };
