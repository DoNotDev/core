/**
 * @fileoverview SEO Handler - Next.js Implementation
 * @description Generates robots.txt and sitemap.xml based on route discovery.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseNextHandler } from './BaseNextHandler.js';
import { RouteDiscovery } from '../../discovery/RouteDiscovery.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { SEOGenerator } from '../../utils/SEOGenerator.js';
import {
  generateLlmsTxt,
  generateLlmsFullTxt,
} from '../../utils/LlmsTxtGenerator.js';

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
    let baseUrl = options.seo?.baseUrl;
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
    // Check options.siteName first (when seoOptions are spread), then options.seo.siteName (legacy)
    const siteName = options.siteName || options.seo?.siteName || null;

    // Log configuration values (like PathResolver values)
    logger.verbose(`Name: ${siteName || 'Not found'}`);
    logger.verbose(`URL: ${baseUrl || 'Not found'}`);

    if (siteName) {
      logger.debug(`  - Site name from appConfig: "${siteName}"`);
    }

    // If SEO is explicitly disabled, create a no-op handler
    if (options.seo?.disabled === true) {
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

    // Store for llms.txt generation
    this._baseUrl = baseUrl;
    this._siteName = siteName;
    this._siteDescription = options.siteDescription || null;
    this._llmsTxtEnabled = this.options.llmsTxt !== false;

    // Create SEO generator
    this.seoGenerator = new SEOGenerator({
      debug: this.options.debug,
      generateRobotsTxt: this.options.generateRobotsTxt,
      generateSitemap: this.options.generateSitemap,
      baseUrl: baseUrl,
      siteName: siteName,
      crawlDelay: this.options.crawlDelay,
      aiCrawlers: this.options.aiCrawlers,
      appRoot: pathResolver.getAppRoot(),
      ...options,
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

      // Generate llms.txt + llms-full.txt
      if (this._llmsTxtEnabled) {
        const blogPosts = this.seoGenerator.discoverBlogPosts();
        const appRoot = this.pathResolver.getAppRoot();
        const llmsContent = generateLlmsTxt({
          siteName: this._siteName,
          baseUrl: this._baseUrl,
          description: this._siteDescription,
          appRoot,
          blogPosts,
          logger: this.logger,
        });
        if (llmsContent) {
          this.writeGeneratedFile('public/llms.txt', llmsContent, 'llms.txt');
          this.logger.info('📄 llms.txt');
        }

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
