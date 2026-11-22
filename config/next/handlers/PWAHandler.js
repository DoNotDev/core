/**
 * @fileoverview Next.js PWA Handler - Platform Adapter
 * @description Handles PWA configuration and generation for Next.js applications.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

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
      // Discovery dump (assets found, derived manifest). Must NOT be the web app
      // manifest path: writing it there replaced /manifest.json with this dump,
      // which the next discovery then read back in and nested once per build.
      manifestPath: 'public/pwa-manifest.json',
      // Web app manifest linked by the root layout (<link rel="manifest">)
      webManifestPath: 'public/manifest.json',
      serviceWorkerPath: 'public/sw.js',
      workboxPath: 'public/workbox-*.js',
      generateServiceWorker: true,
      generateManifest: true,
    };
  }

  createDiscovery(discoveryClass) {
    // The PWA discovery scans public/ itself (manifest, service worker, icons)
    return new discoveryClass(this.pathResolver, this.options);
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
    // The web app manifest is written whether or not PWA is enabled: the root
    // layout always links /manifest.json, and without this the app ships the
    // framework placeholder ("DoNotDev App") copied by AssetDiscovery.
    if (this.options.generateManifest) {
      await this.generatePWAManifest(pwaData);
    }

    if (!this.options.enabled) {
      this.logger.debug('PWA disabled, skipping service worker generation');
      return;
    }

    // Asset generation now handled by AssetDiscovery._generateMissingAssets()
    // Called automatically during discovery process

    if (this.options.generateServiceWorker) {
      await this.generateServiceWorker(pwaData);
    }
  }

  async generatePWAManifest(pwaData) {
    const manifestContent = this.discovery.generateManifestContent(pwaData);
    this.writeGeneratedFile(
      this.options.webManifestPath,
      manifestContent,
      'web app manifest'
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
