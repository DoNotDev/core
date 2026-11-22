/**
 * @fileoverview Vite build pages: prerendered HTML, sitemap.xml, llms.txt
 * @description After the Vite build, from the route manifest and the SPA shell:
 *
 * - `dist/_shell.html`: the shell as Vite built it, the hosting rewrite's fallback
 *   (`SPA_SHELL_FILE`); `dist/index.html` becomes the prerendered home page.
 * - One page per public static route and language (`/about` → `about.html`, `/en/about`
 *   → `en/about.html`): its route identity (`routeSeo` / `routeHeadTags`, the functions
 *   AutoMetaTags renders with), site tags and hreflang.
 * - One page per public record of each entity route and language (`listPublicPages`, the
 *   Next records, read with the entity's read schema `entityReadSchemas`;
 *   `entityRecordSeo`, the Next entity page identity, with its BreadcrumbList).
 * - `dist/sitemap.xml` and `dist/llms.txt` from the same URL set (`buildSitemap`,
 *   `buildLlmsTxt`, the Next builders): every language URL, records included.
 *
 * Each page embeds its identity tags (`PrerenderedHead`): AutoMetaTags renders exactly
 * them on that URL, so react-helmet-async keeps the prerendered nodes. A record published
 * after the build gets the shell (and is listed by the next build).
 *
 * `@donotdev/core/server`, `@donotdev/core/rsc` (translations: the Next server `t`), the
 * app's `entities` package and the provider's public reader load through a Vite module
 * runner (TypeScript sources in a workspace, built packages from node_modules), under the
 * `react-server` condition the Next server graph uses.
 *
 * @version 0.2.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { DEFAULT_OG_IMAGE, SPA_SHELL_FILE } from '../constants.js';
import { entityReadSchemas, entityRecordSeo } from '../utils/entityRecordSeo.js';
import { getLlmsTxtSource } from '../utils/LlmsTxtGenerator.js';
import { buildLlmsTxt } from '../utils/llmsTxt.js';
import { pageFilePath, renderPrerenderedPage } from '../utils/PrerenderEngine.js';
import { listPublicPages, routeParams } from '../utils/publicPages.js';
import { PUBLIC_READER_DEPENDENCIES, publicReaderProvider } from '../utils/publicReaders.js';
import {
  publicRecordsRoute,
  publishedBaseUrl,
  seoBaseUrl,
  SEOGenerator,
} from '../utils/SEOGenerator.js';
import { buildSitemap, formatSitemapXml } from '../utils/sitemap.js';

/** Vite page URLs never end with `/` (no trailing-slash setting), as AutoMetaTags builds them. */
const TRAILING_SLASH = false;

/** Resolve conditions of the module runner: the Next server graph's (`@donotdev/core` → its server entry). */
const SERVER_CONDITIONS = ['react-server', 'module', 'node', 'import', 'default'];

/**
 * Entity routes of the route manifest whose records the build lists: single-param,
 * indexable, page declaring its entity ({@link publicRecordsRoute}, the Next decision),
 * with the page's og:type (PageMeta `seo.type`, default `website`).
 *
 * @param {Array<Object>} routes - Routes of the route manifest (`createRouteManifestStore`)
 * @returns {Array<{ route: { path: string, collection: string }, type: 'website' | 'article' | 'product' }>}
 * @since 0.3.2
 */
export function recordRoutes(routes) {
  const result = [];
  for (const manifestRoute of routes) {
    const route = publicRecordsRoute(manifestRoute);
    if (route) {
      result.push({ route, type: manifestRoute.meta?.seo?.type ?? 'website' });
    }
  }
  return result;
}

/**
 * The app's public reader: its provider package (app dependency, `PUBLIC_READERS` of
 * `utils/publicReaders.js`, the Next generated files' table) and public env values.
 *
 * @param {Object | null} pkg - The app's package.json
 * @param {Record<string, string>} env - The build's `VITE_*` env (`loadEnv`)
 * @param {string[]} paths - Entity route paths, for the errors
 * @returns {{ module: string, create: (provider: Object) => import('@donotdev/core/server').ICrudAdapter }}
 * @throws {Error} When the provider has no public reader or its env is not set
 * @since 0.3.2
 */
export function publicReader(pkg, env, paths) {
  const dependencies = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const reader = publicReaderProvider((dependency) => Boolean(dependencies[dependency]));
  if (!reader) {
    throw new Error(
      `[dndev] ${paths.join(', ')} list published records, but the app's backend provider has no ` +
        `public reader (supported: ${PUBLIC_READER_DEPENDENCIES}). ` +
        'Mark these pages `seo: { noindex: true }`.'
    );
  }
  // The app's public env, Vite prefix (VITE_SUPABASE_URL, ...)
  const names = reader.env.map((name) => `VITE_${name}`);
  const values = names.map((name) => env[name]);
  if (values.some((value) => !value)) {
    throw new Error(
      `[dndev] Set ${names.join(' and ')}: the build lists the published records of ` +
        `${paths.join(', ')} (record pages, sitemap.xml, llms.txt).`
    );
  }
  return {
    module: reader.module,
    create: (provider) => reader.create(provider, values),
  };
}

/**
 * The app URL of the prerendered record pages: `VITE_APP_URL`, the value AutoMetaTags
 * builds the same URLs from in the browser, so it must already be normalized. The URL
 * rule of every published URL ({@link publishedBaseUrl}): a deploy build needs a public
 * one; a local build takes any (localhost included, one warning line) and, without one,
 * gets no record pages.
 *
 * @param {string | undefined} raw - `VITE_APP_URL`
 * @param {{ warn: (message: string) => void }} logger - Logger of the local-build warning
 * @param {Record<string, string | undefined>} [env] - Environment (default `process.env`)
 * @returns {string | null} Absolute URL, no trailing slash; `null` on a local build without one
 * @throws {Error} On a deploy build without a public URL, or when it ends with `/`
 * @since 0.3.2
 */
export function recordBaseUrl(raw, logger, env = process.env) {
  if (!publishedBaseUrl(raw || null, 'VITE_APP_URL', logger, env)) return null;
  if (raw.endsWith('/') || raw !== raw.trim()) {
    throw new Error(
      `[dndev] VITE_APP_URL "${raw}" must have no trailing slash or spaces: the browser builds canonical URLs from it as is.`
    );
  }
  return raw;
}

/**
 * A reader that runs each distinct query once: the record pages, sitemap.xml and
 * llms.txt list the same records from one read. The read schema is passed through; a
 * build has one per collection (`entityReadSchemas`), so collection and options key the
 * query.
 *
 * @param {import('@donotdev/core/server').ICrudAdapter} crud - Public reader
 * @returns {import('@donotdev/core/server').ICrudAdapter}
 */
function onceReader(crud) {
  const results = new Map();
  return {
    query(collection, options, schema) {
      const key = JSON.stringify([collection, options]);
      if (!results.has(key)) results.set(key, crud.query(collection, options, schema));
      return results.get(key);
    },
  };
}

/**
 * The prerendered pages: static routes and entity records, one per language (default
 * language at the root, others under `/<lang>`). Each page: its identity tags, the site
 * tags (canonical, og:url, og:site_name, hreflang) and the embedded `PrerenderedHead`.
 * Record URLs a static route serves (the static page wins, as on Next) and values no
 * file name can hold are skipped.
 *
 * @param {Object} options
 * @param {Array<{ path: string, meta?: Object, auth?: unknown }>} options.staticRoutes - Static pages (manifest routes; blog posts with their frontmatter `meta`)
 * @param {ReturnType<typeof recordRoutes>} options.records - Entity routes whose records get pages (empty: none)
 * @param {import('@donotdev/core/server').ICrudAdapter | undefined} options.crud - Public reader (required with records)
 * @param {Readonly<Record<string, Object>> | undefined} options.readSchemas - `entityReadSchemas` of the entity routes (required with records)
 * @param {Object} options.core - `@donotdev/core/server` exports
 * @param {Readonly<Record<string, unknown>>} options.entities - The app's `entities` exports (records only)
 * @param {(namespaces: string[], language: string) => Function} options.translate - `t` of namespaces in a language
 * @param {import('@donotdev/core/server').LanguageRouting} options.routing - App languages
 * @param {string} options.baseUrl - `VITE_APP_URL` as the browser reads it (`''` when unset)
 * @param {string} options.siteName - Site name
 * @param {boolean} options.hreflang - `appConfig.seo.hreflang !== false`
 * @param {string} options.defaultNamespace - `appConfig.seo.defaultNamespace` (`home`)
 * @param {string} options.defaultImage - `appConfig.seo.defaultImage` (`DEFAULT_OG_IMAGE`)
 * @param {string} options.shellHtml - The SPA shell
 * @returns {Promise<{ pages: Array<{ file: string, html: string }>, skipped: string[] }>}
 *   `file`: output file (`/en/about.html`); `skipped`: URL paths left to the shell
 * @throws {Error} When a read fails or a route's collection has no entity definition
 * @since 0.3.2
 */
export async function buildPrerenderedPages({
  staticRoutes,
  records,
  crud,
  readSchemas,
  core,
  entities,
  translate,
  routing,
  baseUrl,
  siteName,
  hreflang,
  defaultNamespace,
  defaultImage,
  shellHtml,
}) {
  const withHreflang = hreflang && core.isMultilingual(routing.languages);
  const pages = [];
  const skipped = [];
  const files = new Set();

  /** One page per language of an app path; `head(language, url)` gives its identity. */
  const addPage = (path, head) => {
    const alternates = withHreflang
      ? core.languageUrls(path, baseUrl, routing, TRAILING_SLASH)
      : null;
    for (const language of routing.languages) {
      const urlPath = core.localizePath(path, language, routing);
      const file = pageFilePath(urlPath);
      if (!file || files.has(file)) {
        skipped.push(urlPath);
        continue;
      }
      files.add(file);
      const url = core.languageUrl(path, language, baseUrl, routing, TRAILING_SLASH);
      const identity = head(language, url);
      const tags = [
        ...identity.tags,
        ...core.siteHeadTags({
          url: baseUrl ? url : null,
          siteName,
          alternates,
          defaultLanguage: routing.defaultLanguage,
        }),
      ];
      pages.push({
        file,
        html: renderPrerenderedPage(shellHtml, {
          tags,
          headScript: core.jsonScriptText({ url, ...identity }),
          headElementId: core.PRERENDERED_HEAD_ELEMENT_ID,
        }),
      });
    }
  };

  // Static pages first: a record URL they serve keeps the static page
  for (const route of staticRoutes) {
    const meta = route.meta ?? {};
    // The page's own namespace, else the site defaults (routeSeo: never their title)
    const ns = meta.namespace || null;
    addPage(route.path, (language, url) => ({
      tags: core.routeHeadTags(
        core.routeSeo({
          meta,
          ns,
          defaultNs: defaultNamespace,
          t: translate([ns ?? defaultNamespace], language),
          siteName,
          baseUrl,
          url,
          defaultImage,
          authOnly: !!route.auth,
        }),
        { siteName, baseUrl }
      ),
      breadcrumb: false,
    }));
  }

  if (records.length > 0) {
    const typeOf = new Map(records.map(({ route, type }) => [route.path, type]));
    const listed = await listPublicPages(
      records.map(({ route }) => route),
      crud,
      core.HIDDEN_STATUSES,
      readSchemas
    );
    for (const { route, path, record } of listed) {
      const value = String(record[routeParams(route.path)[0]]);
      addPage(path, (language) => {
        const seo = entityRecordSeo(record, {
          route,
          value,
          language,
          routing,
          baseUrl,
          trailingSlash: TRAILING_SLASH,
          siteName,
          defaultImage,
          type: typeOf.get(route.path),
          entities,
          translate: (namespaces) => translate(namespaces, language),
          deriveEntitySeo: core.deriveEntitySeo,
          buildProductJsonLd: core.buildProductJsonLd,
          buildBreadcrumbJsonLd: core.buildBreadcrumbJsonLd,
          languageUrl: core.languageUrl,
        });
        return { tags: core.recordHeadTags(seo), breadcrumb: seo.breadcrumb !== null };
      });
    }
  }
  return { pages, skipped };
}

/**
 * The sitemap.xml and llms.txt of the build: the Next builders over the sitemap's routes
 * (static pages, entity records, blog posts), every language URL with its alternates.
 *
 * @param {Object} options
 * @param {Array<Object>} options.routes - Manifest routes
 * @param {Array<Object>} options.blogPosts - The route manifest's blog posts (read once per build)
 * @param {SEOGenerator} options.generator - The app's SEO generator (sitemap routes)
 * @param {import('@donotdev/core/server').ICrudAdapter | undefined} options.crud - Public reader (required with entity routes)
 * @param {Readonly<Record<string, Object>> | undefined} options.readSchemas - `entityReadSchemas` of the entity routes (required with entity routes)
 * @param {Object} options.core - `@donotdev/core/server` exports
 * @param {Readonly<Record<string, unknown>>} options.entities - The app's `entities` exports
 * @param {import('@donotdev/core/server').LanguageRouting} options.routing - App languages
 * @param {string} options.baseUrl - Sitemap base URL (`seo.baseUrl`, else `VITE_APP_URL`)
 * @param {string} options.siteName - Site name
 * @param {string | undefined} options.siteDescription - llms.txt summary
 * @param {Record<string, Record<string, Object>>} options.translations - i18n content (namespace → language → JSON)
 * @param {string} options.defaultNamespace - `appConfig.seo.defaultNamespace` (`home`): llms.txt page titles
 * @param {boolean} options.sitemap - Write sitemap.xml
 * @param {boolean} options.llmsTxt - Write llms.txt
 * @returns {Promise<Array<{ file: string, content: string }>>}
 * @since 0.3.2
 */
export async function buildUrlListings({
  routes,
  blogPosts,
  generator,
  crud,
  readSchemas,
  core,
  entities,
  routing,
  baseUrl,
  siteName,
  siteDescription,
  translations,
  defaultNamespace,
  sitemap,
  llmsTxt,
}) {
  const sitemapRoutes = generator.getSitemapRoutes(routes, blogPosts);
  const files = [];
  if (sitemap) {
    const entries = await buildSitemap(sitemapRoutes, {
      baseUrl,
      routing,
      trailingSlash: TRAILING_SLASH,
      crud,
      readSchemas,
      languageUrls: core.languageUrls,
      hiddenStatuses: core.HIDDEN_STATUSES,
    });
    files.push({ file: '/sitemap.xml', content: formatSitemapXml(entries) });
  }
  if (llmsTxt) {
    const source = getLlmsTxtSource({
      siteName,
      description: siteDescription,
      baseUrl,
      sitemapRoutes,
      routes,
      blogPosts,
      blogPath: generator.options.blogPath,
      translations,
      language: routing.defaultLanguage,
      defaultNamespace,
    });
    files.push({
      file: '/llms.txt',
      content: await buildLlmsTxt({
        ...source,
        trailingSlash: TRAILING_SLASH,
        formatTrailingSlash: core.formatTrailingSlash,
        entities,
        crud,
        readSchemas,
        deriveEntitySeo: core.deriveEntitySeo,
        hiddenStatuses: core.HIDDEN_STATUSES,
      }),
    });
  }
  return files;
}

/**
 * Load a module through the runner, with what it is for in the error.
 *
 * @param {Object} runner - Vite module runner
 * @param {string} id - Module specifier
 * @param {string} purpose - Why the build needs it
 */
async function importModule(runner, id, purpose) {
  try {
    return await runner.import(id);
  } catch (error) {
    throw new Error(
      `[dndev] Build pages: cannot load "${id}" (${purpose}): ${error.message}`,
      { cause: error }
    );
  }
}

/**
 * Write the build's pages and URL listings (Vite build, after the bundle). Missing env,
 * a failed read or a missing `entities` package fails the build.
 *
 * @param {Object} options
 * @param {string} options.appRoot - App root
 * @param {string} options.mode - Vite mode (env files)
 * @param {Array<Object>} options.manifestRoutes - Routes of the route manifest (`createRouteManifestStore`)
 * @param {Array<Object>} options.blogPosts - Blog posts of the route manifest (read once by the route plugin)
 * @param {Array<{ path: string, meta?: Object, auth?: unknown }>} options.staticRoutes - Static pages to prerender (none: `prerender` off)
 * @param {boolean} options.prerenderRecords - Record pages (`prerender: 'auto'` and `appConfig.prerenderRecords`)
 * @param {string} options.shellHtml - The SPA shell as Vite wrote it
 * @param {Object} options.seo - SEO options (`appConfig.seo`, site name and description)
 * @param {() => Promise<Object>} options.loadI18n - The app's i18n discovery
 * @param {Object | null} options.pkg - The app's package.json
 * @param {(file: string, content: string) => Promise<void>} options.write - Writes `dist/<file>`
 * @param {Object} options.logger - Logger
 * @returns {Promise<{ pages: number, listings: string[] }>}
 * @throws {Error} When the configuration is incomplete or a read fails
 * @since 0.3.2
 */
export async function writeBuildPages({
  appRoot,
  mode,
  manifestRoutes,
  blogPosts,
  staticRoutes,
  prerenderRecords,
  shellHtml,
  seo,
  loadI18n,
  pkg,
  write,
  logger,
}) {
  if (!shellHtml) {
    throw new Error('[dndev] Build pages: the build output has no index.html (the SPA shell).');
  }
  // The hosting rewrite's fallback: the shell as Vite built it, before index.html is the home page
  await write(`/${SPA_SHELL_FILE}`, shellHtml);
  if (seo.disabled) return { pages: 0, listings: [] };

  const { createServer, loadEnv } = await import('vite');
  const env = loadEnv(mode, appRoot, 'VITE_');
  const siteName = seo.siteName;
  // Site defaults of pages without a namespace (AutoMetaTags): page heads, llms.txt titles
  const defaultNamespace = seo.defaultNamespace || 'home';
  // As the SEO plugin resolves it (robots.txt); '' on a local build without one (warned)
  const listingBaseUrl =
    publishedBaseUrl(seoBaseUrl(seo.baseUrl, env.VITE_APP_URL) || null, 'VITE_APP_URL', logger) ?? '';
  const listings = seo.generateSitemap !== false || seo.llmsTxt !== false;
  // The SEO plugin warns and skips its files without them
  const writeListings = listings && Boolean(listingBaseUrl && siteName);

  const entityRoutes = recordRoutes(manifestRoutes);
  // Record pages publish VITE_APP_URL as the browser reads it: none on a local build without it
  const recordUrl =
    prerenderRecords && entityRoutes.length > 0 ? recordBaseUrl(env.VITE_APP_URL, logger) : null;
  const pageRecords = recordUrl ? entityRoutes : [];
  const readsRecords = entityRoutes.length > 0 && (pageRecords.length > 0 || writeListings);
  if (staticRoutes.length === 0 && pageRecords.length === 0 && !writeListings) {
    return { pages: 0, listings: [] };
  }
  if (!siteName) {
    throw new Error(
      '[dndev] Prerendered page titles end with the site name. Set appConfig.app.name (or appConfig.seo.siteName).'
    );
  }

  let reader = null;
  const paths = entityRoutes.map(({ route }) => route.path);
  if (readsRecords) {
    const dependencies = { ...pkg?.dependencies, ...pkg?.devDependencies };
    if (!dependencies.entities) {
      throw new Error(
        `[dndev] ${paths.join(', ')}: record pages derive their identity from the entity definition, ` +
          "but the app does not depend on an `entities` package. Add the entity to the app's `entities` " +
          'package, or mark the page `seo: { noindex: true }`.'
      );
    }
    reader = publicReader(pkg, env, paths);
  }
  // Pages: the URL the browser builds (raw VITE_APP_URL); records need it set and normalized
  const pageBaseUrl = recordUrl ?? (env.VITE_APP_URL ?? '');
  const i18n = await loadI18n();
  const routing = {
    languages: i18n.supportedLanguages,
    defaultLanguage: i18n.fallbackLanguage,
  };

  const server = await createServer({
    root: appRoot,
    configFile: false,
    envFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { conditions: SERVER_CONDITIONS },
    ssr: {
      resolve: {
        conditions: SERVER_CONDITIONS,
        externalConditions: ['react-server'],
      },
    },
  });
  // The Next server `t` reads the i18n config the generated dndev-config-i18n.js registers
  const previousConfig = globalThis._DNDEV_CONFIG_;
  globalThis._DNDEV_CONFIG_ = {
    ...previousConfig,
    i18n: {
      languages: i18n.supportedLanguages,
      eager: i18n.eagerNamespaces,
      fallback: i18n.fallbackLanguage,
      content: i18n.content,
    },
  };
  try {
    const runner = server.environments.ssr.runner;
    const core = await importModule(runner, '@donotdev/core/server', 'SEO helpers');
    const rsc = await importModule(runner, '@donotdev/core/rsc', 'translations');
    let entities = {};
    let crud;
    let readSchemas;
    if (reader) {
      entities = await importModule(runner, 'entities', 'the entity definitions');
      const provider = await importModule(runner, reader.module, 'the public reader');
      crud = onceReader(reader.create(provider));
      readSchemas = entityReadSchemas(
        entities,
        entityRoutes.map(({ route }) => route),
        core.createSchemas
      );
    }
    const translate = (namespaces, language) =>
      rsc.useTranslation(namespaces, { language }).t;

    const { pages, skipped } = await buildPrerenderedPages({
      staticRoutes,
      records: pageRecords,
      crud,
      readSchemas,
      core,
      entities,
      translate,
      routing,
      baseUrl: pageBaseUrl,
      siteName,
      hreflang: seo.hreflang !== false,
      defaultNamespace,
      defaultImage: seo.defaultImage || DEFAULT_OG_IMAGE,
      shellHtml,
    });
    for (const page of pages) await write(page.file, page.html);
    if (skipped.length > 0) {
      logger.warn(
        `Pages left to the SPA shell (a static page serves the URL, or no file name can hold it): ${skipped.join(', ')}`
      );
    }

    const listingFiles = writeListings
      ? await buildUrlListings({
          routes: manifestRoutes,
          blogPosts,
          generator: new SEOGenerator({ baseUrl: listingBaseUrl, siteName, appRoot }),
          crud,
          readSchemas,
          core,
          entities,
          routing,
          baseUrl: listingBaseUrl,
          siteName,
          siteDescription: seo.siteDescription,
          translations: i18n.content,
          defaultNamespace,
          sitemap: seo.generateSitemap !== false,
          llmsTxt: seo.llmsTxt !== false,
        })
      : [];
    for (const { file, content } of listingFiles) await write(file, content);
    return { pages: pages.length, listings: listingFiles.map(({ file }) => file) };
  } finally {
    if (previousConfig === undefined) delete globalThis._DNDEV_CONFIG_;
    else globalThis._DNDEV_CONFIG_ = previousConfig;
    await server.close();
  }
}
