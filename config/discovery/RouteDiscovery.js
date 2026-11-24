/**
 * @fileoverview RouteDiscovery - Pure Route Discovery Engine
 * @description Platform-agnostic route discovery that extends BaseDiscovery. Returns plain data without knowledge of Vite, Next.js, or any platform specifics.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseDiscovery } from './BaseDiscovery.js';
import { ROUTE_DISCOVERY } from '../constants.js';
import { createBuildError, isBuildError } from '../utils/buildError.js';
import { extractMeta, hasGenerateMetadataExport } from '../utils/MetaExtractor.js';
import { createEntityResolver, resolvePageEntity } from '../utils/pageEntity.js';
import { getPathPrefixes, routeAncestors } from '../utils/routeAncestors.js';
import { isCatchAllRoute, isIndexableRoute } from '../utils/SEOGenerator.js';

// Module-level cache to prevent duplicate discovery scans in same build
let cachedRouteData = null;
let cachedBuildId = null;

// Helper function to extract component name from file path
function extractComponentName(filePath) {
  const fileName =
    filePath
      .split('/')
      .pop()
      ?.replace(/\.tsx?$/, '') || 'Component';
  const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '');
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
}

/**
 * Fail the build on a PageMeta `signedInRedirect` that is not a same-site app path
 * (`/x`, never `//host` or `https://…`) or that points at the page itself (loop).
 *
 * @param {{ path: string, file: string, meta?: { signedInRedirect?: unknown } }} route - Discovered route
 * @throws {Error} Build error ({@link createBuildError}) when the target is invalid
 */
export function validateSignedInRedirect(route) {
  const to = route.meta?.signedInRedirect;
  if (to === undefined) return;
  if (
    typeof to !== 'string' ||
    !to.startsWith('/') ||
    to.startsWith('//') ||
    to.startsWith('/\\')
  ) {
    throw createBuildError(
      'dndev-routes',
      `${route.file}: PageMeta signedInRedirect must be an app path starting with '/' (got ${JSON.stringify(to)}). ` +
        `Example: export const meta: PageMeta = { signedInRedirect: '/catalogue' };`,
      'invalid-configuration'
    );
  }
  if (to.split(/[?#]/)[0] === route.path) {
    throw createBuildError(
      'dndev-routes',
      `${route.file}: PageMeta signedInRedirect points at the page itself (${to}): signed-in visitors would loop. Use another page.`,
      'invalid-configuration'
    );
  }
}

/**
 * Fail the build on a PageMeta `parent` the ancestor chain cannot use: not a same-app
 * static route path (`/x`: no `:param`, `*`, query or hash, never `//host`), no page at
 * that path, the page itself, or a page whose URL prefix is itself a page (that page is
 * its parent: `parent` would never be read). Loops: {@link assertParentChains}.
 *
 * @param {{ path: string, file: string, meta?: { parent?: unknown } }} route - Discovered route
 * @param {ReadonlyArray<{ path: string, meta?: Object }>} routes - Every discovered route
 * @returns {void}
 * @throws {Error} Build error ({@link createBuildError}) naming the page and the fix
 * @since 0.3.4
 *
 * @example
 * validatePageParent({ path: '/produits/:slug', file: 'src/pages/ProductPage.tsx', meta: { parent: '/produits' } }, routes); // throws: no page
 */
export function validatePageParent(route, routes) {
  const parent = route.meta?.parent;
  if (parent === undefined) return;
  const fail = (reason) => {
    throw createBuildError(
      'dndev-routes',
      `${route.file}: PageMeta parent ${JSON.stringify(parent)} ${reason}`,
      'invalid-configuration'
    );
  };
  if (
    typeof parent !== 'string' ||
    !parent.startsWith('/') ||
    parent.startsWith('//') ||
    /[\\?#*:]/.test(parent)
  ) {
    fail(
      "must be the static path of one of the app's pages, starting with '/' (no :param, *, query or hash). " +
        "Example: export const meta: PageMeta = { parent: '/catalogue' };"
    );
  }
  if (!routes.some((other) => other.path === parent)) {
    fail(`is not the path of a page of the app. Use the path of an existing page, e.g. one of: ${routes
      .map((other) => other.path)
      .filter((path) => !/[:*]/.test(path))
      .slice(0, 8)
      .join(', ')}.`);
  }
  if (parent === route.path) fail('is the page itself. Name the page its visitors come from.');
  const direct = getPathPrefixes(route.path).slice(0, -1).at(-1);
  if (direct && routes.some((other) => other.path === direct)) {
    fail(`is never used: the URL prefix ${direct} is a page, so it is the parent. Remove parent.`);
  }
}

/**
 * Fail the build when a page's ancestor chain (`routeAncestors`, the one the breadcrumbs,
 * BreadcrumbList and forms read) loops through PageMeta `parent` declarations. Run after
 * {@link validatePageParent} on every route (each `parent` names an existing page).
 *
 * @param {ReadonlyArray<{ path: string, file: string, meta?: Object }>} routes - Every discovered route
 * @returns {void}
 * @throws {Error} Build error naming the page and the loop
 * @since 0.3.4
 */
export function assertParentChains(routes) {
  for (const route of routes) {
    try {
      routeAncestors(route.path, routes);
    } catch (error) {
      throw createBuildError(
        'dndev-routes',
        `${route.file}: ${error.message.replace(/^\[dndev\] /, '')} Fix the PageMeta parent of one of these pages.`,
        'invalid-configuration'
      );
    }
  }
}

/**
 * Fail the build on a public, indexable `:param` route with no per-URL identity: every URL
 * of it would share one title and description (PageMeta + i18n), duplicate pages for
 * search engines. Ways out: the page declares its record entity (PageMeta `entity`), it
 * exports Next's `generateMetadata` (Next only: `pageGenerateMetadata`), or it is
 * `seo: { noindex: true }`. Exempt, like the sitemap ({@link isIndexableRoute},
 * {@link isCatchAllRoute}): auth-only and error routes (`/404`, `/not-found`, ...),
 * catch-all routes (`/docs/*`, no URL list: the sitemap leaves them out too) and blog
 * post routes (`blog` namespace: identity from the post's frontmatter).
 *
 * @param {{ path: string, file: string, auth?: unknown, meta?: object,
 *   metaExport?: { namespace?: string } | null, exportsGenerateMetadata?: boolean }} route - Discovered route
 * @param {{ pageGenerateMetadata?: boolean }} [platform] - `pageGenerateMetadata: true` on
 *   Next, where a page module's own `generateMetadata` sets the identity (Vite has no server)
 * @returns {void}
 * @throws {Error} Build error ({@link createBuildError}) listing the ways out
 * @since 0.3.2
 *
 * @example
 * assertDynamicRouteSeo({ path: '/produits/:slug', file: 'src/pages/ProductPage.tsx', meta: {} }); // throws
 */
export function assertDynamicRouteSeo(route, { pageGenerateMetadata = false } = {}) {
  if (!route.path.split('/').some((segment) => segment.startsWith(':'))) return;
  if (isCatchAllRoute(route) || !isIndexableRoute(route)) return;
  if (route.meta?.entity || route.metaExport?.namespace === 'blog') return;
  if (pageGenerateMetadata && route.exportsGenerateMetadata) return;
  const ways = [
    "declare the record entity it shows: import { productEntity } from 'entities'; then " +
      'entity: productEntity in its PageMeta (title, description and image from the record)',
    ...(pageGenerateMetadata
      ? ["export Next's generateMetadata from the page module (a server module, no 'use client')"]
      : []),
    'keep it out of search engines: seo: { noindex: true } in its PageMeta',
  ];
  throw createBuildError(
    'dndev-routes',
    `${route.file}: public dynamic route ${route.path} has no per-URL SEO: every URL would get the ` +
      'same title and description (PageMeta + i18n), duplicate pages for search engines. Fix, one of:\n' +
      ways.map((way, index) => `  ${index + 1}. ${way}`).join('\n'),
    'invalid-configuration'
  );
}

export class RouteDiscovery extends BaseDiscovery {
  constructor(pathResolver, options = {}) {
    super(pathResolver, {
      additionalPatterns: [],
      ...options,
    });

    this.routes = [];
    this.errors = [];
    this.source = 'auto-discovery';
  }

  // === ABSTRACT METHOD IMPLEMENTATIONS ===

  _getDiscoveryType() {
    return 'Route';
  }

  async _getPatterns() {
    return await this.pathResolver.resolvePatterns('routes');
  }

  _getPatternType() {
    return 'routes';
  }

  async _processFiles(files) {
    const appRoot = this.pathResolver.getAppRoot();
    const currentBuildId = process.env.DNDEV_BUILD_ID;

    // Return cached results if already discovered this build
    if (cachedRouteData && cachedBuildId === currentBuildId) {
      this.logger.debug('Using cached route discovery results');
      this.routes = cachedRouteData.routes;
      this.errors = cachedRouteData.errors;
      this.source = cachedRouteData.source;
      this.entityResolver = cachedRouteData.entityResolver;
      return {
        routes: this.routes,
        errors: this.errors,
        source: this.source,
        totalFiles: this.routes.length,
      };
    }

    this.logger.debug('Route discovery mode: AUTO-DISCOVERY');
    this.logger.debug(`App root: ${appRoot}`);

    // Debug-only logging for troubleshooting (results are logged by logStats in the plugin)
    if (this.options.debug) {
      const fileCount = files?.consumerFiles?.length || 0;
      this.logger.debug(
        `🔍 Route discovery: Scanning ${fileCount} files in ${appRoot}`
      );
      const patterns = await this._getPatterns();
      this.logger.debug(`Patterns: ${JSON.stringify(patterns)}`);
    }

    await this._performAutoDiscovery(files, appRoot);

    if (this.options.debug) {
      this.logger.debug(
        `🔍 Route discovery: Found ${this.routes.length} routes`
      );
    }
    if (this.routes.length === 0) {
      this.logger.warn(
        `⚠️ No routes discovered! Check that pages exist in src/pages/`
      );
    }

    // Cache results for this build
    cachedRouteData = {
      routes: this.routes,
      errors: this.errors,
      source: this.source,
      entityResolver: this.entityResolver,
    };
    cachedBuildId = process.env.DNDEV_BUILD_ID;

    return {
      routes: this.routes,
      errors: this.errors,
      source: this.source,
      totalFiles: this.routes.length,
    };
  }

  _getEmptyResult() {
    return {
      routes: [],
      errors: [],
      source: 'empty',
      totalFiles: 0,
      timestamp: Date.now(),
    };
  }

  _getDiscoverySummary() {
    return `${this.cache?.routes?.length || 0} routes discovered via ${this.cache?.source || 'unknown'}`;
  }

  // === PUBLIC API METHODS ===

  /**
   * The entities resolver of this route discovery run (`createEntityResolver`: the
   * `entities` package parsed once), for the other discoveries that read the entities
   * (the asset discovery's tel-field check). Created here when discovery has not run.
   * @returns {{ collectionOf: Function, usesFieldType: (type: string) => Promise<boolean> }}
   * @since 0.3.2
   */
  getEntityResolver() {
    this.entityResolver ??= createEntityResolver(
      this.pathResolver.getAppRoot()
    );
    return this.entityResolver;
  }

  /**
   * Discover routes (delegates to base discover method)
   * @param {boolean} force - Force re-discovery
   * @returns {Object} Pure route data
   */
  async discoverRoutes(force = false) {
    return await this.discover(force);
  }

  /**
   * Get available routes (cached)
   */
  getRoutes() {
    return this.cache?.routes || [];
  }

  // === PRIVATE IMPLEMENTATION METHODS ===

  async _performAutoDiscovery(files, appRoot) {
    const { consumerFiles } = files;
    // PageMeta entity declarations → collections (entities package parsed once per run)
    this.entityResolver = createEntityResolver(appRoot);

    // Process app pages only (no framework pages)
    const appResults = await this._batchProcessFiles(
      consumerFiles,
      (fileInfo) => this._analyzePageFile(fileInfo, appRoot)
    );

    // Add additional patterns (always app files)
    const additionalFiles = await this._scanAdditionalPatterns(appRoot);
    const additionalResults = await this._batchProcessFiles(
      additionalFiles,
      (fileInfo) => this._analyzePageFile(fileInfo, appRoot)
    );

    const allResults = [...appResults, ...additionalResults];

    this.logger.debug(
      `Auto-discovering from ${consumerFiles.length} app + ${additionalFiles.length} additional files`
    );

    /**
     * Filter reserved routes and validate for conflicts
     *
     * Reserved routes:
     * - /home → Use root "/" instead (semantic web convention)
     *
     * Validation:
     * - Multiple routes with same path → Build error (use PageMeta route override)
     * - Public indexable `:param` route without per-URL SEO → Build error (assertDynamicRouteSeo)
     * - PageMeta `parent` that is no other page, or never read, or loops → Build error
     *   (validatePageParent, assertParentChains)
     */
    this.routes = allResults.filter((route) => {
      if (route.path === 'home' || route.path === '/home') {
        this.logger.debug(
          `Filtered reserved route: ${route.path} - Use root "/" instead (${route.file})`
        );
        return false;
      }
      return true;
    });

    // Validate for route conflicts
    const pathMap = new Map();
    for (const route of this.routes) {
      const path = route.path;
      if (pathMap.has(path)) {
        const existingRoute = pathMap.get(path);
        throw createBuildError(
          'dndev-routes',
          `${route.file}: route ${path} is also the route of ${existingRoute.file}: ` +
            `two pages cannot share a URL. Give one of them another path with a PageMeta route override, ` +
            `e.g. export const meta: PageMeta = { route: '/custom-path' };`,
          'invalid-configuration'
        );
      }
      pathMap.set(path, route);
      validateSignedInRedirect(route);
      assertDynamicRouteSeo(route, {
        pageGenerateMetadata: this.options.pageGenerateMetadata === true,
      });
    }
    // Parents name other pages: checked once every route is known
    for (const route of this.routes) validatePageParent(route, this.routes);
    assertParentChains(this.routes);

    this.logger.debug(
      `Auto-discovered ${this.routes.length} routes from ${consumerFiles.length + additionalFiles.length} files`
    );
  }

  async _scanAdditionalPatterns(appRoot) {
    const additionalPatterns = this.options.additionalPatterns.map((pattern) =>
      this.pathResolver.resolveAppPath(pattern)
    );

    if (additionalPatterns.length === 0) return [];

    try {
      const { consumerFiles } = await this.pathResolver.resolveFiles(
        { consumer: additionalPatterns, framework: [] },
        'routes'
      );
      return consumerFiles;
    } catch (error) {
      this.logger.debug(`Error scanning additional patterns: ${error.message}`);
      return [];
    }
  }

  async _analyzePageFile(fileInfo, appRoot) {
    // Read as text (TS/TSX page files, not JSON)
    const content = await this.pathResolver.read(fileInfo.absolutePath, {
      format: 'text',
    });
    if (!content) return null;

    let relativePath = fileInfo.relativePath;

    // Generate import path for app pages - KEEP .tsx for Vite dynamic imports
    let importPath = '/src/' + relativePath.replace(/\\/g, '/');
    importPath = importPath
      .replace(/src\/src\//g, 'src/')
      .replace(/src\/src\//g, 'src/');

    // Extract meta export first to check for route override (unreadable: build error)
    const metaExport = this._extractMetaExport(content, relativePath);

    // Extract component name - React 19 convention: default exports only
    const componentName = extractComponentName(importPath);

    // DNDEV Convention: HomePage.tsx is always the root route
    const isHomePage = componentName === ROUTE_DISCOVERY.HOMEPAGE_COMPONENT;
    const routePath = isHomePage
      ? ROUTE_DISCOVERY.HOMEPAGE_PATH
      : this._resolveRoutePath(metaExport, relativePath, fileInfo.absolutePath);

    // Title and action from the file name
    const discoveredMeta = this._extractPageMeta(relativePath);

    // The record page's declared entity (PageMeta `entity: productEntity`, imported from
    // 'entities') → its collection; the folder never sets it. Invalid: build error.
    const entity = await resolvePageEntity(
      metaExport,
      content,
      relativePath,
      this.entityResolver
    );

    // Merge metaExport but exclude entity (resolved above) and action (from the file name)
    // Title can be overridden if provided in PageMeta
    const {
      entity: _declaredEntity,
      action,
      ...metaExportWithoutAutoFields
    } = metaExport || {};

    return {
      path: routePath, // Use HomePage convention or meta.route or auto-generated
      component: componentName, // Just the component name, virtual module will create lazy component
      importPath: importPath, // Full path with .tsx extension for Vite
      auth: metaExport?.auth || false, // Extract auth from meta object
      meta: {
        ...discoveredMeta, // Auto-discovered title, action
        ...metaExportWithoutAutoFields, // Other meta fields from PageMeta (title override, namespace, icon, etc.)
        // Collection of the declared entity (absent when the page declares none)
        ...(entity && { entity }),
        action: discoveredMeta.action,
      },
      // PageMeta as written, entity as its collection (the reference is build-time only)
      metaExport: metaExport && { ...metaExport, ...(entity && { entity }) },
      // Next: the page module exports generateMetadata (re-exported by the generated page)
      exportsGenerateMetadata: hasGenerateMetadataExport(content),
      file: relativePath,
    };
  }

  /**
   * Extract meta export from page file using TypeScript AST parsing
   * Parses: export const meta = { title: "...", description: "..." }
   *
   * @param {string} content - File content
   * @param {string} filePath - Page path (`src/pages/…`), named in errors
   * @returns {Object|null} Parsed meta object or null
   * @throws {Error} Build error ({@link extractMeta}): a PageMeta that cannot be read fails
   *   the build instead of dropping the page's route, auth and seo
   * @private
   */
  _extractMetaExport(content, filePath) {
    try {
      const meta = extractMeta(content, filePath);

      if (meta) {
        this.logger.debug(
          `Extracted meta export from ${filePath}: ${JSON.stringify(meta)}`
        );
        return meta;
      }

      return null;
    } catch (error) {
      if (isBuildError(error)) throw error;
      this.logger.debug(
        `Error parsing meta export from ${filePath}: ${error.message}`
      );
      return null;
    }
  }

  _generateRoutePath(relativePath) {
    let path = relativePath
      .replace(/\.tsx$/, '')
      .replace(/Page$/, '')
      .replace(/^src\//, '')
      .replace(/^pages\//, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();

    if (path.endsWith('/index') || path === 'index') {
      path = path.replace(/\/index$/, '') || '/';
    }

    // For root route, keep the leading slash
    if (path === '/') {
      return '/';
    }

    // Generate absolute paths - AppRoutes will strip for child routes
    return '/' + path.replace(/\/+/g, '/');
  }

  /**
   * Resolve route path with smart string detection
   * Perfect DX: Supports auto-generation, custom strings, and validates format
   *
   * @param {Object} metaExport - Extracted meta export from page file
   * @param {string} relativePath - Relative file path for auto-generation
   * @param {string} filePath - Absolute file path for error reporting
   * @returns {string} Valid route path string
   * @private
   */
  _resolveRoutePath(metaExport, relativePath, filePath) {
    // 1. If no meta.route specified, auto-generate from filename (90% of cases)
    if (!metaExport?.route) {
      return this._generateRoutePath(relativePath);
    }

    // 2. If meta.route is string, normalize it (ensure leading slash, remove double slashes)
    if (typeof metaExport.route === 'string') {
      let path = metaExport.route.trim();

      // Root route stays as is
      if (path === '/') {
        return '/';
      }

      // Normalize: remove double slashes, ensure single leading slash
      path = path.replace(/\/+/g, '/'); // Replace multiple slashes with single
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      return path;
    }

    // 3. If meta.route is object with params, build path from base + params
    if (typeof metaExport.route === 'object' && metaExport.route !== null) {
      const basePath = this._generateRoutePath(relativePath);
      const params = metaExport.route.params;

      if (Array.isArray(params) && params.length > 0) {
        const paramSuffix = params.map((param) => `:${param}`).join('/');
        return `${basePath}/${paramSuffix}`;
      }

      // Object format but no params - use base path
      return basePath;
    }

    // 4. Invalid format - log warning and fallback to auto-generated
    this.logger.warn(
      `Invalid route format in ${filePath}. Use string format: route: "/path/:param" or object format: route: { params: ['id'] }`
    );
    this.logger.debug(`Falling back to auto-generated path for ${filePath}`);
    return this._generateRoutePath(relativePath);
  }

  /**
   * Title and action of a page from its file name (`ProductListPage.tsx` → title
   * `Product List`, action `list`). Folders set neither the entity nor anything else
   * here: they only shape the route path ({@link _generateRoutePath}).
   *
   * @param {string} relativePath - Page path (`src/pages/products/ProductPage.tsx`)
   * @returns {{ title: string, action: string | null, file: string }}
   * @private
   */
  _extractPageMeta(relativePath) {
    const fileName = relativePath.split('/').pop()?.replace('.tsx', '') || '';

    let title = fileName.replace(/Page$/, '');
    title = title
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);

    const pathParts = relativePath.split('/');
    let action = null;

    if (pathParts.length > 1) {
      if (fileName.includes('List')) action = 'list';
      else if (
        fileName.includes('Form') ||
        fileName.includes('Create') ||
        fileName.includes('Edit')
      )
        action = 'form';
      else if (fileName.includes('Detail') || fileName.includes('View'))
        action = 'detail';
    }

    return { title, action, file: relativePath };
  }
}
