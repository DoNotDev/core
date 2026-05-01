// packages/core/config/functions/buildFunctions.js

/**
 * @fileoverview High-level build orchestrator for Firebase Functions
 * @description Single function call to build, generate YAML, and filter secrets.
 * Equivalent of `defineViteConfig` but for Firebase Functions.
 *
 * @example
 * ```js
 * // Consumer's build.mjs (3 lines)
 * import { buildFunctions } from '@donotdev/core/functions';
 * import { functionsConfig } from './functions.config.js';
 *
 * buildFunctions(functionsConfig);
 * ```
 *
 * @version 0.0.1
 * @since 0.0.5
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from '../utils/PathResolver.js';
import { createFunctionsConfig } from './functions.js';
import {
  generateFunctionsYamlWithInfo,
  generateCrudExports,
  filterEnvSecrets,
} from './generateYaml.js';
import { detectWorkspace } from './workspace.js';

/**
 * Create esbuild configuration for app functions
 * @param {Object} options - Configuration options
 * @returns {Object} esbuild configuration
 */
function createAppFunctionsConfig(options = {}) {
  const workspace = detectWorkspace();
  return createFunctionsConfig({
    ...options,
    platform: 'firebase',
    bundleWorkspaceDeps: true,
    importFramework: true,
    workspace,
  });
}

/**
 * Build Firebase Functions in one call.
 * Handles: esbuild bundling, functions.yaml generation, .env secret filtering.
 *
 * @param {import('@donotdev/types').FunctionsConfig} functionsConfig - Functions configuration
 * @param {Object} [options] - Build options
 * @param {string} [options.entry='src/index.ts'] - Entry point file
 * @param {string} [options.outDir='lib'] - Output directory
 * @param {boolean} [options.minify] - Minify output (default: true in production)
 * @param {boolean} [options.sourcemap=true] - Generate source maps
 * @param {boolean} [options.analyze=false] - Print bundle analysis
 * @param {string} [options.entryFile='src/index.ts'] - Entry file for auto-detection
 * @param {string} [options.envPath='.env'] - .env path for secret detection
 * @returns {Promise<void>}
 */
export async function buildFunctions(functionsConfig, options = {}) {
  const {
    entry = 'src/index.ts',
    outDir = 'lib',
    minify = process.env.NODE_ENV === 'production',
    sourcemap = true,
    analyze = false,
    entryFile = 'src/index.ts',
    envPath = '.env',
    ...restOptions
  } = options;

  console.log('Building functions...');

  try {
    // 0. Regenerate .generated/crud-exports.ts from the current CRUD_OPERATIONS
    //    list × configured entities. Must run before esbuild so the emitted
    //    top-level exports are in the bundle Firebase CLI inspects.
    const pathResolver = PathResolver.getInstance();
    const crudExports = generateCrudExports(functionsConfig);
    pathResolver.writeSync('src/.generated/crud-exports.ts', crudExports, {
      overwrite: true,
    });

    // 1. esbuild
    const { build } = await import('esbuild');
    const config = createAppFunctionsConfig({
      entry,
      outDir,
      minify,
      sourcemap,
      ...restOptions,
    });

    const result = await build(config);

    if (result.errors.length > 0) {
      console.error('Build errors:', result.errors);
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn('Build warnings:', result.warnings);
    }

    console.log('Functions built successfully.');

    // 2. Generate functions.yaml
    const { yaml, staticFunctions, crudFunctions, autoDetected, autoSecrets } =
      generateFunctionsYamlWithInfo(functionsConfig, { entryFile, envPath });

    // Always overwrite — functions.yaml is a generated artifact and
    // writeSync defaults to no-op-on-exists (silent skip).
    pathResolver.writeSync('functions.yaml', yaml, { overwrite: true });
    console.log(
      `Generated functions.yaml: ${staticFunctions.length} static + ${crudFunctions.length} CRUD`
    );

    if (autoDetected.length > 0) {
      console.log(
        `Auto-detected ${autoDetected.length} function(s): ${autoDetected.join(', ')}`
      );
    }
    if (autoSecrets.length > 0) {
      console.log(
        `Auto-detected ${autoSecrets.length} secret(s): ${autoSecrets.join(', ')}`
      );
    }

    // 3. Filter .env secrets
    const { stripped } = filterEnvSecrets(functionsConfig);
    if (stripped.length > 0) {
      console.log(
        `Filtered ${stripped.length} secret(s) from .env to .env.local`
      );
    }

    // 4. Optional bundle analysis
    if (analyze && result.metafile) {
      const { analyzeMetafile } = await import('esbuild');
      const analysis = await analyzeMetafile(result.metafile);
      console.log('\nBundle analysis:');
      console.log(analysis);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}
