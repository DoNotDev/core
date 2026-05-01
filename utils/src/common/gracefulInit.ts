// packages/core/utils/src/common/gracefulInit.ts

/**
 * @fileoverview Graceful initialization utilities
 * @description Wraps initialization with graceful error handling and degradation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Wraps initialization with graceful error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param init - Async initialization function
 * @param fallback - Fallback function on error
 * @param featureName - Name of feature for logging
 * @returns Result or false on error
 */
export async function withGracefulDegradation<T>(
  init: () => Promise<T>,
  fallback: () => void,
  featureName: string
): Promise<T | false> {
  // Changed from null to false
  try {
    return await init();
  } catch (error) {
    console.warn(
      `[${featureName}] Initialization failed, running in no-op mode`
    );
    fallback();
    return false; // Changed from null to false
  }
}
