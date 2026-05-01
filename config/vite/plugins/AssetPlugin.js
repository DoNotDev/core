/**
 * @fileoverview Asset Plugin - Factory Implementation
 * @description Minimal plugin definition using the discovery factory. Generates PWA assets from logo.svg before discovery.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createDiscoveryPlugin } from './PluginFactory.js';
import {
  VIRTUAL_MODULES,
  GENERATED_PATHS,
  FRAMEWORK_CONFIG,
  CONFIG_KEYS,
} from '../../constants.js';
import { AssetDiscovery } from '../../discovery/AssetDiscovery.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

// Shared cache for asset data (used by PWAPlugin to avoid re-scanning)
export const assetDataCache = { data: null };

// Asset-specific templates
const assetTemplates = {
  /**
   * Check if asset data is empty
   */
  isEmpty: (assetData) => !assetData.manifest || assetData.assets?.length === 0,

  /**
   * Generate main virtual module
   */
  generateModule: (assetData, debug, configKey = 'assets') => {
    const { manifest, assets, copiedAssets } = assetData;
    const logoSvgContent = manifest.logoSvgContent || null;

    const assetManifest = {
      totalAssets: assets.length,
      copiedAssets: copiedAssets.length,
      hasLogo: manifest.logo.optimal !== null,
      hasFavicon: manifest.favicon.optimal !== null,
      hasManifest: manifest.manifest !== null,
      timestamp: new Date().toISOString(),
    };

    return `// ${VIRTUAL_MODULES.assets} - Generated asset manifest
const assetManifest = ${JSON.stringify(manifest, null, 2)};
const assetStats = ${JSON.stringify(assetManifest, null, 2)};

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
  
  // Populate assets configuration
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS[configKey]} = {
    mapping: assetManifest,
    logoSvgContent: ${JSON.stringify(logoSvgContent)},
    manifest: {
      totalAssets: ${assets.length},
      generatedAt: new Date().toISOString(),
    },
  };
}


// Asset helper functions
export function getLogo(format) {
  if (format === 'svg' && assetManifest.logo.optimal && assetManifest.logo.optimal.endsWith('.svg')) {
    return assetManifest.logo.optimal;
  }
  return assetManifest.logo.fallback || assetManifest.logo.optimal;
}

export function getFavicon(variant = 'optimal') {
  if (variant === 'optimal') {
    return assetManifest.favicon.optimal;
  }
  return assetManifest.favicon.fallback || assetManifest.favicon.optimal;
}

export function getManifest() {
  return assetManifest.manifest;
}

export function getAllAssets() {
  return [...assetManifest.modernFormats, ...assetManifest.fallbackFormats];
}

// Named exports
export const logo = assetManifest.logo;
export const favicon = assetManifest.favicon;
export const manifest = assetManifest.manifest;
export const assets = getAllAssets();
export const stats = assetStats;

export default { 
  logo, 
  favicon, 
  manifest, 
  assets, 
  stats,
  getLogo,
  getFavicon,
  getManifest,
  getAllAssets
};
`;
  },

  /**
   * Generate empty virtual module
   */
  generateEmpty: (data, debug, discoveryOptions, configKey = 'assets') => {
    const emptyManifest = {
      totalAssets: 0,
      copiedAssets: 0,
      hasLogo: false,
      hasFavicon: false,
      hasManifest: false,
      timestamp: new Date().toISOString(),
    };

    return `// ${VIRTUAL_MODULES.assets} - Empty asset manifest
const assetManifest = {
  logo: { optimal: null, fallback: null },
  favicon: { optimal: null, fallback: null },
  appleTouchIcon: null,
  androidChrome: { '192': null, '512': null },
  manifest: null,
  modernFormats: [],
  fallbackFormats: []
};
const assetStats = ${JSON.stringify(emptyManifest, null, 2)};

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
  
  // Populate empty assets configuration
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS[configKey]} = {
    mapping: assetManifest,
    logoSvgContent: null,
    manifest: {
      totalAssets: 0,
      generatedAt: new Date().toISOString(),
    },
  };
}


export function getLogo(format) {
  return null;
}

export function getFavicon(variant = 'optimal') {
  return null;
}

export function getManifest() {
  return null;
}

export function getAllAssets() {
  return [];
}

export const logo = assetManifest.logo;
export const favicon = assetManifest.favicon;
export const manifest = assetManifest.manifest;
export const assets = [];
export const stats = assetStats;

export default { 
  logo, 
  favicon, 
  manifest, 
  assets, 
  stats,
  getLogo,
  getFavicon,
  getManifest,
  getAllAssets
};
`;
  },

  /**
   * Generate inspection file content
   */
  generateInspection: (assetData) => {
    const { assets, manifest, copiedAssets } = assetData;

    if (!assets || assets.length === 0) {
      return `/**
 * Generated Asset Discovery Results
 * Source: empty
 * Generated at: ${new Date().toISOString()}
 */

export const discoveredAssets = [];
export const assetManifest = {
  logo: { optimal: null, fallback: null },
  favicon: { optimal: null, fallback: null },
  appleTouchIcon: null,
  androidChrome: { '192': null, '512': null },
  manifest: null,
  modernFormats: [],
  fallbackFormats: []
};
export const assetStats = {
  totalAssets: 0,
  copiedAssets: 0,
  hasLogo: false,
  hasFavicon: false,
  hasManifest: false,
  generatedAt: '${new Date().toISOString()}'
};

export default discoveredAssets;
`;
    }

    return `/**
 * Generated Asset Discovery Results
 * Generated at: ${new Date().toISOString()}
 * Import from '${VIRTUAL_MODULES.assets}'
 */

export const discoveredAssets = ${JSON.stringify(assets, null, 2)};

export const assetManifest = ${JSON.stringify(manifest, null, 2)};

export const assetStats = {
  totalAssets: ${assets.length},
  copiedAssets: ${copiedAssets.length},
  hasLogo: ${manifest.logo.optimal !== null},
  hasFavicon: ${manifest.favicon.optimal !== null},
  hasManifest: ${manifest.manifest !== null},
  generatedAt: '${new Date().toISOString()}'
};

export default discoveredAssets;
`;
  },

  /**
   * Generate production manifest
   */
  generateManifest: (assetData) => ({
    assets: assetData.assets?.length || 0,
    copied: assetData.copiedAssets?.length || 0,
    timestamp: Date.now(),
    hasLogo: assetData.manifest?.logo?.optimal !== null,
    hasFavicon: assetData.manifest?.favicon?.optimal !== null,
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
  logStats: (assetData, icon, logger) => {
    const totalAssets = assetData.assets?.length || 0;
    const generatedAssets = assetData.generatedAssets?.length || 0;

    if (logger) {
      if (generatedAssets > 0) {
        logger.info(
          `${icon} Assets: ${totalAssets} found, ${generatedAssets} generated`
        );
      } else {
        logger.info(`${icon} Assets: ${totalAssets} found`);
      }
    }
  },
};

// File patterns for HMR
const assetFilePatterns = [
  (file) => file.includes('/public/'),
  (file) =>
    file.endsWith('.png') || file.endsWith('.svg') || file.endsWith('.ico'),
  (file) =>
    file.includes('favicon') ||
    file.includes('logo') ||
    file.includes('manifest'),
];

// Create the plugin using createDiscoveryPlugin
export function createViteAssetPlugin(options = {}) {
  const plugin = createDiscoveryPlugin({
    pluginName: 'dndev-vite-asset-discovery',
    icon: '🎯',
    virtualModuleId: VIRTUAL_MODULES.assets,
    DiscoveryClass: AssetDiscovery,
    discoveryMethod: 'discoverAssets',
    filePatterns: assetFilePatterns,
    templates: assetTemplates,
    manifestFileName: GENERATED_PATHS.manifests.asset,
    configKey: 'assets',
  })(options);

  const pathResolver = PathResolver.getInstance();
  const logger = createLogger('asset-plugin', options.debug, options.verbose);
  const originalBuildStart = plugin.buildStart;

  plugin.buildStart = async function (...args) {
    // Call original buildStart (runs discovery via PluginFactory)
    if (originalBuildStart) {
      await originalBuildStart.apply(this, args);
    }
  };

  return plugin;
}
