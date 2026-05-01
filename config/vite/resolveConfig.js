/**
 * @fileoverview Vite Resolve Configuration
 * @description Module resolution and alias configuration for DoNotDev applications with workspace-aware path resolution.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BUNDLING } from '../constants.js';

/**
 * Get custom aliases from user configuration
 * @param {Object|Array} customAliases - Custom aliases from user config
 * @returns {Object} Processed aliases
 */
export function getCustomAliases(customAliases) {
  if (!customAliases) return {};

  const result = {};

  if (Array.isArray(customAliases)) {
    customAliases.forEach(({ find, replacement }) => {
      if (typeof find === 'string') {
        result[find] = replacement;
      }
    });
  } else if (typeof customAliases === 'object') {
    Object.assign(result, customAliases);
  }

  return result;
}

/**
 * Create resolve configuration
 * @param {Object} resolveOptions - Already-merged resolve options from DEFAULT_OPTIONS
 * @returns {Object} Resolve configuration
 * @description
 * Receives already-merged options (not wrapped in object).
 * Merges alias and conditions with framework defaults, returns final Vite resolve config.
 */
export function createResolveConfig(resolveOptions = {}) {
  // Extract alias from resolveOptions to merge with defaults
  const { alias: userAlias, ...restResolveOptions } = resolveOptions;

  // NOTE: No aliasing for optional features - breaks subpath imports (e.g. @donotdev/auth/styles)
  // Graceful degradation happens at RUNTIME via try/catch in useXxxSafe hooks

  // Extract conditions from user config to merge with defaults
  const { conditions: userConditions, ...otherResolveOptions } =
    restResolveOptions;

  return {
    alias: {
      '@': '/src',
      ...getCustomAliases(userAlias),
    },
    // CRITICAL: Dedupe React to prevent multiple instances
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    // CRITICAL: Resolve workspace symlinks to actual files for Vite pre-bundling
    preserveSymlinks: false,
    // POLYMORPHIC ROUTING: 'vite-app' condition triggers Vite-specific hook implementations
    // Package.json exports in @donotdev/ui use this condition to resolve React Router hooks
    // instead of Next.js hooks. This enables the same import path to work in both platforms.
    // CRITICAL: Must include Vite's default conditions for proper ESM resolution!
    conditions: [
      'browser',
      'module',
      'import',
      'vite-app',
      ...(userConditions || []),
    ],
    // Merge all other resolve options (mainFields, etc.)
    ...otherResolveOptions,
  };
}

/**
 * Create optimizeDeps configuration
 * @param {Object} options - Already-merged optimizeDeps options from mergeOptions()
 * @returns {Object} OptimizeDeps configuration
 * @description
 * Receives already-merged options (framework defaults + user additions, already deduped).
 * Only appends constants (optional features, build tools) - no smart merging, that's done in mergeOptions().
 */
export function createOptimizeDepsConfig(options = {}) {
  // Options are already merged from mergeOptions()
  // include/exclude: framework defaults + user additions (already concatenated and deduped)
  // esbuildOptions: framework defaults + user overrides (already deep merged)
  const {
    include: mergedInclude = [],
    exclude: mergedExclude = [],
    esbuildOptions: mergedEsbuildOptions = {},
    ...restOptions
  } = options;

  // @donotdev/* packages are NOT discovered here — they are appended in configResolved
  // (pluginsConfig.js → discoverAppPackages()). This is intentional:
  // - This function runs during Vite's config() phase, BEFORE config.root is resolved.
  // - process.cwd() is unreliable in monorepos (may be repo root, not app root).
  // - discoverAppPackages() needs PathResolver.appRoot, which is only set in configResolved.
  // See discoverAppPackages.js for the full rationale.
  const allIncludes = [...mergedInclude, ...BUNDLING.optionalFeatures];
  const dedupedInclude = [...new Set(allIncludes)];

  // mergedExclude already contains static values from DEFAULT_OPTIONS (buildTools, VIRTUAL_MODULES)
  // Plugins dynamically add their virtual module IDs via config hook
  // No need to append constants here - they're already in DEFAULT_OPTIONS
  const dedupedExcludes = [...new Set(mergedExclude)];

  return {
    // Don't force re-optimization by default (only when deps change)
    // force: true causes 504 timeouts when pre-bundling workspace packages
    include: dedupedInclude,
    exclude: dedupedExcludes,
    esbuildOptions: mergedEsbuildOptions,
    ...restOptions,
  };
}
