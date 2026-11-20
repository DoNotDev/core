/**
 * @fileoverview Next.js I18n Handler - Platform Adapter
 * @description Transforms pure i18n data from I18nDiscovery into Next.js compatible format. Follows Vite pattern: populates globalThis._DNDEV_CONFIG_ instead of generating files.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseNextHandler } from './BaseNextHandler.js';
import { CONFIG_KEYS } from '../../constants.js';
import { I18nDiscovery } from '../../discovery/I18nDiscovery.js';
import { DEFAULT_OPTIONS } from '../../next/options.js';

export class NextI18nHandler extends BaseNextHandler {
  constructor(options = {}) {
    super(I18nDiscovery, options);
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      // Remove provider generation - follow Vite pattern
      generateI18nProvider: false,
      generateTranslationHooks: false,
      manifestPath: 'public/i18n-manifest.json',
      fallbackLanguage: 'en',
    };
  }

  createDiscovery(discoveryClass) {
    // Merge discovery defaults with handler options
    const mergedDiscoveryOptions = {
      ...DEFAULT_OPTIONS.discovery, // Base discovery defaults from config
      ...this.options, // Handler options override discovery defaults
      fallbackLanguage: this.options.fallbackLanguage, // I18n-specific override
    };
    return new discoveryClass(this.pathResolver, mergedDiscoveryOptions);
  }

  getHandlerName() {
    return 'I18n';
  }

  // Enterprise-grade: Log discovery results (business metrics, not process)
  logDiscoveryResults(i18nData) {
    const languages = i18nData.supportedLanguages || [];
    const namespaces =
      Object.keys(i18nData.mapping || {}).filter((ns) => ns !== 'default')
        .length || 0;

    this.logger.info(
      `🌐 I18n: ${languages.length} languages, ${namespaces} namespaces`
    );
  }

  // === DISCOVERY INTEGRATION ===

  async getDiscoveryData() {
    return await this.discovery.discoverTranslations();
  }

  getAPIRewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/i18n',
          destination: '/api/i18n/route',
        },
        {
          source: '/api/translations/:namespace/:language',
          destination: '/api/translations/[namespace]/[language]/route',
        },
      ],
      fallback: [],
    };
  }

  formatAPIResponse(i18nData) {
    return {
      mapping: i18nData.mapping,
      languages: i18nData.supportedLanguages,
      namespaces: i18nData.allNamespaces,
      eagerNamespaces: i18nData.eagerNamespaces,
      fallbackLanguage: i18nData.fallbackLanguage,
      stats: i18nData.stats,
      timestamp: i18nData.timestamp,
    };
  }

  createManifestContent(i18nData) {
    return {
      languages: i18nData.supportedLanguages,
      namespaces: i18nData.allNamespaces,
      eagerNamespaces: i18nData.eagerNamespaces,
      fallbackLanguage: i18nData.fallbackLanguage,
      stats: i18nData.stats,
      generatedAt: new Date().toISOString(),
    };
  }

  getGenerationSummary(i18nData) {
    const stats = i18nData.stats || {};
    const totalNamespaces = stats.totalNamespaces || 0;
    const totalLanguages = stats.totalLanguages || 0;
    return `${totalNamespaces} namespaces, ${totalLanguages} languages`;
  }

  // === FILE GENERATION ===
  // Remove provider generation - only generate manifest and API routes

  async generateSpecificFiles(i18nData) {
    // Generate manifest
    if (this.options.generateManifest) {
      await this.generateManifest(i18nData);
    }

    // Generate API route
    await this.generateAPIHandler(i18nData);
  }

  // I18n provider generation handled by framework

  // === DIRECT CONFIG GENERATION ===

  async generateI18n() {
    const i18nData = await this.getDiscoveryData();
    await this.generateConfigFile(i18nData);
  }

  async generateConfigFile(i18nData) {
    // Use parent class implementation which reads from constants
    return super.generateConfigFile(i18nData);
  }

  generateConfigContent(i18nData) {
    const {
      mapping,
      supportedLanguages,
      eagerNamespaces,
      fallbackLanguage,
      content,
    } = i18nData;

    return `// Auto-generated DnDev config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_ with discovery results

const i18nConfig = {
  mapping: ${JSON.stringify(mapping, null, 2)},
  languages: ${JSON.stringify(supportedLanguages, null, 2)},
  eager: ${JSON.stringify(eagerNamespaces, null, 2)},
  fallback: '${fallbackLanguage}',
  content: ${JSON.stringify(content || {}, null, 2)},
  storage: {
    type: 'localStorage',
    prefix: 'dndev_i18n_',
    ttl: 24 * 60 * 60 * 1000,
    encryption: false,
    maxSize: 5 * 1024 * 1024,
  },
  performance: {
    cacheSize: 100,
    errorCacheTTL: 30000,
  },
  manifest: {
    totalFiles: ${Object.keys(mapping).length},
    totalNamespaces: ${Object.keys(mapping).length},
    totalLanguages: ${supportedLanguages.length},
    eagerNamespaces: ${eagerNamespaces.length},
    generatedAt: new Date().toISOString(),
  },
  debug: ${this.options.debug},
};

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
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS.i18n} = i18nConfig;
}

// Export for compatibility
export default i18nConfig;
`;
  }
}

export function createNextI18nHandler(options = {}) {
  return new NextI18nHandler(options);
}
