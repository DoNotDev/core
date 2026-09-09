/**
 * @fileoverview Next.js Configuration - Clean Version
 * @description Orchestrates Next.js configuration using handlers and utilities
 * @version 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { resolveAppRoot } from './appRoot.js';
import {
  createWebpackConfig,
  createRewritesConfig,
  createRedirectsConfig,
  buildFinalConfig,
} from './configBuilder.js';
import {
  runDiscoveries,
  copyFrameworkAssets,
  isBuildComplete,
} from './discoveryOrchestrator.js';
import { createHandlers, createHandlerConfigs } from './handlerFactory.js';
import { mergeOptions, normalizeOptions } from './options.js';
import { discoverAppPackages } from '../utils/discoverAppPackages.js';
import { createLogger } from '../utils/debugLog.js';
import { detectMissingOptionalDeps } from '../utils/detectOptionalDeps.js';
import { PathResolver } from '../utils/PathResolver.js';

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
    appConfig?.seo && typeof appConfig.seo !== 'boolean'
      ? {
          ...appConfig.seo,
          siteName: appConfig.seo.siteName || appConfig.app?.name,
        }
      : appConfig?.app?.name
        ? { siteName: appConfig.app.name }
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
    serverShimOptions,
    nextConfigOptions,
    reactCompiler,
  } = normalized;

  const logger = createLogger('next-config', debug, verbose);

  // CRITICAL: Resolve appRoot BEFORE creating handlers
  const { appRoot, appRootSet } = resolveAppRoot({ logger, debug });
  let assetsCopied = false;
  // Routing mode resolved once (SSOT) — used both for the build log below and
  // for the Pages-Router shadow-redirect gate inside the config function.
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
  } else if (!process.env.NEXT_PUBLIC_APP_URL) {
    logger.warn(
      'NEXT_PUBLIC_APP_URL not found in environment. Set it in .env.production'
    );
  }

  // Create all handlers
  const handlers = createHandlers({
    debug,
    verbose,
    generateManifest,
    // Thread SSR into the route codegen. SSR is the default for Next apps —
    // generated *PageClient wrappers render directly (server-rendered content in
    // the initial HTML). An app opts OUT of SSR (legacy client-only render) with
    // appConfig.ssr === false.
    routeOptions: { ...routeOptions, ssr: appConfig?.ssr !== false },
    themeOptions,
    i18nOptions,
    assetOptions,
    seoOptions,
    pwaOptions,
    serverShimOptions,
    isDev,
    logger,
    // Note: appUrl removed - handlers read from process.env.NEXT_PUBLIC_APP_URL directly
  });

  // Create handler configs
  const handlerConfigs = createHandlerConfigs(handlers, logger);

  // Build Next.js configuration function
  const nextConfigFn = async function nextConfig(nextConfigOptions = {}) {
    // Discover packages for transpilation
    const pathResolver = PathResolver.getInstance();
    const discoveredPackages = appRootSet ? discoverAppPackages() : [];
    if (debug && discoveredPackages.length > 0) {
      logger.debug(
        `Discovered ${discoveredPackages.length} packages: ${discoveredPackages.join(', ')}`
      );
    }

    // Single detection call — used for webpack externals, Turbopack aliasing, and chunk filtering
    const { missing: missingOptionalDeps, installed: installedOptionalDeps } =
      detectMissingOptionalDeps(pathResolver.getAppRoot());
    const unusedFeaturePackages = missingOptionalDeps.filter((pkg) =>
      pkg.startsWith('@donotdev/')
    );
    const usedFeaturePackages = installedOptionalDeps.filter((pkg) =>
      pkg.startsWith('@donotdev/')
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
      await runDiscoveries(handlers, logger);
    }

    // Parse nextConfigOptions
    const safeNextConfigOptions =
      typeof nextConfigOptions === 'object' && nextConfigOptions !== null
        ? nextConfigOptions
        : {};

    const {
      webpack: originalWebpack,
      rewrites: originalRewrites,
      redirects: originalRedirects,
      ...restNextConfig
    } = safeNextConfigOptions;

    // Copy framework assets
    if (appRootSet && !assetsCopied) {
      assetsCopied = await copyFrameworkAssets(
        handlers.assetHandler,
        logger,
        assetsCopied
      );
    }

    // Get config results from handlers
    const routeResult = handlerConfigs.routeConfig(safeNextConfigOptions);
    const themeResult = handlerConfigs.themeConfig(safeNextConfigOptions);
    const i18nResult = handlerConfigs.i18nConfig(safeNextConfigOptions);
    const assetResult = handlerConfigs.assetConfig(safeNextConfigOptions);
    const seoResult = handlerConfigs.seoConfig(safeNextConfigOptions);
    const pwaResult = handlerConfigs.pwaConfig(safeNextConfigOptions);
    const serverShimResult = handlerConfigs.serverShimConfig();

    // Extract flagCodes from i18n discovery for flag chunk filtering
    const i18nDiscoveryData = await handlers.i18nHandler?.getDiscoveryData?.();
    const flagCodes = i18nDiscoveryData?.flagCodes || [];

    // Extract discovered routes so redirects can shadow Next's legacy Pages
    // Router paths (src/pages/<X>Page.tsx → /<X>Page) onto canonical app routes.
    // Only in app-router mode: in 'pages' mode the framework's own output IS the
    // pages router, so shadowing would redirect the real routes.
    const routeDiscoveryData =
      routingMode === 'app'
        ? await handlers.routeHandler?.getDiscoveryData?.()
        : null;

    // Build webpack and rewrites configs
    const webpackConfig = createWebpackConfig({
      originalWebpack,
      unusedFeaturePackages,
      usedFeaturePackages,
      missingOptionalDeps,
      flagCodes,
      logger,
      debug,
    });

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
      routes: routeDiscoveryData?.routes || [],
      logger,
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
      routeResult,
      themeResult,
      i18nResult,
      assetResult,
      seoResult,
      pwaResult,
      serverShimResult,
      restNextConfig,
      discoveredPackages,
      reactCompiler,

      webpackConfig,
      rewritesConfig,
      redirectsConfig,
      missingOptionalDeps,
      flagCodes,
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
