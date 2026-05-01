// ----- config/src/index.js -----
/**
 * @fileoverview Unified configuration package
 * @description @donotdev/config - Unified Configuration Package. Pure exports only - no business logic. Provides platform configurations and discovery engines.
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Platform configurations - public API only
export * from './vite/index.js';
export * from './next/index.js';

// Internal framework configurations (for CLI and functions build scripts)
export * from './esbuild/index.js';
