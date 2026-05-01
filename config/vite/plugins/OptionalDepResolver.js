/**
 * @fileoverview Optional Dependency Resolver Plugin
 * @description Aliases missing optional dependencies to empty module at resolve time.
 * Covers BOTH Vite's plugin pipeline (resolveId) AND esbuild pre-bundling (optimizeDeps).
 *
 * Why two layers:
 * - Vite plugins don't run during esbuild pre-bundling (optimizeDeps).
 * - When esbuild pre-bundles @donotdev/ui, it encounters imports like
 *   `import * from "@donotdev/oauth"`. Without an esbuild plugin, Vite's
 *   built-in resolver generates a throw-on-import stub (__vite-optional-peer-dep).
 * - The esbuild plugin aliases these to empty.cjs during pre-bundling.
 * - The Vite resolveId covers build mode and non-optimized imports.
 *
 * SSOT: detection runs once in configResolved, isMissingOptionalDep() is the
 * single matcher shared by both resolvers.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from '../../utils/PathResolver.js';
import { detectMissingOptionalDeps } from '../../utils/detectOptionalDeps.js';

/**
 * Check if an import ID matches a missing optional dependency.
 * Matches exact package name OR subpath (e.g. 'shiki/engine/javascript').
 * SSOT matcher — used by both Vite resolveId and esbuild plugin.
 *
 * @param {string} id - Import specifier
 * @param {string[]} missing - List of missing optional dep names
 * @returns {boolean}
 */
function isMissingOptionalDep(id, missing) {
  return missing.some((pkg) => id === pkg || id.startsWith(pkg + '/'));
}

/**
 * Create Vite plugin for optional dependency resolution
 * @param {Object} options - Plugin options
 * @param {boolean} [options.debug] - Enable debug logging
 * @returns {import('vite').Plugin} Vite plugin
 */
export function createOptionalDepResolverPlugin(options = {}) {
  // Shared state: populated in configResolved, read by both resolvers.
  // esbuild optimizer runs AFTER configResolved, so the array is populated in time.
  let missing = [];
  let emptyModulePath = '';
  let emptyCjsPath = '';

  return {
    name: 'dndev-optional-dep-resolver',
    enforce: 'pre',

    config(config) {
      // Inject esbuild plugin into optimizeDeps — runs during pre-bundling.
      // Uses closure over `missing` array which gets populated in configResolved
      // (which runs before the optimizer starts).
      const esbuildPlugin = {
        name: 'dndev-optional-dep-esbuild',
        setup(build) {
          // Filter: match any of the missing optional deps
          build.onResolve({ filter: /^[@a-z]/, namespace: 'file' }, (args) => {
            if (isMissingOptionalDep(args.path, missing)) {
              // empty.cjs — CJS has dynamic exports, esbuild allows any named import.
              return { path: emptyCjsPath, external: false };
            }
            return null;
          });
        },
      };

      const existing = config.optimizeDeps?.esbuildOptions?.plugins || [];
      return {
        optimizeDeps: {
          esbuildOptions: {
            plugins: [...existing, esbuildPlugin],
          },
        },
      };
    },

    configResolved(config) {
      const pathResolver = PathResolver.getInstance();
      const appRoot = pathResolver.getAppRoot();

      // Detect missing optional deps (SSOT — single detection, two consumers).
      // - @donotdev/* packages: checks consumer's explicit package.json deps
      //   (physical presence is irrelevant — dn pack installs all as transitive)
      // - Third-party deps: checks physical resolution
      const result = detectMissingOptionalDeps(appRoot);
      missing = result.missing;

      emptyModulePath = pathResolver.getEmptyModulePath();
      emptyCjsPath = pathResolver.getEmptyCjsModulePath();

      // Exclude missing deps from optimizer to prevent __vite-optional-peer-dep stubs
      if (missing.length > 0) {
        const existing = config.optimizeDeps?.exclude || [];
        config.optimizeDeps.exclude = [...existing, ...missing];
      }

      if (options.debug && missing.length > 0) {
        console.log(`[dndev] Missing optional deps: ${missing.join(', ')}`);
      }
    },

    resolveId(id) {
      if (isMissingOptionalDep(id, missing)) {
        // syntheticNamedExports: Rollup derives any named import from the default export.
        // empty.js default-exports a Proxy that absorbs any property access → no MISSING_EXPORT warnings.
        return { id: emptyModulePath, syntheticNamedExports: true };
      }
      return null;
    },
  };
}
