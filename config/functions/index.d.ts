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

/**
 * Secrets each function of the built bundle declares
 * (`secrets: [defineSecret('X')]`): entry point → secret names.
 * Functions that declare none are absent.
 */
export type DeclaredSecrets = Record<string, string[]>;

/** Auto-detection options for YAML generation */
export interface AutoDetectOptions {
  /** Path to entry file for export detection (e.g., 'src/index.ts') */
  entryFile?: string;
  /** Unused for secrets: bindings come from the functions' declarations */
  envPath?: string;
  /** Built functions package directory the declarations are read from (default: '.') */
  functionsDir?: string;
  /** Declarations already read with {@link detectDeclaredSecrets} (skips reading the bundle) */
  declaredSecrets?: DeclaredSecrets;
}

/**
 * Auto-detect exported function names from entry file
 */
export function detectExportedFunctions(entryFile: string): string[];

/**
 * List the non-config keys of a .env file. Not used for secret binding:
 * functions.yaml binds what the functions declare ({@link detectDeclaredSecrets}).
 */
export function detectSecretsFromEnv(envPath?: string): string[];

/**
 * Read the secrets each function of the built bundle declares, through the
 * firebase-functions SDK manifest (the bin firebase-tools runs for discovery,
 * with `FUNCTIONS_MANIFEST_OUTPUT_PATH`). Needs no secret value and no network.
 *
 * @param functionsDir - Built functions package directory (default: '.')
 * @throws Error when firebase-functions is missing or the bundle fails to load
 */
export function detectDeclaredSecrets(functionsDir?: string): DeclaredSecrets;

/**
 * Generate functions.yaml content from config.
 * Each endpoint binds (`secretEnvironmentVariables`) the secrets its function
 * declares; `config.functions[name].secrets` overrides them; none → no key.
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
  /** Secret names the bundle declares (union over functions, sorted) */
  autoSecrets: string[];
  /** Per-function declarations, to pass to {@link filterEnvSecrets} */
  declaredSecrets: DeclaredSecrets;
};

/**
 * Filter .env secrets for Firebase deployment.
 * Strips the declared secret keys (the functions' declarations plus
 * `config.functions[name].secrets`) from .env and moves them to .env.local
 * (emulator-only). Every other key stays in .env as plain config.
 */
export function filterEnvSecrets(
  config: FunctionsConfig,
  options?: Pick<AutoDetectOptions, 'functionsDir' | 'declaredSecrets'>
): {
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
  /** Unused for secrets: bindings come from the functions' declarations */
  envPath?: string;
}

/**
 * Build Firebase Functions in one call.
 * Handles: esbuild bundling, functions.yaml generation, .env secret filtering.
 * Each endpoint binds the secrets its function declares in the built bundle.
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

/** Vercel Node.js runtime of scaffolded Vercel functions (`nodejs22.x`) */
export const VERCEL_FUNCTIONS_RUNTIME: string;

/** Build options for buildVercelFunctions */
export interface BuildVercelFunctionsOptions {
  /** Function sources, one function per file, URL `/api/<path>` (default: 'src/api') */
  apiDir?: string;
  /** Build Output directory (default: '.vercel/output') */
  outDir?: string;
  /** Vercel runtime (default: {@link VERCEL_FUNCTIONS_RUNTIME}) */
  runtime?: string;
  /** Minify output (default: true in production) */
  minify?: boolean;
  /** Emit source maps (default: true) */
  sourcemap?: boolean;
}

/** Build Output API v3 `.vc-config.json` of one Node.js function */
export interface VercelFunctionConfig {
  runtime: string;
  handler: 'index.mjs';
  launcherType: 'Nodejs';
  shouldAddHelpers: true;
  shouldAddSourcemapSupport: boolean;
}

/**
 * `.vc-config.json` of a Vercel function built by {@link buildVercelFunctions}:
 * `index.mjs` default-exports the `(req, res)` handler, with Vercel's Node helpers.
 */
export function vercelFunctionConfig(options: {
  runtime: string;
  sourcemap: boolean;
}): VercelFunctionConfig;

/**
 * Build Vercel Functions in one call: each `src/api/<path>.ts` becomes the Build
 * Output API v3 function `.vercel/output/functions/api/<path>.func` (bundled
 * `index.mjs` + `.vc-config.json`), served at `/api/<path>`. `dndev deploy`
 * uploads them with the frontend as one deployment. Files named `_*` / `.*`,
 * `*.d.ts` and tests are not functions. Exits 1 when `src/api` is missing or
 * empty, a path has a `[param]` segment (never matched), or esbuild fails.
 *
 * @example
 * ```js
 * import { buildVercelFunctions } from '@donotdev/core/functions';
 *
 * buildVercelFunctions();
 * ```
 *
 * @returns Function paths built (`api/auth/getCustomClaims`)
 */
export function buildVercelFunctions(
  options?: BuildVercelFunctionsOptions
): Promise<string[]>;
