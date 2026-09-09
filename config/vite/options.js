/**
 * @fileoverview Vite Configuration Options and Defaults
 * @description Centralized configuration options for DoNotDev Vite setup. ALL defaults MUST be defined here in DEFAULT_OPTIONS. Individual config builders MUST NOT define their own defaults. Priority chain: User config > DEFAULT_OPTIONS > Nothing else.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BUNDLING, VIRTUAL_MODULES } from '../constants.js';
import { SHARED_DEFAULTS } from '../sharedDefaults.js';
import {
  mergeConfig,
  mergeArrayWithConflicts,
  MERGE_STRATEGY,
} from './mergeUtils.js';

/**
 * Default configuration options for Vite
 * This is the ONLY place where framework defaults are defined
 */
export const DEFAULT_OPTIONS = {
  // Shared defaults (debug, verbose, seo, serverShim, discovery, features)
  ...SHARED_DEFAULTS,

  // React Compiler (stable since 1.0). Off by default: it changes the render
  // behaviour of every component in the app, so each app opts in once its
  // components are verified against the rules of React.
  // Enable per app with `reactCompiler: true` in the app's vite config.
  reactCompiler: false,

  // Vite-specific core options
  base: '/',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  // Suppress Vite's native info logs (module count, chunk rendering) in production
  // Framework's own build summary provides cleaner output
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',

  // Server options
  server: {
    port: 3000,
    // strictPort: true — INTENTIONAL. Local stores (localStorage, cookies, service workers,
    // IndexedDB) are bound to origin. Changing port loses all persisted state.
    strictPort: true,
    host: true, // All interfaces
    open: true,
    cors: true,
    // HTTPS disabled by default - localhost is a secure context (no cert needed)
    // Enable with server: { https: true } for trusted cert via @vitejs/plugin-basic-ssl
    https: false,
    // HMR configuration - customer-configurable for cross-platform compatibility
    hmr: {
      overlay: true, // Show error overlay in browser
      timeout: 5000, // HMR connection timeout (ms)
      // Protocol: Let Vite auto-detect (wss for HTTPS, ws for HTTP)
      // Only set explicitly if you need to override Vite's detection
      // protocol: 'wss', // Uncomment to force wss (not recommended - let Vite handle it)
      // Auto-detect: undefined means let Vite auto-detect or use native watching
      // Set to true for Docker/WSL2/network filesystems
      usePolling: undefined,
      interval: 2000, // Polling interval (ms) when usePolling is true
    },
    // File watching configuration
    watch: {
      usePolling: undefined, // Auto-detect or enable for Docker/WSL2
      interval: 2000, // Polling interval (ms)
      // Files to ignore are configured in buildConfig.js
    },
  },

  // Build options
  build: {
    sourcemap: true,
    target: 'es2020',
    minify: 'esbuild',
    // CSS minification handled by Vite's built-in esbuild minifier
    cssMinify: 'esbuild',
    analyze: false, // Bundle analyzer - opt-in (enable with build: { analyze: true })
  },

  // Preview options
  preview: {
    port: 4173,
    // Same rationale as server.strictPort — origin-bound stores must persist.
    strictPort: true,
    host: true,
    open: false,
    cors: true,
    // HTTPS disabled by default - localhost is a secure context (no cert needed)
    // Enable with preview: { https: true } for trusted cert via @vitejs/plugin-basic-ssl
    https: false,
  },

  // Plugin options
  routes: {
    hmr: true, // Enable HMR for route changes (set to false to reduce log spam)
  },
  themes: {},
  i18n: {},
  assets: {},
  pwa: {
    enabled: false,
  },
  // Prerender options - ON by default: auto-discovers public routes from manifest
  // Override: prerender: false (opt-out), prerender: ['/a', '/b'] (explicit), prerender: { routes: 'auto' }
  prerender: {
    routes: 'auto', // 'auto' discovers all public static routes from manifest
  },
  chunking: {
    // React-core patterns - user patterns are APPENDED to framework defaults
    reactCore: [],
  },
  pluginFactory: {
    verbose: true,
    disableHmr: false, // HMR enabled - framework must support native HMR
    hmrSmartDetection: true,
    hmrDebounceMs: 500,
    hmrCacheTimeout: 30000,
  },

  // Resolve options
  resolve: {
    alias: {
      '@': '/src',
    },
    preserveSymlinks: false, // Let Vite handle symlinks automatically
  },

  // Define options
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __PROD__: JSON.stringify(process.env.NODE_ENV === 'production'),
  },

  // Vite options - all handled at DEFAULT_OPTIONS level
  optimizeDeps: {
    /**
     * Include in dependency optimization
     * Mandatory dependencies are referenced from constants (BUNDLING.mandatoryIncludes).
     * Optional features are appended at factory time (from BUNDLING.optionalFeatures).
     * @type {string[]}
     */
    include: [
      // Mandatory dependencies - required for framework to function (from BUNDLING.mandatoryIncludes)
      ...BUNDLING.mandatoryIncludes,
      // Optional features are appended at factory time (from BUNDLING.optionalFeatures)
    ],
    /**
     * Exclude from dependency optimization
     * Static values (build tools, virtual modules) are referenced from constants.
     * Dynamic values (plugin virtual module IDs) are added by plugins at runtime via config hook.
     * @type {string[]}
     */
    exclude: [
      // Build tools - not runtime dependencies, shouldn't be optimized (from BUNDLING.buildTools)
      ...BUNDLING.buildTools,
      // Virtual modules - generated at build time, not real packages (from VIRTUAL_MODULES)
      ...Object.values(VIRTUAL_MODULES),
      // Note: Plugins dynamically add their virtual module IDs via config hook (PluginFactory.js)
    ],
    esbuildOptions: {
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV || 'development'
        ),
      },
      external: ['next', 'next/*'],
    },
  },

  // Plugins - framework plugins are added in pluginsConfig.js
  // User plugins are appended here
  plugins: [],

  // CSS options - PostCSS config is added in config.js
  css: {},

  // Environment directory - Vite auto-resolves relative to vite.config.ts
  envDir: undefined,
};

/**
 * Merge user options with defaults using explicit merge strategies
 * @param {Object} userOptions - User-provided options
 * @param {Object} options - Merge options
 * @param {Function} [options.onConflict] - Callback when conflict detected
 * @returns {Object} Merged options
 * @description
 * Explicit merge strategies per option type:
 * - `plugins`: CONCATENATE_DEDUPE (framework + user plugins)
 * - `optimizeDeps.include`: CONCATENATE_DEDUPE (framework defaults + user additions)
 * - `optimizeDeps.exclude`: CONCATENATE_DEDUPE (framework defaults + user additions)
 * - `optimizeDeps.esbuildOptions`: DEEP_MERGE (preserve framework defaults, merge user overrides)
 * - `css.*`: DEEP_MERGE (preserve framework PostCSS, merge user options)
 * - `define`: DEEP_MERGE (preserve framework defines, merge user defines)
 * - Other objects: SHALLOW_MERGE (user properties override defaults)
 * - Primitives: REPLACE
 */
export function mergeOptions(userOptions = {}, options = {}) {
  const { onConflict } = options;
  const merged = { ...DEFAULT_OPTIONS };
  const conflicts = [];

  const conflictHandler = (key, frameworkValue, userValue, reason) => {
    conflicts.push({ key, frameworkValue, userValue, reason });
    if (onConflict) {
      onConflict(key, frameworkValue, userValue, reason);
    } else {
      console.warn(
        `[dndev] Config conflict: ${key}. ${reason}. Framework value preserved.`
      );
    }
  };

  // Normalize polymorphic prerender input before merge
  if ('prerender' in userOptions) {
    const raw = userOptions.prerender;
    if (raw === false) {
      userOptions.prerender = { routes: [] };
    } else if (raw === true) {
      userOptions.prerender = { routes: 'auto' };
    } else if (Array.isArray(raw)) {
      userOptions.prerender = { routes: raw };
    }
    // Object form passes through as-is
  }

  Object.keys(userOptions).forEach((key) => {
    const userValue = userOptions[key];
    const defaultValue = merged[key];

    // Special handling for optimizeDeps (nested object with array properties)
    if (
      key === 'optimizeDeps' &&
      typeof userValue === 'object' &&
      userValue !== null
    ) {
      const frameworkInclude = defaultValue?.include || [];
      const frameworkExclude = defaultValue?.exclude || [];
      const userInclude = userValue.include || [];
      const userExclude = userValue.exclude || [];

      // Framework required includes (cannot be excluded by user)
      const requiredIncludes = frameworkInclude.filter(
        (pkg) => !pkg.startsWith('@donotdev/')
      );

      // Check conflicts: user excluded something framework requires
      const excludedRequired = userExclude.filter((pkg) =>
        requiredIncludes.includes(pkg)
      );
      if (excludedRequired.length > 0) {
        for (const pkg of excludedRequired) {
          conflictHandler(
            `optimizeDeps.exclude`,
            pkg,
            'excluded',
            `Framework requires ${pkg} to be included. It will be included despite your exclusion.`
          );
        }
      }

      // Merge include: framework defaults + user additions (dedupe)
      // No conflict checking needed - include arrays are additive only
      // Conflicts are only checked in exclude arrays
      const mergedInclude = mergeArrayWithConflicts(
        frameworkInclude,
        userInclude,
        requiredIncludes
      );

      // Merge exclude: framework defaults + user additions (dedupe)
      const mergedExclude = mergeConfig(
        frameworkExclude,
        userExclude,
        MERGE_STRATEGY.CONCATENATE_DEDUPE
      );

      // Merge esbuildOptions: deep merge (preserve framework defaults)
      const mergedEsbuildOptions = mergeConfig(
        defaultValue?.esbuildOptions || {},
        userValue.esbuildOptions || {},
        MERGE_STRATEGY.DEEP_MERGE,
        {
          protectedKeys: ['external'], // Framework needs 'next', 'next/*' in external
          onConflict: (protectedKey) =>
            conflictHandler(
              `optimizeDeps.esbuildOptions.${protectedKey}`,
              defaultValue?.esbuildOptions?.[protectedKey],
              userValue.esbuildOptions?.[protectedKey],
              `Framework requires ${protectedKey} to remain as configured.`
            ),
        }
      );

      merged[key] = {
        ...defaultValue,
        include: mergedInclude,
        exclude: mergedExclude,
        esbuildOptions: mergedEsbuildOptions,
        ...Object.fromEntries(
          Object.entries(userValue).filter(
            ([k]) => !['include', 'exclude', 'esbuildOptions'].includes(k)
          )
        ),
      };
      return;
    }

    // Special handling for css (preserve framework PostCSS)
    if (key === 'css' && typeof userValue === 'object' && userValue !== null) {
      merged[key] = mergeConfig(
        defaultValue || {},
        userValue,
        MERGE_STRATEGY.DEEP_MERGE,
        {
          protectedKeys: ['postcss'], // Framework PostCSS config is added in config.js
          onConflict: () =>
            conflictHandler(
              'css.postcss',
              'framework PostCSS config',
              userValue.postcss,
              'Framework PostCSS config is required and cannot be overridden. Your postcss config is ignored.'
            ),
        }
      );
      return;
    }

    // Special handling for define (preserve framework defines)
    if (
      key === 'define' &&
      typeof userValue === 'object' &&
      userValue !== null
    ) {
      merged[key] = mergeConfig(
        defaultValue || {},
        userValue,
        MERGE_STRATEGY.DEEP_MERGE,
        {
          protectedKeys: ['__DEV__', '__PROD__'], // Framework constants
          onConflict: (protectedKey) =>
            conflictHandler(
              `define.${protectedKey}`,
              defaultValue?.[protectedKey],
              userValue[protectedKey],
              `Framework requires ${protectedKey} to remain as configured.`
            ),
        }
      );
      return;
    }

    // Top-level arrays: Concatenate and dedupe
    if (Array.isArray(userValue)) {
      if (Array.isArray(defaultValue)) {
        merged[key] = mergeConfig(
          defaultValue,
          userValue,
          MERGE_STRATEGY.CONCATENATE_DEDUPE
        );
      } else {
        merged[key] = userValue;
      }
      return;
    }

    // Objects: Shallow merge (user properties override defaults)
    if (
      typeof userValue === 'object' &&
      userValue !== null &&
      typeof defaultValue === 'object' &&
      defaultValue !== null &&
      !Array.isArray(defaultValue)
    ) {
      merged[key] = mergeConfig(
        defaultValue,
        userValue,
        MERGE_STRATEGY.SHALLOW_MERGE
      );
      return;
    }

    // Primitives: Replace
    merged[key] = userValue;
  });

  return merged;
}

/**
 * Extract and normalize options for different config sections
 * @param {Object} options - Full options object (already merged from mergeOptions)
 * @returns {Object} Normalized options
 * @description
 * Extracts all options into separate variables:
 * - Framework sections (server, build, resolve, routes, etc.)
 * - Vite options (base, define, optimizeDeps, plugins, css, envDir)
 * - Rest options (publicDir, clearScreen, logLevel, etc.) - pass-through to Vite
 * Factory functions receive already-merged options directly (not wrapped)
 */
export function normalizeOptions(options) {
  // Trust merged config - all values already merged from DEFAULT_OPTIONS
  const {
    server: serverOptions = {}, // Nested object safety - already merged
    preview: previewOptions = {}, // Nested object safety - already merged
    mode,
    build: buildOverrides = {}, // Nested object safety - already merged
    resolve: resolveOptions = {}, // Nested object safety - already merged
    routes: routeOptions = {}, // Nested object safety - already merged
    themes: themeOptions = {}, // Nested object safety - already merged
    i18n: i18nOptions = {}, // Nested object safety - already merged
    assets: assetOptions = {}, // Nested object safety - already merged
    features: featureOptions = {}, // Nested object safety - already merged (defaults to {})
    seo: seoOptions = {}, // Nested object safety - already merged
    prerender: prerenderOptions = {}, // Nested object safety - already merged
    pwa: pwaOptions = {}, // Nested object safety - already merged
    serverShim: serverShimOptions = {}, // Nested object safety - already merged
    chunking: chunkingOptions = {}, // Nested object safety - already merged
    discovery: discoveryOptions = {}, // Nested object safety - already merged
    pluginFactory: pluginFactoryOptions = {}, // Nested object safety - already merged
    debug,
    verbose,
    // Vite options - all handled at DEFAULT_OPTIONS level
    base,
    define: defineOptions = {},
    optimizeDeps: optimizeDepsOptions = {},
    plugins: pluginsOptions = [],
    css: cssOptions = {},
    envDir,
    // Framework option, not a Vite one — destructured so it doesn't leak into restOptions
    reactCompiler = false,
    // All other Vite options (publicDir, clearScreen, logLevel, etc.)
    ...restOptions
  } = options;

  // Compute ALL derived values ONCE (Single Source of Truth)
  // isDev: true only in development mode (dev server)
  // Custom modes (test, staging, uat) get production-like builds with different env files
  const isDev = mode === 'development';
  const isDebug = debug || isDev;
  const shouldAnalyze =
    mode === 'production' &&
    (buildOverrides.analyze ?? DEFAULT_OPTIONS.build.analyze);

  return {
    // Core options
    mode,
    debug,
    verbose,

    // Computed values (derived from above, computed ONCE)
    isDev,
    isDebug,
    shouldAnalyze,

    // Section-specific options
    serverOptions,
    previewOptions,
    buildOverrides,
    resolveOptions,
    routeOptions,
    themeOptions,
    i18nOptions,
    assetOptions,
    featureOptions, // Already merged from DEFAULT_OPTIONS (defaults to {})
    seoOptions, // Already merged from DEFAULT_OPTIONS
    prerenderOptions, // Already merged from DEFAULT_OPTIONS
    pwaOptions,
    serverShimOptions,
    chunkingOptions, // Already merged from DEFAULT_OPTIONS (defaults to { reactCore: [] })
    discoveryOptions,
    pluginFactoryOptions,

    // Vite options - all handled at DEFAULT_OPTIONS level
    base,
    defineOptions,
    optimizeDepsOptions,
    pluginsOptions,
    cssOptions,
    envDir,
    reactCompiler,

    // Rest options (publicDir, clearScreen, logLevel, etc.)
    restOptions,
  };
}
