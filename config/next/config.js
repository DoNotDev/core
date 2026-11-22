/**
 * @fileoverview Next.js Configuration - Clean Version
 * @description Orchestrates Next.js configuration using handlers and utilities
 * @version 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { resolveAppRoot } from './appRoot.js';
import {
  createRewritesConfig,
  createRedirectsConfig,
  createHeadersConfig,
  buildFinalConfig,
} from './configBuilder.js';
import { runDiscoveries, isBuildComplete } from './discoveryOrchestrator.js';
import { createHandlers } from './handlerFactory.js';
import { migrateNextFiles } from './nextFiles.js';
import { mergeOptions, normalizeOptions } from './options.js';
import {
  assertNoVercelHeaders,
  detectHeaderProviders,
  resolveHeaderRules,
  syncVercelHeaders,
} from '../headerPolicy.js';
import { discoverAppPackages } from '../utils/discoverAppPackages.js';
import { createLogger } from '../utils/debugLog.js';
import { detectMissingOptionalDeps } from '../utils/detectOptionalDeps.js';
import { PathResolver } from '../utils/PathResolver.js';
import { isDeployBuild } from '../utils/SEOGenerator.js';

/**
 * Module-level cache for Next.js config.
 * Next.js Turbopack evaluates next.config.ts twice (server + client compilation).
 * This cache ensures defineNextConfig() setup and discovery run exactly once per build.
 * @type {Map<string, { configFn: Function, handlers: Object, logger: Object }>}
 */
const _buildCache = new Map();

/**
 * Creates Next.js configuration optimized for DNDev applications
 * @param {Object} userOptions - Configuration options
 * @returns {Function} Next.js configuration function
 */
function defineNextConfig(userOptions = {}) {
  // Extract port FIRST - before anything else, so Next.js can read it at startup
  const { port: userPort, ...restUserOptionsWithoutPort } = userOptions;
  if (userPort && process.env.NODE_ENV !== 'production') {
    process.env.PORT = String(userPort);
  }

  // Generate build correlation ID (CI-friendly)
  if (!process.env.DNDEV_BUILD_ID) {
    const isCI = process.env.CI === 'true';
    process.env.DNDEV_BUILD_ID = isCI
      ? `ci-${Math.random().toString(36).slice(2, 9)}`
      : Math.random().toString(36).slice(2, 9);
  }

  // Return cached config if this build already ran (Turbopack double-evaluation)
  const buildId = process.env.DNDEV_BUILD_ID;
  if (buildId && _buildCache.has(buildId)) {
    return _buildCache.get(buildId).configFn;
  }

  // Extract appConfig - mandatory
  const { appConfig, ...restUserOptions } = restUserOptionsWithoutPort;
  if (!appConfig) {
    throw new Error(
      'appConfig is required. Import appConfig from src/config/app.ts and pass it to defineNextConfig({ appConfig, ... })'
    );
  }

  // Extract build-time config from appConfig
  const extractedFeatures = appConfig?.features
    ? { debug: appConfig.features.debug }
    : undefined;

  const extractedSEO =
    appConfig?.seo === false
      ? { disabled: true } // private app: no robots.txt, sitemap, llms.txt
      : appConfig?.seo && typeof appConfig.seo !== 'boolean'
      ? {
          ...appConfig.seo,
          siteName: appConfig.seo.siteName || appConfig.app?.name,
          // llms.txt summary
          siteDescription: appConfig.app?.description,
        }
      : appConfig?.app?.name
        ? {
            siteName: appConfig.app.name,
            siteDescription: appConfig.app.description,
          }
        : undefined;

  // Extract app metadata for PWA (URL comes from env, not appConfig)
  const extractedApp = appConfig?.app
    ? {
        name: appConfig.app.name,
        shortName: appConfig.app.shortName,
        description: appConfig.app.description,
      }
    : undefined;

  // Merge configs (features/SEO from appConfig, rest from userOptions)
  const {
    features: _ignoredFeatures,
    seo: _ignoredSeo,
    ...restUserOptionsClean
  } = restUserOptions;
  const mergedUserOptions = {
    ...(extractedFeatures ? { features: extractedFeatures } : {}),
    ...(extractedSEO ? { seo: extractedSEO } : {}),
    ...restUserOptionsClean,
  };

  // Merge with framework defaults
  const merged = mergeOptions(mergedUserOptions);
  const normalized = normalizeOptions(merged);
  if (!normalized) {
    throw new Error('normalizeOptions returned undefined');
  }

  const {
    generateManifest,
    debug,
    verbose,
    mode,
    isDev,
    routeOptions,
    themeOptions,
    i18nOptions,
    assetOptions,
    pwaOptions,
    seoOptions,
    nextConfigOptions,
    reactCompiler,
  } = normalized;

  const logger = createLogger('next-config', debug, verbose);

  // CRITICAL: Resolve appRoot BEFORE creating handlers
  const { appRoot, appRootSet } = resolveAppRoot({ logger, debug });
  // Routing mode resolved once (SSOT) — build log, Next file marker and pageExtensions.
  const routingMode = routeOptions?.routingMode || 'app';

  // Framework-level logging (skip on Turbopack's second worker — marker already set)
  const isSecondPass = appRootSet && isBuildComplete(appRoot);
  if (!isSecondPass) {
    logger.info(
      `\n🏗️  DnDev Framework - Building for ${mode}${buildId ? ` [build:${buildId}]` : ''}`
    );
    logger.info(`   Platform: Next.js | Routing: ${routingMode}\n`);
  }

  // Set NEXT_PUBLIC_APP_URL for dev mode only
  // Production URL comes from .env files (NEXT_PUBLIC_APP_URL), not set here
  if (isDev) {
    // Port was already set at the top of defineNextConfig
    const port = process.env.PORT || 3000;
    process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${port}`;
    if (debug) {
      logger.debug(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
      if (userPort) {
        logger.debug(`Port configured: ${port} (set PORT env var)`);
      }
    }
  } else if (!process.env.NEXT_PUBLIC_APP_URL && !isDeployBuild()) {
    // A local production build without a URL: the one it is served at (`next start`,
    // port 3000 by default), as in dev. The SEO handler warns that the build carries it;
    // a deploy build fails instead (publishedBaseUrl)
    process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${process.env.PORT || 3000}`;
  }

  // Next `trailingSlash` (a passthrough Next option): page URLs end with `/`. The route
  // manifest carries it to the SEO head, the generated sitemap / llms.txt routes to their URLs.
  const trailingSlash = nextConfigOptions.trailingSlash === true;

  // Create all handlers
  const handlers = createHandlers({
    debug,
    verbose,
    generateManifest,
    // Thread SSR into the route codegen. SSR is the default for Next apps —
    // generated *PageClient wrappers render directly (server-rendered content in
    // the initial HTML). An app opts OUT of SSR (legacy client-only render) with
    // appConfig.ssr === false.
    routeOptions: {
      ...routeOptions,
      ssr: appConfig?.ssr !== false,
      // Redirect targets of the generated proxy (same config the client AuthGuard reads)
      auth: appConfig?.auth,
      // Cache lifetime of the cached pages (BaseNextHandler.revalidate)
      revalidate: appConfig?.revalidate,
      // Entity pages prerender their published records at build (RouteHandler.prerendersRecords)
      prerenderRecords: appConfig?.prerenderRecords,
      trailingSlash,
      // Title suffix of the generated entity page metadata (same site name as AutoMetaTags)
      siteName: appConfig?.seo?.siteName || appConfig?.app?.name,
      // Link-preview image of pages without one (same default as AutoMetaTags)
      defaultImage: appConfig?.seo?.defaultImage,
      defaultNamespace: appConfig?.seo?.defaultNamespace,
    },
    themeOptions,
    i18nOptions,
    assetOptions,
    // Same cache lifetime for the sitemap / llms.txt routes as for the pages
    seoOptions: { ...seoOptions, revalidate: appConfig?.revalidate, trailingSlash },
    // appConfig.app feeds the web app manifest (name, short_name, description)
    pwaOptions: { ...pwaOptions, app: extractedApp },
    isDev,
    logger,
    // Note: appUrl removed - handlers read from process.env.NEXT_PUBLIC_APP_URL directly
  });

  // Build Next.js configuration function. Next calls it with (phase, { defaultConfig }):
  // the app's own Next options are the passthrough keys of defineNextConfig (nextConfigOptions).
  const nextConfigFn = async function nextConfig() {
    // Discover packages for transpilation
    const pathResolver = PathResolver.getInstance();
    const discoveredPackages = appRootSet ? discoverAppPackages() : [];
    if (debug && discoveredPackages.length > 0) {
      logger.debug(
        `Discovered ${discoveredPackages.length} packages: ${discoveredPackages.join(', ')}`
      );
    }

    // Single detection call: Turbopack aliases the missing ones to the empty module
    const { missing: missingOptionalDeps } = detectMissingOptionalDeps(
      pathResolver.getAppRoot()
    );
    if (debug && missingOptionalDeps.length > 0) {
      logger.debug(
        `Missing optional deps (will alias to empty): ${missingOptionalDeps.join(', ')}`
      );
    }

    // Run all discoveries (once per build)
    // runDiscoveries() handles its own guard via .dndev-build marker file
    // (works across Turbopack's separate worker processes).
    if (appRootSet) {
      // Next files carry the marker before Next scans them (src/pages is never a route)
      if (routingMode === 'app') {
        migrateNextFiles({
          pathResolver,
          logger,
          isCI: Boolean(process.env.CI || process.env.VERCEL),
        });
      }
      await runDiscoveries(handlers, logger);
    }

    // The app's own Next options (every defineNextConfig key the framework does not own),
    // composed with the framework's below: rewrites, redirects, headers and
    // compiler.runAfterProductionCompile are merged; the rest (an own `webpack` included)
    // passes through.
    const safeNextConfigOptions = nextConfigOptions;

    const {
      rewrites: originalRewrites,
      redirects: originalRedirects,
      headers: originalHeaders,
      ...restNextConfig
    } = safeNextConfigOptions;

    const rewritesConfig = createRewritesConfig({
      originalRewrites,
      handlers: [
        handlers.routeHandler,
        handlers.themeHandler,
        handlers.i18nHandler,
        handlers.assetHandler,
        handlers.pwaHandler,
      ],
      logger,
    });

    const redirectsConfig = createRedirectsConfig({
      originalRedirects,
      seoRedirects: seoOptions?.redirects || [],
      logger,
    });

    // HTTP response headers: framework header policy (headerPolicy.js) + the app's own
    // next.config headers (after it: last wins). Served in production builds only, as the
    // host would (the CSP blocks Next dev tooling). A static export cannot serve headers():
    // the host does, from the vercel.json the policy is written into.
    const isStaticExport = restNextConfig.output === 'export';
    const policyRules = appRootSet
      ? resolveHeaderRules({
          appConfig,
          target: isStaticExport ? 'next-export' : 'next',
          providers: detectHeaderProviders(pathResolver.getAppRoot()),
          pwa: pwaOptions?.enabled === true,
        })
      : [];
    if (appRootSet && isStaticExport) {
      syncVercelHeaders({
        appRoot: pathResolver.getAppRoot(),
        rules: policyRules,
        ci: Boolean(process.env.CI || process.env.VERCEL),
        logger,
      });
    } else if (appRootSet) {
      assertNoVercelHeaders(pathResolver.getAppRoot());
    }
    const headersConfig = isStaticExport
      ? null
      : createHeadersConfig({
          policyRules: isDev ? [] : policyRules,
          originalHeaders,
        });

    // Build env config
    // NEXT_PUBLIC_* vars are now injected via generated dndev-config-env.js
    // (dynamic process.env[name] access doesn't work client-side in Next.js)
    const env = {
      _DNDEV_CONFIG_: JSON.stringify({
        platform: 'nextjs',
        mode: process.env.NODE_ENV || 'development',
        context: 'build',
        timestamp: Date.now(),
      }),
    };

    // Build final merged config
    const mergedConfig = buildFinalConfig({
      restNextConfig,
      discoveredPackages,
      reactCompiler,
      routingMode,

      rewritesConfig,
      redirectsConfig,
      headersConfig,
      missingOptionalDeps,
      pathResolver,
      env,
      logger,
    });

    logger.debug('Next.js config generated');

    // Log final paths (skip on second Turbopack worker)
    if (appRootSet && !isSecondPass) {
      const appName = extractedApp?.name || 'app';
      logger.info(`Name: ${appName}`);
      logger.info(
        `URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`
      );
      logger.info(`App root (final): ${pathResolver.getAppRoot()}`);
    }

    return mergedConfig;
  };

  // Cache for Turbopack double-evaluation
  if (buildId) {
    _buildCache.set(buildId, { configFn: nextConfigFn });
  }

  return nextConfigFn;
}

export default defineNextConfig;
export { defineNextConfig };
