// packages/core/utils/src/client/storage/safeStorage.ts

import { isClient } from '../platformDetection';

/**
 * @fileoverview Safe Storage Utilities - SSR-compatible storage access
 * @description Provides safe access to browser storage APIs with SSR guards
 * Imperative API for use outside React (workers, init code, callbacks, utilities).
 * For reactive storage in components, use useLocalStorage hook instead.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Safe sessionStorage access with SSR compatibility
 * Handles cases where window is undefined (SSR) or storage is unavailable
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (!isClient()) return null;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isClient()) return;
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  },
  removeItem: (key: string): void => {
    if (!isClient()) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
};

/**
 * Safe localStorage access with SSR compatibility
 * Handles cases where window is undefined (SSR) or storage is unavailable
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isClient()) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isClient()) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  },
  removeItem: (key: string): void => {
    if (!isClient()) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
};
