/**
 * @fileoverview SEO Plugin - Build-time File Generation
 * @description Generates robots.txt and sitemap.xml during build process based on discovered routes.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { loadEnv } from 'vite';

import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { SEOGenerator } from '../../utils/SEOGenerator.js';
import {
  generateLlmsTxt,
  generateLlmsFullTxt,
} from '../../utils/LlmsTxtGenerator.js';
import { parseRouteManifest } from '../../utils/routeParser.js';

/**
 * Create Vite SEO plugin
 * @param {Object} options - Plugin options
 * @returns {Object} Vite plugin
 */
export function createViteSEOPlugin(options = {}) {
  // Trust merged config - all defaults come from DEFAULT_OPTIONS.seo
  const {
    disabled = false, // Already merged from DEFAULT_OPTIONS.seo (opt-out: default false)
    debug, // Already merged from config
    generateRobotsTxt, // Already merged from DEFAULT_OPTIONS.seo
    generateSitemap, // Already merged from DEFAULT_OPTIONS.seo
    routes: routeOptions = {},
    baseUrl,
    siteName,
    siteDescription, // From appConfig.app.description (optional)
    crawlDelay, // Already merged from DEFAULT_OPTIONS.seo
    aiCrawlers, // Already merged from DEFAULT_OPTIONS.seo
    llmsTxt = true, // Already merged from DEFAULT_OPTIONS.seo
    redirects: seoRedirects, // From appConfig.seo.redirects
    isDev,
    ...pluginOptions
  } = options;

  if (disabled) {
    return { name: 'seo-disabled' };
  }

  // Initialize utilities
  const logger = createLogger('SEO Plugin', debug, true);
  const pathResolver = PathResolver.getInstance();

  // Deferred resolution - will happen in configResolved hook after env vars are loaded
  // These are runtime state, populated from config/environment, not defaults
  let resolvedSiteName = null; // Will be populated from config/environment
  let resolvedBaseUrl = null; // Will be populated from config/environment
  let isDisabled = false; // Runtime state flag

  // Route parsing delegated to shared routeParser.js

  return {
    name: 'vite-seo-plugin',
    enforce: 'pre',

    configResolved(config) {
      // appRoot already set in pluginsConfig.js via sharedPathResolver.setAppRoot()
      const appRoot = pathResolver.getAppRoot();

      // Explicitly load env vars using Vite's loadEnv
      // This ensures .env.production is loaded even when Vite config runs before env population
      const mode = config.mode || 'production';
      const loadedEnv = loadEnv(mode, appRoot, 'VITE_');

      // Read URL from loaded environment (priority: loadEnv > process.env)
      const resolvedAppUrl =
        loadedEnv.VITE_APP_URL || process.env.VITE_APP_URL || null;
      if (resolvedAppUrl && debug) {
        logger.debug(`Using app URL from VITE_APP_URL: ${resolvedAppUrl}`);
      }

      // siteName comes from appConfig.app.name (already extracted in config.js)
      resolvedSiteName = siteName || null;
      const rawBaseUrl = baseUrl || resolvedAppUrl || null;
      resolvedBaseUrl = rawBaseUrl
        ? rawBaseUrl.trim().replace(/\/+$/, '')
        : null;

      // Log configuration values (like PathResolver values)
      logger.verbose(`Name: ${resolvedSiteName || 'Not found'}`);
      logger.verbose(`URL: ${resolvedBaseUrl || 'Not found'}\n`);

      if (resolvedSiteName) {
        logger.debug(`  - Site name from appConfig: "${resolvedSiteName}"`);
      }

      // Validate required configuration
      const missingConfig = [];
      if (!resolvedBaseUrl) {
        missingConfig.push('baseUrl (VITE_APP_URL in .env)');
      }
      if (!resolvedSiteName) {
        missingConfig.push('siteName (APP_NAME in src/config/app.ts)');
      }

      // If required config is missing, disable plugin
      if (missingConfig.length > 0) {
        isDisabled = true;
        logger.warn(
          '⚠️  SEO Plugin disabled - missing required configuration:'
        );
        missingConfig.forEach((cfg) => logger.warn(`     - ${cfg}`));
        logger.warn('');
        logger.warn('   To fix:');
        if (!resolvedBaseUrl) {
          logger.warn(
            '     1. Add VITE_APP_URL=https://yourdomain.com to your .env file'
          );
        }
        if (!resolvedSiteName) {
          logger.warn('     2. Add APP_NAME export to src/config/app.ts:');
          logger.warn('        export const APP_NAME = "Your App Name";');
        }
        logger.warn('');
        logger.warn('   robots.txt and sitemap.xml will NOT be generated.');
        logger.warn('');
        return;
      }

      logger.debug(`Generate robots.txt: ${generateRobotsTxt}`);
      logger.debug(`Generate sitemap: ${generateSitemap}`);
    },

    async generateBundle() {
      // Early return if disabled
      if (isDisabled) {
        return;
      }
      try {
        // Create SEO generator with resolved values
        const seoGenerator = new SEOGenerator({
          debug,
          generateRobotsTxt,
          generateSitemap,
          baseUrl: resolvedBaseUrl,
          siteName: resolvedSiteName,
          crawlDelay,
          aiCrawlers,
          routes: routeOptions,
          appRoot: pathResolver.getAppRoot(),
          ...pluginOptions,
        });

        // Parse already-generated routes instead of re-running discovery
        const routeData = parseRouteManifest({
          appRoot: pathResolver.getAppRoot(),
          logger,
        });

        // Create Vite-specific writeFile function
        const writeFile = async (fileName, content) => {
          this.emitFile({
            type: 'asset',
            fileName,
            source: content,
          });
        };

        // Generate all SEO files using shared generator
        const results = await seoGenerator.generateSEOFiles(
          routeData,
          writeFile
        );

        // Log generation results
        if (results.robotsTxt && !results.robotsTxt.skipped) {
          logger.info(
            `🤖 robots.txt: ${results.robotsTxt.disallowedPaths || 0} disallowed paths`
          );
        }
        if (results.sitemap && !results.sitemap.skipped) {
          logger.info(
            `🗺️ sitemap.xml: ${results.sitemap.publicRoutes || 0} routes`
          );
        }
        if (results.rss && !results.rss.skipped) {
          logger.info(`📡 rss.xml: ${results.rss.postCount || 0} blog posts`);
        }
        if (results.manifest && !results.manifest.skipped) {
          logger.info(`📄 seo-manifest.json`);
        }

        // Generate llms.txt + llms-full.txt
        if (llmsTxt) {
          const appRoot = pathResolver.getAppRoot();
          const blogPosts = seoGenerator.discoverBlogPosts();
          const llmsContent = generateLlmsTxt({
            siteName: resolvedSiteName,
            baseUrl: resolvedBaseUrl,
            description: siteDescription,
            appRoot,
            blogPosts,
            logger,
          });
          if (llmsContent) {
            await writeFile('llms.txt', llmsContent);
            logger.info('📄 llms.txt');
          }

          // llms-full.txt — full blog content for direct AI consumption
          if (blogPosts.length > 0) {
            const llmsFullContent = generateLlmsFullTxt({
              siteName: resolvedSiteName,
              baseUrl: resolvedBaseUrl,
              description: siteDescription,
              appRoot,
              blogPosts,
              logger,
            });
            if (llmsFullContent) {
              await writeFile('llms-full.txt', llmsFullContent);
              logger.info('📄 llms-full.txt');
            }
          }
        }

        // Generate _redirects file for static hosting (Netlify/Vercel/CF Pages)
        if (seoRedirects?.length > 0) {
          const seenSources = new Set();
          const validRedirects = [];
          for (const { from, to, permanent } of seoRedirects) {
            const normalizedFrom = from.replace(/\/+$/, '') || '/';
            const normalizedTo = to.replace(/\/+$/, '') || '/';
            if (normalizedFrom === normalizedTo) {
              logger.warn(`Redirect loop detected: ${from} → ${to} (skipped)`);
              continue;
            }
            if (!from.startsWith('/')) {
              logger.warn(
                `Redirect source must start with /: "${from}" (skipped)`
              );
              continue;
            }
            if (seenSources.has(normalizedFrom)) {
              logger.warn(`Duplicate redirect source: "${from}" (skipped)`);
              continue;
            }
            seenSources.add(normalizedFrom);
            validRedirects.push(
              `${from}  ${to}  ${permanent === false ? 302 : 301}`
            );
          }

          if (validRedirects.length > 0) {
            await writeFile('_redirects', validRedirects.join('\n') + '\n');
            logger.info(
              `📎 _redirects: ${validRedirects.length} redirect${validRedirects.length > 1 ? 's' : ''}`
            );
          }
        }
      } catch (error) {
        logger.error(
          `SEO plugin failed to generate files (robots.txt/sitemap.xml): ${error.message}`
        );
        logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
        // Log error but continue - SEO files are optional, build can proceed without them
      }
    },
  };
}
