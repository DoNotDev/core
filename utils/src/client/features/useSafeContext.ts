// packages/core/utils/src/client/features/useSafeContext.ts

/**
 * @fileoverview Safe context hook
 * @description React hook for safely accessing context with error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useDebugValue } from 'react';

import { handleError } from '../errors';

/**
 * Safe context hook with error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useSafeContext<T>(context: T | undefined, name: string): T {
  useDebugValue(context, (ctx) => `${name}: ${!!ctx}`);
  if (!context) {
    throw handleError(null, `${name} must be used within a ${name}Provider`);
  }
  return context;
}
