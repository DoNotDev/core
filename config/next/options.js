/**
 * @fileoverview Next.js Configuration Options and Defaults
 * @description Centralized configuration options for DoNotDev Next.js setup. ALL defaults MUST be defined here in DEFAULT_OPTIONS. Individual handlers and config builders MUST NOT define their own defaults. Priority chain: User config > DEFAULT_OPTIONS > Nothing else.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { SHARED_DEFAULTS } from '../sharedDefaults.js';

/**
 * Default configuration options for Next.js
 * This is the ONLY place where framework defaults are defined
 */
export const DEFAULT_OPTIONS = {
  // Shared defaults (debug, verbose, seo, serverShim, discovery, features)
  ...SHARED_DEFAULTS,

  // Next.js-specific core options
  generateManifest: true,

  // Plugin options — debug cascades from global debug at runtime via ?? (handlerFactory.js)
  // Only declare platform-specific keys here. Shared sections (seo, serverShim, discovery, features)
  // come from ...SHARED_DEFAULTS above.
  routes: {
    disabled: false, // Opt-out: set to true to disable route discovery (if using custom router)
    routingMode: 'app', // 'app' or 'pages'
    generateMiddleware: true,
  },
  themes: {},
  i18n: {
    fallbackLanguage: 'en',
  },
  assets: {},
  pwa: {},
};

/**
 * Deep merge utility
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };

  if (!source) return output;

  Object.keys(source).forEach((key) => {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });

  return output;
}

/**
 * Merge user options with framework defaults
 * User options take precedence over DEFAULT_OPTIONS
 * @param {Object} userOptions - User-provided options
 * @returns {Object} Merged options
 */
export function mergeOptions(userOptions = {}) {
  return deepMerge(DEFAULT_OPTIONS, userOptions);
}

/**
 * Extract and normalize options for different handlers
 * @param {Object} options - Full options object
 * @returns {Object} Normalized options
 */
export function normalizeOptions(options) {
  // Trust merged config - all values already merged from DEFAULT_OPTIONS
  const {
    features: featureOptions = {}, // Nested object safety - already merged (defaults to {})
    routes: routeOptions = {}, // Nested object safety - already merged (includes routingMode, generateMiddleware)
    themes: themeOptions = {}, // Nested object safety - already merged
    i18n: i18nOptions = {}, // Nested object safety - already merged
    assets: assetOptions = {}, // Nested object safety - already merged
    pwa: pwaOptions = {}, // Nested object safety - already merged
    seo: seoOptions = {}, // Nested object safety - already merged (includes generateRobotsTxt, generateSitemap)
    serverShim: serverShimOptions = {}, // Nested object safety - already merged
    discovery: discoveryOptions = {}, // Nested object safety - already merged
    generateManifest,
    debug,
    verbose,
    ...nextConfigOptions
  } = options;

  // Compute ALL derived values ONCE (Single Source of Truth)
  const mode =
    process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const isDev = mode === 'development';

  return {
    // Core options
    generateManifest,
    debug,
    verbose,
    mode,

    // Computed values (derived from above, computed ONCE)
    isDev,

    // Handler-specific options (all defaults already merged from DEFAULT_OPTIONS)
    routeOptions, // Includes routingMode, generateMiddleware
    themeOptions,
    i18nOptions,
    assetOptions,
    featureOptions, // Already merged from DEFAULT_OPTIONS (defaults to {})
    pwaOptions,
    seoOptions, // Includes generateRobotsTxt, generateSitemap
    serverShimOptions,
    discoveryOptions,

    // Rest options
    nextConfigOptions,
  };
}
