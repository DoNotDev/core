/**
 * @fileoverview Prerender Plugin - Build-time Static HTML Generation
 * @description After the build: the SPA shell as the hosting fallback (`dist/_shell.html`),
 * one static HTML per public static route, blog post and entity record, in each language
 * (`dist/<path>.html`, see `../buildPages.js`), and the sitemap.xml / llms.txt of the
 * same URL set. Reads the route manifest; no browser, pure Node string operations.
 * ON by default with routes: 'auto' (auto-discovers public static routes from the
 * manifest, plus the records of entity routes unless `appConfig.prerenderRecords: false`).
 * The routes: the route plugin's manifest, in memory (`createRouteManifestStore`).
 *
 * @version 0.3.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createLogger } from '../../utils/debugLog.js';
import { localizeFontPreloads } from './FontPlugin.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { PrerenderEngine } from '../../utils/PrerenderEngine.js';
import { getPublicStaticRoutes } from '../../utils/routeParser.js';
import { writeBuildPages } from '../buildPages.js';

/**
 * Whether entity routes prerender their public records (`appConfig.prerenderRecords`,
 * default `true`, the Next option).
 *
 * @param {unknown} value - `appConfig.prerenderRecords`
 * @returns {boolean}
 * @throws {Error} When the value is not a boolean
 */
function prerendersRecords(value = true) {
  if (typeof value === 'boolean') return value;
  throw new Error(
    `appConfig.prerenderRecords must be true or false. Got ${JSON.stringify(value)}.`
  );
}

/**
 * Create Vite prerender plugin
 * @param {Object} options - Plugin options
 * @param {string[]|'auto'} options.routes - Route patterns to prerender ('auto' discovers
 *   from manifest, `[]` = no page; the shell, sitemap.xml and llms.txt are still written)
 * @param {boolean} [options.prerenderRecords] - `appConfig.prerenderRecords`: with `routes: 'auto'`,
 *   one page per public record of each entity route (default true)
 * @param {Object} [options.seo] - SEO options (`appConfig.seo` merged with the defaults, site
 *   name and description); `disabled` (`seo: false`): the shell only
 * @param {ReturnType<import('./I18nPlugin.js').createI18nStore>} options.i18nStore - This build's i18n discovery (languages, translations), set by the i18n plugin
 * @param {ReturnType<import('./FontPlugin.js').createFontPlanStore>} options.fontPlan - This build's font plan, set by the font plugin (each page language's font preloads)
 * @param {boolean} [options.debug] - Debug logging
 * @param {boolean} [options.verbose] - Verbose logging
 * @param {ReturnType<import('../../utils/routeParser.js').createRouteManifestStore>} options.routeManifest - The build's route manifest, set by the route plugin
 * @returns {Object} Vite plugin
 */
export function createVitePrerenderPlugin(options = {}) {
  const {
    routes = 'auto',
    prerenderRecords,
    seo = {},
    i18nStore,
    fontPlan,
    debug,
    verbose,
    routeManifest,
  } = options;

  if (!routeManifest || !i18nStore || !fontPlan) {
    throw new Error(
      '[dndev] createVitePrerenderPlugin: options.routeManifest, options.i18nStore and options.fontPlan are required (createVitePlugins passes the route, i18n and font plugins\', createRouteManifestStore / createI18nStore / createFontPlanStore).'
    );
  }

  // Record pages: auto-discovered routes only
  const recordsEnabled = routes === 'auto' && prerendersRecords(prerenderRecords);

  const logger = createLogger('Prerender', debug, verbose);
  const pathResolver = PathResolver.getInstance();
  let resolvedConfig = null;
  let isBuild = false;
  /**
   * The client bundle was written (writeBundle ran): closeBundle also runs after a failed
   * build (Vite's `bundle.close()` in a `finally`), when there is no index.html to read
   * @type {boolean}
   */
  let written = false;

  return {
    name: 'dndev-prerender',
    enforce: 'post',

    // The client environment only: it builds the SPA shell (index.html) and dist/. Another
    // Vite environment (ssr, a custom one) has no shell and its own outDir.
    applyToEnvironment(environment) {
      return environment.name === 'client';
    },

    configResolved(config) {
      isBuild = config.command === 'build';
      resolvedConfig = {
        outDir: config.build?.outDir || 'dist',
        mode: config.mode,
      };
    },

    buildStart() {
      written = false;
    },

    // Runs only once every output file is on disk (Rollup), never after a failed build
    writeBundle() {
      written = true;
    },

    async closeBundle() {
      // After a failed build (a plugin's generateBundle threw, ...) write nothing: the build
      // reports that error, not a missing index.html thrown from Vite's cleanup
      if (!written || !resolvedConfig || !isBuild) return;

      const appRoot = pathResolver.getAppRoot();
      const outDir = pathResolver.resolveAppPath(resolvedConfig.outDir);
      const manifestData = routeManifest.get();
      const manifestRoutes = manifestData.routes;

      // Pages: public static routes ('auto'; blog posts included: the route plugin writes
      // the manifest with each post expanded from its frontmatter), or the explicit list
      const engine = new PrerenderEngine({
        routes: Array.isArray(routes) ? routes : [],
        debug,
        outDir,
        logger,
      });
      const routeByPath = new Map(manifestRoutes.map((route) => [route.path, route]));
      const paths =
        routes === 'auto'
          ? [
              ...new Set(
                getPublicStaticRoutes(manifestRoutes).filter((path) => !path.includes('*'))
              ),
            ]
          : engine.expandRoutes(manifestData);
      const staticRoutes = paths.map((path) => routeByPath.get(path) ?? { path });

      // The SPA shell as Vite wrote it, before index.html becomes the home page
      const shellHtml = pathResolver.readSync(pathResolver.resolvePath('index.html', outDir));
      const { preloads } = fontPlan.get();
      const { pages, listings } = await writeBuildPages({
        appRoot,
        mode: resolvedConfig.mode,
        manifestRoutes,
        blogPosts: manifestData.blogPosts,
        staticRoutes,
        prerenderRecords: recordsEnabled,
        shellHtml,
        // A page in another language than the shell's gets its language's font preloads
        pageShell: (language) => localizeFontPreloads(shellHtml, preloads[language]),
        seo,
        loadI18n: async () => i18nStore.get(),
        pkg: pathResolver.readSync(pathResolver.resolveAppPath('package.json'), {
          format: 'json',
        }),
        write: (file, content) => engine.writeOutputFile(file, content),
        logger,
      });
      if (pages > 0) logger.info(`Prerendered: ${pages} pages`);
      for (const file of listings) logger.info(`📄 ${file.slice(1)}`);
    },
  };
}
