/**
 * @fileoverview Vite PWA Plugin - Workbox Integration with Smart Defaults
 * @description Uses vite-plugin-pwa with workbox for production-grade PWA support with intelligent caching strategies.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { VitePWA } from 'vite-plugin-pwa';

import { assetDataCache } from './AssetPlugin.js';
import { PWADiscovery } from '../../discovery/PWADiscovery.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

export function createVitePWAPlugin(options = {}) {
  if (!options.enabled) {
    return null;
  }

  // Warn if PWA is enabled but app is missing or incomplete
  const app = options.app || {};
  const missingFields = [];
  if (!app.name) missingFields.push('name');
  if (!app.shortName) missingFields.push('shortName');
  if (!app.description) missingFields.push('description');

  if (missingFields.length > 0) {
    const logger = createLogger('PWA', options.debug, true);
    logger.warn(
      `⚠️  PWA is enabled but appConfig.app is missing required fields: ${missingFields.join(', ')}`
    );
    logger.warn('   Add these to your src/config/app.ts:');
    logger.warn('   export const appConfig: AppConfig = {');
    logger.warn('     app: {');
    if (!app.name) logger.warn('       name: "Your App Name",');
    if (!app.shortName) logger.warn('       shortName: "App",');
    if (!app.description)
      logger.warn('       description: "Your app description",');
    logger.warn('     },');
    logger.warn('     // ... rest of config');
    logger.warn('   };');
    logger.warn('');
  }

  const pathResolver = PathResolver.getInstance();

  // Get asset data from AssetPlugin (if available) to avoid re-scanning
  const assetData = assetDataCache.data;

  const discovery = new PWADiscovery(pathResolver, {
    ...options,
    assetData, // Pass asset data to avoid re-scanning
  });
  const isDev = options.devEnabled === true;

  const smartDefaults = {
    registerType: options.registerType || 'prompt',
    includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
    manifest: async () => {
      // Use appConfig.app passed from config.js
      const app = options.app || {};

      // Discover icons after assets are generated (at build time)
      const pwaData = await discovery.discoverPWAAssets();
      const icons = pwaData.assets
        .filter((asset) => asset.type === 'icon')
        .map((icon) => ({
          src: `/${icon.path}`,
          sizes: `${icon.size.width}x${icon.size.height}`,
          type: `image/${icon.format}`,
          purpose: icon.purpose,
        }));

      return {
        name: app.name,
        short_name: app.shortName,
        description: app.description,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: icons.length > 0 ? icons : [],
      };
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
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
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\/.*/],
      manifestTransforms: [
        (manifest) => {
          const indexHtmlEntry = manifest.find(
            (entry) => entry.url === '/index.html' || entry.url === 'index.html'
          );
          if (indexHtmlEntry && !manifest.find((entry) => entry.url === '/')) {
            manifest.push({ url: '/', revision: indexHtmlEntry.revision });
          }
          return { manifest, warnings: [] };
        },
      ],
    },
    devOptions: {
      enabled: isDev,
      type: 'module',
    },
  };

  // Merge manifest: if user provides manifest, merge with discovered manifest
  const manifestFn = async () => {
    const discoveredManifest = await smartDefaults.manifest();
    if (options.manifest) {
      // If user provided manifest is a function, call it and merge
      if (typeof options.manifest === 'function') {
        const userManifest = await options.manifest();
        return { ...discoveredManifest, ...userManifest };
      }
      // If user provided manifest is an object, merge directly
      return { ...discoveredManifest, ...options.manifest };
    }
    return discoveredManifest;
  };

  const mergedOptions = {
    ...smartDefaults,
    manifest: manifestFn,
    workbox: {
      ...smartDefaults.workbox,
      ...(options.workbox || {}),
      runtimeCaching: [
        ...smartDefaults.workbox.runtimeCaching,
        ...(options.workbox?.runtimeCaching || []),
      ],
      manifestTransforms: [
        ...(smartDefaults.workbox.manifestTransforms || []),
        ...(options.workbox?.manifestTransforms || []),
      ],
    },
  };

  // Asset Plugin already generated assets - PWA just uses them
  return VitePWA(mergedOptions);
}
