/**
 * @fileoverview PWADiscovery - PWA Asset Discovery Engine
 * @description Discovers PWA-related assets and generates PWA manifests. Extends BaseDiscovery for consistent architecture.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseDiscovery } from './BaseDiscovery.js';

export class PWADiscovery extends BaseDiscovery {
  constructor(pathResolver, options = {}) {
    super(pathResolver, {
      ...options,
    });
  }

  // === ABSTRACT METHOD IMPLEMENTATIONS ===

  _getDiscoveryType() {
    return 'PWA';
  }

  async _getPatterns() {
    return await this.pathResolver.resolvePatterns('pwa');
  }

  _getPatternType() {
    return 'pwa';
  }

  async _processFiles(files) {
    const { frameworkFiles, consumerFiles } = files;
    const allFiles = [...frameworkFiles, ...consumerFiles];

    this.logger.debug(`Processing ${allFiles.length} PWA files`);

    // Use asset data from AssetDiscovery if provided (avoids re-scanning)
    let pwaAssets = [];
    if (this.options.assetData?.pwaIcons) {
      this.logger.debug(
        `Using ${this.options.assetData.pwaIcons.length} icons from AssetDiscovery`
      );
      pwaAssets = [...this.options.assetData.pwaIcons];
    }

    // Still scan for manifest.json and service workers
    const scannedAssets = await this._analyzePWAFiles(allFiles);
    const manifestAssets = scannedAssets.filter(
      (asset) => asset.type === 'manifest' || asset.type === 'service-worker'
    );
    pwaAssets.push(...manifestAssets);

    // Also scan for any icons not found by AssetDiscovery (fallback)
    const scannedIcons = scannedAssets.filter((asset) => asset.type === 'icon');
    const existingIconPaths = new Set(
      pwaAssets.filter((a) => a.type === 'icon').map((a) => a.path)
    );
    const newIcons = scannedIcons.filter(
      (icon) => !existingIconPaths.has(icon.path)
    );
    pwaAssets.push(...newIcons);

    const manifest = this._generatePWAManifest(pwaAssets);

    return {
      assets: pwaAssets,
      manifest,
      totalFiles: allFiles.length,
      timestamp: Date.now(),
    };
  }

  _getEmptyResult() {
    return {
      assets: [],
      manifest: this._getDefaultManifest(),
      totalFiles: 0,
      timestamp: Date.now(),
    };
  }

  _getDiscoverySummary() {
    return `${this.cache?.assets?.length || 0} PWA assets discovered`;
  }

  // === PWA-SPECIFIC METHODS ===

  async _analyzePWAFiles(files) {
    const pwaAssets = [];

    for (const file of files) {
      // Convert string path to fileInfo object if needed
      const fileInfo =
        typeof file === 'string'
          ? {
              absolutePath: file,
              relativePath: this.pathResolver.getRelativePath(file),
              fileName: file.split('/').pop() || '',
              extension: (file.split('.').pop() || '').toLowerCase(),
            }
          : file;
      const asset = await this._analyzePWAAsset(fileInfo);
      if (asset) {
        pwaAssets.push(asset);
      }
    }

    return pwaAssets;
  }

  async _analyzePWAAsset(fileInfo) {
    // Read as text (PWA manifest/icon files, not JSON - though manifest.json is handled separately)
    const content = await this.pathResolver.read(fileInfo.absolutePath, {
      format: 'text',
    });
    if (!content) return null;

    const relativePath = fileInfo.relativePath;
    const fileName = fileInfo.fileName;

    // Analyze different PWA asset types
    if (fileName.includes('manifest.json')) {
      return this._parseManifestFile(content, relativePath);
    }

    if (fileName.includes('service-worker') || fileName.includes('sw.')) {
      return this._parseServiceWorkerFile(content, relativePath);
    }

    if (this._isPWAIcon(fileName)) {
      return this._parseIconFile(fileInfo, relativePath);
    }

    return null;
  }

  _parseManifestFile(content, relativePath) {
    try {
      // Content may already be parsed (pathResolver.read auto-parses JSON)
      const manifest =
        typeof content === 'string' ? JSON.parse(content) : content;
      return {
        type: 'manifest',
        path: relativePath,
        content: manifest,
        size:
          typeof content === 'string'
            ? content.length
            : JSON.stringify(manifest).length,
      };
    } catch (error) {
      this.logger.debug(`Failed to parse manifest: ${error.message}`);
      return null;
    }
  }

  _parseServiceWorkerFile(content, relativePath) {
    return {
      type: 'service-worker',
      path: relativePath,
      size: content.length,
      hasWorkbox: content.includes('workbox'),
    };
  }

  _parseIconFile(fileInfo, relativePath) {
    const fileName = fileInfo.fileName;
    const size = this._extractIconSize(fileName);

    return {
      type: 'icon',
      path: relativePath,
      size,
      format: fileInfo.extension,
      purpose: this._getIconPurpose(fileName),
    };
  }

  _isPWAIcon(fileName) {
    const iconPatterns = [
      'icon',
      'logo',
      'apple-touch-icon',
      'android-chrome',
      'favicon',
    ];

    return iconPatterns.some((pattern) => fileName.includes(pattern));
  }

  _extractIconSize(fileName) {
    const sizeMatch = fileName.match(/(\d+)x(\d+)/);
    if (sizeMatch) {
      return {
        width: parseInt(sizeMatch[1]),
        height: parseInt(sizeMatch[2]),
      };
    }

    // Default sizes for common patterns
    if (fileName.includes('favicon')) return { width: 32, height: 32 };
    if (fileName.includes('apple-touch-icon'))
      return { width: 180, height: 180 };
    if (fileName.includes('icon-192')) return { width: 192, height: 192 };
    if (fileName.includes('icon-512')) return { width: 512, height: 512 };

    return { width: 192, height: 192 };
  }

  _getIconPurpose(fileName) {
    if (fileName.includes('maskable')) return 'maskable';
    if (fileName.includes('apple-touch')) return 'apple-touch';
    if (fileName.includes('android-chrome')) return 'android';
    return 'any';
  }

  _generatePWAManifest(assets) {
    const icons = assets.filter((asset) => asset.type === 'icon');
    const existingManifest = assets.find((asset) => asset.type === 'manifest');

    const manifest = existingManifest?.content || this._getDefaultManifest();

    // Enhance manifest with discovered icons
    if (icons.length > 0) {
      manifest.icons = icons.map((icon) => ({
        src: `/${icon.path}`,
        sizes: `${icon.size.width}x${icon.size.height}`,
        type: `image/${icon.format}`,
        purpose: icon.purpose,
      }));
    }

    return manifest;
  }

  _getDefaultManifest() {
    // appConfig.app is passed via options, not extracted here
    const app = this.options?.app || {};

    return {
      name: app.name,
      short_name: app.shortName,
      description: app.description,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#000000',
      icons: [],
    };
  }

  // === COMMON PWA GENERATION METHODS ===

  /**
   * Generate PWA manifest content
   * @param {Object} pwaData - PWA discovery data
   * @returns {string} JSON string of manifest
   */
  generateManifestContent(pwaData) {
    const manifest = pwaData.manifest || this._getDefaultManifest();
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Generate workbox-based service worker content
   * @param {Object} pwaData - PWA discovery data
   * @param {Object} workboxOptions - Workbox configuration options
   * @returns {string} Service worker JavaScript content with workbox
   */
  generateServiceWorkerContent(pwaData, workboxOptions = {}) {
    const workboxConfig = this._getWorkboxDefaults(workboxOptions);
    const hasBackgroundSync =
      workboxOptions.backgroundSync !== false && workboxOptions.backgroundSync;
    const precacheManifest = workboxOptions.precacheManifest || [];
    const manifestJson = JSON.stringify(precacheManifest, null, 2);

    return `// Generated by @donotdev/config - PWA Service Worker with Workbox
// Generated at ${new Date().toISOString()}

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute, cleanupOutdatedPrecaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
${hasBackgroundSync ? 'const { BackgroundSyncPlugin } = workbox.backgroundSync;' : ''}

// Clean up outdated caches
cleanupOutdatedPrecaches();

// Precache static assets
const precacheManifest = ${manifestJson.length > 2 ? manifestJson : 'self.__WB_MANIFEST || []'};
precacheAndRoute(precacheManifest);

// Runtime caching strategies
${this._generateWorkboxRuntimeCaching(workboxConfig.runtimeCaching, workboxOptions)}

${hasBackgroundSync ? this._generateBackgroundSync(workboxOptions.backgroundSync) : ''}

// Skip waiting and claim clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
`;
  }

  _getWorkboxDefaults(workboxOptions = {}) {
    return {
      globPatterns: workboxOptions.globPatterns || [
        '**/*.{js,css,html,ico,png,svg,woff2}',
      ],
      runtimeCaching: workboxOptions.runtimeCaching || [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'images-cache',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
        {
          urlPattern: /\/api\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 5,
            },
            networkTimeoutSeconds: 10,
          },
        },
        {
          urlPattern: ({ request }) => request.destination === 'document',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages-cache',
            expiration: {
              maxEntries: 32,
              maxAgeSeconds: 60 * 60 * 24,
            },
            networkTimeoutSeconds: 10,
          },
        },
      ],
      cleanupOutdatedCaches: workboxOptions.cleanupOutdatedCaches !== false,
      skipWaiting: workboxOptions.skipWaiting !== false,
      clientsClaim: workboxOptions.clientsClaim !== false,
      maximumFileSizeToCacheInBytes:
        workboxOptions.maximumFileSizeToCacheInBytes || 5 * 1024 * 1024,
      navigateFallback: workboxOptions.navigateFallback || '/',
      navigateFallbackDenylist: workboxOptions.navigateFallbackDenylist || [
        /^\/api\/.*/,
      ],
    };
  }

  _generateWorkboxRuntimeCaching(runtimeCaching, workboxOptions = {}) {
    return runtimeCaching
      .map((cache, index) => {
        const { urlPattern, handler, options = {} } = cache;
        const strategy =
          handler === 'CacheFirst'
            ? 'CacheFirst'
            : handler === 'NetworkFirst'
              ? 'NetworkFirst'
              : handler === 'StaleWhileRevalidate'
                ? 'StaleWhileRevalidate'
                : 'NetworkFirst';

        let urlPatternStr;
        if (typeof urlPattern === 'function') {
          urlPatternStr = `({ request }) => request.destination === 'document'`;
        } else if (urlPattern instanceof RegExp) {
          urlPatternStr = urlPattern.toString();
        } else {
          urlPatternStr = JSON.stringify(urlPattern);
        }

        const plugins = [];
        if (options.expiration) {
          plugins.push(
            `new ExpirationPlugin({\n        maxEntries: ${options.expiration.maxEntries || 50},\n        maxAgeSeconds: ${options.expiration.maxAgeSeconds || 60 * 60 * 24},\n      })`
          );
        }
        if (options.cacheableResponse) {
          plugins.push(
            `new CacheableResponsePlugin({\n        statuses: ${JSON.stringify(options.cacheableResponse.statuses || [0, 200])},\n      })`
          );
        }
        if (options.backgroundSync) {
          plugins.push(
            `new BackgroundSyncPlugin('${options.backgroundSync.queueName || 'background-sync-queue'}', {\n        maxRetentionTime: ${options.backgroundSync.maxRetentionTime || 24 * 60},\n      })`
          );
        }

        let strategyOptions = '';
        if (options.cacheName) {
          strategyOptions += `\n    cacheName: '${options.cacheName}',`;
        }
        if (plugins.length > 0) {
          strategyOptions += `\n    plugins: [\n      ${plugins.join(',\n      ')}\n    ],`;
        }
        if (options.networkTimeoutSeconds) {
          strategyOptions += `\n    networkTimeoutSeconds: ${options.networkTimeoutSeconds},`;
        }

        return `// Runtime cache ${index + 1}: ${options.cacheName || 'cache-' + index}
registerRoute(
  ${urlPatternStr},
  new ${strategy}({${strategyOptions}
  })
);`;
      })
      .join('\n\n');
  }

  _generateBackgroundSync(backgroundSyncConfig) {
    if (!backgroundSyncConfig || backgroundSyncConfig === false) {
      return '';
    }

    const queueName = backgroundSyncConfig.queueName || 'background-sync-queue';
    const maxRetentionTime = backgroundSyncConfig.maxRetentionTime || 24 * 60;
    const urlPattern = backgroundSyncConfig.urlPattern || /\/api\/.*/i;

    let urlPatternStr;
    if (typeof urlPattern === 'function') {
      urlPatternStr = urlPattern.toString();
    } else if (urlPattern instanceof RegExp) {
      urlPatternStr = urlPattern.toString();
    } else {
      urlPatternStr = JSON.stringify(urlPattern);
    }

    return `
// Background sync for offline actions
const { NetworkOnly } = workbox.strategies;
registerRoute(
  ${urlPatternStr},
  new NetworkOnly({
    plugins: [
      new BackgroundSyncPlugin('${queueName}', {
        maxRetentionTime: ${maxRetentionTime},
      }),
    ],
  }),
  'POST'
);
`;
  }

  /**
   * Get PWA headers for different platforms
   * @returns {Array} Array of header configurations
   */
  getPWAHeaders() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
        ],
      },
    ];
  }

  /**
   * Get PWA rewrites for different platforms
   * @returns {Object} Rewrites configuration
   */
  getPWARewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/sw.js',
          destination: '/sw.js',
        },
        {
          source: '/workbox-:path*',
          destination: '/workbox-:path*',
        },
      ],
      fallback: [],
    };
  }

  /**
   * Discover Next.js build assets from .next/static directory
   * @param {string} buildDir - Build directory (default: '.next')
   * @returns {Promise<Array>} Array of build asset paths for precache manifest
   */
  async discoverNextBuildAssets(buildDir = '.next') {
    const staticDir = this.pathResolver.resolveAppPath(`${buildDir}/static`);
    const chunksDir = this.pathResolver.resolveAppPath(
      `${buildDir}/static/chunks`
    );
    const cssDir = this.pathResolver.resolveAppPath(`${buildDir}/static/css`);

    const assets = [];

    try {
      const patterns = [
        `${staticDir}/**/*.{js,css,woff2,woff,ttf,eot}`,
        `${chunksDir}/**/*.{js,css}`,
        `${cssDir}/**/*.css`,
      ];

      for (const pattern of patterns) {
        const files = await this.pathResolver.findFiles(
          this.pathResolver.getAppRoot(),
          pattern.replace(this.pathResolver.getAppRoot(), ''),
          { onlyFiles: true }
        );

        for (const file of files) {
          const relativePath = this.pathResolver.getRelativePath(file);
          if (relativePath.startsWith(`${buildDir}/static/`)) {
            const publicPath = `/_next/${relativePath.replace(`${buildDir}/static/`, '')}`;
            assets.push({
              url: publicPath,
              revision: null,
            });
          }
        }
      }
    } catch (error) {
      this.logger?.warn(
        `Failed to discover Next.js build assets: ${error.message}`
      );
    }

    return assets;
  }

  /**
   * Generate precache manifest for Next.js
   * @param {Array} buildAssets - Build assets from discoverNextBuildAssets
   * @param {Function} manifestTransform - Optional transform function
   * @returns {Array} Precache manifest array
   */
  generatePrecacheManifest(buildAssets = [], manifestTransform = null) {
    let manifest = buildAssets;

    if (manifestTransform && typeof manifestTransform === 'function') {
      manifest = manifestTransform(manifest);
    }

    return manifest;
  }

  // === PUBLIC API ===

  async discoverPWAAssets(force = false) {
    return await this.discover(force);
  }

  getPWAAssets() {
    return this.cache?.assets || [];
  }

  getPWAManifest() {
    return this.cache?.manifest || this._getDefaultManifest();
  }
}

export default PWADiscovery;
