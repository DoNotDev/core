// packages/core/config/functions/index.d.ts
/**
 * @fileoverview Type Definitions for esbuild Configuration
 * @description TypeScript type definitions for esbuild configuration used in Firebase and Vercel function builds.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { BuildOptions } from 'esbuild';
import type { FunctionsConfig } from '@donotdev/types';

/**
 * Esbuild configuration options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EsbuildOptions {
  entry?: string;
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean;
  platform?: 'firebase' | 'vercel' | 'framework';
  bundleWorkspaceDeps?: boolean;
  importFramework?: boolean;
  external?: boolean;
}

/**
 * Create esbuild configuration for functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createFunctionsEsbuildConfig(
  options?: EsbuildOptions
): BuildOptions;
/**
 * Create root functions esbuild configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createRootFunctionsConfig(
  options?: EsbuildOptions
): BuildOptions;
/**
 * Create app functions esbuild configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createAppFunctionsConfig(
  options?: EsbuildOptions
): BuildOptions;

/** Auto-detection options for YAML generation */
export interface AutoDetectOptions {
  /** Path to entry file for export detection (e.g., 'src/index.ts') */
  entryFile?: string;
  /** Path to .env file for secret detection (default: '.env') */
  envPath?: string;
}

/**
 * Auto-detect exported function names from entry file
 */
export function detectExportedFunctions(entryFile: string): string[];

/**
 * Auto-detect secret keys from .env file (non-config keys)
 */
export function detectSecretsFromEnv(envPath?: string): string[];

/**
 * Generate functions.yaml content from config
 */
export function generateFunctionsYaml(
  config: FunctionsConfig,
  options?: AutoDetectOptions
): string;

/**
 * Generate yaml and return metadata
 */
export function generateFunctionsYamlWithInfo(
  config: FunctionsConfig,
  options?: AutoDetectOptions
): {
  yaml: string;
  functions: string[];
  staticFunctions: string[];
  crudFunctions: string[];
  autoDetected: string[];
  autoSecrets: string[];
};

/**
 * Filter .env secrets for Firebase deployment
 * Strips secret keys from .env and moves them to .env.local (emulator-only)
 */
export function filterEnvSecrets(config: FunctionsConfig): {
  stripped: string[];
  kept: number;
};

/** Build options for buildFunctions */
export interface BuildFunctionsOptions {
  /** Entry point file (default: 'src/index.ts') */
  entry?: string;
  /** Output directory (default: 'lib') */
  outDir?: string;
  /** Minify output (default: true in production) */
  minify?: boolean;
  /** Generate source maps (default: true) */
  sourcemap?: boolean;
  /** Print bundle analysis (default: false) */
  analyze?: boolean;
  /** Entry file for auto-detection (default: 'src/index.ts') */
  entryFile?: string;
  /** .env path for secret detection (default: '.env') */
  envPath?: string;
}

/**
 * Build Firebase Functions in one call.
 * Handles: esbuild bundling, functions.yaml generation, .env secret filtering.
 *
 * @example
 * ```js
 * import { buildFunctions } from '@donotdev/core/functions';
 * import { functionsConfig } from './functions.config.js';
 *
 * buildFunctions(functionsConfig);
 * ```
 */
export function buildFunctions(
  functionsConfig: FunctionsConfig,
  options?: BuildFunctionsOptions
): Promise<void>;
