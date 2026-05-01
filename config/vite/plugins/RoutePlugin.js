/**
 * @fileoverview Route Plugin - Factory Implementation
 * @description Minimal plugin definition using the discovery factory for automatic route discovery and virtual module generation.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createDiscoveryPlugin } from './PluginFactory.js';
import {
  VIRTUAL_MODULES,
  GENERATED_PATHS,
  CONFIG_KEYS,
} from '../../constants.js';
import { RouteDiscovery } from '../../discovery/RouteDiscovery.js';
import { createMissingResourceError } from '../../utils/buildError.js';

// Route-specific templates
const routeTemplates = {
  /**
   * Check if route data is empty
   */
  isEmpty: (routeData) => !routeData.routes || routeData.routes.length === 0,

  /**
   * Generate main virtual module
   */
  generateModule: (routeData, debug, configKey = 'routes') => {
    const manifest = {
      totalRoutes: routeData.routes.length,
      authRequired: routeData.routes.filter((r) => r.auth && r.auth.required)
        .length,
      publicRoutes: routeData.routes.filter((r) => !r.auth || r.auth === false)
        .length,
      source: routeData.source,
      generatedAt: new Date().toISOString(),
      errors: routeData.errors.length,
    };

    /**
     * Generate route objects with component functions
     *
     * Include all discovered routes including "/" (HomePage).
     * HomePage.tsx is automatically assigned path "/" by RouteDiscovery convention.
     */
    const routesArray = routeData.routes
      .map((route) => {
        return `  {
    path: '${route.path}',
    component: () => import('${route.importPath}'),
    auth: ${JSON.stringify(route.auth, null, 2).replace(/\n/g, '\n    ')},
    meta: ${JSON.stringify(route.meta, null, 2).replace(/\n/g, '\n    ')}
  }`;
      })
      .join(',\n');

    return `
// ${VIRTUAL_MODULES.routes} - Generated route data
import { lazy } from 'react';

const routeData = [
${routesArray}
];

const routeManifest = ${JSON.stringify(manifest, null, 2)};

// Populate unified DnDev config for runtime access
if (typeof globalThis !== 'undefined') {
  if (!globalThis._DNDEV_CONFIG_) {
    globalThis._DNDEV_CONFIG_ = {
      platform: 'vite',
      mode: 'development',
      version: '1.0.0',
      context: 'client',
      timestamp: Date.now(),
    };
  }
  
  // Include all routes in mapping (navigation store will filter by hideFromMenu)
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS[configKey]} = {
    mapping: routeData,
    manifest: {
      totalRoutes: ${routeData.routes.length},
      authRequired: ${routeData.routes.filter((r) => r.auth && r.auth.required).length},
      publicRoutes: ${routeData.routes.filter((r) => !r.auth || r.auth === false).length},
      generatedAt: new Date().toISOString(),
    },
  };
}


export const routes = routeData;
export const manifest = routeManifest;
export const source = '${routeData.source}';

export default { routes: routeData, manifest: routeManifest, source: '${routeData.source}' };
`;
  },

  /**
   * Generate empty virtual module
   */
  generateEmpty: (data, debug, discoveryOptions, configKey = 'routes') => {
    const emptyManifest = {
      totalRoutes: 0,
      authRequired: 0,
      publicRoutes: 0,
      source: 'empty',
      generatedAt: new Date().toISOString(),
    };

    return `
// ${VIRTUAL_MODULES.routes} - Empty route data

const routeData = [];
const routeManifest = ${JSON.stringify(emptyManifest, null, 2)};

// Populate unified DnDev config for runtime access
if (typeof globalThis !== 'undefined') {
  // Initialize _DNDEV_CONFIG_ if it doesn't exist
  if (!globalThis._DNDEV_CONFIG_) {
    globalThis._DNDEV_CONFIG_ = {
      platform: 'vite',
      mode: 'development',
      version: '1.0.0',
      context: 'client',
      timestamp: Date.now(),
    };
  }
  
  // Populate empty routes configuration
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS[configKey]} = {
    mapping: [],
    manifest: {
      totalRoutes: 0,
      authRequired: 0,
      publicRoutes: 0,
      generatedAt: new Date().toISOString(),
    },
  };
}


export const routes = routeData;
export const manifest = routeManifest;
export const source = 'empty';

export default { routes: routeData, manifest: routeManifest, source: 'empty' };
`;
  },

  /**
   * Generate inspection file content
   */
  generateInspection: (routeData, configRoot) => {
    if (!routeData.routes || routeData.routes.length === 0) {
      return `/**
 * Generated Route Discovery Results
 * Source: empty
 * Generated at: ${new Date().toISOString()}
 */

import { lazy } from 'react';

export const discoveredRoutes = [];
export const routeManifest = {
  totalRoutes: 0,
  source: 'empty',
  generatedAt: '${new Date().toISOString()}'
};

export default discoveredRoutes;
`;
    }

    /**
     * Generate route objects with component functions for Vite build-time processing
     *
     * Include all discovered routes including "/" (HomePage).
     * HomePage.tsx is automatically assigned path "/" by RouteDiscovery convention.
     */
    const routesArray = routeData.routes
      .map((route) => {
        return `  {
    path: '${route.path}',
    component: () => import('${route.importPath}'),
    auth: ${JSON.stringify(route.auth, null, 2).replace(/\n/g, '\n    ')},
    meta: ${JSON.stringify(route.meta, null, 2).replace(/\n/g, '\n    ')}
  }`;
      })
      .join(',\n');

    return `/**
 * Generated Route Discovery Results
 * Source: ${routeData.source}
 * Generated at: ${new Date().toISOString()}
 * Import from '${VIRTUAL_MODULES.routes}'
 */

export const discoveredRoutes = [
${routesArray}
];

export const routeManifest = {
  totalRoutes: ${routeData.routes.length},
  source: '${routeData.source}',
  generatedAt: '${new Date().toISOString()}'
};

export default discoveredRoutes;
`;
  },

  /**
   * Generate production manifest
   */
  generateManifest: (routeData) => ({
    routes: routeData?.routes?.length || 0,
    source: routeData?.source || 'unknown',
    timestamp: Date.now(),
    errors: routeData?.errors?.length || 0,
  }),

  /**
   * Log configuration details
   */
  logConfig: (options) => {
    // Using debug logger - will be replaced by plugin factory
  },

  /**
   * Log discovery stats - show WHAT was found, not timing
   */
  logStats: (routeData, icon, logger) => {
    const routes = routeData.routes || [];
    const authRequired = routes.filter((r) => r.auth && r.auth.required).length;
    const totalRoutes = routes.length;

    if (logger) {
      // Root route "/" is automatically assigned to HomePage.tsx by RouteDiscovery convention
      // No validation needed - HomePage.tsx provides the root route
      logger.info(
        `${icon} Routes: ${totalRoutes} found${authRequired > 0 ? `, ${authRequired} are authguarded` : ''}`
      );
    }
  },
};

// Helper function

// File patterns for HMR
const routeFilePatterns = [(file) => file.endsWith('Page.tsx')];

// Create the plugin using createDiscoveryPlugin
export function createViteRoutePlugin(options = {}) {
  return createDiscoveryPlugin({
    pluginName: 'dndev-vite-route-discovery',
    icon: '🛣️',
    virtualModuleId: VIRTUAL_MODULES.routes,
    DiscoveryClass: RouteDiscovery,
    discoveryMethod: 'discoverRoutes',
    filePatterns: routeFilePatterns,
    templates: routeTemplates,
    manifestFileName: GENERATED_PATHS.manifests.route,
    configKey: 'routes',
  })({
    ...options,
    // Default: enable HMR for routes; allow explicit override with routes: { hmr: false }
    disableHmr: options?.hmr === false ? true : false,
    hmrSmartDetection: false, // Stick to explicit patterns only
  });
}
