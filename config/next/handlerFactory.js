/**
 * @fileoverview Handler Factory for Next.js
 * @description Creates all handlers with proper debug cascading
 */

import { createNextAssetHandler } from './handlers/AssetHandler.js';
import { createNextBlogContentHandler } from './handlers/BlogContentHandler.js';
import { createNextI18nHandler } from './handlers/I18nHandler.js';
import { createNextPWAHandler } from './handlers/PWAHandler.js';
import { createNextRouteHandler } from './handlers/RouteHandler.js';
import { createNextSEOHandler } from './handlers/SEOHandler.js';
import { createNextServerShimHandler } from './handlers/ServerShimHandler.js';
import { createNextThemeHandler } from './handlers/ThemeHandler.js';

/**
 * Create all handlers with debug cascade
 * Debug/verbose cascade: global debug/verbose cascades to all handlers unless explicitly overridden
 *
 * @param {Object} options - Handler options
 * @returns {Object} All handlers
 */
export function createHandlers({
  debug,
  verbose,
  generateManifest,
  routeOptions,
  themeOptions,
  i18nOptions,
  assetOptions,
  seoOptions,
  pwaOptions,
  serverShimOptions,
  appUrl,
  isDev,
  logger,
}) {
  // Enterprise-grade debug cascade
  const routeDebug = routeOptions.debug ?? debug;
  const themeDebug = themeOptions.debug ?? debug;
  const i18nDebug = i18nOptions.debug ?? debug;
  const assetDebug = assetOptions.debug ?? debug;
  const seoDebug = seoOptions.debug ?? debug;
  const pwaDebug = pwaOptions.debug ?? debug;
  const serverShimDebug = serverShimOptions.debug ?? debug;

  // Verbose cascade
  const routeVerbose = routeOptions.verbose ?? verbose;
  const themeVerbose = themeOptions.verbose ?? verbose;
  const i18nVerbose = i18nOptions.verbose ?? verbose;
  const assetVerbose = assetOptions.verbose ?? verbose;
  const seoVerbose = seoOptions.verbose ?? verbose;
  const pwaVerbose = pwaOptions.verbose ?? verbose;
  const serverShimVerbose = serverShimOptions.verbose ?? verbose;

  // Shared options
  const sharedOptions = { debug, verbose, generateManifest };

  // Create all handlers
  const routeHandler = routeOptions.disabled
    ? null
    : createNextRouteHandler({
        ...sharedOptions,
        ...routeOptions,
        debug: routeDebug,
        verbose: routeVerbose,
      });

  if (debug) {
    logger.debug(
      `Route handler created: ${routeHandler ? 'enabled' : 'disabled'} (debug: ${routeDebug})`
    );
  }

  const themeHandler = createNextThemeHandler({
    ...sharedOptions,
    ...themeOptions,
    debug: themeDebug,
    verbose: themeVerbose,
  });

  const i18nHandler = createNextI18nHandler({
    ...sharedOptions,
    ...i18nOptions,
    debug: i18nDebug,
    verbose: i18nVerbose,
  });

  const assetHandler = createNextAssetHandler({
    ...sharedOptions,
    ...assetOptions,
    debug: assetDebug,
    verbose: assetVerbose,
  });

  const seoHandler = createNextSEOHandler({
    ...sharedOptions,
    ...seoOptions,
    debug: seoDebug,
    verbose: seoVerbose,
    appUrl: appUrl,
    isDev: isDev,
  });

  const pwaHandler = createNextPWAHandler({
    ...sharedOptions,
    ...pwaOptions,
    debug: pwaDebug,
    verbose: pwaVerbose,
  });

  const serverShimHandler = createNextServerShimHandler({
    ...sharedOptions,
    ...serverShimOptions,
    debug: serverShimDebug,
    verbose: serverShimVerbose,
  });

  const blogContentHandler = createNextBlogContentHandler({
    debug,
    verbose,
  });

  return {
    routeHandler,
    themeHandler,
    i18nHandler,
    assetHandler,
    seoHandler,
    pwaHandler,
    serverShimHandler,
    blogContentHandler,
  };
}

/**
 * Create handler configs with error handling
 * @param {Object} handlers - Handler instances
 * @param {Object} logger - Logger instance
 * @returns {Object} Handler config functions
 */
export function createHandlerConfigs(handlers, logger) {
  const configs = {};

  // Route config
  if (handlers.routeHandler) {
    try {
      configs.routeConfig = handlers.routeHandler.createNextConfig();
    } catch (error) {
      logger.error(
        `Route handler failed during config creation: ${error.message}`
      );
      logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      configs.routeConfig = () => ({});
    }
  } else {
    configs.routeConfig = () => ({});
  }

  // Other handlers
  const handlerMap = [
    { name: 'theme', handler: handlers.themeHandler },
    { name: 'i18n', handler: handlers.i18nHandler },
    { name: 'asset', handler: handlers.assetHandler },
    { name: 'seo', handler: handlers.seoHandler },
    { name: 'pwa', handler: handlers.pwaHandler },
  ];

  for (const { name, handler } of handlerMap) {
    try {
      configs[`${name}Config`] = handler.createNextConfig();
    } catch (error) {
      logger.error(
        `${name.charAt(0).toUpperCase() + name.slice(1)} handler failed: ${error.message}`
      );
      logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      configs[`${name}Config`] = () => ({});
    }
  }

  // ServerShim (special case - it's a function, not a handler)
  try {
    configs.serverShimConfig = handlers.serverShimHandler;
  } catch (error) {
    logger.error(`ServerShim handler failed: ${error.message}`);
    logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
    configs.serverShimConfig = () => ({});
  }

  return configs;
}
