/**
 * @fileoverview Vite Configuration with Discovery
 * @description Platform-specific Vite configuration using pure discovery engines. All defaults are defined in options.js (DEFAULT_OPTIONS). This file merges user config with defaults, then passes merged values to individual config builders. No builder should define its own defaults. Priority: User config > DEFAULT_OPTIONS > Nothing else.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import {
  createViteBuildConfig,
  createViteServerConfig,
  createVitePreviewConfig,
} from './buildConfig.js';
import { mergeOptions, normalizeOptions } from './options.js';
import { createPostCSSConfig } from './plugins/postcssConfig.js';
import { createVitePlugins } from './pluginsConfig.js';
import {
  createResolveConfig,
  createOptimizeDepsConfig,
} from './resolveConfig.js';
import { createLogger } from '../utils/debugLog.js';

/**
 * Create Vite configuration optimized for DNDev applications
 * Vite calls this function with (env) => config, so we return a function
 * @param {Object} userOptions - User-provided configuration options
 * @returns {Function} Function that Vite calls with env parameter
 */
export function defineViteConfig(userOptions = {}) {
  // Validate inputs
  if (userOptions === null || userOptions === undefined) {
    userOptions = {};
  }

  // Return a function that Vite will call with env
  return async (viteEnv = {}) => {
    // Validate viteEnv
    if (viteEnv === null || viteEnv === undefined) {
      viteEnv = {};
    }

    try {
      // Generate correlation ID for this build (CI-friendly)
      const isCI = process.env.CI === 'true';
      if (!process.env.DNDEV_BUILD_ID) {
        process.env.DNDEV_BUILD_ID = isCI
          ? `ci-${Math.random().toString(36).slice(2, 9)}`
          : Math.random().toString(36).slice(2, 9);
      }

      // Use Vite's deterministic command and mode from viteEnv
      // Vite passes: command: 'build' | 'serve'
      // Vite passes: mode: 'development' | 'production' | custom
      // Vite passes: isPreview: true when running `vite preview`
      const command = viteEnv.command; // Vite's deterministic command
      const actualMode = viteEnv.mode; // Vite's deterministic mode
      const isPreview = viteEnv.isPreview ?? false;

      // We'll load env vars in the plugin's config hook where we have proper context

      // Extract appConfig and dndev option
      const {
        appConfig,
        dndev: dndevOptions,
        ...restUserOptions
      } = userOptions;

      if (!appConfig) {
        throw new Error(
          'appConfig is required. Import appConfig from src/config/app.ts and pass it to defineViteConfig({ appConfig, ... })\n' +
            'Make sure the import statement in vite.config.ts is: import { appConfig } from "./src/config/app";'
        );
      }

      // Validate appConfig structure
      if (typeof appConfig !== 'object' || appConfig === null) {
        throw new Error(
          `appConfig must be an object, but got ${typeof appConfig}. ` +
            'Make sure you are exporting appConfig from src/config/app.ts correctly.'
        );
      }

      // Extract features from appConfig (runtime config)
      const extractedFeatures = appConfig?.features
        ? { debug: appConfig.features.debug }
        : undefined;

      // Extract SEO config: merge appConfig.seo with appConfig.app.name for siteName
      // baseUrl comes from VITE_APP_URL env var (discovered later in SEO plugin)
      const extractedSEO =
        appConfig?.seo && typeof appConfig.seo !== 'boolean'
          ? {
              ...appConfig.seo,
              // Use appConfig.app.name as siteName if not explicitly set in seo
              siteName: appConfig.seo.siteName || appConfig.app?.name,
            }
          : appConfig?.app?.name
            ? { siteName: appConfig.app.name }
            : undefined;

      // Features and SEO come from appConfig only - cannot be overridden in vite.config.ts
      // Remove any user-provided features/seo from restUserOptions (they're ignored)
      const {
        features: _ignoredFeatures,
        seo: _ignoredSeo,
        ...restUserOptionsWithoutFeaturesSeo
      } = restUserOptions;

      // Extract app metadata for PWA plugin (URL comes from env, not appConfig)
      const extractedApp = appConfig?.app
        ? {
            name: appConfig.app.name,
            shortName: appConfig.app.shortName,
            description: appConfig.app.description,
          }
        : undefined;

      // Merge extracted config (from appConfig) with user options
      // Extract pwa from user options to merge app into it
      const { pwa: userPwaOptions = {}, ...restUserOptionsWithoutPwa } =
        restUserOptionsWithoutFeaturesSeo;

      // Merge appConfig.app into pwa, but prioritize user's pwa.app if provided
      const mergedPwa = {
        ...userPwaOptions,
        // If user provided pwa.app, use it (takes priority), otherwise use appConfig.app
        app: userPwaOptions.app || extractedApp,
      };

      const mergedUserOptions = {
        ...(extractedFeatures ? { features: extractedFeatures } : {}),
        ...(extractedSEO ? { seo: extractedSEO } : {}),
        ...(Object.keys(mergedPwa).length > 0 ? { pwa: mergedPwa } : {}),
        ...restUserOptionsWithoutPwa,
        mode: actualMode,
      };

      // Merge user options with defaults, overriding mode with actual Vite mode
      let options;
      try {
        options = mergeOptions(mergedUserOptions);
      } catch (error) {
        throw new Error(
          `mergeOptions failed: ${error?.message || error || 'Unknown error'}`
        );
      }

      let normalized;
      try {
        normalized = normalizeOptions(options);
      } catch (error) {
        throw new Error(
          `normalizeOptions failed: ${error?.message || error || 'Unknown error'}`
        );
      }

      if (!normalized) {
        throw new Error('normalizeOptions returned undefined');
      }

      const {
        mode,
        debug,
        verbose,
        isDev,
        isDebug,
        shouldAnalyze,
        serverOptions,
        previewOptions,
        buildOverrides,
        resolveOptions,
        routeOptions,
        themeOptions,
        i18nOptions,
        assetOptions,
        featureOptions, // Includes features array - already merged from DEFAULT_OPTIONS
        seoOptions, // Already merged from DEFAULT_OPTIONS
        prerenderOptions, // Already merged from DEFAULT_OPTIONS
        pwaOptions,
        serverShimOptions,
        chunkingOptions,
        pluginFactoryOptions,
        // Vite options - all handled at DEFAULT_OPTIONS level
        base,
        defineOptions,
        optimizeDepsOptions,
        pluginsOptions,
        cssOptions,
        envDir,
        // Rest options (publicDir, clearScreen, logLevel, etc.)
        restOptions,
      } = normalized;

      // Create logger with normalized debug/verbose values
      const logger = createLogger('vite-config', debug, verbose);

      logger.debug(`Mode: ${mode}, Dev: ${isDev}`);

      // ===================================================================
      // TIER 1 LOGGING - ALWAYS SHOWN (Framework-level information)
      // Show banner BEFORE plugin creation
      // ===================================================================
      const buildId = process.env.DNDEV_BUILD_ID;

      // Determine action message based on command
      let actionMessage;
      if (command === 'build') {
        actionMessage = `Building for ${mode}`;
      } else if (isPreview) {
        actionMessage = `Preview server (serving ${mode} build)`;
      } else if (command === 'serve') {
        actionMessage = `Development server (${mode})`;
      } else {
        actionMessage = `Running ${command} (${mode})`;
      }

      logger.info(
        `\n🏗️  DnDev Framework - ${actionMessage}${buildId ? ` [build:${buildId}]` : ''}`
      );
      logger.info(`   Platform: Vite | Command: ${command} | Mode: ${mode}\n`);

      // PathResolver values logged in configResolved hook after app root is set

      // Environment variables are now handled by virtual:env module (EnvPlugin)
      // No manual injection needed - EnvPlugin loads and exposes via globalThis._DNDEV_CONFIG_.env

      const plugins = createVitePlugins({
        mode,
        debug,
        verbose,
        isDev,
        isPreview,
        routes: routeOptions,
        themes: themeOptions,
        i18n: i18nOptions,
        assets: assetOptions,
        features: featureOptions,
        seo: seoOptions,
        prerender: prerenderOptions,
        pwa: pwaOptions,
        serverShim: serverShimOptions,
        chunkingOptions,
        pluginFactory: pluginFactoryOptions,
        // Note: appUrl removed - SEO/PWA plugins read from process.env.VITE_APP_URL directly
      });

      // Validate plugins is an array
      if (!Array.isArray(plugins)) {
        throw new Error(
          `createVitePlugins returned ${typeof plugins}, expected array. Value: ${plugins}`
        );
      }
      const buildConfig = createViteBuildConfig({
        mode,
        chunkingOptions,
        debug,
        isDev,
        isDebug,
        shouldAnalyze,
      });

      const serverConfig = isPreview
        ? undefined
        : createViteServerConfig(
            serverOptions.port || 3000,
            serverOptions,
            logger
          );
      const previewConfig = isPreview
        ? createVitePreviewConfig(previewOptions)
        : undefined;

      // ===================================================================
      // DNDEV DASHBOARD PLUGIN — opt-in via dndev config option
      // ===================================================================
      if (dndevOptions) {
        try {
          const { createDndevPlugin } =
            await import('./plugins/DndevPlugin.js');
          pluginsOptions.push(
            createDndevPlugin(
              typeof dndevOptions === 'object' ? dndevOptions : {}
            )
          );
        } catch (err) {
          console.warn('[dndev] DndevPlugin not available:', err.message);
        }
      }

      // ===================================================================
      // CONFIGURATION ASSEMBLY - SEPARATION OF CONCERNS
      // ===================================================================

      const finalConfig = {
        // Base path
        ...(base && { base }),

        // MERGE: Framework Plugins + User Plugins (Already concatenated in mergeOptions)
        plugins: [...plugins, ...pluginsOptions],

        // Explicitly set appType to 'spa' to ensure SPA routing works (dev server serves index.html for all routes)
        appType: 'spa',

        // Treat font files as static assets (prevents Vite from trying to resolve them as modules)
        assetsInclude: [
          '**/*.woff',
          '**/*.woff2',
          '**/*.ttf',
          '**/*.otf',
          '**/*.eot',
        ],

        // Only apply build config when actually building (not in dev serve)
        ...(mode === 'production' && { build: buildConfig }),
        // Only apply server config when running dev server (not preview)
        ...(command === 'serve' && !isPreview && { server: serverConfig }),
        // Only apply preview config when running preview server
        ...(isPreview && { preview: previewConfig }),

        // Vite auto-resolves envDir relative to vite.config.ts location (smart defaults!)
        ...(envDir && { envDir }),

        // Enterprise-grade: Suppress chunk spam, keep warnings, fix inaccurate build time
        customLogger:
          mode === 'production' && !debug
            ? (() => {
                const logger = {
                  hasWarned: false,
                  // Single suppression list - everything we want to hide
                  _shouldSuppress(msg) {
                    return (
                      // Build spam (use stats.html instead)
                      msg.includes('dist/') ||
                      msg.includes('kB') ||
                      msg.includes('│') ||
                      msg.includes('gzip:') ||
                      // Build time (turbo shows the real value)
                      msg.includes('✓ built in') ||
                      msg.match(/built in \d+\.\d+s/)
                    );
                  },
                  info(msg) {
                    if (logger._shouldSuppress(msg)) {
                      return;
                    }
                    console.log(msg);
                  },
                  warn(msg) {
                    if (logger._shouldSuppress(msg)) {
                      return;
                    }
                    console.warn(msg);
                  },
                  error(msg) {
                    console.error(msg);
                  },
                  warnOnce(msg) {
                    if (logger.hasWarned) return;
                    logger.hasWarned = true;
                    console.warn(msg);
                  },
                  clearScreen() {},
                  hasErrorLogged() {
                    return false;
                  },
                };
                return logger;
              })()
            : undefined,

        // MERGE: CSS processing - PostCSS config (no postcss.config.ts needed) + User CSS options
        css: {
          postcss: createPostCSSConfig(cssOptions),
          ...cssOptions,
        },

        // MERGE: Optimize Deps - Framework Defaults + User Appends (Deduped)
        optimizeDeps: createOptimizeDepsConfig(optimizeDepsOptions),

        resolve: createResolveConfig(resolveOptions),

        // Merge framework defines with user defines (framework constants take precedence)
        define: {
          ...defineOptions,
          'process.env.NODE_ENV': JSON.stringify(actualMode),
          __DEV__: JSON.stringify(isDev),
          __PROD__: JSON.stringify(!isDev),
          // VITE_* env vars are loaded by the virtual:env module (EnvPlugin)
        },

        // SPREAD: Pass-through options (publicDir, clearScreen, logLevel, etc.)
        // Managed options (plugins, css, optimizeDeps, define, base, envDir) already extracted in normalizeOptions()
        ...restOptions,
      };

      // Configuration complete - discovery results shown during buildStart
      return finalConfig;
    } catch (error) {
      // Ensure we always have a valid error object
      const errorObj = error || new Error('Unknown error occurred');
      const errorMessage =
        errorObj?.message ||
        errorObj?.toString() ||
        String(errorObj) ||
        'Unknown error';
      const errorStack = errorObj?.stack || '';

      // Log error to console (logger might not be available in catch block)
      console.error(`\n❌ Vite config error: ${errorMessage}`);
      if (errorStack) {
        console.error(`Stack trace:\n${errorStack}`);
      }

      // Re-throw with full context
      const fullError = new Error(
        `Failed to create Vite config: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`
      );
      fullError.stack = errorStack || fullError.stack;
      throw fullError;
    }
  };
}
