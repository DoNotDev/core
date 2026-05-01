// packages/core/utils/src/client/localStorage.ts

/**
 * @fileoverview localStorage Utilities
 * @description Utility functions for localStorage operations with error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { isClient } from './platformDetection';

/**
 * Safe localStorage.getItem with error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param key - localStorage key
 * @param defaultValue - Default value if key doesn't exist or error occurs
 * @returns Stored value or default value
 */
export function getLocalStorageItem<T = string>(
  key: string,
  defaultValue: T
): T {
  if (!isClient() || !window.localStorage) {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item === null) return defaultValue;

    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(item);
    } catch {
      return item as T;
    }
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safe localStorage.setItem with error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param key - localStorage key
 * @param value - Value to store
 * @returns Success boolean or StorageError object
 */
export function setLocalStorageItem<T>(
  key: string,
  value: T
): boolean | StorageError {
  if (!isClient() || !window.localStorage) {
    return {
      type: 'unavailable',
      message: 'localStorage is not available',
    };
  }

  try {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    const storageError = detectStorageError(error);
    console.warn(`Error setting localStorage key "${key}":`, storageError);
    return storageError;
  }
}

/**
 * Safe localStorage.removeItem with error handling
 * @param key - localStorage key
 * @returns Whether the operation was successful
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function removeLocalStorageItem(key: string): boolean {
  if (!isClient() || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Error removing localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Safe localStorage.clear with error handling
 * @returns Whether the operation was successful
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function clearLocalStorage(): boolean {
  if (!isClient() || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.clear();
    return true;
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
    return false;
  }
}

/**
 * Storage error type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type StorageErrorType =
  | 'quota_exceeded'
  | 'security_error'
  | 'unavailable'
  | 'unknown';

/**
 * Storage error interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface StorageError {
  type: StorageErrorType;
  message: string;
  originalError?: unknown;
}

/**
 * Detect storage error type from exception
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function detectStorageError(error: unknown): StorageError {
  if (!isClient() || !window.localStorage) {
    return {
      type: 'unavailable',
      message: 'localStorage is not available in this environment',
      originalError: error,
    };
  }

  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      return {
        type: 'quota_exceeded',
        message: 'localStorage quota exceeded',
        originalError: error,
      };
    }
    if (error.name === 'SecurityError' || error.code === 18) {
      return {
        type: 'security_error',
        message: 'localStorage access denied (blocked by browser/extension)',
        originalError: error,
      };
    }
  }

  return {
    type: 'unknown',
    message: String(error),
    originalError: error,
  };
}

/**
 * Check if localStorage is available
 * @returns Whether localStorage is available
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isLocalStorageAvailable(): boolean {
  if (!isClient() || !window.localStorage) {
    return false;
  }

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
