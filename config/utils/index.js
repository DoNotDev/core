/**
 * @fileoverview Utilities Index
 * @description Shared utilities used across all discovery engines and platform adapters. Provides centralized exports for path resolution, CSS extraction, utility generation, and debug logging.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// ----- config/src/utils/index.js -----

// Core utilities
export * from './PathResolver.js';
export * from './CSSExtractor.js';
export * from './debugLog.js';
export * from './buildError.js';
export * from './detectOptionalDeps.js';
export {
  discoverAppPackages,
  SERVER_ONLY_PACKAGES,
} from './discoverAppPackages.js';
