/**
 * @fileoverview Next.js Route Handler - Platform Adapter
 * @description Transforms pure route data from RouteDiscovery into Next.js compatible format. Generates both middleware and app/** directory files for optimal SEO.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// node:module kept — createRequire is used for dynamic CJS require() with cache-busting
// (delete require.cache[key]), which has no PathResolver equivalent.
import { createRequire } from 'node:module';

import { BaseNextHandler } from './BaseNextHandler.js';
import { NEXT_FILE_MARKER, nextFileName } from '../nextFiles.js';
import {
  GENERATED_PATHS,
  ROUTE_DISCOVERY,
  CONFIG_KEYS,
  DEFAULT_OG_IMAGE,
  NEXT_RENDER,
} from '../../constants.js';
import { RouteDiscovery } from '../../discovery/RouteDiscovery.js';
import { createMissingResourceError } from '../../utils/buildError.js';
import {
  readTranslation,
  getTranslationValue,
  getSupportedLocales,
  getFallbackLocale,
} from '../utils/TranslationReader.js';

export class NextRouteHandler extends BaseNextHandler {
  constructor(options = {}) {
    super(RouteDiscovery, options);
    /**
     * Whether the per-request tree (src/app/dndev-session) is generated: cookie session
     * and a generated proxy to rewrite to it. Set by generateMiddleware, which runs
     * before the page generation.
     * @type {boolean}
     */
    this.rendersSessionTree = false;
    /**
     * First URL segments of the app's own route files outside `src/app/[lang]` (2+
     * languages, set by generateMiddleware): the proxy passes them untouched.
     * @type {string[]}
     */
    this.appRouteSegments = [];
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      routingMode: 'app', // 'app' or 'pages'
      generateMiddleware: true,
      generateAppPages: true, // NEW: Generate app/** page files
      // Note: catch-all removed - incompatible with Next.js 16+ static export, use not-found.next.tsx instead
      proxyPath: GENERATED_PATHS.next.proxy,
      manifestPath: GENERATED_PATHS.next.routeManifest,
      // App languages (set by useLanguages from the i18n discovery before generation).
      // One language: no URL prefix, pages at the app root.
      languages: [],
      defaultLanguage: null,
    };
  }

  /**
   * Languages of the app, from the i18n discovery (runDiscoveries calls this before
   * generating routes, which run before the i18n handler). 2+ languages: pages are
   * generated under `src/app/[lang]/` and the proxy serves the default language at
   * the root.
   *
   * @param {{ languages: string[], defaultLanguage: string }} i18n
   * @since 0.2.3
   */
  useLanguages({ languages, defaultLanguage }) {
    if (languages.length > 1 && !languages.includes(defaultLanguage)) {
      throw new Error(
        `i18n fallbackLanguage "${defaultLanguage}" has no translations among [${languages.join(', ')}]: it is the language served at the root URL. Add its locale files or set i18n.fallbackLanguage to one of them.`
      );
    }
    this.options.languages = languages;
    this.options.defaultLanguage = defaultLanguage;
  }

  /**
   * Whether every language has its own URL (2+ languages).
   *
   * @returns {boolean}
   * @since 0.2.3
   */
  isMultilingual() {
    return this.options.languages.length > 1;
  }

  /**
   * Directory of the root layout, relative to `src/app`: `/[lang]` with 2+ languages
   * (the root layout reads the language of the URL), `''` with one.
   *
   * @returns {string}
   * @since 0.2.3
   */
  rootDir() {
    return this.isMultilingual() ? '/[lang]' : '';
  }

  /**
   * Root directory of a render tree, relative to `src/app` (NEXT_RENDER), under the
   * root layout: the `(site)` route group (static, cached pages) or the internal
   * per-request tree. `/[lang]/(site)` with 2+ languages, `/(site)` with one.
   *
   * @param {'site'|'session'} [tree='site']
   * @returns {string}
   * @since 0.2.3
   */
  treeDir(tree = 'site') {
    return `${this.rootDir()}/${tree === 'session' ? NEXT_RENDER.sessionSegment : NEXT_RENDER.siteGroup}`;
  }

  /**
   * App directory of a route, relative to `src/app`: `/[lang]/(site)/produits/[slug]`
   * with 2+ languages, `/(site)/produits/[slug]` with one; under the per-request tree
   * (`/[lang]/dndev-session/…`) for `tree: 'session'`.
   *
   * @param {string} routePath - Route path in React Router syntax
   * @param {'site'|'session'} [tree='site'] - Render tree
   * @returns {string}
   * @since 0.2.3
   */
  appDirFor(routePath, tree = 'site') {
    return `${this.treeDir(tree)}${this.convertRouteToAppPath(routePath)}`;
  }

  /**
   * Import path of an app file of `src/app` (ClientLayout, AppDocument) from a
   * directory below it.
   *
   * @param {string} dir - Directory relative to `src/app` (`/[lang]/(site)`, `''`)
   * @param {string} name - Module name in `src/app` (`ClientLayout`)
   * @returns {string} `../../ClientLayout`, `./ClientLayout` from `src/app` itself
   * @since 0.2.3
   */
  appImport(dir, name) {
    const depth = dir.split('/').filter(Boolean).length;
    return depth === 0 ? `./${name}` : `${'../'.repeat(depth)}${name}`;
  }

  createDiscovery(discoveryClass) {
    return new discoveryClass(this.pathResolver, this.options);
  }

  getHandlerName() {
    return 'Route';
  }

  // Enterprise-grade: Log discovery results (business metrics, not process)
  logDiscoveryResults(routeData) {
    const routes = routeData.routes || [];
    const authRequired = routes.filter((r) => r.auth && r.auth.required).length;
    const totalRoutes = routes.length;

    // Root route "/" is automatically assigned to HomePage.tsx by RouteDiscovery convention
    // No validation needed - HomePage.tsx provides the root route
    this.logger.info(
      `🛣️ Routes: ${totalRoutes} found${authRequired > 0 ? `, ${authRequired} are authguarded` : ''}`
    );
  }

  // === DISCOVERY INTEGRATION ===

  async getDiscoveryData() {
    return await this.discovery.discoverRoutes();
  }

  getAPIRewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/routes',
          destination: '/api/routes/route',
        },
      ],
      fallback: [],
    };
  }

  formatAPIResponse(routeData) {
    return {
      routes: routeData.routes,
      source: routeData.source,
      totalRoutes: routeData.routes.length,
      timestamp: routeData.timestamp,
    };
  }

  createManifestContent(routeData) {
    return {
      routes: routeData.routes.map((route) => ({
        path: route.path,
        auth: route.auth,
        meta: route.meta,
      })),
      source: routeData.source,
      totalRoutes: routeData.routes.length,
      generatedAt: new Date().toISOString(),
      routingMode: this.options.routingMode,
    };
  }

  getGenerationSummary(routeData) {
    return `${routeData.routes.length} routes for Next.js ${this.options.routingMode} router`;
  }

  // === CONFIG GENERATION ===

  /**
   * Override base config generation to match Vite format
   * Store expects routes.mapping, not route.routes
   */
  generateConfigContent(discoveryData) {
    // Include all discovered routes including "/" (HomePage).
    // HomePage.tsx is automatically assigned path "/" by RouteDiscovery convention.
    const routes = discoveryData.routes || [];

    const manifest = {
      totalRoutes: routes.length,
      authRequired: routes.filter((r) => r.auth && r.auth.required).length,
      publicRoutes: routes.filter((r) => !r.auth || r.auth === false).length,
      source: discoveryData.source,
      generatedAt: new Date().toISOString(),
    };

    return `// Auto-generated DnDev config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_.routes with discovery results

const routeMapping = ${JSON.stringify(routes, null, 2)};

const routeManifest = ${JSON.stringify(manifest, null, 2)};

// Populate unified DnDev config for runtime access (universal CSR/SSR)
if (typeof globalThis !== 'undefined') {
  if (!globalThis._DNDEV_CONFIG_) {
    globalThis._DNDEV_CONFIG_ = {
      platform: 'nextjs',
      mode: typeof process !== 'undefined' && process.env.NODE_ENV === 'production' ? 'production' : 'development',
      version: '1.0.0',
      context: typeof window !== 'undefined' ? 'client' : 'server',
      timestamp: Date.now(),
    };
  }
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS.routes} = {
    mapping: routeMapping,
    manifest: routeManifest,
  };
}

// Export for compatibility
export const routes = routeMapping;
export const manifest = routeManifest;
export default { routes: routeMapping, manifest: routeManifest };
`;
  }

  // === FILE GENERATION ===

  async generateSpecificFiles(routeData) {
    await this.assertAppDocument();

    if (this.options.generateMiddleware) {
      await this.generateMiddleware(routeData);
    }

    // Generate metadata manifest for centralized SEO
    await this.generateMetadataManifest(routeData);

    // NEW: Generate app/** page files for Site template
    if (this.options.generateAppPages) {
      await this.generateAppPageFiles(routeData);
    }

    if (this.options.routingMode === 'app') {
      await this.generateAppRoutes(routeData);
    } else {
      await this.generatePagesRoutes(routeData);
    }

    // Generate API route
    await this.generateAPIHandler(routeData);
  }

  /**
   * Generate metadata manifest for centralized SEO
   * Pre-resolves i18n at build time for all routes
   *
   * @param {Object} routeData - Route discovery results
   * @returns {Promise<void>}
   */
  async generateMetadataManifest(routeData) {
    const i18nConfig = this.loadI18nConfig();
    const locales = getSupportedLocales(i18nConfig);
    const fallbackLocale = getFallbackLocale(i18nConfig);

    // Read site name from config or env
    let siteName = process.env.NEXT_PUBLIC_SITE_NAME || '';
    if (!siteName) {
      try {
        const seoManifestPath = this.pathResolver.resolveAppPath(
          'public/seo-manifest.json'
        );
        if (this.pathResolver.pathExists(seoManifestPath)) {
          const seoManifest = this.pathResolver.readSync(seoManifestPath, {
            format: 'json',
          });
          siteName = seoManifest?.siteName || '';
        }
      } catch {
        // Ignore - siteName will be empty
      }
    }

    const manifest = {};

    for (const route of routeData.routes) {
      const namespace = route.metaExport?.namespace;
      const seo = route.metaExport?.seo || {};

      // Per-locale metadata
      const localeMetadata = {};

      for (const locale of locales) {
        // Read translation for this locale
        const translation =
          (namespace &&
            i18nConfig &&
            readTranslation(
              namespace,
              locale,
              i18nConfig,
              this.pathResolver
            )) ||
          readTranslation(
            namespace,
            fallbackLocale,
            i18nConfig,
            this.pathResolver
          );

        // Extract values with priority chain:
        // 1. i18n meta.fullTitle → wins
        // 2. seo.fullTitle (PageMeta) → static fallback
        // 3. i18n ns:title + siteName
        // 4. seo.title + siteName
        // 5. siteName only
        const i18nMeta = getTranslationValue(translation, 'meta') || {};
        const i18nTitle = getTranslationValue(translation, 'title');
        const i18nDescription = getTranslationValue(translation, 'description');

        let title;
        if (i18nMeta.fullTitle) {
          title = i18nMeta.fullTitle;
        } else if (seo.fullTitle) {
          title = seo.fullTitle;
        } else if (i18nTitle) {
          title = siteName ? `${i18nTitle} | ${siteName}` : i18nTitle;
        } else if (seo.title) {
          title = siteName ? `${seo.title} | ${siteName}` : seo.title;
        } else if (seo.title === null) {
          title = siteName;
        } else {
          title = siteName || '';
        }

        // Description: seo.description (explicit) > i18n > omit if null
        let description;
        if (seo.description === null) {
          description = undefined;
        } else if (seo.description) {
          description = seo.description;
        } else if (i18nDescription) {
          description = i18nDescription;
        }

        // Other metadata
        const image = seo.image || i18nMeta.image || DEFAULT_OG_IMAGE;
        const type = seo.type || i18nMeta.type || 'website';
        const keywords = seo.keywords || i18nMeta.keywords;
        const noindex = seo.noindex || false;

        localeMetadata[locale] = {
          title,
          ...(description && { description }),
          image,
          type,
          ...(keywords && { keywords }),
          ...(noindex && { noindex }),
        };
      }

      manifest[route.path] = {
        locales: localeMetadata,
        defaultLocale: fallbackLocale,
      };
    }

    // Write manifest to public directory for static access
    const manifestContent = JSON.stringify(manifest, null, 2);
    this.writeGeneratedFile(
      'public/metadata-manifest.json',
      manifestContent,
      'metadata manifest'
    );

    this.logger.debug(
      `Generated metadata manifest for ${Object.keys(manifest).length} routes`
    );
  }

  /**
   * Generate app/** page files from discovered routes, in two render trees:
   *
   * - `src/app/(site)/…` (every app): the providers without request data, so each page
   *   is static and served from the cache, revalidated every
   *   NEXT_RENDER.revalidateSeconds (ISR). One cache entry per URL, i.e. per page and
   *   per language. Guests, crawlers and every visitor of an app whose session the
   *   server cannot read (Firebase, localStorage) get it.
   * - `src/app/dndev-session/…` (cookie session + generated proxy): the same pages
   *   rendered per request with the request cookies (signed-in state, the visitor's
   *   data). The proxy rewrites requests carrying an auth cookie to it.
   *
   * Both trees sit under the generated root layout (`src/app/layout.next.tsx`, or
   * `src/app/[lang]/layout.next.tsx` with 2+ languages): the app's AppDocument with the
   * page's `<html lang>`, no providers, no request data, so the site tree stays static.
   * The 404 pages are generated next to it.
   *
   * @param {Object} routeData - Route discovery results
   * @returns {Promise<void>}
   */
  async generateAppPageFiles(routeData) {
    this.logger.debug('Starting app/** page file generation');

    try {
      // Clean existing generated page files first
      await this.cleanGeneratedPageFiles();

      this.generateRootLayout();
      this.generateNotFoundPages();
      const trees = this.rendersSessionTree ? ['site', 'session'] : ['site'];
      for (const tree of trees) {
        await this.generateTreeLayout(tree);
      }

      // Generate a page file for each discovered route
      let generatedCount = 0;
      for (const route of routeData.routes) {
        const wasGenerated = await this.generateSingleAppPage(route);
        if (wasGenerated) generatedCount++;
        if (wasGenerated && this.rendersSessionTree) {
          this.generateSessionPage(route);
        }
      }

      this.logger.debug(
        `Successfully generated ${generatedCount}/${routeData.routes.length} app/** page files`
      );
    } catch (error) {
      this.logger.error(`Failed to generate app/** files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Request-reading parts of the app's document (src/app/AppDocument.tsx): the
   * providers (`<ClientLayout>`), `next/headers`, an exported `dynamic`.
   *
   * @param {string} content - AppDocument source
   * @returns {string[]} What it does, empty for an HTML shell
   * @since 0.2.3
   */
  requestDocumentParts(content) {
    return [
      [/<ClientLayout\b/, 'renders <ClientLayout>'],
      [/from\s+['"]next\/headers['"]/, 'imports next/headers'],
      [/export\s+const\s+dynamic\b/, 'exports `dynamic`'],
    ]
      .filter(([pattern]) => pattern.test(content))
      .map(([, label]) => label);
  }

  /**
   * Fail the build unless the app's HTML document is `src/app/AppDocument.tsx` and the
   * framework owns the root layout and the 404 pages.
   *
   * - An app-owned root layout (`src/app/layout.next.tsx`, `src/app/[lang]/layout.next.tsx`)
   *   or root 404 (`not-found.next.tsx`, `global-not-found.next.tsx`): the generated
   *   root layout renders AppDocument with the page's language (`<html lang>`), which
   *   a root layout above the `[lang]` segment cannot know.
   * - AppDocument missing, or reading the request / rendering the providers: it is the
   *   HTML shell of every cached page; the generated tree layouts render ClientLayout
   *   (cached pages for guests, per request for an auth cookie).
   *
   * @returns {Promise<void>}
   * @throws {Error} With the files to move or delete and the shape AppDocument takes
   * @since 0.2.3
   */
  async assertAppDocument() {
    const documentPath = GENERATED_PATHS.next.appDocument;
    const documentShape =
      `${documentPath} exports \`metadata\` (site-level: metadataBase) and ` +
      '`AppDocument({ lang, children })`, which renders <html lang={lang}>, the <head> ' +
      'links (favicon, <FontPreloadLinks />), imports the global CSS and puts {children} ' +
      'in <body> (see the @donotdev/cli app-next template)';
    const appOwned = [];
    for (const rel of this.frameworkRootFiles()) {
      const fullPath = this.pathResolver.resolveAppPath(rel);
      if (
        this.pathResolver.pathExists(fullPath) &&
        !(await this.hasGenerationMarker(fullPath))
      ) {
        appOwned.push(rel);
      }
    }
    if (appOwned.length > 0) {
      throw new Error(
        `[dndev] ${appOwned.join(', ')}: the framework generates the root layout and the ` +
          "404 pages, so every page's HTML carries its language (<html lang>). Move the " +
          `HTML shell into ${documentPath}: ${documentShape}. Then delete ${appOwned.join(', ')}.`
      );
    }

    const fullPath = this.pathResolver.resolveAppPath(documentPath);
    if (!this.pathResolver.pathExists(fullPath)) {
      throw new Error(`[dndev] ${documentPath} is missing: ${documentShape}.`);
    }
    const parts = this.requestDocumentParts(
      await this.pathResolver.read(fullPath, { format: 'text' })
    );
    if (parts.length === 0) return;
    throw new Error(
      `[dndev] ${documentPath} ${parts.join(', ')}. It must be the HTML shell: ` +
        'render {children} in <body>, drop the ClientLayout / headers() wrapper and ' +
        '`export const dynamic`. The generated layouts render ClientLayout: cached pages ' +
        'for guests, per-request pages for visitors with an auth cookie.'
    );
  }

  /**
   * Root files the framework generates (root layouts, 404 pages), in both language
   * modes: an app-owned one is refused (assertAppDocument), a generated one of the
   * other mode is removed by cleanGeneratedPageFiles.
   *
   * @returns {string[]} Paths relative to the app root
   * @since 0.2.3
   */
  frameworkRootFiles() {
    const layout = nextFileName('layout', 'tsx');
    const notFound = nextFileName('not-found', 'tsx');
    return [
      GENERATED_PATHS.next.appLayout,
      `src/app/[lang]/${layout}`,
      `src/app/${notFound}`,
      `src/app/[lang]/${notFound}`,
      `src/app/${nextFileName('global-not-found', 'tsx')}`,
    ];
  }

  /**
   * Layout of a render tree: `src/app/(site)/layout.next.tsx` or
   * `src/app/dndev-session/layout.next.tsx` (under `src/app/[lang]` with 2+ languages).
   * The per-request one is removed when the app has no cookie session.
   *
   * @param {'site'|'session'} tree
   * @returns {Promise<void>}
   * @since 0.2.3
   */
  async generateTreeLayout(tree) {
    const layoutPath = `src/app${this.treeDir(tree)}/${nextFileName('layout', 'tsx')}`;
    const fullPath = this.pathResolver.resolveAppPath(layoutPath);
    if (
      this.pathResolver.pathExists(fullPath) &&
      !(await this.hasGenerationMarker(fullPath))
    ) {
      this.logger.debug(`Skipping ${layoutPath} - user-created file detected`);
      return;
    }
    this.writeGeneratedFile(
      layoutPath,
      tree === 'session'
        ? this.generateSessionLayoutContent()
        : this.generateSiteLayoutContent(),
      `${tree} layout`
    );
  }

  /**
   * Content of `src/app/(site)/layout.next.tsx` (`src/app/[lang]/(site)` with 2+
   * languages): the app's ClientLayout without request
   * data. Signed-out snapshot (`serverCookies=""`: a cookie-session provider reads it
   * as signed out, the others as unknown), language from the URL only. The Suspense
   * boundary keeps a page that reads the query string (useSearchParams /
   * useLocation().search) to itself: that page renders in the browser, the layout and
   * every other page stay in the cached HTML.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateSiteLayoutContent() {
    return `// Generated by @donotdev/config - DO NOT EDIT
// Cached pages: rendered without request data (no cookies, no headers), served from the
// cache and re-rendered at most every ${NEXT_RENDER.revalidateSeconds}s. One entry per URL (page and language).

import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { ClientLayout } from '${this.appImport(this.treeDir('site'), 'ClientLayout')}';

export const revalidate = ${NEXT_RENDER.revalidateSeconds};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <ClientLayout serverCookies="" acceptLanguage={null}>
      <Suspense fallback={null}>{children}</Suspense>
    </ClientLayout>
  );
}
`;
  }

  /**
   * Content of `src/app/dndev-session/layout.next.tsx` (`src/app/[lang]/dndev-session`
   * with 2+ languages): the app's ClientLayout with the
   * request's Cookie and Accept-Language headers (signed-in state on the first paint,
   * the visitor's data). Reading the headers renders these pages per request.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateSessionLayoutContent() {
    return `// Generated by @donotdev/config - DO NOT EDIT
// Per-request pages for visitors with an auth cookie (the proxy rewrites them here; a
// direct hit is a 404): the providers read the request cookies, so the server render
// shows the visitor's signed-in state and data. Never cached.

import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { ClientLayout } from '${this.appImport(this.treeDir('session'), 'ClientLayout')}';

export default async function SessionLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  return (
    <ClientLayout
      serverCookies={requestHeaders.get('cookie') ?? ''}
      acceptLanguage={requestHeaders.get('accept-language')}
    >
      {children}
    </ClientLayout>
  );
}
`;
  }

  /**
   * The root layout: `src/app/layout.next.tsx` with one language,
   * `src/app/[lang]/layout.next.tsx` with 2+ (the generated one of the other mode is
   * removed by cleanGeneratedPageFiles). It renders the app's AppDocument with the
   * page's language, so every page's HTML carries its `<html lang>`, cached pages
   * included. Both render trees are its children: moving between them (sign-in,
   * sign-out) and between languages is a client-side navigation.
   *
   * @returns {void}
   * @since 0.2.3
   */
  generateRootLayout() {
    this.writeGeneratedFile(
      `src/app${this.rootDir()}/${nextFileName('layout', 'tsx')}`,
      this.generateRootLayoutContent(),
      'root layout'
    );
  }

  /**
   * Content of the root layout. 2+ languages: lists the languages
   * (generateStaticParams, every language URL is prerendered) and 404s any other
   * first segment. One language: the default language.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateRootLayoutContent() {
    const documentImport = this.appImport(this.rootDir(), 'AppDocument');
    if (!this.isMultilingual()) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// Root layout: the app's AppDocument (src/app/AppDocument.tsx) in the app's language.

import type { ReactNode } from 'react';

import { AppDocument } from '${documentImport}';

export { metadata } from '${documentImport}';

export default function RootLayout({ children }: { children: ReactNode }) {
  return <AppDocument lang=${JSON.stringify(this.options.defaultLanguage)}>{children}</AppDocument>;
}
`;
    }
    return `// Generated by @donotdev/config - DO NOT EDIT
// Root layout: the app's AppDocument (src/app/AppDocument.tsx) in the URL's language.
// One URL per language: the default language (${this.options.defaultLanguage}) at the root, served here by
// the proxy's rewrite; the others under their prefix. Any other first segment is a 404.

import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppDocument } from '${documentImport}';

export { metadata } from '${documentImport}';

const LANGUAGES: readonly string[] = ${JSON.stringify(this.options.languages)};

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LANGUAGES.includes(lang)) notFound();
  return <AppDocument lang={lang}>{children}</AppDocument>;
}
`;
  }

  /**
   * The 404 pages, rendered with the app's providers (ClientLayout) and the
   * framework's NotFoundPage, without request data:
   *
   * - `not-found.next.tsx` next to the root layout: a page calling notFound().
   * - `src/app/global-not-found.next.tsx` (Next `experimental.globalNotFound`, set by
   *   the framework's Next config, which then serves every unknown URL from it): its
   *   own document, in the app's language with one language (static), in the URL's
   *   language with 2+ (the proxy's NEXT_RENDER.languageHeader, rendered per request),
   *   since no root layout sits above `[lang]`.
   *
   * @returns {void}
   * @since 0.2.3
   */
  generateNotFoundPages() {
    this.writeGeneratedFile(
      `src/app${this.rootDir()}/${nextFileName('not-found', 'tsx')}`,
      this.generateNotFoundContent(),
      '404 page'
    );
    this.writeGeneratedFile(
      `src/app/${nextFileName('global-not-found', 'tsx')}`,
      this.generateGlobalNotFoundContent(),
      'global 404 page'
    );
  }

  /**
   * Content of `not-found.next.tsx` (next to the root layout).
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateNotFoundContent() {
    return `// Generated by @donotdev/config - DO NOT EDIT
// 404 page: the app's providers without request data (static, like every cached page).
// The Suspense boundary keeps a query-string read (useSearchParams) to the 404 content.

import { Suspense } from 'react';

import { NotFoundPage } from '@donotdev/ui';

import { ClientLayout } from '${this.appImport(this.rootDir(), 'ClientLayout')}';

export default function NotFound() {
  return (
    <ClientLayout serverCookies="" acceptLanguage={null}>
      <Suspense fallback={null}>
        <NotFoundPage />
      </Suspense>
    </ClientLayout>
  );
}
`;
  }

  /**
   * Content of `src/app/global-not-found.next.tsx`.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateGlobalNotFoundContent() {
    const content = `
    <AppDocument lang={lang}>
      <ClientLayout serverCookies="" acceptLanguage={null}>
        <Suspense fallback={null}>
          <NotFoundPage />
        </Suspense>
      </ClientLayout>
    </AppDocument>`;
    if (!this.isMultilingual()) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// 404 of an unknown URL: the app's AppDocument in the app's language (static).

import { Suspense } from 'react';

import { NotFoundPage } from '@donotdev/ui';

import { AppDocument } from './AppDocument';
import { ClientLayout } from './ClientLayout';

export { metadata } from './AppDocument';

const lang = ${JSON.stringify(this.options.defaultLanguage)};

export default function GlobalNotFound() {
  return (${content}
  );
}
`;
    }
    return `// Generated by @donotdev/config - DO NOT EDIT
// 404 of an unknown URL (no root layout above [lang]): the app's AppDocument in the URL's
// language, which the proxy sets on the request (${NEXT_RENDER.languageHeader}); a request the proxy
// does not see (API route, file) gets the default language (${this.options.defaultLanguage}).

import { headers } from 'next/headers';
import { Suspense } from 'react';

import { NotFoundPage } from '@donotdev/ui';

import { AppDocument } from './AppDocument';
import { ClientLayout } from './ClientLayout';

export { metadata } from './AppDocument';

const LANGUAGES: readonly string[] = ${JSON.stringify(this.options.languages)};

export default async function GlobalNotFound() {
  const requested = (await headers()).get(${JSON.stringify(NEXT_RENDER.languageHeader)});
  const lang =
    requested && LANGUAGES.includes(requested) ? requested : ${JSON.stringify(this.options.defaultLanguage)};
  return (${content}
  );
}
`;
  }

  /**
   * Per-request page of a route (`src/app/dndev-session/…/page.next.tsx`): re-exports
   * the site tree's page (and the blog post metadata), so both trees render the same
   * component. Its layout makes it per request.
   *
   * @param {Object} route - Route object from discovery
   * @returns {void}
   * @since 0.2.3
   */
  generateSessionPage(route) {
    const sessionDir = this.appDirFor(route.path, 'session');
    const up = '../'.repeat(sessionDir.split('/').filter(Boolean).length);
    const sitePage = `${up}${this.appDirFor(route.path).slice(1)}/${nextFileName('page', 'tsx').replace(/\.tsx$/, '')}`;
    const names = ['default'];
    if (route.metaExport?.namespace === 'blog' && this.hasDynamicSegment(route.path)) {
      names.push('generateMetadata');
    }
    this.writeGeneratedFile(
      `src/app${sessionDir}/${nextFileName('page', 'tsx')}`,
      `// Generated by @donotdev/config - DO NOT EDIT
// Per-request render of ${route.path} (visitors with an auth cookie): same page as the cached one.

export { ${names.join(', ')} } from '${sitePage}';
`,
      `session page: ${sessionDir}`
    );
  }

  /**
   * Clean existing generated page files
   * Only removes files with generation markers to preserve user-created files
   *
   * @returns {Promise<void>}
   */
  async cleanGeneratedPageFiles() {
    try {
      const appRoot = this.pathResolver.getAppRoot();
      // Generated pages and their client wrappers: a route removed from src/pages
      // must not leave a *PageClient.tsx importing a page that no longer exists.
      const patterns = [
        `src/app/**/${nextFileName('page', 'tsx')}`,
        `src/app/**/${nextFileName('layout', 'tsx')}`,
        `src/app/**/${nextFileName('not-found', 'tsx')}`,
        `src/app/${nextFileName('global-not-found', 'tsx')}`,
        'src/app/**/*PageClient.tsx',
      ];
      const files = await this.pathResolver._globWithNormalization(patterns, {
        cwd: appRoot,
        absolute: true,
        onlyFiles: true,
        braceExpansion: true,
        extglob: true,
        globstar: true,
      });

      let cleanedCount = 0;
      for (const file of files) {
        if (await this.hasGenerationMarker(file)) {
          try {
            await this.pathResolver.remove(file);
            cleanedCount++;
            this.logger.debug(`Cleaned generated file: ${file}`);
          } catch (error) {
            this.logger.debug(`Could not clean file ${file}: ${error.message}`);
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(
          `Cleaned ${cleanedCount} existing generated page files`
        );
      }
    } catch (error) {
      this.logger.debug(`Error during cleanup: ${error.message}`);
      // Don't throw - cleanup failure shouldn't stop generation
    }
  }

  /**
   * Generate a single app/** page file from route data
   * Skips generation if user-created file exists (no generation marker)
   *
   * @param {Object} route - Route object from discovery
   * @returns {Promise<boolean>} True if file was generated, false if skipped
   */
  async generateSingleAppPage(route) {
    try {
      const appPath = this.appDirFor(route.path);
      const pageFilePath = `src/app${appPath}/${nextFileName('page', 'tsx')}`;
      const fullPagePath = this.pathResolver.resolveAppPath(pageFilePath);

      // Skip if user-created file exists (no generation marker)
      if (
        this.pathResolver.pathExists(fullPagePath) &&
        !(await this.hasGenerationMarker(fullPagePath))
      ) {
        this.logger.debug(
          `Skipping ${pageFilePath} - user-created file detected (no generation marker)`
        );
        return false;
      }

      // Normalize route data for Next.js page generation
      // RouteDiscovery returns: file (relativePath), importPath
      // generatePageFileContent expects: filePath (absolute), relativePath
      const normalizedRoute = {
        ...route,
        filePath:
          route.file ||
          route.filePath ||
          this.pathResolver.resolveAppPath(route.file),
        relativePath: route.file || route.relativePath,
      };

      // Generate the page file content
      const pageContent = this.generatePageFileContent(normalizedRoute);

      // Write the generated file
      this.writeGeneratedFile(
        pageFilePath,
        pageContent,
        `app page: ${appPath}`
      );

      const componentName = this.extractComponentName(normalizedRoute.filePath);
      const relativeImportPath = this.calculateRelativeImportPath(
        normalizedRoute.relativePath,
        normalizedRoute.path
      );

      if (
        normalizedRoute.metaExport?.namespace === 'blog' &&
        this.hasDynamicSegment(normalizedRoute.path)
      ) {
        this.writeGeneratedFile(
          `src/app${appPath}/BlogPostClient.tsx`,
          this.generateBlogPostClientContent(componentName, relativeImportPath),
          `app blog client: ${appPath}`
        );
      } else if (this.isClientComponent(normalizedRoute.filePath)) {
        this.writeGeneratedFile(
          `src/app${appPath}/${componentName}Client.tsx`,
          this.generateMountedClientContent(componentName, relativeImportPath),
          `app client wrapper: ${appPath}`
        );
      }

      return true;
    } catch (error) {
      this.logger.debug(
        `Error generating page for route ${route.path}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Convert route path to Next.js app directory structure.
   *
   * DNDEV consumers author routes in React Router syntax (`:param`, `*` catch-all).
   * Next.js requires bracket syntax (`[param]`, `[...rest]`). This translates per
   * segment so `/blog/:slug` becomes `/blog/[slug]` on disk while the runtime
   * route metadata in `routes.generated.ts` keeps the React Router form.
   *
   * @param {string} routePath - Route path in React Router syntax (e.g., '/blog/:slug')
   * @returns {string} App directory path in Next.js syntax (e.g., '/blog/[slug]')
   */
  convertRouteToAppPath(routePath) {
    // DNDEV Convention: HomePage.tsx becomes root route
    if (routePath === ROUTE_DISCOVERY.HOMEPAGE_PATH) {
      return '';
    }

    // Normalize: ensure leading slash for app directory structure
    // RouteDiscovery now generates absolute paths with leading slashes
    // Next.js app directory uses paths like '/blog' → 'app/blog/page.tsx'
    let path = routePath;
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // Remove double slashes (shouldn't happen after RouteDiscovery normalization, but be safe)
    path = path.replace(/\/+/g, '/');

    // React Router → Next.js dynamic-segment syntax
    return path
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) return `[${seg.slice(1)}]`;
        if (seg === '*') return '[...slug]';
        return seg;
      })
      .join('/');
  }

  /**
   * Load i18n config from generated config file
   *
   * @returns {Object|null} I18n config object or null if not found
   */
  loadI18nConfig() {
    try {
      const configPath = this.pathResolver.resolveAppPath(
        'src/config/dndev-config-i18n.js'
      );

      if (!this.pathResolver.pathExists(configPath)) {
        this.logger.debug(
          'I18n config file not found, skipping metadata generation'
        );
        return null;
      }

      // Try to access from globalThis first (already populated by config file)
      if (
        typeof globalThis !== 'undefined' &&
        globalThis._DNDEV_CONFIG_?.i18n
      ) {
        return globalThis._DNDEV_CONFIG_.i18n;
      }

      // Fallback: use createRequire to import the module in ESM context
      try {
        const appRoot = this.pathResolver.getAppRoot();
        const require = createRequire(appRoot);
        // Resolve to absolute path for require
        const absoluteConfigPath = require.resolve(configPath);
        // Clear cache to ensure fresh import
        delete require.cache[absoluteConfigPath];
        const configModule = require(absoluteConfigPath);
        return configModule.default || configModule.i18nConfig || configModule;
      } catch (requireError) {
        this.logger.debug(
          `Failed to require i18n config: ${requireError.message}`
        );
        return null;
      }
    } catch (error) {
      this.logger.debug(`Failed to load i18n config: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate page file content with component import and metadata
   * Creates bridge file that imports actual page component
   * Server components get generateMetadata that reads from manifest
   *
   * @param {Object} route - Route object with importPath, metaExport, etc.
   * @returns {string} Complete page file content
   */
  generatePageFileContent(route) {
    const componentName = this.extractComponentName(route.filePath);
    // Calculate relative path from app/**/page.tsx to src/pages/**Page.tsx
    // Example: src/app/page.tsx -> ../pages/HomePage
    const relativePath = route.relativePath || route.file;
    const relativeImportPath = this.calculateRelativeImportPath(
      relativePath,
      route.path
    );

    // Blog post dynamic routes keep the source page as the interactive client renderer,
    // while the generated server bridge adds English canonical SEO metadata/static params.
    if (
      route.metaExport?.namespace === 'blog' &&
      this.hasDynamicSegment(route.path)
    ) {
      return this.generateBlogPostRSCContent(
        route,
        componentName,
        relativeImportPath
      );
    }

    // Check if imported component is a client component
    const isClientComponent = this.isClientComponent(route.filePath);

    // Client components render after hydration through a mounted client wrapper.
    // The generated page stays a server component so Next.js can keep metadata/static export stable.
    // Pages whose PageMeta sets `auth` render inside AuthGuard, and pages that set
    // `signedInRedirect` inside SignedInRedirect, as on Vite (vite-routing/AppRoutes).
    // The proxy, when generated, redirects before render.
    const auth = this.normalizeAuth(route.auth) ? route.auth : null;
    const signedInTo = route.meta?.signedInRedirect ?? null;
    const guards = [
      ...(auth ? ['AuthGuard'] : []),
      ...(signedInTo ? ['SignedInRedirect'] : []),
    ];
    const guardImport = guards.length
      ? `import { ${guards.join(', ')} } from '@donotdev/ui';\n`
      : '';
    const guard = (jsx) => {
      const inner = signedInTo
        ? `<SignedInRedirect to={${JSON.stringify(signedInTo)}}>${jsx}</SignedInRedirect>`
        : jsx;
      return auth
        ? `<AuthGuard auth={${JSON.stringify(auth === true ? { required: true } : auth)}}>${inner}</AuthGuard>`
        : inner;
    };

    if (isClientComponent) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

${guardImport}import ${componentName}Client from './${componentName}Client';
${this.onDemandParamsExport(route)}
export default function ${componentName}Route() {
  return ${guard(`<${componentName}Client />`)};
}
`;
    }

    // Server components: head tags come from AutoMetaTags (NextJsAppProviders), the
    // same PageMeta resolution as Vite. No generateMetadata here: a second <title>
    // source would ship twice (React 19 does not dedupe), and getMetadataForPath
    // pulls the build tooling (@babel/core) into the Next server bundle.
    if (guards.length) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

${guardImport}import ${componentName} from '${relativeImportPath}';
${this.onDemandParamsExport(route)}
export default function ${componentName}Route(props: Record<string, unknown>) {
  return ${guard(`<${componentName} {...props} />`)};
}
`;
    }

    return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

import ${componentName} from '${relativeImportPath}';
${this.onDemandParamsExport(route)}
export default ${componentName};
`;
  }

  /**
   * Generate Next.js generateMetadata() function
   * Creates async function that reads translations and generates metadata
   *
   * @param {Object} route - Route object
   * @param {string} namespace - Translation namespace
   * @param {Object} i18nConfig - I18n configuration
   * @returns {string} Generated function code
   */
  generateMetadataFunction(route, namespace, i18nConfig) {
    const supportedLocales = getSupportedLocales(i18nConfig);
    const fallbackLocale = getFallbackLocale(i18nConfig);
    // Base URL will be determined at runtime in generateMetadata
    const backtick = String.fromCharCode(96);

    // Generate hreflang alternates for all languages
    // Note: In a real i18n setup, each locale would have its own URL path
    // For now, we generate alternates pointing to the same path
    // Consumers can customize this based on their routing strategy
    const alternates = supportedLocales
      .map((locale) => {
        // If using locale-based routing like /en/page or /fr/page, adjust accordingly
        // For now, assume same path for all locales (consumer can customize)
        return `        '${locale}': { href: ${backtick}\${baseUrl}\${currentPath}${backtick} }`;
      })
      .join(',\n');

    return `
import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Translation reader helper
function readTranslation(namespace, locale, i18nConfig) {
  try {
    if (i18nConfig?.content?.[namespace]?.[locale]) {
      return i18nConfig.content[namespace][locale];
    }
    const mapping = i18nConfig?.mapping?.[namespace]?.[locale];
    if (!mapping) return null;
    const filePath = join(process.cwd(), mapping);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getTranslationValue(translation, keyPath) {
  if (!translation || !keyPath) return undefined;
  const keys = keyPath.split('.');
  let value = translation;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

// I18n config (inlined from build-time config)
const i18nConfig = ${JSON.stringify(i18nConfig, null, 2)};
const supportedLocales = ${JSON.stringify(supportedLocales)};
const fallbackLocale = '${fallbackLocale}';

export async function generateMetadata({ params }): Promise<Metadata> {
  // Detect locale from params or use fallback
  // For Next.js App Router, locale can come from [locale] segment or headers
  const locale = (params?.locale as string) || fallbackLocale;
  const effectiveLocale = supportedLocales.includes(locale) ? locale : fallbackLocale;
  
  // Get base URL from environment or construct from request
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  (typeof process !== 'undefined' && process.env.VERCEL_URL 
                    ? ${backtick}https://\${process.env.VERCEL_URL}${backtick}
                    : '');
  const currentPath = '${route.path}';

  // Read translation for current locale
  const translation = readTranslation('${namespace}', effectiveLocale, i18nConfig) ||
                      readTranslation('${namespace}', fallbackLocale, i18nConfig);

  // Extract metadata from translation
  const title = getTranslationValue(translation, 'title') || '${route.metaExport?.title || ''}';
  const description = getTranslationValue(translation, 'description') || '${route.metaExport?.description || ''}';
  const metaObject = getTranslationValue(translation, 'meta') || {};
  
  // Read site name from SEO manifest or env var
  let siteName = process.env.NEXT_PUBLIC_SITE_NAME;
  if (!siteName) {
    try {
      const seoManifestPath = join(process.cwd(), 'public', 'seo-manifest.json');
      const seoManifest = JSON.parse(readFileSync(seoManifestPath, 'utf-8'));
      siteName = seoManifest?.siteName || 'Site';
    } catch {
      siteName = 'Site';
    }
  }
  
  const pageTitle = title ? ${backtick}\${title} | \${siteName}${backtick} : siteName;
  const pageDescription = description || '';
  const pageImage = metaObject?.image || '${DEFAULT_OG_IMAGE}';
  const pageType = metaObject?.type || 'website';
  const pageKeywords = metaObject?.keywords;
  const pageAuthor = metaObject?.author;

  // Build metadata object
  const metadata: Metadata = {
    title: pageTitle,
    ...(pageDescription && { description: pageDescription }),
    ...(pageKeywords && { 
      keywords: Array.isArray(pageKeywords) ? pageKeywords.join(', ') : pageKeywords 
    }),
    ...(pageAuthor && { authors: [{ name: pageAuthor }] }),
    openGraph: {
      title: pageTitle,
      ...(pageDescription && { description: pageDescription }),
      type: pageType,
      url: ${backtick}\${baseUrl}\${currentPath}${backtick},
      ...(pageImage && { images: [pageImage] }),
      siteName: siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      ...(pageDescription && { description: pageDescription }),
      ...(pageImage && { images: [pageImage] }),
    },
    alternates: {
      languages: {
${alternates}
      },
    },
  };

  return metadata;
}
`;
  }

  /**
   * Generate Next.js metadata object from page meta export
   * Converts DNDev meta format to Next.js metadata format
   * Fallback when i18n config is not available
   *
   * @param {Object} metaExport - Meta object from page export
   * @returns {string} Formatted metadata object string
   */
  generateMetadataObject(metaExport) {
    const metadata = {};

    // Basic metadata
    if (metaExport.title) {
      metadata.title = metaExport.title;
    }

    if (metaExport.description) {
      metadata.description = metaExport.description;
    }

    // OpenGraph metadata for social sharing
    if (metaExport.title || metaExport.description) {
      metadata.openGraph = {};

      if (metaExport.title) {
        metadata.openGraph.title = metaExport.title;
      }

      if (metaExport.description) {
        metadata.openGraph.description = metaExport.description;
      }

      // Add default OpenGraph type
      metadata.openGraph.type = 'website';
    }

    // Twitter metadata
    if (metaExport.title || metaExport.description) {
      metadata.twitter = {
        card: 'summary_large_image',
      };

      if (metaExport.title) {
        metadata.twitter.title = metaExport.title;
      }

      if (metaExport.description) {
        metadata.twitter.description = metaExport.description;
      }
    }

    // Additional metadata from metaExport
    Object.keys(metaExport).forEach((key) => {
      if (!['title', 'description'].includes(key)) {
        metadata[key] = metaExport[key];
      }
    });

    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Extract component name from file path
   * Converts file path to valid component name
   *
   * @param {string} filePath - Full file path
   * @returns {string} Component name (e.g., 'AboutPage')
   */
  extractComponentName(filePath) {
    const fileName =
      filePath
        .split('/')
        .pop()
        ?.replace(/\.tsx?$/, '') || 'Component';

    // Ensure valid component name (PascalCase)
    const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '');
    return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  /**
   * Check if file has generation marker
   * Used to identify files that can be safely regenerated
   *
   * @param {string} filePath - Full path to file
   * @returns {boolean} True if file has generation marker
   */
  async hasGenerationMarker(filePath) {
    try {
      // Read as text (TS/JS files, not JSON)
      const content = await this.pathResolver.read(filePath, {
        format: 'text',
      });
      return content && content.includes('// Generated by @donotdev/config');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate `src/proxy.next.ts` (Next 16), the request gate before anything renders:
   *
   * - 2+ languages: serves an unprefixed URL as the default language (internal
   *   rewrite to `/<default>/…`, the app/[lang] route), redirects a first visit to the
   *   visitor's language (language cookie, then Accept-Language) and `/<default>/…`
   *   to the root URL (resolveLanguageRoute in @donotdev/core).
   * - Session in cookies (Supabase `createBrowserClient`): a request without an auth
   *   cookie is signed out and gets the cached page (src/app/(site)); with one, the
   *   session is verified and refreshed when expired (refreshSupabaseSession in
   *   @donotdev/supabase/server) and, signed in or unknown, the page renders per
   *   request (internal rewrite to src/app/dndev-session, under src/app/[lang] with 2+
   *   languages; 404 on a direct hit). The redirects below use a verified session only.
   * - 2+ languages, a request that is not a page: sets NEXT_RENDER.languageHeader to
   *   the URL's language (an unknown URL's 404 renders in it).
   * - Auth redirects for pages whose PageMeta sets `auth`, cookie session only: a
   *   session the server cannot read (Firebase, localStorage) would redirect signed-in
   *   users, so those apps rely on the page's AuthGuard alone. Redirect gate only: data
   *   access stays enforced by RLS.
   * - Signed-in redirects for pages whose PageMeta sets `signedInRedirect`, same
   *   cookie-session condition (else the page's SignedInRedirect alone).
   *
   * Generated when any applies; removed (if generated) when none does.
   *
   * @param {Object} routeData - Discovered routes
   */
  async generateMiddleware(routeData) {
    this.removeLegacyMiddleware();
    this.rendersSessionTree = false;

    const authRoutes = routeData.routes.filter((route) =>
      Boolean(this.normalizeAuth(route.auth))
    );
    const signedInPages = routeData.routes.filter(
      (route) => route.meta?.signedInRedirect
    );
    const cookieSession = this.usesCookieSession();
    if ((authRoutes.length > 0 || signedInPages.length > 0) && !cookieSession) {
      this.logger.debug(
        'Auth session not in cookies (no Supabase createBrowserClient): pages use the client AuthGuard / SignedInRedirect only, no proxy auth redirects'
      );
    }
    const protectedRoutes = cookieSession ? authRoutes : [];
    const signedInRoutes = cookieSession ? signedInPages : [];

    const proxyPath = this.pathResolver.resolveAppPath(this.options.proxyPath);
    const isHandWritten =
      this.pathResolver.pathExists(proxyPath) &&
      !(await this.hasGenerationMarker(proxyPath));

    if (!this.isMultilingual() && !cookieSession) {
      this.logger.debug('One language and no cookie session: no proxy.next.ts');
      if (this.pathResolver.pathExists(proxyPath) && !isHandWritten) {
        await this.pathResolver.remove(proxyPath);
      }
      return;
    }
    if (isHandWritten) {
      this.logger.warn(
        `${this.options.proxyPath} is hand-written: not generating language routing / session refresh / auth redirects / per-request pages (add them to your proxy; every visitor gets the cached pages)`
      );
      return;
    }

    if (this.isMultilingual()) {
      this.appRouteSegments = await this.findAppRouteSegments();
    }
    this.writeGeneratedFile(
      this.options.proxyPath,
      this.generateMiddlewareContent(
        protectedRoutes,
        routeData.routes,
        signedInRoutes,
        cookieSession
      ),
      'proxy'
    );
    this.rendersSessionTree = cookieSession;
  }

  /**
   * First URL segments of the app's own (not generated) route files outside
   * `src/app/[lang]` (2+ languages): route handlers such as
   * `src/app/auth/callback/route.next.ts` → `auth`. Route groups are not URL segments.
   *
   * @returns {Promise<string[]>} Sorted, unique
   * @since 0.2.3
   */
  async findAppRouteSegments() {
    const appRoot = this.pathResolver.getAppRoot();
    const appDir = this.pathResolver.resolveAppPath(GENERATED_PATHS.next.appPages);
    const files = await this.pathResolver._globWithNormalization(
      [`${GENERATED_PATHS.next.appPages}/**/{route,page}.${NEXT_FILE_MARKER}.{ts,tsx,js,jsx}`],
      { cwd: appRoot, absolute: true, onlyFiles: true, braceExpansion: true }
    );
    const segments = new Set();
    for (const file of files) {
      if (await this.hasGenerationMarker(file)) continue;
      const [first] = file
        .slice(appDir.length + 1)
        .split('/')
        .slice(0, -1)
        .filter((segment) => !/^\(.*\)$/.test(segment));
      if (first && first !== '[lang]') segments.add(first);
    }
    return [...segments].sort();
  }

  /**
   * Regex source of a route path (`/produits/:slug` → `^/produits/[^/]+$`).
   *
   * @param {string} path - Route path in React Router syntax
   * @returns {string}
   */
  routePattern(path) {
    return (
      '^' +
      path
        .split('/')
        .map((seg) => {
          if (seg === '*') return '.*';
          if (seg.startsWith(':')) return '[^/]+';
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
    );
  }

  /**
   * Content of the generated proxy.next.ts.
   *
   * @param {Array<Object>} protectedRoutes - Routes whose auth requires a user (cookie session only)
   * @param {Array<Object>} [pageRoutes] - Every discovered route (language routing, 2+ languages)
   * @param {Array<Object>} [signedInRoutes] - Routes whose PageMeta sets `signedInRedirect` (cookie session only)
   * @param {boolean} [cookieSession] - The auth session lives in cookies: refresh it on every page request with an auth cookie (implied by protected or signed-in routes)
   * @returns {string}
   */
  generateMiddlewareContent(
    protectedRoutes,
    pageRoutes = [],
    signedInRoutes = [],
    cookieSession = false
  ) {
    const multilingual = this.isMultilingual();
    const hasAuth = protectedRoutes.length > 0;
    const hasSignedIn = signedInRoutes.length > 0;
    const hasRedirects = hasAuth || hasSignedIn;
    const hasSession = cookieSession || hasRedirects;
    const auth = this.options.auth ?? {};

    const authEntries = protectedRoutes
      .map((route) => {
        const { role } = this.normalizeAuth(route.auth);
        return `  { pattern: new RegExp(${JSON.stringify(this.routePattern(route.path))})${
          role ? `, role: ${JSON.stringify(role)}` : ''
        } },`;
      })
      .join('\n');
    const signedInEntries = signedInRoutes
      .map(
        (route) =>
          `  { pattern: new RegExp(${JSON.stringify(this.routePattern(route.path))}), to: ${JSON.stringify(route.meta.signedInRedirect)} },`
      )
      .join('\n');
    const pageEntries = [...new Set(pageRoutes.map((r) => r.path))]
      .map((path) => `  new RegExp(${JSON.stringify(this.routePattern(path))}),`)
      .join('\n');
    // Every page request: language routing sees every page, and every page renders
    // the session snapshot (refreshed here). Not API routes, _next or files.
    const matcherLines = `    ${JSON.stringify('/((?!api|_next|.*\\..*).*)')},`;

    const coreImports = [
      ...(hasAuth ? ['hasRoleAccess'] : []),
      ...(multilingual
        ? [
            'LANGUAGE_COOKIE',
            ...(hasRedirects ? ['localizePath'] : []),
            'parseAcceptLanguage',
            'readCookieValue',
            'resolveLanguageRoute',
            'splitLanguagePath',
          ]
        : []),
    ];
    const supabaseImports = [
      'hasSupabaseSessionCookie',
      'refreshSupabaseSession',
      ...(hasRedirects ? ['type SupabaseProxySession'] : []),
    ];
    const sessionParam = hasRedirects
      ? ",\n  session: SupabaseProxySession['session']"
      : '';
    const languageParam = multilingual ? ',\n  language: string' : '';
    // With a session, the forwarded request carries the refreshed cookies to the render
    const forward = hasSession ? '{ request }' : '';
    const sessionTreePath = `/${NEXT_RENDER.sessionSegment}`;

    const header = `// Generated by @donotdev/config - DO NOT EDIT
// Request gate (Next 16 proxy)${multilingual ? `: one URL per language, the default language (${this.options.defaultLanguage}) at the
// root, the others under their prefix (resolveLanguageRoute in @donotdev/core)` : ''}.${
      hasSession
        ? `
// Session: the Supabase cookie (createBrowserClient). No auth cookie: signed out, the
// page comes from the cache (src/app${this.treeDir('site')}, static). With one: verified and refreshed
// when expired (refreshSupabaseSession), then rendered per request with the refreshed
// cookies (src/app${this.rootDir()}${sessionTreePath}, an internal path: a direct hit is a 404); the browser
// gets the refreshed cookies on the response.`
        : ''
    }${
      hasAuth
        ? `
// Auth redirects for pages whose PageMeta sets \`auth\`, on the verified session.
// Redirect gate only: data access stays enforced by RLS, and the page's AuthGuard still
// runs on the client.`
        : ''
    }${
      hasSignedIn
        ? `
// Signed-in redirects for pages whose PageMeta sets \`signedInRedirect\` (verified
// session); the page's SignedInRedirect still runs on the client.`
        : ''
    }

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

${coreImports.length ? `import { ${coreImports.join(', ')} } from '@donotdev/core/server';\n` : ''}${hasSession ? `import { ${supabaseImports.join(', ')} } from '@donotdev/supabase/server';\n` : ''}`;

    const sessionBlock = hasSession
      ? `
/** Supabase project of the cookie session (same env as src/config/providers.ts) */
const SUPABASE = supabaseProject(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY
);

function supabaseProject(url: string | undefined, publicKey: string | undefined) {
  if (!url || !publicKey) {
    throw new Error(
      '[dndev] Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: the proxy refreshes the auth session on every page request.'
    );
  }
  return { url, publicKey };
}
${
  multilingual
    ? `
/** Internal tree of the per-request pages (src/app/[lang]${sessionTreePath}), after the language: never a public URL */
const SESSION_SEGMENT = ${JSON.stringify(NEXT_RENDER.sessionSegment)};

/** Internal URL path of a page rendered per request: \`/fr/compte\` → \`/fr${sessionTreePath}/compte\` */
function sessionPath(path: string): string {
  const [, language, ...rest] = path.split('/');
  return ['', language, SESSION_SEGMENT, ...rest].join('/');
}

/** A direct request for the internal tree (\`/fr${sessionTreePath}/…\`) */
function isSessionTreePath(pathname: string): boolean {
  return pathname.split('/').slice(1, 3).includes(SESSION_SEGMENT);
}
`
    : `
/** Internal tree of the per-request pages (src/app${sessionTreePath}): never a public URL */
const SESSION_TREE = ${JSON.stringify(sessionTreePath)};

/** Internal URL path of a page rendered per request */
function sessionPath(path: string): string {
  return path === '/' ? SESSION_TREE : SESSION_TREE + path;
}

/** A direct request for the internal tree */
function isSessionTreePath(pathname: string): boolean {
  return pathname === SESSION_TREE || pathname.startsWith(\`\${SESSION_TREE}/\`);
}
`
}${
  hasRedirects
    ? `
/** Session of a request without an auth cookie: signed out, nothing to verify */
const SIGNED_OUT: SupabaseProxySession['session'] = { user: null };
`
    : ''
}`
      : '';

    const authBlock = hasAuth
      ? `
/** appConfig.auth.authRoute: where a signed-out visitor goes (null: page fallback) */
const AUTH_ROUTE: string | null = ${JSON.stringify(auth.authRoute ?? null)};
/** appConfig.auth.roleRoute: where a visitor without the role goes (null: page fallback) */
const ROLE_ROUTE: string | null = ${JSON.stringify(auth.roleRoute ?? null)};

const protectedRoutes: Array<{ pattern: RegExp; role?: string }> = [
${authEntries}
];

/** Redirect of a protected route, or null to let the page render. */
function authRedirect(
  request: NextRequest${sessionParam},
  routePath: string${languageParam}
): NextResponse | null {
  const route = protectedRoutes.find((r) => r.pattern.test(routePath));
  if (!route) return null;
  // Cannot tell (Supabase unreachable, several projects' cookies): the page's AuthGuard decides
  if (session === null) return null;

  if (!session.user) {
    if (!AUTH_ROUTE) return null;
    const url = new URL(${multilingual ? 'localizePath(AUTH_ROUTE, language, LANGUAGE_ROUTING)' : 'AUTH_ROUTE'}, request.url);
    url.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (route.role && !hasRoleAccess(session.user.role, route.role)) {
    if (!ROLE_ROUTE) return null;
    return NextResponse.redirect(new URL(${multilingual ? 'localizePath(ROLE_ROUTE, language, LANGUAGE_ROUTING)' : 'ROLE_ROUTE'}, request.url));
  }
  return null;
}
`
      : '';

    const signedInBlock = hasSignedIn
      ? `
/** PageMeta \`signedInRedirect\`: where a signed-in visitor of the page goes */
const signedInRoutes: Array<{ pattern: RegExp; to: string }> = [
${signedInEntries}
];

/** Redirect of a signed-in visitor, or null to let the page render. */
function signedInRedirect(
  request: NextRequest${sessionParam},
  routePath: string${languageParam}
): NextResponse | null {
  const route = signedInRoutes.find((r) => r.pattern.test(routePath));
  if (!route) return null;
  // A pending return-to wins: the page's AuthReturnTo takes the visitor there
  if (request.nextUrl.searchParams.has('returnTo')) return null;
  // Signed out, or cannot tell: the page renders (its SignedInRedirect decides on the client)
  if (!session?.user) return null;
  return NextResponse.redirect(new URL(${multilingual ? 'localizePath(route.to, language, LANGUAGE_ROUTING)' : 'route.to'}, request.url));
}
`
      : '';

    const languageBlock = multilingual
      ? `
const LANGUAGE_ROUTING = {
  languages: ${JSON.stringify(this.options.languages)},
  defaultLanguage: ${JSON.stringify(this.options.defaultLanguage)},
};

/** Request header of the URL's language, read by the 404 page (src/app/global-not-found) */
const LANGUAGE_HEADER = ${JSON.stringify(NEXT_RENDER.languageHeader)};

/** First URL segments of the app's hand-written routes outside src/app/[lang] (route handlers) */
const APP_ROUTE_SEGMENTS: readonly string[] = ${JSON.stringify(this.appRouteSegments)};
`
      : '';
    const pageRoutesBlock =
      multilingual || hasSession
        ? `
/** App pages (src/pages): API routes, files and hand-written app routes pass untouched */
const pageRoutes: RegExp[] = [
${pageEntries}
];
`
        : '';

    const sessionArg = hasRedirects ? 'session, ' : '';
    const refresh = `  // Verified session, refreshed when expired: the redirects and the server render
  // (refreshed cookies forwarded with \`request\`) see the same signed-in state
  const auth = await refreshSupabaseSession(request, SUPABASE.url, SUPABASE.publicKey);`;
    // route(): language routing, redirects, then the render tree of a page request
    const routeParams = `\n  request: NextRequest${sessionParam}${hasSession ? ',\n  personal: boolean' : ''}\n`;
    const redirects = (path, language) =>
      `${
        hasAuth
          ? `
  const redirect = authRedirect(request, ${sessionArg}${path}${language});
  if (redirect) return redirect;
`
          : ''
      }${
        hasSignedIn
          ? `
  const signedIn = signedInRedirect(request, ${sessionArg}${path}${language});
  if (signedIn) return signedIn;
`
          : ''
      }`;
    const personalRewrite = (page) =>
      hasSession
        ? `
  // Auth cookie: rendered per request with the visitor's cookies
  if (personal) {${page === 'pathname' ? '' : `
    const page = ${page};`}
    return NextResponse.rewrite(new URL(sessionPath(${page === 'pathname' ? 'pathname' : 'page'}) + search, request.url), { request });
  }`
        : '';

    let routeFn;
    if (multilingual) {
      routeFn = `
/** Language routing, redirects and render tree of a page request. */
function route(${routeParams}): NextResponse {
  const { pathname, search } = request.nextUrl;
  const decision = resolveLanguageRoute(
    pathname,
    {
      stored: readCookieValue(request.headers.get('cookie'), LANGUAGE_COOKIE),
      preferred: parseAcceptLanguage(request.headers.get('accept-language')),
    },
    LANGUAGE_ROUTING
  );
  if (!pageRoutes.some((pattern) => pattern.test(decision.path))) {
    // Not a page (API route, hand-written route, unknown URL): an unknown URL's 404
    // renders in the URL's language
    const url = splitLanguagePath(pathname, LANGUAGE_ROUTING);
    request.headers.set(LANGUAGE_HEADER, url.language);
    // Unprefixed and not a hand-written route: the app/[lang] route would read its first
    // segment as a language. Served as an unknown URL of the default language instead.
    if (!url.prefixed && !APP_ROUTE_SEGMENTS.includes(pathname.split('/')[1] ?? '')) {
      return NextResponse.rewrite(
        new URL('/' + LANGUAGE_ROUTING.defaultLanguage + pathname + search, request.url),
        { request }
      );
    }
    return NextResponse.next({ request });
  }

  // Language redirects set no language cookie (the browser language store does)
  if (decision.type === 'redirect') {
    return NextResponse.redirect(
      new URL(decision.location + search, request.url),
      decision.permanent ? 308 : 307
    );
  }
${redirects('decision.path', ', decision.language')}${personalRewrite("decision.type === 'rewrite' ? decision.destination : pathname")}
  if (decision.type === 'rewrite') {
    return NextResponse.rewrite(new URL(decision.destination + search, request.url)${hasSession ? ', { request }' : ''});
  }
  return NextResponse.next(${forward});
}
`;
    } else {
      routeFn = `
/** Redirects and render tree of a page request. */
function route(${routeParams}): NextResponse {
  const { ${hasSession ? 'pathname, search' : 'pathname'} } = request.nextUrl;
  if (!pageRoutes.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next({ request });
  }
${redirects('pathname', '')}${personalRewrite('pathname')}
  return NextResponse.next({ request });
}
`;
    }

    let proxyFn;
    if (hasSession) {
      proxyFn = `
export async function proxy(request: NextRequest) {
  if (isSessionTreePath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  // No auth cookie: signed out. Nothing to verify or refresh, no cookie written: the
  // page is served from the cache.
  if (!hasSupabaseSessionCookie(request)) {
    return route(request${hasRedirects ? ', SIGNED_OUT' : ''}, false);
  }

${refresh}
  // Signed in, or cannot tell (Supabase unreachable): per-request render. Signed out
  // (refresh failed, session revoked): the cached page, with the cleared cookies.
  return auth.apply(route(request, ${hasRedirects ? 'auth.session, ' : ''}auth.session?.user !== null));
}
${routeFn}`;
    } else {
      proxyFn = `
export function proxy(request: NextRequest) {
  return route(request);
}
${routeFn}`;
    }

    return `${header}${sessionBlock}${languageBlock}${pageRoutesBlock}${authBlock}${signedInBlock}${proxyFn}
export const config = {
  matcher: [
${matcherLines}
  ],
};
`;
  }

  /**
   * Route `auth` (PageMeta) as `{ role?, tier? }` when the page needs a signed-in user,
   * else null. Same reading as the Vite router's parseAuthConfig.
   *
   * @param {boolean|Object|null|undefined} auth
   * @returns {{ role?: string, tier?: string }|null}
   */
  normalizeAuth(auth) {
    if (auth === true) return {};
    if (!auth || typeof auth !== 'object') return null;
    if (!auth.required && !auth.role && !auth.tier) return null;
    return { role: auth.role, tier: auth.tier };
  }

  /**
   * Whether the app keeps its auth session in cookies the server can read:
   * @donotdev/supabase with `createBrowserClient` in src/config/providers.ts.
   *
   * @returns {boolean}
   */
  usesCookieSession() {
    try {
      // readSync parses .json files
      const pkg = this.pathResolver.readSync(
        this.pathResolver.resolveAppPath('package.json')
      );
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (!deps['@donotdev/supabase']) return false;
      const providersPath = this.pathResolver.resolveAppPath(
        'src/config/providers.ts'
      );
      if (!this.pathResolver.pathExists(providersPath)) return false;
      return this.pathResolver
        .readSync(providersPath)
        .includes('createBrowserClient(');
    } catch (error) {
      this.logger.debug(`Cookie session detection failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove the generated `middleware.ts` of earlier versions (root or src/): it never
   * parsed, read a cookie no provider sets, and Next 16 replaces it with proxy.ts.
   */
  removeLegacyMiddleware() {
    for (const rel of ['middleware.ts', 'src/middleware.ts']) {
      const file = this.pathResolver.resolveAppPath(rel);
      try {
        if (
          this.pathResolver.pathExists(file) &&
          this.pathResolver
            .readSync(file)
            .startsWith('// Auto-generated middleware by @donotdev/config')
        ) {
          this.pathResolver.removeSync(file);
          this.logger.debug(`Removed legacy generated ${rel}`);
        }
      } catch (error) {
        this.logger.debug(`Could not remove legacy ${rel}: ${error.message}`);
      }
    }
  }

  async generateAppRoutes(routeData) {
    const routesContent = this.generateAppRoutesContent(routeData.routes);
    this.writeGeneratedFile(
      'src/app/routes.generated.ts',
      routesContent,
      'app routes index'
    );
  }

  generateAppRoutesContent(routes) {
    const routeExports = routes
      .map((route) => {
        const componentName =
          route.componentName || this.pathToComponentName(route.path);
        // Next.js-specific import resolution: relative to app directory
        // RouteDiscovery returns 'file' (relativePath), not 'relativePath'
        const relativePath = route.relativePath || route.file;
        if (!relativePath) {
          this.logger.warn(`Route ${route.path} missing file path, skipping`);
          return null;
        }
        const importPath = relativePath
          .replace(/\.tsx$/, '')
          .replace(/^src\//, '../');

        return `  {
    path: '${route.path}',
    component: lazy(() => import('${importPath}')),
    auth: ${JSON.stringify(route.auth)},
    meta: ${JSON.stringify(route.meta)}
  }`;
      })
      .filter((item) => item !== null)
      .join(',\n');

    return `// Auto-generated app routes by @donotdev/config
// Generated at ${new Date().toISOString()}

import { lazy } from 'react';

export const appRoutes = [
${routeExports}
];

export const routeManifest = {
  totalRoutes: ${routes.length},
  routingMode: 'app',
  generatedAt: '${new Date().toISOString()}'
};

export default appRoutes;
`;
  }

  async generatePagesRoutes(routeData) {
    const routesContent = this.generatePagesRoutesContent(routeData.routes);
    this.writeGeneratedFile(
      'src/pages/routes.generated.ts',
      routesContent,
      'pages routes index'
    );
  }

  generatePagesRoutesContent(routes) {
    const routeExports = routes
      .map((route) => {
        return `  '${route.path}': {
    auth: ${JSON.stringify(route.auth)},
    meta: ${JSON.stringify(route.meta)},
    file: '${route.file}'
  }`;
      })
      .join(',\n');

    return `// Auto-generated pages routes by @donotdev/config
// Generated at ${new Date().toISOString()}

export const pageRoutes = {
${routeExports}
};

export const routeManifest = {
  totalRoutes: ${routes.length},
  routingMode: 'pages',
  generatedAt: '${new Date().toISOString()}'
};

export default pageRoutes;
`;
  }

  pathToComponentName(path) {
    return (
      path
        .split('/')
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('') + 'Page'
    );
  }

  /**
   * Calculate relative import path from app/** /page.tsx to src/pages/ **Page.tsx
   * @param {string} relativePath - Source file path (e.g., 'src/pages/HomePage.tsx')
   * @param {string} routePath - Route path (e.g., '/' or '/legal/privacy')
   * @returns {string} Relative import path (e.g., '../pages/HomePage')
   */
  calculateRelativeImportPath(relativePath, routePath) {
    if (!relativePath) {
      throw new Error('relativePath is required for import path calculation');
    }

    // Remove .tsx extension
    const pathWithoutExt = relativePath.replace(/\.tsx$/, '');

    // Remove src/ prefix
    const pathFromSrc = pathWithoutExt.replace(/^src\//, '');

    // Directories below src/app: the (site) group, the [lang] directory with 2+
    // languages, then one per route segment ('/' = none)
    const routeDepth = this.appDirFor(routePath).split('/').filter(Boolean).length;

    // Build relative path: go up from app/**/page.tsx to src/, then into pages/
    // app/(site)/page.tsx (depth 1) -> ../../pages/HomePage
    // app/(site)/legal/privacy/page.tsx (depth 3) -> ../../../../pages/legal/PrivacyPage
    // app/(site)/[lang]/legal/privacy/page.tsx (depth 4) -> ../../../../../pages/legal/PrivacyPage
    const upLevels = '../'.repeat(routeDepth + 1); // +1 for app/ directory

    return `${upLevels}${pathFromSrc}`;
  }

  /**
   * Check if a component file is a client component
   * Reads the file and checks for 'use client' directive
   *
   * @param {string} filePath - Path to component file
   * @returns {boolean} True if component has 'use client' directive
   */
  /**
   * True when a route path contains a React Router dynamic segment (`:param`) or
   * an already-converted Next.js bracket segment (`[param]`).
   *
   * @param {string} routePath - e.g. '/blog/:slug'
   * @returns {boolean}
   */
  /**
   * Segment config of a page with dynamic segments (`/produits/:slug`): an empty
   * generateStaticParams, so no URL is prerendered at build and each one is rendered
   * on its first request, then cached (ISR) instead of rendered per request.
   *
   * @param {Object} route - Route object (`path` in React Router syntax)
   * @returns {string} The export, or `''` for a static path
   * @since 0.2.3
   */
  onDemandParamsExport(route) {
    if (!this.convertRouteToAppPath(route.path).includes('[')) return '';
    return `
// Each URL renders on its first request, then is cached like the static pages (ISR)
export function generateStaticParams() {
  return [];
}
`;
  }

  hasDynamicSegment(routePath) {
    return routePath.includes(':') || routePath.includes('[');
  }

  /**
   * Extract the first dynamic param name from a route path.
   *
   * @param {string} routePath - e.g. '/blog/:slug' or '/news/[id]'
   * @returns {string} param name, e.g. 'slug'
   */
  extractDynamicParam(routePath) {
    const colonMatch = routePath.match(/:([a-zA-Z0-9_]+)/);
    if (colonMatch) return colonMatch[1];
    const bracketMatch = routePath.match(/\[([^\]]+)\]/);
    return bracketMatch ? bracketMatch[1] : 'slug';
  }

  /**
   * Generate a client-only renderer for a source page component.
   *
   * @param {string} componentName
   * @param {string} relativeImportPath
   * @returns {string}
   */
  generateMountedClientContent(componentName, relativeImportPath) {
    // SSR mode: render the page directly so its content is server-rendered
    // (crawlable HTML). The legacy mount-gate below returns null on the server
    // and only renders after client hydration — that's what suppressed SSR.
    if (this.options.ssr) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
'use client';

import ${componentName} from '${relativeImportPath}';

export default function ${componentName}Client() {
  return <${componentName} />;
}
`;
    }
    return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
'use client';

import { useEffect, useState } from 'react';

import ${componentName} from '${relativeImportPath}';

export default function ${componentName}Client() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <${componentName} />;
}
`;
  }

  /**
   * Generate the client-only blog renderer used by Next.js blog routes.
   * It mounts after hydration so the server fallback remains English for crawlers,
   * then the normal reactive page takes over and follows the i18n/Zustand store.
   *
   * @param {string} componentName
   * @param {string} relativeImportPath
   * @returns {string}
   */
  generateBlogPostClientContent(componentName, relativeImportPath) {
    return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
'use client';

import { useEffect, useState } from 'react';

import ${componentName} from '${relativeImportPath}';

export default function BlogPostClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.dndevBlogClientReady = 'true';
    setMounted(true);
    return () => {
      delete document.documentElement.dataset.dndevBlogClientReady;
    };
  }, []);

  if (!mounted) return null;
  return <${componentName} />;
}
`;
  }

  /**
   * Calculate relative import path from an app route page to generated blog content.
   *
   * @param {string} routePath
   * @returns {string}
   */
  calculateBlogContentImportPath(routePath) {
    const appPath = this.appDirFor(routePath);
    const segments = appPath.split('/').filter(Boolean);
    const prefix = '../'.repeat(segments.length + 1);
    return `${prefix}content/blog/blog-content.generated`;
  }

  /**
   * Generate an RSC page for a blog post dynamic route.
   * Emits generateStaticParams (all blog slugs) and generateMetadata (per-post
   * title / description / OG / Twitter) automatically — no manual file needed.
   *
   * @param {Object} route
   * @returns {string}
   */
  generateBlogPostRSCContent(route, componentName, relativeImportPath) {
    const param = this.extractDynamicParam(route.path);

    return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

import type { Metadata } from 'next';

import BlogPostClient from './BlogPostClient';
import blogContent from '${this.calculateBlogContentImportPath(route.path)}';

type Params = Promise<{ ${param}: string }>;

interface BlogMeta {
  title: string;
  description: string;
  date: string;
  tags?: string;
  image?: string;
  [key: string]: string | undefined;
}

interface BlogPost {
  slug: string;
  meta: BlogMeta;
  content: string;
}

function parseFrontmatter(raw: string): { meta: BlogMeta; content: string } {
  const match = raw.match(new RegExp('^---\\\\r?\\\\n([\\\\s\\\\S]*?)\\\\r?\\\\n---\\\\r?\\\\n'));
  if (match === null) {
    return { meta: { title: '', description: '', date: '' }, content: raw };
  }

  const meta: BlogMeta = { title: '', description: '', date: '' };
  const frontmatter = match[1] ?? '';
  for (const line of frontmatter.split('\\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, content: raw.slice(match[0].length) };
}

function parseFilePath(path: string): { slug: string; lang: string } | null {
  const filename = path.split('/').pop()?.replace(new RegExp('\\\\.md$'), '');
  if (filename === undefined) return null;

  const lastUnderscore = filename.lastIndexOf('_');
  if (lastUnderscore === -1) return { slug: filename, lang: 'en' };

  const lang = filename.slice(lastUnderscore + 1);
  const slug = filename.slice(0, lastUnderscore);
  if (lang.length < 2 || lang.length > 5 || !/^[a-zA-Z]{2,5}$/.test(lang)) {
    return { slug: filename, lang: 'en' };
  }
  return { slug, lang };
}

function getEnglishPosts(): BlogPost[] {
  const posts: BlogPost[] = [];
  for (const [path, raw] of Object.entries(blogContent)) {
    const parsed = parseFilePath(path);
    if (parsed === null || parsed.lang !== 'en') continue;
    const post = parseFrontmatter(raw);
    posts.push({ slug: parsed.slug, meta: post.meta, content: post.content });
  }
  return posts;
}

const englishPosts = getEnglishPosts();

export async function generateStaticParams() {
  return englishPosts.map((post) => ({ ${param}: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { ${param} } = await params;
  const post = englishPosts.find((item) => item.slug === ${param}) ?? null;
  if (!post) return { title: 'Post not found' };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return {
    title: post.meta.title,
    ...(post.meta.description ? { description: post.meta.description } : {}),
    ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
    openGraph: {
      title: post.meta.title,
      type: 'article',
      ...(post.meta.description ? { description: post.meta.description } : {}),
      ...(post.meta.image ? { images: [post.meta.image] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.meta.title,
      ...(post.meta.description ? { description: post.meta.description } : {}),
      ...(post.meta.image ? { images: [post.meta.image] } : {}),
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function BlogPostRoute({ params }: { params: Params }) {
  const { ${param} } = await params;
  const post = englishPosts.find((item) => item.slug === ${param}) ?? null;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html:
            'html[data-dndev-blog-client-ready="true"] .dndev-blog-seo-fallback{display:none}',
        }}
      />
      {post && (
        <article className="dndev-blog-seo-fallback prose">
          <h1>{post.meta.title}</h1>
          {post.meta.description && <p>{post.meta.description}</p>}
          {post.meta.date && <p>{post.meta.date}</p>}
          <pre
            style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}
            dangerouslySetInnerHTML={{ __html: escapeHtml(post.content) }}
          />
        </article>
      )}
      <BlogPostClient />
    </>
  );
}
`;
  }

  isClientComponent(filePath) {
    try {
      const fullPath = this.pathResolver.resolveAppPath(filePath);
      if (!this.pathResolver.pathExists(fullPath)) {
        return false;
      }

      const content = this.pathResolver.readSync(fullPath);
      if (!content) {
        return false;
      }

      // Check first 50 lines for 'use client' directive
      const lines = content.split('\n').slice(0, 50);
      return lines.some(
        (line) =>
          line.trim() === "'use client';" || line.trim() === '"use client";'
      );
    } catch {
      return false;
    }
  }
}

// Export factory function for easier usage
export function createNextRouteHandler(options = {}) {
  return new NextRouteHandler(options);
}
