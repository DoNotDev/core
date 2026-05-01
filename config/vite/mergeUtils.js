/**
 * @fileoverview Configuration Merge Utilities
 * @description Explicit merge strategies for different option types with conflict handling
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Merge strategies for different option types
 * @enum {string}
 */
export const MERGE_STRATEGY = {
  /** Concatenate arrays, dedupe */
  CONCATENATE_DEDUPE: 'CONCATENATE_DEDUPE',
  /** Shallow merge objects (user overrides defaults) */
  SHALLOW_MERGE: 'SHALLOW_MERGE',
  /** Deep merge objects (nested objects merged recursively) */
  DEEP_MERGE: 'DEEP_MERGE',
  /** Replace entirely */
  REPLACE: 'REPLACE',
};

/**
 * Merge configuration with explicit strategy
 * @param {any} defaultValue - Framework default value
 * @param {any} userValue - User-provided value
 * @param {MERGE_STRATEGY} strategy - Merge strategy to use
 * @param {Object} options - Additional options
 * @param {string[]} [options.protectedKeys] - Keys that cannot be overridden (for DEEP_MERGE)
 * @param {Function} [options.onConflict] - Callback when conflict detected
 * @returns {any} Merged value
 */
export function mergeConfig(defaultValue, userValue, strategy, options = {}) {
  const { protectedKeys = [], onConflict } = options;

  // Handle undefined/null user values
  if (userValue === undefined || userValue === null) {
    return defaultValue;
  }

  switch (strategy) {
    case MERGE_STRATEGY.CONCATENATE_DEDUPE: {
      if (!Array.isArray(defaultValue) || !Array.isArray(userValue)) {
        return userValue;
      }
      const merged = [...defaultValue, ...userValue];
      return [...new Set(merged)];
    }

    case MERGE_STRATEGY.SHALLOW_MERGE: {
      if (
        typeof defaultValue !== 'object' ||
        typeof userValue !== 'object' ||
        defaultValue === null ||
        userValue === null ||
        Array.isArray(defaultValue) ||
        Array.isArray(userValue)
      ) {
        return userValue;
      }
      return { ...defaultValue, ...userValue };
    }

    case MERGE_STRATEGY.DEEP_MERGE: {
      if (
        typeof defaultValue !== 'object' ||
        typeof userValue !== 'object' ||
        defaultValue === null ||
        userValue === null ||
        Array.isArray(defaultValue) ||
        Array.isArray(userValue)
      ) {
        return userValue;
      }

      const merged = { ...defaultValue };
      for (const key in userValue) {
        if (protectedKeys.includes(key)) {
          // Protected key - warn user but keep framework default
          if (onConflict) {
            onConflict(key, defaultValue[key], userValue[key]);
          }
          continue;
        }

        if (
          typeof merged[key] === 'object' &&
          typeof userValue[key] === 'object' &&
          merged[key] !== null &&
          userValue[key] !== null &&
          !Array.isArray(merged[key]) &&
          !Array.isArray(userValue[key])
        ) {
          // Recursively merge nested objects
          merged[key] = mergeConfig(
            merged[key],
            userValue[key],
            MERGE_STRATEGY.DEEP_MERGE,
            { protectedKeys, onConflict }
          );
        } else {
          merged[key] = userValue[key];
        }
      }
      return merged;
    }

    case MERGE_STRATEGY.REPLACE:
    default:
      return userValue;
  }
}

/**
 * Merge array with conflict detection
 * @param {any[]} defaultArray - Framework default array
 * @param {any[]} userArray - User-provided array
 * @param {any[]} frameworkRequired - Items that must be in final array (framework requirements)
 * @param {Function} [onConflict] - Callback when user excludes required item (unused for include arrays)
 * @returns {any[]} Merged and deduped array
 * @description
 * For include arrays: Simply concatenate and dedupe (user additions to framework defaults).
 * Conflicts are only checked in exclude arrays, not include arrays.
 * Framework requirements are automatically included in the final result.
 */
export function mergeArrayWithConflicts(
  defaultArray,
  userArray,
  frameworkRequired = [],
  onConflict
) {
  // Concatenate framework defaults + user additions
  const merged = [...defaultArray, ...(userArray || [])];
  const deduped = [...new Set(merged)];

  // Ensure framework requirements are included (they're already in defaultArray, but ensure anyway)
  const final = [...new Set([...deduped, ...frameworkRequired])];
  return final;
}
