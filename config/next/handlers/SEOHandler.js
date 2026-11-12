/**
 * @fileoverview SEO Handler - Next.js Implementation
 * @description Generates robots.txt and sitemap.xml based on route discovery.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseNextHandler } from './BaseNextHandler.js';
import { nextFileName } from '../nextFiles.js';
import { NEXT_RENDER } from '../../constants.js';
import { RouteDiscovery } from '../../discovery/RouteDiscovery.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';
import {
  assertPublicBaseUrl,
  SEOGenerator,
} from '../../utils/SEOGenerator.js';
import {
  generateLlmsFullTxt,
  getLlmsTxtSource,
} from '../../utils/LlmsTxtGenerator.js';

/**
 * Generated sitemap (`/sitemap.xml`): a route handler, not the `sitemap.ts` metadata
 * convention, which Turbopack ignores under the framework's file marker.
 */
const SITEMAP_ROUTE = `src/app/sitemap.xml/${nextFileName('route', 'ts')}`;

/** Generated llms.txt route (`/llms.txt`). */
const LLMS_TXT_ROUTE = `src/app/llms.txt/${nextFileName('route', 'ts')}`;

/**
 * SEO Handler for Next.js applications
 * Generates robots.txt and sitemap.xml during build process
 */
export class SEOHandler extends BaseNextHandler {
  constructor(options = {}) {
    super(RouteDiscovery, options);
    // Initialize path resolver and logger for discovery
    const pathResolver = PathResolver.getInstance();
    const logger = createLogger(
      'SEO Handler',
      this.options.debug,
      this.options.verbose
    );

    // Get app URL from NEXT_PUBLIC_APP_URL env var (single source of truth)
    // Env files are loaded early in next/config.js via loadEnvFiles()
    const resolvedAppUrl = process.env.NEXT_PUBLIC_APP_URL || null;
    if (resolvedAppUrl && this.options.debug) {
      logger.debug(`Using app URL from NEXT_PUBLIC_APP_URL: ${resolvedAppUrl}`);
    }

    // Resolve baseUrl: explicit > NEXT_PUBLIC_APP_URL > null
    let baseUrl = options.baseUrl;
    if (!baseUrl && resolvedAppUrl) {
      const normalizedAppUrl = resolvedAppUrl.trim().replace(/\/+$/, '');
      const hasScheme = /^https?:\/\//i.test(normalizedAppUrl);
      baseUrl = hasScheme ? normalizedAppUrl : `https://${normalizedAppUrl}`;
    }

    if (baseUrl) {
      logger.debug(`Found app URL: ${baseUrl}`);
    } else {
      logger.warn('Missing app URL. Set NEXT_PUBLIC_APP_URL in .env file.');
    }

    // siteName comes from appConfig.app.name (already extracted in config.js)
    // seoOptions are spread flat by handlerFactory (appConfig.seo + app name)
    const siteName = options.siteName || null;

    // Log configuration values (like PathResolver values)
    logger.verbose(`Name: ${siteName || 'Not found'}`);
    logger.verbose(`URL: ${baseUrl || 'Not found'}`);

    if (siteName) {
      logger.debug(`  - Site name from appConfig: "${siteName}"`);
    }

    // SEO explicitly disabled (appConfig.seo: false): no-op handler
    if (options.disabled === true) {
      logger.info('SEO generation disabled (disabled: true)');
      this.disabled = true;
      return;
    }

    // Validate required configuration
    const missingConfig = [];
    if (!baseUrl) {
      missingConfig.push('baseUrl (NEXT_PUBLIC_APP_URL in .env)');
    }
    if (!siteName) {
      missingConfig.push('siteName (APP_NAME in src/config/app.ts)');
    }

    // If required config is missing, show helpful error and disable handler
    if (missingConfig.length > 0) {
      logger.warn('⚠️  SEO Handler disabled - missing required configuration:');
      missingConfig.forEach((config) => logger.warn(`     - ${config}`));
      logger.warn('');
      logger.warn('   To fix:');
      if (!baseUrl) {
        logger.warn(
          '     1. Add NEXT_PUBLIC_APP_URL=https://yourdomain.com to your .env file'
        );
      }
      if (!siteName) {
        logger.warn('     2. Add APP_NAME export to src/config/app.ts:');
        logger.warn('        export const APP_NAME = "Your App Name";');
      }
      logger.warn('');
      logger.warn('   robots.txt and sitemap.xml will NOT be generated.');
      logger.warn('');

      this.disabled = true;
      return;
    }

    // A production build publishes absolute URLs (sitemap, llms.txt, robots): never localhost
    if (!this.options.isDev) assertPublicBaseUrl(baseUrl, 'NEXT_PUBLIC_APP_URL');

    // Store for llms.txt generation
    this._baseUrl = baseUrl;
    this._siteName = siteName;
    this._siteDescription = options.siteDescription || null;
    this._llmsTxtEnabled = this.options.llmsTxt !== false;
    this._sitemapEnabled = this.options.generateSitemap !== false;

    // Create SEO generator. On Next the sitemap is a generated app/sitemap.xml route
    // (records change without a rebuild), never a static public/sitemap.xml.
    this.seoGenerator = new SEOGenerator({
      debug: this.options.debug,
      generateRobotsTxt: this.options.generateRobotsTxt,
      baseUrl: baseUrl,
      siteName: siteName,
      crawlDelay: this.options.crawlDelay,
      aiCrawlers: this.options.aiCrawlers,
      appRoot: pathResolver.getAppRoot(),
      ...options,
      generateSitemap: false,
    });
  }

  /**
   * Get handler defaults - SEO-specific paths
   */
  getHandlerDefaults() {
    return {
      manifestPath: 'public/seo-manifest.json',
    };
  }

  /**
   * Create Next.js config - returns empty object if disabled
   */
  createNextConfig() {
    if (this.disabled) {
      return () => ({});
    }
    return super.createNextConfig();
  }

  /**
   * Get discovery data - returns empty if disabled
   */
  async getDiscoveryData() {
    if (this.disabled) {
      return { routes: [], errors: [], source: 'disabled' };
    }
    return await this.discovery.discoverRoutes();
  }

  /**
   * Get API rewrites - returns empty if disabled
   */
  getAPIRewrites() {
    if (this.disabled) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  }

  /**
   * Get handler name for logging
   */
  getHandlerName() {
    return 'SEO';
  }

  /**
   * Generate specific SEO files
   */
  async generateSpecificFiles(routeData) {
    // Skip if disabled
    if (this.disabled) {
      return;
    }

    // SEO needs route data - try to load from route manifest if not provided
    if (!routeData || !routeData.routes) {
      try {
        const routeManifestPath = this.pathResolver.resolveAppPath(
          'public/route-manifest.json'
        );
        if (this.pathResolver.pathExists(routeManifestPath)) {
          const manifestContent = await this.pathResolver.read(
            routeManifestPath,
            { format: 'json' }
          );
          routeData = manifestContent;
        } else {
          this.logger.debug(
            'Route manifest not found, skipping SEO file generation'
          );
          return;
        }
      } catch (error) {
        this.logger.debug(
          `Could not load route manifest for SEO: ${error.message}`
        );
        return;
      }
    }

    try {
      // Create Next.js-specific writeFile function
      const writeFile = async (fileName, content) => {
        if (!fileName) {
          this.logger.debug('Skipping SEO file write - fileName is undefined');
          return;
        }
        this.writeGeneratedFile(`public/${fileName}`, content, fileName);
      };

      // Generate all SEO files using shared generator
      const results = await this.seoGenerator.generateSEOFiles(
        routeData,
        writeFile
      );

      if (this._sitemapEnabled) {
        await this.generateSitemapRoute(routeData.routes || []);
      }

      // Log generation results
      if (results.robotsTxt && !results.robotsTxt.skipped) {
        this.logger.info(
          `🤖 robots.txt: ${results.robotsTxt.disallowedPaths || 0} disallowed paths`
        );
      }
      if (results.sitemap && !results.sitemap.skipped) {
        this.logger.info(
          `🗺️ sitemap.xml: ${results.sitemap.publicRoutes || 0} routes`
        );
      }
      if (results.rss && !results.rss.skipped) {
        this.logger.info(
          `📡 rss.xml: ${results.rss.postCount || 0} blog posts`
        );
      }
      if (results.manifest && !results.manifest.skipped) {
        this.logger.info(`📄 seo-manifest.json`);
      }

      // Generate llms.txt (runtime route, same URLs as the sitemap) + llms-full.txt
      if (this._llmsTxtEnabled) {
        const blogPosts = this.seoGenerator.discoverBlogPosts();
        const appRoot = this.pathResolver.getAppRoot();
        await this.generateLlmsTxtRoute(routeData.routes || [], blogPosts);

        // llms-full.txt — full blog content for direct AI consumption
        if (blogPosts.length > 0) {
          const llmsFullContent = generateLlmsFullTxt({
            siteName: this._siteName,
            baseUrl: this._baseUrl,
            description: this._siteDescription,
            appRoot,
            blogPosts,
            logger: this.logger,
          });
          if (llmsFullContent) {
            this.writeGeneratedFile(
              'public/llms-full.txt',
              llmsFullContent,
              'llms-full.txt'
            );
            this.logger.info('📄 llms-full.txt');
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `SEO handler failed to generate files (robots.txt/sitemap.xml): ${error.message}`
      );
      this.logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      // Log error but continue - SEO files are optional, build can proceed without them
    }
  }

  /**
   * Languages of the app, from the i18n discovery (set by runDiscoveries): the
   * sitemap lists every language URL of each page.
   *
   * @param {{ languages: string[], defaultLanguage: string }} routing
   * @since 0.2.3
   */
  useLanguages(routing) {
    this._languageRouting = routing;
  }

  /**
   * Write the Next sitemap route (src/app/sitemap.xml/route.next.ts). It lists the static public
   * routes and, at request time (revalidated hourly), one URL per published record of
   * each dynamic route's entity, once per language URL with 2+ languages. Removes the
   * static public/sitemap.xml this handler wrote before: Next refuses a public file and
   * a route on the same path.
   * @param {Array} routes - Routes from discovery
   */
  async generateSitemapRoute(routes) {
    if (!this._languageRouting) {
      throw new Error(
        'SEO handler: languages not set before sitemap generation (runDiscoveries calls useLanguages)'
      );
    }
    const sitemapRoutes = this.seoGenerator.getSitemapRoutes(
      routes,
      this.seoGenerator.discoverBlogPosts()
    );
    const reader = this.serverCrudReader(sitemapRoutes);
    const content = `// Generated by @donotdev/config - DO NOT EDIT
// Regenerated on every build from src/pages (PageMeta) and appConfig.
// Public routes + one URL per published record of each dynamic route's entity
// (read with the public role). Keep a page out with \`seo: { noindex: true }\`.

import { HIDDEN_STATUSES, languageUrls } from '@donotdev/core/server';
import type { LanguageRouting } from '@donotdev/core/server';
import { buildSitemap, formatSitemapXml } from '@donotdev/core/next';
import type { SitemapRoute } from '@donotdev/core/next';
${reader.imports}
// Re-read published records at most once per cache lifetime (same as the pages).
export const revalidate = ${NEXT_RENDER.revalidateSeconds};

const BASE_URL = ${JSON.stringify(this._baseUrl)};

const LANGUAGE_ROUTING: LanguageRouting = ${JSON.stringify(this._languageRouting)};

const ROUTES: SitemapRoute[] = ${JSON.stringify(sitemapRoutes, null, 2)};
${reader.setup}
export async function GET(): Promise<Response> {
  const entries = await buildSitemap(ROUTES, {
    baseUrl: BASE_URL,
    routing: LANGUAGE_ROUTING,
    languageUrls,
    hiddenStatuses: HIDDEN_STATUSES,${reader.expr ? `\n    crud: ${reader.expr},` : ''}
  });
  return new Response(formatSitemapXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
`;
    this.writeGeneratedFile(SITEMAP_ROUTE, content, 'sitemap route');

    const staleSitemap = this.pathResolver.resolveAppPath('public/sitemap.xml');
    if (this.pathResolver.pathExists(staleSitemap)) {
      await this.pathResolver.remove(staleSitemap);
    }
    this.logger.info(
      `🗺️ sitemap: ${sitemapRoutes.length} routes (${SITEMAP_ROUTE})`
    );
  }

  /**
   * i18n discovery content (namespace → language → JSON), set by runDiscoveries:
   * llms.txt labels pages and sections in the app's language.
   *
   * @param {Record<string, Record<string, Object>>} translations
   * @since 0.2.3
   */
  useTranslations(translations) {
    this._translations = translations;
  }

  /**
   * Write the Next llms.txt route (src/app/llms.txt/route.next.ts). Same routes as the
   * sitemap route, labelled at build in the app's default language; at request time
   * (revalidated hourly) each entity route lists its published records with the title
   * and description of `deriveEntitySeo`. The app's `entities` package provides the
   * entity definitions.
   *
   * @param {Array} routes - Routes from discovery
   * @param {Array} blogPosts - Discovered blog posts
   * @since 0.2.3
   */
  async generateLlmsTxtRoute(routes, blogPosts) {
    if (!this._languageRouting || !this._translations) {
      throw new Error(
        'SEO handler: languages/translations not set before llms.txt generation (runDiscoveries calls useLanguages and useTranslations)'
      );
    }
    const source = getLlmsTxtSource({
      siteName: this._siteName,
      description: this._siteDescription,
      baseUrl: this._baseUrl,
      sitemapRoutes: this.seoGenerator.getSitemapRoutes(routes, blogPosts),
      routes,
      blogPosts,
      blogPath: this.seoGenerator.options.blogPath,
      translations: this._translations,
      language: this._languageRouting.defaultLanguage,
    });
    const reader = this.serverCrudReader(source.routes);
    const hasEntities = this.appDependsOn('entities');
    const content = `// Generated by @donotdev/config - DO NOT EDIT
// Regenerated on every build from src/pages (PageMeta), translations and appConfig.
// Same URLs as app/sitemap.xml: public pages + one link per published record of each
// dynamic route's entity. Keep a page out with \`seo: { noindex: true }\`.

import { HIDDEN_STATUSES, deriveEntitySeo } from '@donotdev/core/server';
import { buildLlmsTxt } from '@donotdev/core/next';
import type { LlmsTxtSource } from '@donotdev/core/next';
${hasEntities ? "import * as entities from 'entities';\n" : ''}${reader.imports}
// Re-read published records at most once an hour (same as the sitemap).
export const revalidate = ${NEXT_RENDER.revalidateSeconds};

const SOURCE: LlmsTxtSource = ${JSON.stringify(source, null, 2)};
${reader.setup}
export async function GET(): Promise<Response> {
  const body = await buildLlmsTxt({
    ...SOURCE,
    entities: ${hasEntities ? 'entities' : '{}'},
    deriveEntitySeo,
    hiddenStatuses: HIDDEN_STATUSES,${reader.expr ? `\n    crud: ${reader.expr},` : ''}
  });
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
`;
    this.writeGeneratedFile(LLMS_TXT_ROUTE, content, 'llms.txt route');
    this.logger.info(
      `📄 llms.txt: ${source.routes.length} routes (${LLMS_TXT_ROUTE})`
    );
  }

  /**
   * Whether the app's package.json lists a dependency.
   * @param {string} name
   * @returns {boolean}
   */
  appDependsOn(name) {
    const pkg = this.pathResolver.readSync(
      this.pathResolver.resolveAppPath('package.json'),
      { format: 'json' }
    );
    return Boolean(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
  }

  /**
   * Server-side public reader for a generated SEO route: built from the app's provider
   * package and its public env variables, never from the app's client bootstrap
   * (src/config/providers.ts loads client code). Only when a route lists records.
   *
   * @param {Array<{ path: string, collection?: string }>} routes - Routes of the generated file
   * @returns {{ imports: string, setup: string, expr: string | null }} Code to insert
   * @throws {Error} When a route lists records and the app's provider has no server reader
   * @since 0.2.3
   */
  serverCrudReader(routes) {
    const listing = routes.filter((route) => route.collection);
    if (listing.length === 0) return { imports: '', setup: '', expr: null };
    if (this.appDependsOn('@donotdev/supabase')) {
      return {
        imports:
          "import { createPublicServerClient, SupabaseCrudAdapter } from '@donotdev/supabase/server';\n",
        setup: `
// Public (anonymous) reader: RLS returns what a signed-out visitor can read.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;
if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
  throw new Error(
    '[dndev] Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: the sitemap and llms.txt list published records.'
  );
}
const CRUD = new SupabaseCrudAdapter(
  createPublicServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY)
);
`,
        expr: 'CRUD',
      };
    }
    throw new Error(
      `[dndev] SEO: ${listing.map((route) => route.path).join(', ')} list published records, but the app's ` +
        'backend provider has no server reader (supported: @donotdev/supabase). Mark these pages `seo: { noindex: true }`.'
    );
  }

  /**
   * Create manifest content
   */
  createManifestContent(seoData) {
    if (this.disabled) {
      return {};
    }
    return this.seoGenerator.formatAPIResponse(seoData);
  }

  /**
   * Format API response
   */
  formatAPIResponse(seoData) {
    if (this.disabled) {
      return {};
    }
    return this.seoGenerator.formatAPIResponse(seoData);
  }

  /**
   * Get generation summary for logging
   */
  getGenerationSummary(seoData) {
    if (this.disabled) {
      return 'SEO disabled';
    }
    const routes = seoData?.routes || [];
    return `${routes.length} routes processed for SEO`;
  }
}

// Export factory function for easier usage
export function createNextSEOHandler(options = {}) {
  return new SEOHandler(options);
}
