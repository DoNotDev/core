// packages/core/utils/src/common/lazyImport.ts

/**
 * @fileoverview Lazy import utility
 * @description Caches dynamic imports for performance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

const importCache = new Map<string, Promise<unknown>>();

/**
 * Lazy import with caching
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param importFn - Dynamic import function
 * @param cacheKey - Cache key for this import
 * @returns Cached or fresh import result
 */
export function lazyImport<T>(
  importFn: () => Promise<T>,
  cacheKey: string
): Promise<T> {
  if (importCache.has(cacheKey)) {
    // why: heterogeneous cache keyed by string; the same cacheKey always maps to the same module type
    return importCache.get(cacheKey) as Promise<T>;
  }

  const importPromise = importFn().catch((error) => {
    importCache.delete(cacheKey);
    throw error;
  });
  importCache.set(cacheKey, importPromise);
  return importPromise;
}
