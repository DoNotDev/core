/**
 * @fileoverview Prerender Plugin - Build-time Static HTML Generation
 * @description Generates per-route static HTML with SEO metadata after build completes.
 * Reads the route manifest, injects route-specific meta tags into the SPA shell,
 * and writes per-route HTML files. No browser required - pure Node string ops.
 * ON by default with routes: 'auto' - auto-discovers public static routes from manifest.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { PrerenderEngine } from '../../utils/PrerenderEngine.js';
import {
  parseRouteManifest,
  getPublicStaticRoutes,
  expandBlogRoutes,
} from '../../utils/routeParser.js';

/**
 * Create Vite prerender plugin
 * @param {Object} options - Plugin options
 * @param {string[]|'auto'} options.routes - Route patterns to prerender ('auto' discovers from manifest)
 * @param {boolean} [options.debug] - Debug logging
 * @param {boolean} [options.verbose] - Verbose logging
 * @returns {Object} Vite plugin
 */
export function createVitePrerenderPlugin(options = {}) {
  const { routes = 'auto', debug, verbose, ...engineOptions } = options;

  // Disabled when routes is explicitly empty array
  if (Array.isArray(routes) && routes.length === 0) {
    return { name: 'prerender-disabled' };
  }

  const logger = createLogger('Prerender', debug, verbose);
  const pathResolver = PathResolver.getInstance();
  let resolvedConfig = null;
  let isBuild = false;

  return {
    name: 'dndev-prerender',
    enforce: 'post',

    configResolved(config) {
      isBuild = config.command === 'build';
      resolvedConfig = {
        root: config.root,
        outDir: config.build?.outDir || 'dist',
        base: config.base || '/',
      };
    },

    async closeBundle() {
      if (!resolvedConfig || !isBuild) return;

      const appRoot = pathResolver.getAppRoot();
      const outDir = pathResolver.resolveAppPath(resolvedConfig.outDir);

      // Resolve 'auto' to actual routes from manifest
      let resolvedRoutes = routes;
      if (routes === 'auto') {
        const routeData = parseRouteManifest({ appRoot, logger });
        const staticRoutes = getPublicStaticRoutes(routeData.routes);

        // Expand dynamic blog routes (/blog/:slug -> /blog/my-post, etc.)
        // expandBlogRoutes returns route objects; extract paths for prerender
        const blogRouteObjects = expandBlogRoutes(routeData.routes, {
          appRoot,
        });
        const blogPaths = blogRouteObjects.map((r) => r.path);

        // Merge: static routes first, then blog (index last - it's heaviest)
        resolvedRoutes = [...new Set([...staticRoutes, ...blogPaths])];

        if (resolvedRoutes.length === 0) {
          logger.warn('No public static routes found for prerendering.');
          return;
        }
        logger.debug(
          `Auto-discovered ${resolvedRoutes.length} route(s) to prerender`
        );
      }

      try {
        const engine = new PrerenderEngine({
          ...engineOptions,
          routes: resolvedRoutes,
          debug,
          outDir,
          base: resolvedConfig.base,
          appRoot,
          logger,
        });

        const results = await engine.run();

        // Summary - single categorized line
        const succeeded = results.filter((r) => r.ok).length;
        const failed = results.filter((r) => !r.ok);
        const total = results.length;

        const blogCount = results.filter(
          (r) => r.ok && r.route.startsWith('/blog/')
        ).length;
        const staticCount = succeeded - blogCount;
        const parts = [];
        if (staticCount > 0) parts.push(`${staticCount} static`);
        if (blogCount > 0) parts.push(`${blogCount} blog`);
        const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';

        if (succeeded > 0) {
          logger.info(`Prerendered: ${succeeded}/${total} pages${breakdown}`);
        }

        if (failed.length > 0) {
          for (const r of failed) {
            logger.warn(`  Failed: ${r.route} - ${r.error}`);
          }
        }
      } catch (error) {
        // Graceful degradation - SPA still works via index.html fallback
        logger.warn(`Prerendering failed: ${error.message}`);
        logger.warn(
          'SPA will serve all routes via index.html fallback (no impact on functionality).'
        );
        if (debug && error.stack) {
          logger.debug(error.stack);
        }
      }
    },
  };
}
