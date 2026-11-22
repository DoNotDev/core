/**
 * @fileoverview Next.js Route Handler - Platform Adapter
 * @description Transforms pure route data from RouteDiscovery into Next.js compatible format. Generates both middleware and app/** directory files for optimal SEO.
 * This file holds the handler's configuration, route manifest and page generation; each
 * other concern is a method group in `./route/` mixed into the prototype: app document and
 * layouts (`appDocument.js`), metadata manifest, proxy, route index files, server metadata
 * of generated pages (`serverMetadata.js`), revalidation route, blog post pages.
 *
 * @version 0.0.3
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseNextHandler, NEXT_DISCOVERY_OPTIONS } from './BaseNextHandler.js';
import { appDocumentMethods } from './route/appDocument.js';
import { blogPostMethods } from './route/blogPost.js';
import { metadataManifestMethods } from './route/metadataManifest.js';
import { proxyMethods } from './route/proxy.js';
import { revalidationRouteMethods } from './route/revalidationRoute.js';
import { routeIndexMethods } from './route/routeIndex.js';
import { serverMetadataMethods } from './route/serverMetadata.js';
import { nextFileName } from '../nextFiles.js';
import {
  GENERATED_PATHS,
  ROUTE_DISCOVERY,
  CONFIG_KEYS,
  DEFAULT_OG_IMAGE,
  NEXT_RENDER,
} from '../../constants.js';
import { RouteDiscovery } from '../../discovery/RouteDiscovery.js';
import { hasBlogFeed } from '../../utils/blogFeed.js';

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
    /**
     * This build's i18n discovery (set by useI18n before generation).
     * @type {Object | null}
     */
    this.i18n = null;
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      routingMode: 'app', // 'app' or 'pages'
      generateMiddleware: true,
      generateAppPages: true, // NEW: Generate app/** page files
      // Catch-all routes: a PageMeta route ending in `*` (`/docs/*`) is generated as a
      // `[...slug]` segment (convertRouteToAppPath). It is not prerendered, nor revalidated
      // per record (prerenderedRecordsRoute, revalidationRoute): each URL renders on its
      // first request, then is cached. Unknown URLs get global-not-found.next.tsx.
      proxyPath: GENERATED_PATHS.next.proxy,
      manifestPath: GENERATED_PATHS.next.routeManifest,
      // App languages (set by useLanguages from the i18n discovery before generation).
      // One language: no URL prefix, pages at the app root.
      languages: [],
      defaultLanguage: null,
      // The app's Next `trailingSlash` (defineNextConfig passes it through to Next):
      // written into the route manifest, the SEO head builds public URLs in that form.
      trailingSlash: false,
      // Site name (appConfig.seo.siteName, else appConfig.app.name, set by defineNextConfig):
      // suffix of the generated entity page titles, as AutoMetaTags titles the other pages
      siteName: null,
      // appConfig.seo.defaultImage (set by defineNextConfig): og:image of pages without one,
      // as AutoMetaTags (see defaultImage())
      defaultImage: undefined,
      // appConfig.seo.defaultNamespace (set by defineNextConfig): translations of pages
      // without a namespace, as AutoMetaTags (see defaultNamespace())
      defaultNamespace: undefined,
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
   * This build's i18n discovery (runDiscoveries calls this before generating routes, which
   * run before the i18n handler writes its config): the metadata manifest's translations
   * (`content`, `mapping`) and languages.
   *
   * @param {{ supportedLanguages: string[], fallbackLanguage: string, content?: Object, mapping?: Object }} i18n - I18n discovery results
   * @since 0.3.2
   */
  useI18n(i18n) {
    this.i18n = i18n;
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
   * Link-preview image of pages without their own (`og:image`, Twitter card):
   * `appConfig.seo.defaultImage`, else `DEFAULT_OG_IMAGE` (`/og-image.png`). The same
   * default AutoMetaTags renders (AppConfigProvider), so the server metadata of entity
   * pages and `getMetadataForPath` match the other pages.
   *
   * @returns {string}
   * @since 0.3.2
   */
  defaultImage() {
    return this.options.defaultImage || DEFAULT_OG_IMAGE;
  }

  /**
   * Translation namespace of pages whose PageMeta sets none: `appConfig.seo.defaultNamespace`,
   * else `home`. The default AutoMetaTags (AppConfigProvider) and the Vite prerender use, so
   * the metadata manifest titles those pages the same way.
   *
   * @returns {string}
   * @since 0.3.2
   */
  defaultNamespace() {
    return this.options.defaultNamespace || 'home';
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
    return new discoveryClass(this.pathResolver, {
      ...this.options,
      ...NEXT_DISCOVERY_OPTIONS,
    });
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

  /**
   * The entities resolver of the route discovery (the `entities` package parsed once),
   * handed by runDiscoveries to the asset handler (tel-field flags).
   * @returns {{ collectionOf: Function, usesFieldType: (type: string) => Promise<boolean> }}
   * @since 0.3.2
   */
  getEntityResolver() {
    return this.discovery.getEntityResolver();
  }

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
    // Pages fail here, loudly, not in their per-page generation
    if (this.options.generateAppPages) this.assertServerMetadata(routes);

    const manifest = {
      totalRoutes: routes.length,
      authRequired: routes.filter((r) => r.auth && r.auth.required).length,
      publicRoutes: routes.filter((r) => !r.auth || r.auth === false).length,
      source: discoveryData.source,
      hasBlogFeed: hasBlogFeed(this.pathResolver.getAppRoot()),
      trailingSlash: this.options.trailingSlash,
      // Routes whose page identity the generated page.tsx sets on the server
      // (serverMetadataSource): AutoMetaTags emits none there
      serverMetadataPaths: this.options.generateAppPages
        ? routes.filter((route) => this.serverMetadataSource(route)).map((route) => route.path)
        : [],
      // Entity pages: the generated page renders the BreadcrumbList (record title last),
      // AutoMetaTags emits none there
      recordBreadcrumbPaths: this.options.generateAppPages
        ? routes.filter((route) => this.entityMetadataRoute(route)).map((route) => route.path)
        : [],
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
      this.generateRevalidationRoute(routeData);
    }

    if (this.options.routingMode === 'app') {
      await this.generateAppRoutes(routeData);
    } else {
      await this.generatePagesRoutes(routeData);
    }
  }

  /**
   * Generate app/** page files from discovered routes, in two render trees:
   *
   * - `src/app/(site)/…` (every app): the providers without request data, so each page
   *   is static and served from the cache, revalidated every `revalidate()` seconds
   *   (appConfig.revalidate, ISR; `false` = until the next deploy). One cache entry per URL, i.e. per page and
   *   per language. Guests, crawlers and every visitor of an app whose session the
   *   server cannot read (Firebase, localStorage) get it.
   * - `src/app/dndev-session/…` (cookie session + generated proxy): the same pages
   *   rendered per request with the request cookies (signed-in state, the visitor's
   *   data). The proxy rewrites requests carrying an auth cookie to it.
   *
   * With the per-request tree, pages whose PageMeta sets `auth` exist only there
   * (isSessionOnlyRoute): the proxy renders them per request for every visitor, so they
   * read the request (query string included) on the server, with no Suspense boundary.
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
        const tree = this.isSessionOnlyRoute(route) ? 'session' : 'site';
        const wasGenerated = await this.generateSingleAppPage(route, tree);
        if (wasGenerated) generatedCount++;
        if (wasGenerated && tree === 'site' && this.rendersSessionTree) {
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
   * Whether a route is generated only in the per-request tree: the app renders that tree
   * (cookie session + generated proxy) and the page's PageMeta sets `auth`. The proxy
   * renders it per request for every visitor (redirect first), so no cached copy is
   * built and the page reads the request on the server.
   *
   * @param {Object} route - Route object from discovery
   * @returns {boolean}
   * @since 0.2.4
   */
  isSessionOnlyRoute(route) {
    return this.rendersSessionTree && Boolean(this.normalizeAuth(route.auth));
  }

  /**
   * Per-request page of a route (`src/app/dndev-session/…/page.next.tsx`): re-exports
   * the site tree's page (and its server metadata: entity page, blog post, page module's
   * own `generateMetadata`, see {@link serverMetadataSource}), so both trees render the
   * same component with the same head. Its layout makes it per request.
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
    if (this.serverMetadataSource(route)) names.push('generateMetadata');
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
   * @param {'site'|'session'} [tree='site'] - Render tree (`session`: isSessionOnlyRoute)
   * @returns {Promise<boolean>} True if file was generated, false if skipped
   */
  async generateSingleAppPage(route, tree = 'site') {
    try {
      const appPath = this.appDirFor(route.path, tree);
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
      const pageContent = this.generatePageFileContent(normalizedRoute, tree);

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

      if (this.isBlogPostRoute(normalizedRoute)) {
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
   * Generate page file content with component import and metadata
   * Creates bridge file that imports actual page component. Server identity
   * ({@link serverMetadataSource}): an entity page gets generated generateMetadata,
   * JSON-LD and a 404 for a missing record ({@link entityMetadataExport}); a page module
   * exporting `generateMetadata` gets it re-exported. Other pages: AutoMetaTags.
   *
   * @param {Object} route - Route object with importPath, metaExport, etc.
   * @param {'site'|'session'} [tree='site'] - Render tree: per-request pages get no
   *   generateStaticParams (nothing of them is cached)
   * @returns {string} Complete page file content
   */
  generatePageFileContent(route, tree = 'site') {
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
    if (this.isBlogPostRoute(route)) {
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
    // One public reader for the prerendered records (cached tree only: per-request pages
    // have nothing to prerender) and the generated entity metadata
    const reader = this.entityPageReader(route, tree);
    const params =
      tree === 'site'
        ? this.staticParamsExport(route, reader)
        : { named: {}, code: '' };
    // Server identity: generated from the entity record, or the page's own generateMetadata
    const entitySeo = this.entityMetadataExport(route, reader);
    // Framework imports, one line per module (after vendors, before the app's)
    const named = {
      '@donotdev/core/server': reader.expr ? ['HIDDEN_STATUSES'] : [],
      '@donotdev/core/next': [],
      '@donotdev/core/rsc': [],
    };
    for (const source of [params.named, entitySeo?.named ?? {}, reader.named]) {
      for (const [module, names] of Object.entries(source)) named[module].push(...names);
    }
    const frameworkImports = Object.entries(named)
      .filter(([, names]) => names.length > 0)
      .map(([module, names]) => `import { ${names.join(', ')} } from '${module}';\n`)
      .join('');
    const pageMetadata =
      this.serverMetadataSource(route) === 'page'
        ? `\n// The page module's own Next metadata\nexport { generateMetadata } from '${relativeImportPath}';\n`
        : '';
    const guard = (jsx) => {
      const inner = signedInTo
        ? `<SignedInRedirect to={${JSON.stringify(signedInTo)}}>${jsx}</SignedInRedirect>`
        : jsx;
      return auth
        ? `<AuthGuard auth={${JSON.stringify(auth === true ? { required: true } : auth)}}>${inner}</AuthGuard>`
        : inner;
    };
    const pageImport = isClientComponent
      ? `import ${componentName}Client from './${componentName}Client';`
      : `import ${componentName} from '${relativeImportPath}';`;
    const header = `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

${entitySeo?.vendorImports ?? ''}${frameworkImports}${entitySeo?.typeImports ?? ''}${guardImport}${reader.imports}${entitySeo?.appImports ?? ''}${pageImport}
${reader.setup}${params.code}${entitySeo ? entitySeo.code : ''}${pageMetadata}`;

    // Entity page: the page renders after its record is known (404 otherwise), with the
    // record's JSON-LD
    if (entitySeo) {
      const page = isClientComponent
        ? `<${componentName}Client />`
        : `<${componentName} {...props} />`;
      return `${header}
export default async function ${componentName}Route(props: { params: Params }) {
  ${entitySeo.render.replace('{PAGE}', guard(page))}
}
`;
    }

    if (isClientComponent) {
      return `${header}
export default function ${componentName}Route() {
  return ${guard(`<${componentName}Client />`)};
}
`;
    }

    // Server components: head tags come from AutoMetaTags (NextJsAppProviders), the
    // same PageMeta resolution as Vite, unless the page module exports its own
    // generateMetadata (re-exported above). getMetadataForPath is not used: it pulls the
    // build tooling (@babel/core) into the Next server bundle.
    if (guards.length) {
      return `${header}
export default function ${componentName}Route(props: Record<string, unknown>) {
  return ${guard(`<${componentName} {...props} />`)};
}
`;
    }

    return `${header}
export default ${componentName};
`;
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
   * True when a route path contains a React Router dynamic segment (`:param`) or
   * an already-converted Next.js bracket segment (`[param]`).
   *
   * @param {string} routePath - e.g. '/blog/:slug'
   * @returns {boolean}
   */
  hasDynamicSegment(routePath) {
    return routePath.includes(':') || routePath.includes('[');
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
   * Check if a component file is a client component
   * Reads the file and checks for 'use client' directive
   *
   * @param {string} filePath - Path to component file
   * @returns {boolean} True if component has 'use client' directive
   */
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

// Method groups, one module each (./route/): mixed into the prototype, `this` is the handler
Object.assign(
  NextRouteHandler.prototype,
  appDocumentMethods,
  metadataManifestMethods,
  proxyMethods,
  routeIndexMethods,
  serverMetadataMethods,
  revalidationRouteMethods,
  blogPostMethods,
);

// Export factory function for easier usage
export function createNextRouteHandler(options = {}) {
  return new NextRouteHandler(options);
}
