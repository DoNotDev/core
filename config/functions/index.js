/**
 * @fileoverview esbuild configuration factory for Firebase Functions
 * @description Creates esbuild configurations for bundling workspace dependencies
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFunctionsConfig } from './functions.js';
import { detectWorkspace } from './workspace.js';

/**
 * Create esbuild configuration for Firebase Functions
 * @param {Object} options - Configuration options
 * @param {string} [options.entry] - Entry point file
 * @param {string} [options.outDir] - Output directory
 * @param {boolean} [options.minify] - Whether to minify output
 * @param {boolean} [options.sourcemap] - Whether to generate source maps
 * @param {string} [options.platform] - Target platform (firebase, vercel)
 * @returns {Object} esbuild configuration
 */
export function createFunctionsEsbuildConfig(options = {}) {
  const {
    entry = 'src/index.ts',
    outDir = 'lib',
    minify = false,
    sourcemap = true,
    platform = 'firebase',
    ...restOptions
  } = options;

  const workspace = detectWorkspace();

  return createFunctionsConfig({
    entry,
    outDir,
    minify,
    sourcemap,
    platform,
    workspace,
    ...restOptions,
  });
}

/**
 * Create esbuild configuration for root functions (framework package)
 * @param {Object} options - Configuration options
 * @returns {Object} esbuild configuration
 */
export function createRootFunctionsConfig(options = {}) {
  return createFunctionsEsbuildConfig({
    ...options,
    platform: 'framework',
    bundleWorkspaceDeps: true,
  });
}

/**
 * Create esbuild configuration for app functions
 * @param {Object} options - Configuration options
 * @returns {Object} esbuild configuration
 */
export function createAppFunctionsConfig(options = {}) {
  return createFunctionsEsbuildConfig({
    ...options,
    platform: 'firebase',
    bundleWorkspaceDeps: true,
    importFramework: true,
  });
}

// YAML generation and .env utilities
export {
  generateFunctionsYaml,
  generateFunctionsYamlWithInfo,
  filterEnvSecrets,
} from './generateYaml.js';

// High-level build orchestrator (consumer-facing)
export { buildFunctions } from './buildFunctions.js';
