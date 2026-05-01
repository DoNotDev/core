// packages/core/i18n/src/utils/storage.ts

/**
 * @fileoverview i18n storage utility
 * @description Storage strategies for translation resources
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import {
  getLocalStorageItem,
  setLocalStorageItem,
  removeLocalStorageItem,
  isLocalStorageAvailable,
  isClient,
} from '@donotdev/utils';

import { getStorageConfig } from './config';

/** Storage backend interface for persisting translation resources. */
export interface StorageStrategy {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
}

interface StorageItem<T = any> {
  value: T;
  created: number;
  expires?: number;
}

abstract class BaseStorage implements StorageStrategy {
  protected config = getStorageConfig();
  protected prefix = this.config.prefix;

  protected getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  protected isExpired(item: StorageItem): boolean {
    if (!item.expires) return false;
    return Date.now() > item.expires;
  }

  protected createStorageItem<T>(value: T, ttl?: number): StorageItem<T> {
    return {
      value,
      created: Date.now(),
      expires: ttl ? Date.now() + ttl : undefined,
    };
  }

  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract remove(key: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract keys(): Promise<string[]>;
  abstract size(): Promise<number>;
}

class LocalStorageStrategy extends BaseStorage {
  public isAvailable(): boolean {
    return isLocalStorageAvailable();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const fullKey = this.getKey(key);
      const item = getLocalStorageItem<StorageItem<T> | null>(fullKey, null);
      if (!item) return null;

      if (this.isExpired(item)) {
        await this.remove(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.warn(
        `[i18n-storage] LocalStorage get error for key ${key}:`,
        error
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const fullKey = this.getKey(key);
      const item = this.createStorageItem(value, ttl || this.config.ttl);
      const itemStr = JSON.stringify(item);

      if (itemStr.length > this.config.maxSize) {
        console.warn(`[i18n-storage] Item too large for key ${key}, skipping`);
        return;
      }

      setLocalStorageItem(fullKey, item);
    } catch (error) {
      console.warn(
        `[i18n-storage] LocalStorage set error for key ${key}:`,
        error
      );
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const fullKey = this.getKey(key);
      removeLocalStorageItem(fullKey);
    } catch (error) {
      console.warn(
        `[i18n-storage] LocalStorage remove error for key ${key}:`,
        error
      );
    }
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const keysToRemove = await this.keys();
      keysToRemove.forEach((key) => removeLocalStorageItem(key));
    } catch (error) {
      console.warn('[i18n-storage] LocalStorage clear error:', error);
    }
  }

  async keys(): Promise<string[]> {
    if (!this.isAvailable()) return [];
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.warn('[i18n-storage] LocalStorage keys error:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }
}

class SessionStorageStrategy extends BaseStorage {
  private isAvailable(): boolean {
    if (!isClient() || !window.sessionStorage) return false;
    try {
      const testKey = '__storage_test__';
      window.sessionStorage.setItem(testKey, 'test');
      window.sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;
    try {
      const fullKey = this.getKey(key);
      const itemStr = window.sessionStorage.getItem(fullKey);
      if (!itemStr) return null;

      const item: StorageItem<T> = JSON.parse(itemStr);
      if (this.isExpired(item)) {
        await this.remove(key);
        return null;
      }
      return item.value;
    } catch (error) {
      console.warn(
        `[i18n-storage] SessionStorage get error for key ${key}:`,
        error
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const fullKey = this.getKey(key);
      const item = this.createStorageItem(value, ttl || this.config.ttl);
      const itemStr = JSON.stringify(item);

      if (itemStr.length > this.config.maxSize) {
        console.warn(`[i18n-storage] Item too large for key ${key}, skipping`);
        return;
      }
      window.sessionStorage.setItem(fullKey, itemStr);
    } catch (error) {
      console.warn(
        `[i18n-storage] SessionStorage set error for key ${key}:`,
        error
      );
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const fullKey = this.getKey(key);
      window.sessionStorage.removeItem(fullKey);
    } catch (error) {
      console.warn(
        `[i18n-storage] SessionStorage remove error for key ${key}:`,
        error
      );
    }
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const keysToRemove = await this.keys();
      keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('[i18n-storage] SessionStorage clear error:', error);
    }
  }

  async keys(): Promise<string[]> {
    if (!this.isAvailable()) return [];
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.warn('[i18n-storage] SessionStorage keys error:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }
}

class IndexedDBStrategy extends BaseStorage {
  private dbName = 'DNDevI18nDB';
  private storeName = 'translations';
  private version = 1;
  private db: IDBDatabase | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      if (!isClient() || !window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = window.indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  private async getTransaction(
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], mode);
    return transaction.objectStore(this.storeName);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const store = await this.getTransaction('readonly');
      const fullKey = this.getKey(key);

      return new Promise((resolve, reject) => {
        const request = store.get(fullKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(null);
            return;
          }

          const item: StorageItem<T> = result.value;
          if (this.isExpired(item)) {
            this.remove(key);
            resolve(null);
            return;
          }
          resolve(item.value);
        };
      });
    } catch (error) {
      console.warn(`[i18n-storage] IndexedDB get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      const fullKey = this.getKey(key);
      const item = this.createStorageItem(value, ttl || this.config.ttl);

      return new Promise((resolve, reject) => {
        const request = store.put({ key: fullKey, value: item });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.warn(`[i18n-storage] IndexedDB set error for key ${key}:`, error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      const fullKey = this.getKey(key);

      return new Promise((resolve, reject) => {
        const request = store.delete(fullKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.warn(
        `[i18n-storage] IndexedDB remove error for key ${key}:`,
        error
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.warn('[i18n-storage] IndexedDB clear error:', error);
    }
  }

  async keys(): Promise<string[]> {
    try {
      const store = await this.getTransaction('readonly');
      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const allKeys = request.result as string[];
          const filteredKeys = allKeys.filter((key) =>
            key.startsWith(this.prefix)
          );
          resolve(filteredKeys);
        };
      });
    } catch (error) {
      console.warn('[i18n-storage] IndexedDB keys error:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }
}

class MemoryStrategy extends BaseStorage {
  private cache = new Map<string, StorageItem>();

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);
    const item = this.cache.get(fullKey);
    if (!item) return null;

    if (this.isExpired(item)) {
      this.cache.delete(fullKey);
      return null;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const item = this.createStorageItem(value, ttl || this.config.ttl);
    this.cache.set(fullKey, item);
  }

  async remove(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    this.cache.delete(fullKey);
  }

  async clear(): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(this.prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys()).filter((key) =>
      key.startsWith(this.prefix)
    );
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }
}

/**
 * Create storage strategy based on configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createStorage(): StorageStrategy {
  const config = getStorageConfig();

  try {
    switch (config.type) {
      case 'localStorage':
        const localStorageStrategy = new LocalStorageStrategy();
        // Test if localStorage actually works
        if (localStorageStrategy.isAvailable()) {
          return localStorageStrategy;
        }
        // Fallback to memory if localStorage fails (SSR, private browsing, etc.)
        // Silent fallback - expected behavior, no warning needed
        return new MemoryStrategy();
      case 'sessionStorage':
        return new SessionStorageStrategy();
      case 'indexedDB':
        return new IndexedDBStrategy();
      case 'memory':
        return new MemoryStrategy();
      default:
        console.warn(
          `[i18n-storage] Unknown storage type: ${config.type}, falling back to memory`
        );
        return new MemoryStrategy();
    }
  } catch (error) {
    // Ultimate fallback - always return memory storage
    console.warn(
      '[i18n-storage] Storage creation failed, using memory fallback:',
      error
    );
    return new MemoryStrategy();
  }
}
