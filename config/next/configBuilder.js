/**
 * @fileoverview Next.js Config Builder
 * @description Builds the final Next.js config from all handler configs
 */

import fs from 'node:fs';
import { createPostCSSConfig } from './postcss.js';
import { NEXT_PAGE_EXTENSIONS } from './nextFiles.js';
import { isPlainObject } from './utils.js';
import { GENERATED_PATHS, VIRTUAL_MODULES } from '../constants.js';

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
 * Build the headers() function: framework header policy rules first, then the app's own
 * next.config `headers` (Next: when two rules set the same header on a path, the last wins).
 * Fails loud: a broken app `headers` must not ship a site without its security headers.
 *
 * @param {Object} options
 * @param {Array<{ source: string, headers: Array<{ key: string, value: string }> }>} options.policyRules - From resolveHeaderRules (headerPolicy.js)
 * @param {Function} [options.originalHeaders] - The app's next.config `headers`
 * @returns {Function} headers config function
 * @since 0.3.1
 */
export function createHeadersConfig({ policyRules, originalHeaders }) {
  if (originalHeaders !== undefined && typeof originalHeaders !== 'function') {
    throw new Error(
      '[dndev] next.config headers must be a function returning an array (Next headers() contract).'
    );
  }
  return async function headers() {
    const appRules = originalHeaders ? await originalHeaders() : [];
    if (!Array.isArray(appRules)) {
      throw new Error(
        `[dndev] next.config headers() must return an array (got ${typeof appRules}).`
      );
    }
    return [...policyRules, ...appRules];
  };
}

/**
 * Build the final Next.js config
 *
 * Assembles transpilePackages, Turbopack resolveAlias (CSS, blog content, missing optional
 * deps), rewrites/redirects/headers and environment variables. `poweredByHeader` defaults
 * to `false` (no `X-Powered-By: Next.js` header); an app's own value in `restNextConfig`
 * wins. Next 16 builds with Turbopack: the framework sets no webpack or `compiler` config
 * (an app's own `webpack` and `compiler` pass through untouched in `restNextConfig`).
 * The discovery handlers contribute no config of their own: they generate their files in
 * `runDiscoveries`, and their rewrites reach `rewritesConfig` (`createRewritesConfig`, every
 * handler's `getAPIRewrites`, none for `output: 'export'`).
 *
 * @param {Object} options - Options
 * @param {string[]} [options.missingOptionalDeps] - Optional deps to alias in Turbopack
 *   (exact match + wildcard subpath, e.g. 'shiki' and 'shiki/*' → absolute path to empty.cjs)
 * @param {import('../utils/PathResolver.js').PathResolver} options.pathResolver - PathResolver instance
 * @returns {Object} Merged Next.js config
 */
export function buildFinalConfig({
  // Build options
  restNextConfig,
  discoveredPackages,
  reactCompiler = false,
  routingMode,

  // Rewrites/redirects/headers
  rewritesConfig,
  redirectsConfig,
  headersConfig,

  // Optional deps (for Turbopack aliasing)
  missingOptionalDeps,

  // Resolution
  pathResolver,

  // Environment
  env,

  // Logger
  logger,
}) {
  // Check if user explicitly set output: 'export' (opt-in for static export)
  const isStaticExport = restNextConfig?.output === 'export';

  // The framework owns pageExtensions (app router): see nextFiles.js
  if (routingMode === 'app' && restNextConfig?.pageExtensions) {
    throw new Error(
      '[dndev] pageExtensions is set by the framework (Next files carry the .next. marker so src/pages is never a route). Remove it from next.config.'
    );
  }

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

    // React Compiler — top-level key in Next 16 (not experimental). Placed before
    // the restNextConfig spread so an app's own next config still wins.
    ...(reactCompiler ? { reactCompiler } : {}),

    // No `X-Powered-By: Next.js` response header (Next sends it by default). Before the
    // restNextConfig spread: an app's own `poweredByHeader` still wins.
    poweredByHeader: false,

    // PostCSS configuration removed - Next.js 16 requires postcss.config.js file
    // TODO: Generate postcss.config.js if needed

    // Base config (includes output: 'export' if user explicitly set it)
    ...(isPlainObject(restNextConfig)
      ? restNextConfig
      : (logger.warn('restNextConfig is not a plain object:', restNextConfig),
        {})),

    // Only `*.next.*` files are Next files: src/pages/**Page.tsx (page sources shared
    // with Vite) never becomes a Pages Router route. 'pages' mode IS the Pages Router.
    ...(routingMode === 'app' && { pageExtensions: NEXT_PAGE_EXTENSIONS }),

    // Unknown URLs get the generated src/app/global-not-found.next.tsx (experimental in
    // Next 16): with 2+ languages the root layout sits under src/app/[lang]
    ...(routingMode === 'app' && {
      experimental: { ...restNextConfig?.experimental, globalNotFound: true },
    }),

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
        // Alias @donotdev/blog-content → generated blog file, or empty stub when
        // no blog exists. ALWAYS set so apps without
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

    // Skip rewrites/redirects for static export (they don't work with output: 'export')
    // Only set rewrites if not static export AND there are actual rewrites
    // (rewritesConfig returns null when empty - don't set rewrites at all to avoid interfering with Next.js)
    ...(isStaticExport
      ? {}
      : {
          rewrites: rewritesConfig,
          ...(redirectsConfig ? { redirects: redirectsConfig } : {}),
          // Header policy + app headers (null for static export: the host serves them)
          ...(headersConfig ? { headers: headersConfig } : {}),
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
