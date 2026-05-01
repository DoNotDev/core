/**
 * @fileoverview Next.js PWA Handler - Platform Adapter
 * @description Handles PWA configuration and generation for Next.js applications.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { nextAssetDataCache } from './AssetHandler.js';
import { BaseNextHandler } from './BaseNextHandler.js';
import { GENERATED_PATHS } from '../../constants.js';
import { PWADiscovery } from '../../discovery/PWADiscovery.js';

export class NextPWAHandler extends BaseNextHandler {
  constructor(options = {}) {
    super(PWADiscovery, options);
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      enabled: false,
      manifestPath: 'public/manifest.json',
      serviceWorkerPath: 'public/sw.js',
      workboxPath: 'public/workbox-*.js',
      generateServiceWorker: true,
      generateManifest: true,
    };
  }

  createDiscovery(discoveryClass) {
    // Get asset data from AssetHandler if available (avoids re-scanning)
    // AssetHandler stores data in shared cache during getDiscoveryData()
    const assetData = this.options.assetData || nextAssetDataCache.data;

    return new discoveryClass(this.pathResolver, {
      ...this.options,
      assetData, // Pass asset data to avoid re-scanning
    });
  }

  getHandlerName() {
    return 'PWA';
  }

  // === DISCOVERY INTEGRATION ===

  async getDiscoveryData() {
    return await this.discovery.discoverPWAAssets();
  }

  getAPIRewrites() {
    if (!this.options.enabled) {
      return {
        beforeFiles: [],
        afterFiles: [],
        fallback: [],
      };
    }

    return this.discovery.getPWARewrites();
  }

  formatAPIResponse(pwaData) {
    return {
      assets: pwaData.assets,
      manifest: pwaData.manifest,
      totalAssets: pwaData.assets.length,
      timestamp: pwaData.timestamp,
    };
  }

  createManifestContent(pwaData) {
    return {
      assets: pwaData.assets.map((asset) => ({
        type: asset.type,
        path: asset.path,
        size: asset.size,
      })),
      manifest: pwaData.manifest,
      totalAssets: pwaData.assets.length,
      generatedAt: new Date().toISOString(),
    };
  }

  getGenerationSummary(pwaData) {
    return `${pwaData.assets.length} PWA assets for Next.js`;
  }

  // === FILE GENERATION ===

  async generateSpecificFiles(pwaData) {
    if (!this.options.enabled) {
      this.logger.debug('PWA disabled, skipping generation');
      return;
    }

    // Asset generation now handled by AssetDiscovery._generateMissingAssets()
    // Called automatically during discovery process

    if (this.options.generateManifest) {
      await this.generatePWAManifest(pwaData);
    }

    if (this.options.generateServiceWorker) {
      await this.generateServiceWorker(pwaData);
    }

    // Generate API route
    await this.generateAPIHandler(pwaData);
  }

  async generatePWAManifest(pwaData) {
    const manifestContent = this.discovery.generateManifestContent(pwaData);
    this.writeGeneratedFile(
      this.options.manifestPath,
      manifestContent,
      'PWA manifest'
    );
  }

  async generateServiceWorker(pwaData) {
    const workboxOptions = this.options.workbox || {};

    let precacheManifest = [];
    if (this.options.discoverBuildAssets !== false) {
      const buildAssets = await this.discovery.discoverNextBuildAssets('.next');
      precacheManifest = this.discovery.generatePrecacheManifest(
        buildAssets,
        workboxOptions.manifestTransform
      );
    }

    const serviceWorkerContent = this.discovery.generateServiceWorkerContent(
      pwaData,
      {
        ...workboxOptions,
        precacheManifest,
      }
    );

    this.writeGeneratedFile(
      this.options.serviceWorkerPath,
      serviceWorkerContent,
      'service worker'
    );
  }

  // === NEXT.JS CONFIGURATION ===

  createNextConfig() {
    if (!this.options.enabled) {
      return () => ({});
    }

    return (nextConfig = {}) => {
      this.logger.debug('Initializing Next.js PWA handler');

      return {
        ...nextConfig,

        // Add PWA headers
        async headers() {
          const baseHeaders = nextConfig.headers
            ? await nextConfig.headers()
            : [];
          const pwaHeaders = this.discovery.getPWAHeaders();

          return [...baseHeaders, ...pwaHeaders];
        },

        // Add PWA to webpack
        webpack: (config, context) => {
          const { dev, isServer, webpack } = context;

          // Apply Vite ignore plugin to prevent webpack warnings
          this.applyViteIgnorePlugin(config, webpack);

          // Generate PWA files during build
          if (!dev && !isServer) {
            this._generateFiles();
          }

          // Call original webpack config if exists
          if (nextConfig.webpack) {
            return nextConfig.webpack(config, context);
          }

          return config;
        },
      };
    };
  }

  async generatePWA() {
    return this.generateFiles();
  }

  createPWAAPIHandler() {
    return this.createAPIHandler();
  }
}

// Export factory function for easier usage
export function createNextPWAHandler(options = {}) {
  return new NextPWAHandler(options);
}
