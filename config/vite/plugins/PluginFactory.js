/**
 * @fileoverview PluginFactory - Single Plugin Factory for All Discovery Plugins
 * @description Provides a unified factory pattern for creating Vite discovery plugins. Eliminates duplicate virtual module, HMR, and template patterns across plugins.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { TemplateEngine } from '../../discovery/TemplateEngine.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { expandBlogRoutes } from '../../utils/routeParser.js';
import { DEFAULT_OPTIONS } from '../options.js';

/**
 * Factory for creating discovery-based Vite plugins
 * @param {Object} config - Plugin configuration
 * @returns {Function} Plugin creator function
 */
export function createDiscoveryPlugin(config) {
  const {
    pluginName,
    icon,
    virtualModuleId,
    DiscoveryClass,
    discoveryMethod,
    filePatterns,
    templates,
    manifestFileName,
    createDiscovery,
    discoveryOptions: pluginDiscoveryOptions = {}, // Extract discoveryOptions from plugin config
    configKey, // Optional: explicit config key (e.g., 'routes', 'themes'). If not provided, extracted from pluginName
  } = config;

  return function createPlugin(options = {}) {
    // Trust merged config - defaults come from DEFAULT_OPTIONS.pluginFactory
    // Plugin factory is always enabled (not optional)
    const {
      debug, // Already merged from config (cascaded)
      verbose, // Already merged from config (cascaded)
      virtualModuleId: customVirtualId = virtualModuleId, // Plugin-specific, not config
      // HMR optimization options - already merged from DEFAULT_OPTIONS.pluginFactory
      hmrDebounceMs, // Already merged from DEFAULT_OPTIONS.pluginFactory
      hmrCacheTimeout, // Already merged from DEFAULT_OPTIONS.pluginFactory
      hmrSmartDetection, // Already merged from DEFAULT_OPTIONS.pluginFactory
      disableHmr, // Already merged from DEFAULT_OPTIONS.pluginFactory
      ...userDiscoveryOptions
    } = options;

    // Validate templates
    if (!TemplateEngine.validateTemplates(templates)) {
      throw new Error(`Invalid templates for plugin ${pluginName}`);
    }

    // Merge discovery options with defaults from config
    // Priority: user options > plugin config discoveryOptions > DEFAULT_OPTIONS.discovery
    // Use DEFAULT_OPTIONS.discovery as base to ensure single source of truth
    const mergedDiscoveryOptions = {
      ...DEFAULT_OPTIONS.discovery, // Base discovery defaults from config
      ...pluginDiscoveryOptions, // Plugin-specific discovery options from plugin config
      debug, // Cascaded from global debug (overrides discovery.debug)
      verbose, // Cascaded from global verbose (overrides discovery.verbose)
      ...userDiscoveryOptions, // User-provided discovery options override everything
    };

    // Extract config key from plugin name or use explicit configKey
    // Pattern: 'dndev-vite-{key}-discovery' → 'key'
    // Matches Next.js pattern: getHandlerName().toLowerCase()
    const resolvedConfigKey =
      configKey ||
      (() => {
        const match = pluginName.match(/dndev-vite-(\w+)-discovery/);
        return match ? match[1] : null;
      })();

    // Initialize utilities
    const logger = createLogger(pluginName, debug, verbose, {
      fileLogging: mergedDiscoveryOptions.fileLogging, // Already merged from config
      logDir: mergedDiscoveryOptions.logDir, // Already merged from config
    });
    const pathResolver = PathResolver.getInstance();

    // Track if configResolved has run (ensures appRoot is set)
    // Check appRoot directly instead of per-plugin flag to ensure it's actually set
    const isAppRootReady = () => {
      const appRoot = pathResolver.getAppRoot();
      const repoRoot = pathResolver.getRepoRoot();
      return appRoot && appRoot !== repoRoot;
    };

    // ===================================================================
    // TIER 3 LOGGING - DEBUG (Detailed timing information)
    // ===================================================================
    const discoveryStartTime = Date.now();
    const discovery = createDiscovery
      ? createDiscovery(pathResolver, mergedDiscoveryOptions)
      : new DiscoveryClass(pathResolver, mergedDiscoveryOptions);

    // Virtual module setup
    let resolvedVirtualModuleId = '\0' + customVirtualId;
    // Runtime state - populated from config/environment, not defaults
    let configRoot = ''; // Will be populated from Vite config
    let isDevMode = false; // Will be populated from Vite config

    // HMR optimization state - runtime tracking, not config
    let hmrDebounceTimer = null;
    let lastHmrUpdate = 0;
    let pendingHmrUpdate = false;
    let lastDiscoveryData = null;
    let isHmrInProgress = false; // Prevent infinite HMR loops
    let lastProcessedFile = null; // Track last processed file to prevent same-file loops
    let isDiscoveryComplete = false; // Prevent HMR during discovery

    // Expose cache clearing for dev tools
    if (typeof global !== 'undefined') {
      global.__DNDEV_CLEAR_CACHE__ = () => {
        discovery.clearCache();
        lastDiscoveryData = null;
        logger.info('Discovery cache cleared manually');
        return 'Cache cleared';
      };
    }

    /**
     * Generate virtual module content using provided templates
     */
    function generateVirtualModule(data) {
      const moduleCode = TemplateEngine.generateVirtualModule(
        data,
        templates,
        debug,
        mergedDiscoveryOptions,
        resolvedConfigKey
      );

      // Fix production mode detection in all virtual modules
      let finalCode = moduleCode.replace(
        /mode:\s*['"]development['"]/g,
        "mode: typeof process !== 'undefined' && process.env.NODE_ENV === 'production' ? 'production' : 'development'"
      );

      // Add HMR boundary if HMR is enabled and in dev mode
      if (!disableHmr && isDevMode) {
        finalCode += `\n\n// HMR boundary for ${pluginName}\nif (import.meta.hot) {\n  import.meta.hot.accept();\n}\n`;
      }

      return finalCode;
    }

    /**
     * File change detection - trigger only for current app's src files
     */
    function isRelevantFileChange(filePath) {
      const normalized = filePath.replace(/\\/g, '/');

      // If HMR is disabled for this discovery plugin, never treat as relevant
      if (disableHmr) return false;

      // System and build artifacts exclusions
      if (
        normalized.includes('/node_modules/') ||
        normalized.includes('/.git/') ||
        normalized.includes('/dist/') ||
        normalized.includes('/build/') ||
        normalized.includes('/coverage/') ||
        normalized.includes('/.vite/') ||
        normalized.includes('/.turbo/') ||
        normalized.endsWith('.d.ts') ||
        normalized.endsWith('.tsbuildinfo') ||
        normalized.endsWith('.map') ||
        normalized.endsWith('.css.map') ||
        normalized.endsWith('.generated.log') ||
        /\.generated\.[a-z]+$/.test(normalized)
      ) {
        return false;
      }

      // Compute path relative to the current Vite app root
      const relativeToProject = pathResolver.getRelativePath(normalized);

      // Exclude any framework package source from triggering HMR
      if (relativeToProject.startsWith('packages/')) {
        return false;
      }

      // Only allow changes within the current app's src directory
      const isInAppSrc =
        relativeToProject.startsWith('src/') &&
        /\.(ts|tsx)$/.test(relativeToProject);

      if (!isInAppSrc) {
        return false;
      }

      // Respect plugin-specific filePatterns (functions or string patterns)
      if (Array.isArray(filePatterns) && filePatterns.length > 0) {
        return filePatterns.some((p) => {
          if (typeof p === 'function') return p(normalized);
          if (typeof p === 'string') {
            if (p.startsWith('**/')) return normalized.endsWith(p.slice(3));
            return normalized.endsWith(p);
          }
          return false;
        });
      }

      return isInAppSrc;
    }

    /**
     * Debounced HMR update handler
     */
    function handleHmrUpdate(ctx) {
      // Virtual modules are static - no HMR needed
      if (disableHmr) {
        logger.debug('Virtual modules are static - HMR disabled');
        return [];
      }

      const now = Date.now();

      // Prevent infinite HMR loops
      if (isHmrInProgress) {
        logger.debug('HMR already in progress, skipping update');
        return [];
      }

      // Check if we should skip this update
      if (now - lastHmrUpdate < hmrDebounceMs) {
        if (!pendingHmrUpdate) {
          pendingHmrUpdate = true;
          hmrDebounceTimer = setTimeout(() => {
            pendingHmrUpdate = false;
            lastHmrUpdate = Date.now();
            performHmrUpdate(ctx);
          }, hmrDebounceMs);
        }
        return [];
      }

      lastHmrUpdate = now;
      return performHmrUpdate(ctx);
    }

    /**
     * Perform the actual HMR update
     */
    function performHmrUpdate(ctx) {
      // Prevent rapid same-file loops (within 100ms window)
      const now = Date.now();
      if (lastProcessedFile === ctx.file && now - lastHmrUpdate < 100) {
        logger.debug(`Same file processed too recently: ${ctx.file}`);
        return [];
      }

      if (!isRelevantFileChange(ctx.file)) {
        logger.debug(`Skipping irrelevant file change: ${ctx.file}`);
        return [];
      }

      logger.debug(`Relevant file changed: ${ctx.file}`);
      isHmrInProgress = true;
      lastProcessedFile = ctx.file;

      try {
        // Check if we can use cached data
        const cacheAge = Date.now() - (lastDiscoveryData?.timestamp || 0);
        if (cacheAge < hmrCacheTimeout && lastDiscoveryData) {
          logger.debug(`Using cached discovery data (age: ${cacheAge}ms)`);
          // Just reload the virtual module with cached data
          const module = ctx.server.moduleGraph.getModuleById(
            resolvedVirtualModuleId
          );
          if (module) {
            ctx.server.reloadModule(module);
          }
          return [];
        }

        // Clear cache and perform fresh discovery
        discovery.clearCache();

        // Reload virtual module
        const module = ctx.server.moduleGraph.getModuleById(
          resolvedVirtualModuleId
        );
        if (module) {
          ctx.server.reloadModule(module);
        }

        return [];
      } finally {
        // Reset HMR guard - allow subsequent updates
        isHmrInProgress = false;
        // Reset lastProcessedFile after a short delay to allow legitimate re-updates
        setTimeout(() => {
          if (lastProcessedFile === ctx.file) {
            lastProcessedFile = null;
          }
        }, 200);
      }
    }

    // Return Vite plugin
    return {
      name: pluginName,
      enforce: 'pre',

      configResolved(config) {
        configRoot = config.root;

        // Detect dev mode for optimization
        isDevMode = config.command === 'serve';

        // ===================================================================
        // TIER 3 LOGGING - DEBUG (Plugin initialization details)
        // ===================================================================
        if (debug) {
          logger.debug(`${icon} ${pluginName} initialized`);
        }

        // Add dev mode cache clearing instructions (debug only)
        if (isDevMode) {
          logger.debug(
            `💡 Dev mode: Press 'r' in terminal to restart, or use global.__DNDEV_CLEAR_CACHE__() in console`
          );
        }

        if (templates.logConfig) {
          templates.logConfig(mergedDiscoveryOptions);
        }

        // Discovery runs in buildStart() (production) or lazily on first load() (dev).
        // No early discovery here — configResolved fires before buildStart,
        // and buildStart already forces discovery with the correct timing.
      },

      config(config) {
        // Exclude virtual module from dependency optimization
        if (!config.optimizeDeps) config.optimizeDeps = {};
        if (!config.optimizeDeps.exclude) config.optimizeDeps.exclude = [];
        if (!config.optimizeDeps.exclude.includes(customVirtualId)) {
          config.optimizeDeps.exclude.push(customVirtualId);
        }
        return config;
      },

      resolveId(id) {
        if (id === customVirtualId) {
          logger.debug(`Resolving virtual module: ${id}`);
          return {
            id: resolvedVirtualModuleId,
            moduleSideEffects: true,
          };
        }
        return null;
      },

      async load(id) {
        if (id !== resolvedVirtualModuleId) return null;

        logger.debug(`Loading virtual module: ${id}`);

        // CRITICAL: Wait for appRoot to be set before running discovery
        // load() can run before configResolved if virtual module is imported early
        if (!isAppRootReady()) {
          logger.warn(
            `⚠️  load() called before appRoot is set - waiting for config resolution`
          );
          // Wait for appRoot to be set (with timeout)
          let waitCount = 0;
          while (!isAppRootReady() && waitCount < 100) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            waitCount++;
          }
          if (!isAppRootReady()) {
            throw new Error(
              'App root not set before discovery. Ensure configResolved hook has set appRoot.'
            );
          }
        }

        try {
          // Use cached discovery data if available (build-time safe)
          let data;
          if (lastDiscoveryData) {
            logger.debug(`Using cached discovery data for virtual module`);
            data = lastDiscoveryData;
          } else {
            // This should rarely happen - discovery should run in buildStart first
            logger.warn(
              `⚠️  No cached discovery data found for ${pluginName} - running discovery in load() hook. ` +
                `This may indicate buildStart() hook did not run or failed. ` +
                `Performance may be impacted.`
            );
            // Pass envDir to discovery methods (EnvDiscovery uses it for loadEnv)
            data = await discovery[discoveryMethod]();
            lastDiscoveryData = data;
            logger.debug(`Discovery completed for virtual module`);
          }

          const moduleCode = generateVirtualModule(data);

          // ❌ REMOVED: logStats already called in buildStart() - don't duplicate!

          return moduleCode;
        } catch (error) {
          logger.error(
            `${pluginName} virtual module (${resolvedVirtualModuleId}) failed to load: ${error.message}`
          );
          logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
          // Return empty module to prevent app from hanging, but log the failure clearly
          return templates.generateEmpty(
            {},
            debug,
            mergedDiscoveryOptions,
            resolvedConfigKey
          );
        }
      },

      async buildStart() {
        isDiscoveryComplete = false; // Disable HMR during discovery

        // CRITICAL: Wait for appRoot to be set before running discovery
        // buildStart should run after configResolved, but we guard just in case
        if (!isAppRootReady()) {
          logger.warn(
            `⚠️  buildStart() called before appRoot is set - waiting for config resolution`
          );
          // Wait for appRoot to be set (with timeout)
          let waitCount = 0;
          while (!isAppRootReady() && waitCount < 100) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            waitCount++;
          }
          if (!isAppRootReady()) {
            throw new Error(
              'App root not set before discovery. Ensure configResolved hook has set appRoot.'
            );
          }
        }

        try {
          // Store the discovery data for virtual modules to use
          // Only force discovery if we don't have cached data
          const data = await discovery[discoveryMethod](!lastDiscoveryData);
          lastDiscoveryData = data;

          // Write canonical JSON route manifest to public/ for build-time consumers
          // (SEOPlugin, PrerenderPlugin, LlmsTxtGenerator all read public/route-manifest.json)
          if (manifestFileName && configKey === 'routes' && data?.routes) {
            try {
              // Expand dynamic blog routes with frontmatter SEO metadata
              const blogRoutes = expandBlogRoutes(data.routes, {
                appRoot: pathResolver.getAppRoot(),
              });

              const allRoutes = [
                ...data.routes.map((route) => ({
                  path: route.path,
                  auth: route.auth,
                  meta: route.meta,
                })),
                ...blogRoutes,
              ];

              const manifest = {
                routes: allRoutes,
                source: data.source || 'auto-discovery',
                totalRoutes: allRoutes.length,
                generatedAt: new Date().toISOString(),
              };
              const manifestPath = pathResolver.resolveAppPath(
                `public/${manifestFileName}`
              );
              await pathResolver.write(
                manifestPath,
                JSON.stringify(manifest, null, 2)
              );
              logger.debug(
                `Generated route manifest: public/${manifestFileName}`
              );
            } catch (manifestError) {
              logger.error(
                `Failed to write route manifest: ${manifestError.message}`
              );
            }
          }

          // ===================================================================
          // TIER 1 LOGGING - ALWAYS SHOWN (Discovery summaries - business metrics)
          // Show WHAT was found (counts, summaries) - these are always shown
          // ===================================================================
          if (templates.logStats) {
            templates.logStats(data, icon, logger);
          }
        } catch (error) {
          logger.error(
            `${pluginName} discovery failed during file scanning: ${error.message}`
          );
          logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
          // Use DRY utility from TemplateEngine for consistent error handling
          // generateEmpty() returns module code (string), not data object
          lastDiscoveryData = TemplateEngine.getEmptyResultWithError(
            discovery,
            error
          );
        } finally {
          isDiscoveryComplete = true; // Enable HMR after discovery completes
        }
      },

      configureServer() {
        // Discovery completed in buildStart() - HMR is now enabled
        // Only routes plugin will rerun discovery via HMR when new pages are added
        isDiscoveryComplete = true; // Ensure HMR is enabled after server configures
      },

      handleHotUpdate(ctx) {
        if (disableHmr) return [];
        // Prevent HMR during discovery - only watch after discovery completes
        if (!isDiscoveryComplete) {
          logger.debug(`HMR disabled - discovery not complete yet`);
          return [];
        }
        return handleHmrUpdate(ctx);
      },

      generateBundle() {
        // Generate manifest for production using cached data from buildStart
        if (!lastDiscoveryData) {
          logger.warn(
            `No cached discovery data for manifest generation - skipping`
          );
          return;
        }

        try {
          const manifest = TemplateEngine.generateManifest(
            lastDiscoveryData,
            templates.generateManifest
          );

          this.emitFile({
            type: 'asset',
            fileName: manifestFileName,
            source: JSON.stringify(manifest, null, 2),
          });

          // ===================================================================
          // TIER 2 LOGGING - VERBOSE (Manifest generation summary)
          // ===================================================================
          if (verbose && templates.logManifest) {
            templates.logManifest(lastDiscoveryData, pluginName);
          }
        } catch (error) {
          logger.error(
            `${pluginName} manifest generation failed: ${error.message}`
          );
          logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
          // Log error but continue - manifest is optional, build can proceed without it
        }
      },

      // Ensure virtual module is included in production bundle
      transform(code, id) {
        // Force include virtual module in production builds
        if (id === resolvedVirtualModuleId) {
          return {
            code,
            map: null,
          };
        }
        return null;
      },
    };
  };
}

/**
 * Template helpers for common patterns - Re-exported from TemplateEngine
 */
export const TemplateHelpers = {
  generateGlobals: TemplateEngine.generateGlobals,
  generateExports: TemplateEngine.generateExports,
  generateDefaultExport: TemplateEngine.generateDefaultExport,
  wrapVirtualModule: TemplateEngine.wrapVirtualModule,
  generateInspectionHeader: TemplateEngine.generateInspectionHeader,
  validateTemplates: TemplateEngine.validateTemplates,
  createTemplateConfig: TemplateEngine.createTemplateConfig,
};

/**
 * Create a plugin factory with configuration
 * @param {Object} factoryConfig - Factory configuration
 * @returns {Function} Plugin factory function
 */
export function createPluginFactory(factoryConfig) {
  return function createPluginWithTemplates(options = {}) {
    const { templates, ...pluginOptions } = options;

    if (!templates) {
      throw new Error(
        `Templates must be provided for ${factoryConfig.pluginName}`
      );
    }

    return createDiscoveryPlugin({
      ...factoryConfig,
      templates,
    })(pluginOptions);
  };
}
