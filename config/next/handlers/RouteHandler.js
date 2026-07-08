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
import {
  GENERATED_PATHS,
  ROUTE_DISCOVERY,
  CONFIG_KEYS,
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
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      routingMode: 'app', // 'app' or 'pages'
      generateMiddleware: true,
      generateAppPages: true, // NEW: Generate app/** page files
      // Note: catch-all removed - incompatible with Next.js 16+ static export, use not-found.tsx instead
      middlewarePath: GENERATED_PATHS.next.middleware,
      manifestPath: GENERATED_PATHS.next.routeManifest,
    };
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
        const image = seo.image || i18nMeta.image || '/og-image.png';
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
   * Generate app/** page files from discovered routes
   * Creates bridge files that import actual page components for optimal SEO
   *
   * @param {Object} routeData - Route discovery results
   * @returns {Promise<void>}
   */
  async generateAppPageFiles(routeData) {
    this.logger.debug('Starting app/** page file generation');

    try {
      // Clean existing generated page files first
      await this.cleanGeneratedPageFiles();

      // Generate a page file for each discovered route
      let generatedCount = 0;
      for (const route of routeData.routes) {
        const wasGenerated = await this.generateSingleAppPage(route);
        if (wasGenerated) generatedCount++;
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
   * Clean existing generated page files
   * Only removes files with generation markers to preserve user-created files
   *
   * @returns {Promise<void>}
   */
  async cleanGeneratedPageFiles() {
    try {
      const appRoot = this.pathResolver.getAppRoot();
      const patterns = ['src/app/**/page.tsx', 'src/app/[...slug]/page.tsx'];
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
      const appPath = this.convertRouteToAppPath(route.path);
      const pageFilePath = `src/app${appPath}/page.tsx`;
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
    if (isClientComponent) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

import ${componentName}Client from './${componentName}Client';
${this.ssrDynamicExport()}
export default function ${componentName}Route() {
  return <${componentName}Client />;
}
`;
    }

    // Server components: include generateMetadata from manifest
    // Same PageMeta works in Vite (AutoMetaTags) and Next.js (this)
    return `// Generated by @donotdev/config - DO NOT EDIT
// This file will be regenerated when src/pages changes
// To customize: edit ${route.filePath} or create manual app/** files

import type { Metadata } from 'next';

import { getMetadataForPath } from '@donotdev/core/next';

import ${componentName} from '${relativeImportPath}';
${this.ssrDynamicExport()}
export async function generateMetadata(): Promise<Metadata> {
  return getMetadataForPath('${route.path}');
}

export default ${componentName};
`;
  }

  /**
   * When appConfig.ssr is set, generated route wrappers render dynamically at
   * request time. The framework's client provider tree is not static-generation
   * safe under Next 16 (null-dispatcher during SSG prerender), but renders
   * correctly per request — content is still fully server-rendered and crawlable.
   * Returns an empty string when SSR is off (legacy static/CSR behavior).
   *
   * @returns {string}
   */
  ssrDynamicExport() {
    if (!this.options.ssr) return '';
    // Dynamic rendering is the correct mode for this framework: the provider and
    // layout tree reads live zustand stores (theme, layout, i18n, overlay) during
    // render, which makes it inherently dynamic. React 19 static prerendering (SSG)
    // cannot statically render components that read mutable external stores, so we
    // render on the server at request time — full, real SSR (content is in the
    // initial HTML and crawlable). Not a workaround: it matches the architecture.
    return `
// SSR (appConfig.ssr): render at request time — the provider tree is store-driven
// and therefore dynamic. Content is fully server-rendered.
export const dynamic = 'force-dynamic';
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
  const pageImage = metaObject?.image || '/og-image.png';
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

  async generateMiddleware(routeData) {
    // Get protected routes
    const protectedRoutes = routeData.routes.filter(
      (route) => route.auth && route.auth !== false && route.auth.required
    );

    if (protectedRoutes.length === 0) {
      this.logger.debug(
        'No protected routes found, skipping middleware generation'
      );
      return;
    }

    const middlewareContent = this.generateMiddlewareContent(protectedRoutes);
    this.writeGeneratedFile(
      this.options.middlewarePath,
      middlewareContent,
      'middleware'
    );
  }

  generateMiddlewareContent(protectedRoutes) {
    const routePatterns = protectedRoutes
      .map((route) => {
        // Convert dynamic routes to Next.js patterns
        const pattern = route.path
          .replace(/\[([^\]]+)\]/g, ':$1') // [id] -> :id
          .replace(/\.\.\./g, '*'); // [...slug] -> *

        return `    '${pattern}'`;
      })
      .join(',\n');

    return `// Auto-generated middleware by @donotdev/config
// Generated at ${new Date().toISOString()}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected route patterns
const protectedRoutes = [
${routePatterns}
];

// Auth check function (customize as needed)
function isAuthenticated(request: NextRequest): boolean {
  // TODO: Implement your authentication logic
  // Example: check for auth cookie, JWT token, etc.
  const authToken = request.cookies.get('auth-token')?.value;
  return Boolean(authToken);
}

// Route matching function
function matchesProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(pattern => {
    if (pattern.includes(':')) {
      // Dynamic route matching
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      return regex.test(pathname);
    }
    if (pattern.includes('*')) {
      // Wildcard matching
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(pathname);
    }
    // Exact match
    return pathname === pattern;
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current route is protected
  if (matchesProtectedRoute(pathname)) {
    if (!isAuthenticated(request)) {
      // Redirect to login page
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
`;
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

    // Calculate depth: routePath '/' = depth 0, '/legal/privacy' = depth 2
    const routeDepth =
      routePath === '/' ? 0 : routePath.split('/').filter(Boolean).length;

    // Build relative path: go up from app/**/page.tsx to src/, then into pages/
    // app/page.tsx (depth 0) -> ../pages/HomePage
    // app/legal/privacy/page.tsx (depth 2) -> ../../../pages/legal/PrivacyPage
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
    const appPath = this.convertRouteToAppPath(routePath);
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
