'use client';
// packages/core/utils/src/client/storage/hooks/useStorageManager.ts

/**
 * @fileoverview useStorageManager hook
 * @description React hook for using StorageManager
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useRef } from 'react';

import type { IStorageManager } from '@donotdev/types';

import { StorageManager } from '../StorageManager';

/**
 * React hook for using StorageManager
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns StorageManager instance
 */
export function useStorageManager(): IStorageManager {
  // Create StorageManager instance on first render
  const managerRef = useRef<StorageManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new StorageManager();
  }

  return managerRef.current;
}
