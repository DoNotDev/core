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

  // Verbose cascade
  const routeVerbose = routeOptions.verbose ?? verbose;
  const themeVerbose = themeOptions.verbose ?? verbose;
  const i18nVerbose = i18nOptions.verbose ?? verbose;
  const assetVerbose = assetOptions.verbose ?? verbose;
  const seoVerbose = seoOptions.verbose ?? verbose;
  const pwaVerbose = pwaOptions.verbose ?? verbose;

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
    blogContentHandler,
  };
}
