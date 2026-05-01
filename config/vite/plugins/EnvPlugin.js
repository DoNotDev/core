/**
 * @fileoverview Vite Environment Variables Plugin - Factory Implementation
 * @description Loads VITE_* environment variables and makes them available via virtual:env virtual module.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { loadEnv } from 'vite';

import { createDiscoveryPlugin } from './PluginFactory.js';
import {
  VIRTUAL_MODULES,
  GENERATED_PATHS,
  CONFIG_KEYS,
} from '../../constants.js';

// Env-specific templates
const envTemplates = {
  /**
   * Check if env data is empty
   */
  isEmpty: (envData) => !envData.env || Object.keys(envData.env).length === 0,

  /**
   * Generate main virtual module
   */
  generateModule: (envData, debug, configKey = 'env') => {
    const { env, mode } = envData;

    if (!env || Object.keys(env).length === 0) {
      return envTemplates.generateEmpty(envData, debug, undefined, configKey);
    }

    const manifest = {
      totalVars: Object.keys(env).length,
      mode: mode,
      source: envData.source,
      generatedAt: new Date().toISOString(),
    };

    return `// ${VIRTUAL_MODULES.env} - Generated environment variables

const envData = ${JSON.stringify(env, null, 2)};
const envManifest = ${JSON.stringify(manifest, null, 2)};

// Freeze env data to prevent runtime tampering
Object.freeze(envData);
Object.freeze(envManifest);

// Populate unified DnDev config for runtime access
if (typeof globalThis !== 'undefined') {
  // Initialize _DNDEV_CONFIG_ if it doesn't exist
  if (!globalThis._DNDEV_CONFIG_) {
    globalThis._DNDEV_CONFIG_ = {
      platform: 'vite',
      mode: '${mode}',
      context: 'client',
      timestamp: Date.now(),
    };
  } else {
    // Ensure platform is always set to 'vite' (Vite config builder responsibility)
    globalThis._DNDEV_CONFIG_.platform = 'vite';
    // Update mode if it exists
    if (globalThis._DNDEV_CONFIG_.mode !== '${mode}') {
      globalThis._DNDEV_CONFIG_.mode = '${mode}';
    }
  }

  // Populate env configuration (frozen to prevent tampering)
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS[configKey]} = envData;
  // Only freeze the env property, not the entire config (other plugins need to add properties)
}

// Named exports for convenience
export const env = envData;
export const manifest = envManifest;
export const source = '${envData.source}';

// Default export
export default envData;
`;
  },

  /**
   * Generate empty virtual module
   */
  generateEmpty: (data, debug, discoveryOptions, configKey = 'env') => {
    const emptyManifest = {
      totalVars: 0,
      mode: data.mode || 'development',
      source: 'empty',
      generatedAt: new Date().toISOString(),
    };

    return `// ${VIRTUAL_MODULES.env} - Empty environment data

const envData = {};
const envManifest = ${JSON.stringify(emptyManifest, null, 2)};

// Freeze env data to prevent runtime tampering
Object.freeze(envData);
Object.freeze(envManifest);

// Populate unified DnDev config for runtime access
if (typeof globalThis !== 'undefined') {
  // Initialize _DNDEV_CONFIG_ if it doesn't exist
  if (!globalThis._DNDEV_CONFIG_) {
    globalThis._DNDEV_CONFIG_ = {
      platform: 'vite',
      mode: '${data.mode || 'development'}',
      context: 'client',
      timestamp: Date.now(),
    };
  } else {
    // Ensure platform is always set to 'vite' (Vite config builder responsibility)
    globalThis._DNDEV_CONFIG_.platform = 'vite';
    // Update mode if it exists
    if (globalThis._DNDEV_CONFIG_.mode !== '${data.mode || 'development'}') {
      globalThis._DNDEV_CONFIG_.mode = '${data.mode || 'development'}';
    }
  }

  // Populate empty env configuration (frozen to prevent tampering)
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS[configKey]} = envData;
  // Only freeze the env property, not the entire config (other plugins need to add properties)
}

export const env = envData;
export const manifest = envManifest;
export const source = 'empty';

export default envData;
`;
  },

  /**
   * Generate inspection file
   */
  generateInspection: (envData) => {
    const { env, mode } = envData;
    const lines = [
      '/**',
      ' * Generated Environment Variables',
      ` * Mode: ${mode}`,
      ` * Generated at: ${new Date().toISOString()}`,
      ` * Total variables: ${Object.keys(env).length}`,
      ' */',
      '',
      '```json',
      JSON.stringify(env, null, 2),
      '```',
    ];
    return lines.join('\n');
  },

  /**
   * Generate manifest
   */
  generateManifest: (envData) => ({
    totalVars: Object.keys(envData?.env || {}).length,
    mode: envData?.mode || 'development',
    variables: Object.keys(envData?.env || {}),
    timestamp: Date.now(),
  }),

  /**
   * Log discovery stats
   */
  logStats: (envData, icon, logger) => {
    const count = Object.keys(envData.env).length;
    if (logger) {
      logger.info(`${icon} Env: ${count} VITE_* variables`);
    }
  },
};

/**
 * Simple env discovery class
 */
class EnvDiscovery {
  constructor(pathResolver, options = {}) {
    this.pathResolver = pathResolver;
    this.options = options;
    this.mode = options.mode || 'development';
    this.appRoot = null;
  }

  /**
   * Discover environment variables
   */
  async discoverEnv() {
    try {
      // Get app root from pathResolver
      const appRoot = this.pathResolver.getAppRoot();

      if (!appRoot) {
        throw new Error('App root not available in EnvDiscovery');
      }

      // Load environment variables using Vite's loadEnv
      // loadEnv automatically loads .env, .env.local, .env.[mode], and .env.[mode].local
      // Pass 'VITE_' as prefix to only load VITE_* variables
      const loadedEnv = loadEnv(this.mode, appRoot, 'VITE_');

      // loadEnv already filters to VITE_* prefix, so use directly
      const env = { ...loadedEnv };

      // 🚨 CRITICAL: Remove emulator config in production builds
      // Emulator vars should never be in production bundles
      if (this.mode === 'production') {
        delete env.VITE_USE_FIREBASE_EMULATOR;
        delete env.VITE_FIREBASE_EMULATOR_HOST;
        delete env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
        delete env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST;
        delete env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT;
      }

      // Also add built-in env vars
      env.MODE = this.mode;
      env.DEV = this.mode === 'development';
      env.PROD = this.mode === 'production';
      env.SSR = false;

      return {
        env,
        mode: this.mode,
        source: `${appRoot}/.env`,
        errors: [],
      };
    } catch (error) {
      console.error('[EnvDiscovery] Error loading env vars:', error);
      return {
        env: {},
        mode: this.mode,
        source: 'error',
        errors: [error.message],
      };
    }
  }
}

/**
 * Create the Vite environment plugin
 */
export function createViteEnvPlugin(options = {}) {
  return createDiscoveryPlugin({
    pluginName: 'dndev-vite-env-discovery',
    icon: '🔐',
    virtualModuleId: VIRTUAL_MODULES.env,
    discoveryMethod: 'discoverEnv',
    filePatterns: [], // No file watching needed
    templates: envTemplates,
    manifestFileName: GENERATED_PATHS.manifests.env,
    configKey: 'env',
    createDiscovery: (pathResolver, opts) =>
      new EnvDiscovery(pathResolver, {
        ...opts,
        mode: options.mode || opts.mode || 'development',
      }),
  })({
    ...options,
    disableHmr: true, // Static env vars - no HMR needed
  });
}
