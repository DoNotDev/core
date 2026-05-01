/**
 * @fileoverview esbuild CommonJS shim utilities
 * @description Provides shim configuration for esbuild to handle CommonJS globals in ESM bundles.
 * Bootstrap utility — provides shim paths for esbuild before PathResolver is available.
 * Uses native node:path/node:url intentionally.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Comprehensive CommonJS shim banner
 * Provides all CommonJS globals that bundled dependencies might use
 */
export const COMMONJS_SHIM_BANNER = {
  js: `import { createRequire as __createRequire } from 'node:module';\nimport { fileURLToPath } from 'node:url';\nimport { dirname } from 'node:path';\nimport { Buffer } from 'node:buffer';\nimport process from 'node:process';\n\nconst require = __createRequire(import.meta.url);\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = dirname(__filename);\n\nif (typeof globalThis !== 'undefined') {\n  globalThis.require = require;\n  globalThis.__filename = __filename;\n  globalThis.__dirname = __dirname;\n  globalThis.Buffer = Buffer;\n  globalThis.process = process;\n  if (typeof global === 'undefined') {\n    globalThis.global = globalThis;\n  }\n}`,
};

/**
 * Get the path to the CommonJS shim file
 * @param {string} workspaceRoot - Root of the workspace
 * @returns {string} Path to cjs-shim.ts
 */
export function getCommonJsShimPath(workspaceRoot) {
  return join(
    workspaceRoot,
    'packages',
    'tooling',
    'src',
    'bundler',
    'handlers',
    'cjs-shim.ts'
  );
}

/**
 * Get esbuild shim configuration (inject + banner)
 * @param {string} workspaceRoot - Root of the workspace
 * @returns {Object} Object with inject and banner properties
 */
export function getEsbuildShimConfig(workspaceRoot) {
  return {
    inject: [getCommonJsShimPath(workspaceRoot)],
    banner: COMMONJS_SHIM_BANNER,
  };
}
