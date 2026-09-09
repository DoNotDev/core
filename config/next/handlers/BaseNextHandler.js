/**
 * @fileoverview Base Next.js Handler - Platform Adapter Foundation
 * @description Common patterns for transforming discovery data into Next.js compatible format.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { GENERATED_PATHS, CONFIG_KEYS } from '../../constants.js';
import { DEFAULT_OPTIONS } from '../../next/options.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

export class BaseNextHandler {
  constructor(discoveryClass, defaultOptions = {}) {
    // Trust merged config - no local defaults override.
    // getHandlerDefaults() is spread FIRST so it only fills gaps: spreading it last
    // let a hardcoded default silently beat an explicit app setting. That is how an
    // app declaring i18n.fallbackLanguage: 'fr' still shipped <html lang="en">,
    // which disables French hyphenation and mislabels the page for screen readers
    // and crawlers.
    this.options = {
      ...this.getHandlerDefaults(), // Handler-specific fallbacks
      ...defaultOptions, // Already merged from config — always wins
    };

    // Initialize logger
    this.logger = createLogger(
      `Next${this.getHandlerName()}Handler`,
      this.options.debug,
      this.options.verbose
    );

    // Use PathResolver singleton - appRoot already set in defineNextConfig()
    this.pathResolver = PathResolver.getInstance();
    this.configRoot = this.pathResolver.getAppRoot();
    this.discovery = this.createDiscovery(discoveryClass);

    // Handler-specific initialization
    this.initialize();
  }

  /**
   * Override in subclass to provide handler-specific defaults
   */
  getHandlerDefaults() {
    return {};
  }

  /**
   * Override in subclass to log discovery results (TIER 2 - VERBOSE)
   * Show WHAT was found (business metrics), not timing or process details
   * Only called when options.verbose is true
   */
  logDiscoveryResults(data) {
    // Subclasses implement this to show business metrics
    // This is TIER 2 logging - only shown when verbose=true
  }

  /**
   * Override in subclass to create the specific discovery instance
   */
  createDiscovery(discoveryClass) {
    // Merge discovery defaults with handler options to ensure single source of truth
    const mergedDiscoveryOptions = {
      ...DEFAULT_OPTIONS.discovery, // Base discovery defaults from config
      ...this.options, // Handler options override discovery defaults
    };
    return new discoveryClass(this.pathResolver, mergedDiscoveryOptions);
  }

  /**
   * Override in subclass for additional initialization
   */
  initialize() {
    // Subclass hook
  }

  /**
   * Initialize the handler with app root
   */
  setAppRoot(root) {
    this.configRoot = root;
    this.pathResolver.setAppRoot(root);
  }

  /**
   * Create Next.js configuration function
   */
  createNextConfig() {
    return (nextConfig = {}) => {
      if (this.options.debug) {
        this.logger.debug(`${this.getHandlerName()} handler initialized`);
      }

      return {
        ...nextConfig,

        // Add discovery to build process
        webpack: (config, context) => {
          const { dev, isServer, webpack } = context;

          // Apply Vite ignore plugin to prevent webpack warnings
          this.applyViteIgnorePlugin(config, webpack);

          // Generate files during both development and build
          this._generateFiles();

          // Call original webpack config if exists
          if (nextConfig.webpack) {
            return nextConfig.webpack(config, context);
          }

          return config;
        },

        // Add API routes for discovery
        rewrites: async function () {
          try {
            const baseRewrites = nextConfig.rewrites
              ? await nextConfig.rewrites()
              : [];

            const discoveryRewrites = this.getAPIRewrites();

            return this.mergeRewrites(baseRewrites, discoveryRewrites);
          } catch (error) {
            this.logger.error(
              `${this.getHandlerName()} handler failed to merge rewrites: ${error.message}`
            );
            this.logger.error(
              `Stack: ${error.stack || 'No stack trace available'}`
            );
            // Return empty rewrites as fallback, but log the failure clearly
            return [];
          }
        }.bind(this),
      };
    };
  }

  /**
   * Generate files for Next.js
   */
  async generateFiles() {
    try {
      const discoveryData = await this.getDiscoveryData();

      // ===================================================================
      // TIER 2 LOGGING - VERBOSE (Handler-level discovery summaries)
      // ===================================================================
      if (this.options.verbose) {
        this.logDiscoveryResults(discoveryData);
      }

      // Generate direct config file instead of API routes
      await this.generateConfigFile(discoveryData);

      if (this.options.generateManifest) {
        await this.generateManifest(discoveryData);
      }

      // Generate handler-specific files (app pages, routes, etc.)
      await this.generateSpecificFiles(discoveryData);

      // Generate Next.js environment types if this is the first handler
      if (this.getHandlerName() === 'Route') {
        await this.generateNextEnvTypes();
      }

      // ===================================================================
      // TIER 3 LOGGING - DEBUG (Generation process details)
      // ===================================================================
      this.logger.debug(
        `Generated ${this.getHandlerName()}: ${this.getGenerationSummary(discoveryData)}`
      );

      return discoveryData;
    } catch (error) {
      this.logger.error(
        `${this.getHandlerName()} handler failed to generate files: ${error.message}`
      );
      this.logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      throw error;
    }
  }

  /**
   * Generate direct config file for Next.js
   */
  async generateConfigFile(discoveryData) {
    const handlerName = this.getHandlerName().toLowerCase();
    const configPath =
      GENERATED_PATHS.next[
        `config${handlerName.charAt(0).toUpperCase()}${handlerName.slice(1)}`
      ];

    if (!configPath) {
      throw new Error(
        `No config path defined for ${handlerName} handler. ` +
          `Add config${handlerName.charAt(0).toUpperCase()}${handlerName.slice(1)} to GENERATED_PATHS.next in constants.js`
      );
    }

    const configContent = this.generateConfigContent(discoveryData);
    this.writeGeneratedFile(
      configPath,
      configContent,
      `DnDev ${handlerName} config`
    );
  }

  /**
   * Generate config content - override in subclasses
   */
  generateConfigContent(discoveryData) {
    const handlerName = this.getHandlerName().toLowerCase();
    // Use CONFIG_KEYS for consistent naming between Vite and Next.js
    const configKey = CONFIG_KEYS[handlerName] || handlerName;

    return `// Auto-generated DnDev config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_ with discovery results

const ${handlerName}Config = ${JSON.stringify(discoveryData, null, 2)};

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
  globalThis._DNDEV_CONFIG_.${configKey} = ${handlerName}Config;
}

// Export for compatibility
export default ${handlerName}Config;
`;
  }

  // === UTILITY METHODS ===

  /**
   * Ensure directory exists and write file
   */
  writeGeneratedFile(filePath, content, description = 'file') {
    const fullPath = this.pathResolver.resolveAppPath(filePath);

    // PathResolver.writeFile handles directory creation automatically
    this.pathResolver.writeSync(fullPath, content);
    this.logger.debug(`Generated ${description}: ${fullPath}`);

    return fullPath;
  }

  /**
   * Generate manifest file
   */
  async generateManifest(discoveryData) {
    const manifest = this.createManifestContent(discoveryData);

    this.writeGeneratedFile(
      this.options.manifestPath,
      JSON.stringify(manifest, null, 2),
      `${this.getHandlerName().toLowerCase()} manifest`
    );
  }

  /**
   * Generate Next.js environment types file
   */
  async generateNextEnvTypes() {
    try {
      // next-env.d.ts is in the app root (generated by Next.js)
      const nextEnvPath = this.pathResolver.resolveAppPath('next-env.d.ts');
      // Read as text (TS declaration file, not JSON)
      const nextEnvContent = this.pathResolver.readSync(nextEnvPath, {
        format: 'text',
      });

      if (nextEnvContent) {
        this.writeGeneratedFile(
          'next-env.d.ts',
          nextEnvContent,
          'Next.js environment types'
        );
        this.logger.debug('Generated Next.js environment types');
      }
    } catch (error) {
      this.logger.debug(
        `Could not generate Next.js environment types: ${error.message}`
      );
    }
  }

  /**
   * Apply Vite ignore plugin to webpack config
   * This prevents webpack from trying to parse Vite-related modules
   */
  applyViteIgnorePlugin(config, webpack) {
    config.plugins = config.plugins || [];

    // Ignore Vite and related packages completely
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^vite$/,
      })
    );

    // Ignore @vitejs packages
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@vitejs\//,
      })
    );

    // Ignore any file paths containing vite in node_modules
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /vite/,
        contextRegExp: /node_modules/,
      })
    );

    return config;
  }

  /**
   * Merge Next.js rewrites properly
   */
  mergeRewrites(baseRewrites, discoveryRewrites) {
    // Ensure discoveryRewrites has the correct structure
    const safeDiscoveryRewrites = {
      beforeFiles: discoveryRewrites?.beforeFiles || [],
      afterFiles: discoveryRewrites?.afterFiles || [],
      fallback: discoveryRewrites?.fallback || [],
    };

    // Always return object format for consistency
    return {
      beforeFiles: [
        ...(Array.isArray(baseRewrites) ? [] : baseRewrites?.beforeFiles || []),
        ...safeDiscoveryRewrites.beforeFiles,
      ],
      afterFiles: [
        ...(Array.isArray(baseRewrites)
          ? baseRewrites
          : baseRewrites?.afterFiles || []),
        ...safeDiscoveryRewrites.afterFiles,
      ],
      fallback: [
        ...(Array.isArray(baseRewrites) ? [] : baseRewrites?.fallback || []),
        ...safeDiscoveryRewrites.fallback,
      ],
    };
  }

  /**
   * Debug logging
   */

  // === PRIVATE METHODS ===

  async _generateFiles() {
    return this.generateFiles();
  }

  // === ABSTRACT METHODS (Override in subclass) ===

  /**
   * Get handler name for logging and identification
   */
  getHandlerName() {
    throw new Error('getHandlerName() must be implemented by subclass');
  }

  /**
   * Get discovery data from the specific discovery engine
   */
  async getDiscoveryData() {
    throw new Error('getDiscoveryData() must be implemented by subclass');
  }

  /**
   * Generate handler-specific files
   */
  async generateSpecificFiles(discoveryData) {
    throw new Error('generateSpecificFiles() must be implemented by subclass');
  }

  /**
   * Generate API handler (no-op - API routes replaced by direct config files)
   * Kept for backwards compatibility with handlers that call it
   */
  async generateAPIHandler(discoveryData) {
    // No-op: API routes replaced by direct config files (dndev-config.js)
    // This method exists to prevent errors when handlers call it
    return Promise.resolve();
  }

  /**
   * Get API rewrites for this handler
   */
  getAPIRewrites() {
    throw new Error('getAPIRewrites() must be implemented by subclass');
  }

  /**
   * Format discovery data for API response
   */
  formatAPIResponse(discoveryData) {
    throw new Error('formatAPIResponse() must be implemented by subclass');
  }

  /**
   * Create manifest content from discovery data
   */
  createManifestContent(discoveryData) {
    throw new Error('createManifestContent() must be implemented by subclass');
  }

  /**
   * Get summary of what was generated for debug logging
   */
  getGenerationSummary(discoveryData) {
    throw new Error('getGenerationSummary() must be implemented by subclass');
  }
}

/**
 * Factory function to create handler with specific discovery class
 */
export function createBaseHandler(discoveryClass, defaultOptions = {}) {
  return (options = {}) =>
    new BaseNextHandler(discoveryClass, { ...defaultOptions, ...options });
}

export default BaseNextHandler;
