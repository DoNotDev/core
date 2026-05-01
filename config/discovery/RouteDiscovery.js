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
import { extractMeta } from '../utils/MetaExtractor.js';

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
        throw new Error(
          `Route conflict: Multiple routes found for path '${path}'. ` +
            `Routes: ${existingRoute.file} and ${route.file}. ` +
            `Use PageMeta route override to specify unique paths. ` +
            `Example: export const meta: PageMeta = { route: '/custom-path' };`
        );
      }
      pathMap.set(path, route);
    }

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

    // Extract meta export first to check for route override
    const metaExport = this._extractMetaExport(content, fileInfo.absolutePath);

    // Extract component name - React 19 convention: default exports only
    const componentName = extractComponentName(importPath);

    // DNDEV Convention: HomePage.tsx is always the root route
    const isHomePage = componentName === ROUTE_DISCOVERY.HOMEPAGE_COMPONENT;
    const routePath = isHomePage
      ? ROUTE_DISCOVERY.HOMEPAGE_PATH
      : this._resolveRoutePath(metaExport, relativePath, fileInfo.absolutePath);

    // Auto-discover entity and action from file path (always takes precedence)
    const discoveredMeta = this._extractPageMeta(relativePath, content);

    // Merge metaExport but exclude entity/action (they're auto-discovered)
    // Title can be overridden if provided in PageMeta
    const { entity, action, ...metaExportWithoutAutoFields } = metaExport || {};

    return {
      path: routePath, // Use HomePage convention or meta.route or auto-generated
      component: componentName, // Just the component name, virtual module will create lazy component
      importPath: importPath, // Full path with .tsx extension for Vite
      auth: metaExport?.auth || false, // Extract auth from meta object
      meta: {
        ...discoveredMeta, // Auto-discovered title, entity, action
        ...metaExportWithoutAutoFields, // Other meta fields from PageMeta (title override, namespace, icon, etc.)
        // Ensure entity and action are always from discovery (not overridable)
        entity: discoveredMeta.entity,
        action: discoveredMeta.action,
      },
      metaExport: metaExport,
      file: relativePath,
    };
  }

  /**
   * Extract meta export from page file using TypeScript AST parsing
   * Parses: export const meta = { title: "...", description: "..." }
   *
   * @param {string} content - File content
   * @param {string} filePath - File path for better error reporting
   * @returns {Object|null} Parsed meta object or null
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

  _extractPageMeta(relativePath, content) {
    const fileName = relativePath.split('/').pop()?.replace('.tsx', '') || '';

    let title = fileName.replace(/Page$/, '');
    title = title
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);

    const pathParts = relativePath.split('/');
    let entity = null;
    let action = null;

    if (pathParts.length > 1) {
      entity = pathParts[pathParts.length - 2];
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

    return { title, entity, action, file: relativePath };
  }
}
