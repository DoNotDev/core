/**
 * @fileoverview Next.js Config Builder
 * @description Builds the final Next.js config from all handler configs
 */

import fs from 'node:fs';
import { createFontPreloadWebpackPlugin } from './plugins/FontPreloadWebpackPlugin.js';
import { createLowerDestructuringWebpackPlugin } from './plugins/LowerDestructuringWebpackPlugin.js';
import { createPostCSSConfig } from './postcss.js';
import { isPlainObject } from './utils.js';
import { PathResolver } from '../utils/PathResolver.js';
import { GENERATED_PATHS, VIRTUAL_MODULES } from '../constants.js';

/**
 * CSS alias: redirect @donotdev/ui/dndev.css → dndev-next.css in Next.js.
 * The -next variant strips @fontsource imports; fonts are served from
 * public/dndev-fonts.css instead (see copyFontsToPublic + FontPreloadLinks).
 *
 * NOTE: Turbopack resolveAlias does NOT work for CSS @import (verified Next.js 16).
 * The authoritative CSS alias lives in postcss.js (postcss-import resolver).
 * These webpack/turbopack aliases are defense-in-depth only.
 */
const DNDEV_CSS_ALIAS = {
  '@donotdev/ui/dndev.css': '@donotdev/ui/dndev-next.css',
};

/**
 * Build webpack configuration for Next.js
 *
 * Handles: SVG imports, CSS aliasing, Vite-specific ignores, font preloading,
 * feature package exclusion, and optional dependency resolution.
 *
 * @param {Object} options - Options
 * @param {Function} [options.originalWebpack] - Consumer's webpack config function (composed)
 * @param {string[]} options.unusedFeaturePackages - @donotdev/* feature packages to externalize
 * @param {string[]} options.usedFeaturePackages - @donotdev/* feature packages in use (for logging)
 * @param {string[]} [options.missingOptionalDeps=[]] - Third-party optional deps not installed
 *   (e.g. shiki, @tiptap/*). Aliased to empty module via NormalModuleReplacementPlugin.
 *   Regex matches exact name + subpaths (e.g. 'shiki' and 'shiki/engine/javascript').
 * @param {string[]} [options.flagCodes=[]] - Allowed flag country codes from I18n discovery.
 *   Flag files not in this list are aliased to an empty component.
 * @param {Object} options.logger - Framework logger
 * @param {boolean} options.debug - Enable debug logging
 * @returns {Function} Webpack config function for next.config.js
 */
export function createWebpackConfig({
  originalWebpack,
  unusedFeaturePackages,
  usedFeaturePackages,
  missingOptionalDeps = [],
  flagCodes = [],
  logger,
  debug,
}) {
  return (config, context) => {
    const { dev, isServer, webpack } = context;

    // Enhanced WebSocket error handling for development
    if (dev && !isServer) {
      config.infrastructureLogging = { level: 'error' };
      config.stats = {
        ...config.stats,
        logging: 'error',
        loggingTrace: false,
      };
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        /WebSocket connection to/,
        /WebSocket closed without opened/,
        /failed to connect to websocket/,
        /WebSocket error/,
      ];
    }

    // SVG support - import as URL (like Vite does)
    // Find existing SVG rule and modify it, or add new one
    const fileLoaderRule = config.module?.rules?.find((rule) =>
      rule.test?.test?.('.svg')
    );
    if (fileLoaderRule) {
      // Exclude SVG from default file loader
      fileLoaderRule.exclude = /\.svg$/i;
    }
    // Add SVG as asset/resource (returns URL like Vite)
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.svg$/i,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });

    // Markdown files as raw strings (for blog content)
    config.module.rules.push({ test: /\.md$/, type: 'asset/source' });

    // Alias @donotdev/blog-content → generated blog file, or empty stub when no
    // blog exists. ALWAYS set: @donotdev/templates re-exports blog-loader at top
    // level (`import blogContent from '@donotdev/blog-content'`), so any consumer
    // pulling templates (legal pages, FAQ, docs) needs this to resolve.
    // Empty stub (@donotdev/core/empty) is a Proxy noop — Object.entries(noop)
    // is [], blog loader yields 0 posts. Graceful degradation.
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    try {
      const pathResolver = PathResolver.getInstance();
      const blogGeneratedPath = pathResolver.resolveAppPath(GENERATED_PATHS.next.blogContent);
      config.resolve.alias[VIRTUAL_MODULES.blog] = fs.existsSync(blogGeneratedPath)
        ? blogGeneratedPath
        : pathResolver.getEmptyCjsModulePath();
    } catch (e) {
      logger.debug(`Blog content alias fallback to empty stub: ${e?.message}`);
    }

    // Alias @donotdev/ui/dndev.css → dndev-next.css (strips @fontsource CSS imports)
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      ...DNDEV_CSS_ALIAS,
    };

    // Ignore Vite-specific packages
    if (webpack?.IgnorePlugin) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(vite|@vitejs|vite-tsconfig-paths)$/,
        })
      );
    }

    // Font preload manifest (Lighthouse): infer fonts from consumer CSS, write public/dndev-font-preloads.json
    try {
      const pathResolver = PathResolver.getInstance();
      config.plugins.push(
        createFontPreloadWebpackPlugin({ pathResolver, debug })
      );
    } catch (e) {
      logger.debug(`Font preload webpack plugin skipped: ${e?.message}`);
    }

    // Safari fix: lower JS destructuring on the production client bundle so it
    // parses on older Safari (< 14.1), which has a destructuring parser bug that
    // blanks the page. Client build only; the plugin self-guards dev/server.
    if (!isServer) {
      try {
        config.plugins.push(
          createLowerDestructuringWebpackPlugin({ logger, debug })
        );
      } catch (e) {
        logger.debug(`Lower-destructuring webpack plugin skipped: ${e?.message}`);
      }
    }

    // Feature exclusion logic
    if (unusedFeaturePackages.length > 0) {
      logger.info(
        `🚫 Excluding unused features: ${unusedFeaturePackages.join(', ')}`
      );
      logger.info(`✅ Including features: ${usedFeaturePackages.join(', ')}`);

      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(...unusedFeaturePackages);
      } else {
        const originalExternals = config.externals;
        config.externals = (context, request, callback) => {
          if (unusedFeaturePackages.includes(request)) {
            return callback(null, 'commonjs ' + request);
          }
          if (typeof originalExternals === 'function') {
            return originalExternals(context, request, callback);
          }
          return callback();
        };
      }
    }

    // Alias missing optional deps (shiki, @tiptap/*) to empty module
    // Prevents webpack "module not found" when consumer doesn't install them
    if (
      missingOptionalDeps.length > 0 &&
      webpack?.NormalModuleReplacementPlugin
    ) {
      const pathResolver = PathResolver.getInstance();
      const emptyModulePath = pathResolver.getEmptyCjsModulePath();
      const escaped = missingOptionalDeps.map((d) =>
        d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      const pattern = new RegExp(`^(${escaped.join('|')})(\\/|$)`);
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(pattern, emptyModulePath)
      );
      if (debug) {
        logger.debug(
          `Aliased ${missingOptionalDeps.length} missing optional deps to empty module`
        );
      }
    }

    // Alias unused flag files to empty flag component
    // Reduces ~112 flag chunks down to only the ones matching supportedLanguages
    if (flagCodes.length > 0 && webpack?.NormalModuleReplacementPlugin) {
      const pathResolver = PathResolver.getInstance();
      const emptyFlagPath = pathResolver.getEmptyFlagModulePath();
      const allowed = new Set(flagCodes.map((c) => c.toUpperCase()));
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /flags\/raw\/flag([A-Z][A-Z0-9_-]*)\./,
          (resource) => {
            const match = resource.request.match(/flag([A-Z][A-Z0-9_-]*)\./i);
            if (
              match &&
              match[1].toUpperCase() !== 'BASE' &&
              !allowed.has(match[1].toUpperCase())
            ) {
              resource.request = emptyFlagPath;
            }
          }
        )
      );
      if (debug) {
        logger.debug(
          `Flag filter: allowing ${allowed.size} flags, aliasing rest to empty component`
        );
      }
    }

    return originalWebpack ? originalWebpack(config, context) : config;
  };
}

/**
 * Build rewrites configuration
 * @param {Object} options - Options
 * @returns {Function} Rewrites config function
 */
export function createRewritesConfig({ originalRewrites, handlers, logger }) {
  return async function () {
    try {
      const baseRewrites = originalRewrites ? await originalRewrites() : [];

      // Merge rewrites from all handlers
      const discoveryRewrites = handlers
        .filter((h) => h?.getAPIRewrites)
        .map((h) => h.getAPIRewrites());

      const mergedDiscoveryRewrites = discoveryRewrites.reduce(
        (acc, rewrites) => {
          if (rewrites?.beforeFiles)
            acc.beforeFiles.push(...rewrites.beforeFiles);
          if (rewrites?.afterFiles) acc.afterFiles.push(...rewrites.afterFiles);
          if (rewrites?.fallback) acc.fallback.push(...rewrites.fallback);
          return acc;
        },
        { beforeFiles: [], afterFiles: [], fallback: [] }
      );

      const result = {
        beforeFiles: [
          ...(Array.isArray(baseRewrites)
            ? []
            : baseRewrites?.beforeFiles || []),
          ...mergedDiscoveryRewrites.beforeFiles,
        ],
        afterFiles: [
          ...(Array.isArray(baseRewrites)
            ? baseRewrites
            : baseRewrites?.afterFiles || []),
          ...mergedDiscoveryRewrites.afterFiles,
        ],
        fallback: [
          ...(Array.isArray(baseRewrites) ? [] : baseRewrites?.fallback || []),
          ...mergedDiscoveryRewrites.fallback,
        ],
      };

      return result;
    } catch (error) {
      logger.error(`Next.js config failed to merge rewrites: ${error.message}`);
      logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
  };
}

/**
 * Build redirects configuration
 * @param {Object} options - Options
 * @returns {Function} Redirects config function
 */
export function createRedirectsConfig({
  originalRedirects,
  seoRedirects,
  logger,
}) {
  return async function () {
    try {
      const baseRedirects = originalRedirects ? await originalRedirects() : [];

      // Map framework format { from, to, permanent } to Next.js format { source, destination, permanent }
      const frameworkRedirects = (seoRedirects || []).map(
        ({ from, to, permanent }) => ({
          source: from,
          destination: to,
          permanent: permanent !== false, // default true (301)
        })
      );

      // Build-time validation
      const validRedirects = [];
      const seenSources = new Set();
      for (const r of frameworkRedirects) {
        const normalizedSource = r.source.replace(/\/+$/, '') || '/';
        const normalizedDest = r.destination.replace(/\/+$/, '') || '/';

        if (normalizedSource === normalizedDest) {
          logger.warn(
            `Redirect loop detected: ${r.source} → ${r.destination} (skipped)`
          );
          continue;
        }
        if (!r.source.startsWith('/')) {
          logger.warn(
            `Redirect source must start with /: "${r.source}" (skipped)`
          );
          continue;
        }
        if (seenSources.has(normalizedSource)) {
          logger.warn(`Duplicate redirect source: "${r.source}" (skipped)`);
          continue;
        }
        seenSources.add(normalizedSource);
        validRedirects.push(r);
      }

      const merged = [
        ...(Array.isArray(baseRedirects) ? baseRedirects : []),
        ...validRedirects,
      ];

      if (merged.length === 0) return [];

      logger.info(
        `  📎 ${merged.length} redirect${merged.length > 1 ? 's' : ''} configured`
      );
      return merged;
    } catch (error) {
      logger.error(`Failed to merge redirects: ${error.message}`);
      return [];
    }
  };
}

/**
 * Merge all handler configs into final Next.js config
 *
 * Assembles transpilePackages, Turbopack resolveAlias (CSS + optional deps),
 * webpack/rewrites, handler results, and environment variables.
 *
 * @param {Object} options - Options
 * @param {string[]} [options.missingOptionalDeps] - Optional deps to alias in Turbopack
 *   (exact match + wildcard subpath, e.g. 'shiki' and 'shiki/*' → absolute path to empty.cjs)
 * @param {import('../utils/PathResolver.js').PathResolver} options.pathResolver - PathResolver instance
 * @returns {Object} Merged Next.js config
 */
export function buildFinalConfig({
  // Handler configs
  routeResult,
  themeResult,
  i18nResult,
  assetResult,
  seoResult,
  pwaResult,
  serverShimResult,

  // Build options
  restNextConfig,
  discoveredPackages,

  // Webpack/rewrites/redirects
  webpackConfig,
  rewritesConfig,
  redirectsConfig,

  // Optional deps (for Turbopack aliasing)
  missingOptionalDeps,

  // Flag filtering
  flagCodes = [],

  // Resolution
  pathResolver,

  // Environment
  env,

  // Logger
  logger,
}) {
  // Check if user explicitly set output: 'export' (opt-in for static export)
  const isStaticExport = restNextConfig?.output === 'export';

  // Ensure distDir is always set
  const userDistDir = restNextConfig?.distDir;
  const distDir = userDistDir || '.next';

  const mergedConfig = {
    // Transpile all @donotdev/* packages + missing optional deps.
    // @donotdev/* packages need transpilation because tsc emits extensionless
    // imports and Next.js 16 externalizes non-transpiled ESM during SSR.
    // Missing optional deps must be in transpilePackages so Next.js bundles them
    // instead of trying to externalize them (shiki is on Next.js's default
    // serverExternalPackages list — without this, Node.js can't resolve it and warns).
    // Turbopack's resolveAlias then resolves them to the empty CJS module.
    transpilePackages: [...discoveredPackages, ...(missingOptionalDeps || [])],

    // PostCSS configuration removed - Next.js 16 requires postcss.config.js file
    // TODO: Generate postcss.config.js if needed

    // Base config (includes output: 'export' if user explicitly set it)
    ...(isPlainObject(restNextConfig)
      ? restNextConfig
      : (logger.warn('restNextConfig is not a plain object:', restNextConfig),
        {})),

    // AFTER restNextConfig spread: override serverExternalPackages.
    // Always set (even empty) to override Next.js defaults — otherwise
    // Next.js tries to externalize optional deps (e.g. shiki) that aren't installed.
    serverExternalPackages: (
      restNextConfig?.serverExternalPackages ||
      restNextConfig?.serverComponentsExternalPackages ||
      []
    ).filter(
      (pkg) =>
        !pkg.startsWith('@donotdev/') && !missingOptionalDeps?.includes(pkg)
    ),

    // Turbopack: AFTER restNextConfig spread to prevent silent overwrite.
    // Deep-merge resolveAlias with any consumer turbopack config.
    turbopack: {
      ...(restNextConfig?.turbopack || {}),
      // Explicit root prevents Next.js from guessing based on stray lockfiles
      root: restNextConfig?.turbopack?.root || pathResolver.getRepoRoot(),
      resolveAlias: {
        ...(restNextConfig?.turbopack?.resolveAlias || {}),
        ...DNDEV_CSS_ALIAS,
        // Alias @donotdev/blog-content → generated blog file, or empty stub when
        // no blog exists (mirrors webpack alias above). ALWAYS set so apps without
        // .md files don't crash on the top-level blog-loader import in
        // @donotdev/templates. Empty stub is the same Proxy used for missing
        // optional deps below.
        // Key must NOT use virtual: prefix — Turbopack treats virtual: as an external protocol,
        // bypassing resolveAlias entirely.
        // Value must be relative to the Next.js project directory (where next.config.js lives),
        // NOT the turbopack root — Turbopack resolves alias values from the project dir.
        [VIRTUAL_MODULES.blog]: (() => {
          try {
            const blogGeneratedPath = pathResolver.resolveAppPath(
              GENERATED_PATHS.next.blogContent
            );
            if (fs.existsSync(blogGeneratedPath)) {
              return './' + GENERATED_PATHS.next.blogContent;
            }
          } catch {
            // fall through to empty stub
          }
          return '@donotdev/core/empty';
        })(),
        // Alias missing optional deps to @donotdev/core/empty (CJS).
        // Turbopack resolveAlias needs a package specifier, not an absolute path.
        // CJS because Turbopack statically analyzes ESM exports.
        ...(missingOptionalDeps?.length > 0
          ? Object.fromEntries(
              missingOptionalDeps.flatMap((dep) => [
                [dep, '@donotdev/core/empty'],
                [`${dep}/*`, '@donotdev/core/empty'],
              ])
            )
          : {}),
      },
    },

    // Always set distDir to ensure consistent path resolution
    // User's distDir takes precedence if set, otherwise default to '.next'
    distDir,

    // Development server configuration
    ...(process.env.NODE_ENV === 'development' && {
      devIndicators: {
        position: 'bottom-right',
      },
      onDemandEntries: {
        maxInactiveAge: 60 * 1000,
        pagesBufferLength: 5,
      },
    }),

    // Handler configs (with validation)
    ...(isPlainObject(routeResult)
      ? routeResult
      : (logger.error(
          `Route handler config invalid (got ${typeof routeResult}):`,
          routeResult
        ),
        {})),
    ...(isPlainObject(themeResult)
      ? themeResult
      : (logger.error(
          `Theme handler config invalid (got ${typeof themeResult}):`,
          themeResult
        ),
        {})),
    ...(isPlainObject(i18nResult)
      ? i18nResult
      : (logger.error(
          `I18n handler config invalid (got ${typeof i18nResult}):`,
          i18nResult
        ),
        {})),
    ...(isPlainObject(assetResult)
      ? assetResult
      : (logger.error(
          `Asset handler config invalid (got ${typeof assetResult}):`,
          assetResult
        ),
        {})),
    ...(isPlainObject(seoResult)
      ? seoResult
      : (logger.error(
          `SEO handler config invalid (got ${typeof seoResult}):`,
          seoResult
        ),
        {})),
    ...(isPlainObject(pwaResult)
      ? pwaResult
      : (logger.error(
          `PWA handler config invalid (got ${typeof pwaResult}):`,
          pwaResult
        ),
        {})),
    ...(isPlainObject(serverShimResult)
      ? serverShimResult
      : (logger.warn('serverShimConfig returned non-object:', serverShimResult),
        {})),

    // Webpack and rewrites
    webpack: webpackConfig,
    // Skip rewrites/redirects for static export (they don't work with output: 'export')
    // Only set rewrites if not static export AND there are actual rewrites
    // (rewritesConfig returns null when empty - don't set rewrites at all to avoid interfering with Next.js)
    ...(isStaticExport
      ? {}
      : {
          rewrites: rewritesConfig,
          ...(redirectsConfig ? { redirects: redirectsConfig } : {}),
        }),

    // Environment variables
    env,

    // Suppress console warnings in production
    ...(process.env.NODE_ENV === 'production' && {
      logging: {
        fetches: {
          fullUrl: false,
        },
      },
    }),
  };

  return mergedConfig;
}
