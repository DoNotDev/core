/**
 * @fileoverview Next.js Theme Handler - Platform Adapter
 * @description Transforms pure theme data from ThemeDiscovery into Next.js compatible format. Follows Vite pattern: populates globalThis._DNDEV_CONFIG_ instead of generating files.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseNextHandler } from './BaseNextHandler.js';
import { CONFIG_KEYS } from '../../constants.js';
import { ThemeDiscovery } from '../../discovery/ThemeDiscovery.js';
import { createMissingResourceError } from '../../utils/buildError.js';
import { CSSExtractor } from '../../utils/CSSExtractor.js';

export class NextThemeHandler extends BaseNextHandler {
  constructor(options = {}) {
    super(ThemeDiscovery, options);
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      // Remove provider generation - follow Vite pattern
      generateThemeProvider: false,
      manifestPath: 'public/theme-manifest.json',
    };
  }

  createDiscovery(discoveryClass) {
    // Theme discovery needs CSS extraction only
    this.cssExtractor = new CSSExtractor(this.pathResolver, {
      debug: this.options.debug,
    });

    return new discoveryClass(
      this.cssExtractor,
      this.pathResolver,
      this.options
    );
  }

  getHandlerName() {
    return 'Theme';
  }

  // Enterprise-grade: Log discovery results (business metrics, not process)
  logDiscoveryResults(themeData) {
    const themes = themeData.themes || [];
    const customThemes = themes.filter((t) => !t.essential).length;
    const totalThemes = themes.length;

    // Framework requires at least 1 theme - fail fast
    if (totalThemes === 0) {
      throw createMissingResourceError(
        'dndev-theme',
        'themes',
        'Framework requires at least one theme. Ensure CSS files with theme definitions exist in your project. Check that @donotdev/components/styles are imported.'
      );
    }

    this.logger.info(
      `🎨 Themes: ${totalThemes} discovered${customThemes > 0 ? ` (${customThemes} custom)` : ''}`
    );
  }

  // === DISCOVERY INTEGRATION ===

  async getDiscoveryData() {
    return await this.discovery.discoverThemes();
  }

  getAPIRewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/themes',
          destination: '/api/themes/route',
        },
      ],
      fallback: [],
    };
  }

  formatAPIResponse(themeData) {
    return {
      themes: themeData.themes,
      variables: themeData.variables,
      stats: themeData.stats,
      timestamp: themeData.timestamp,
    };
  }

  createManifestContent(themeData) {
    return {
      themes: themeData.themes,
      variables: {
        total: themeData.variables.all.length,
        framework: themeData.variables.framework.length,
        consumer: themeData.variables.consumer.length,
      },
      stats: themeData.stats,
      generatedAt: new Date().toISOString(),
    };
  }

  getGenerationSummary(themeData) {
    return `${themeData.themes.length} themes, ${themeData.variables.all.length} variables`;
  }

  // === FILE GENERATION ===
  // Remove provider generation - only generate utilities and manifest

  async generateSpecificFiles(themeData) {
    // Generate API route
    await this.generateAPIHandler(themeData);
  }

  // Theme provider generation handled by framework

  // === DIRECT CONFIG GENERATION ===

  async generateThemes() {
    const themeData = await this.getDiscoveryData();
    await this.generateConfigFile(themeData);
  }

  async generateConfigFile(themeData) {
    // Use parent class implementation which reads from constants
    return super.generateConfigFile(themeData);
  }

  generateConfigContent(themeData) {
    const { themes, variables } = themeData;

    return `// Auto-generated DnDev config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_ with discovery results

const themeConfig = {
  discovered: ${JSON.stringify(themes, null, 2)},
  variables: ${JSON.stringify(variables, null, 2)},
  utilities: {
    framework: ${JSON.stringify(variables.framework, null, 2)},
    consumer: ${JSON.stringify(variables.consumer, null, 2)},
    all: ${JSON.stringify(variables.all, null, 2)},
  },
  manifest: {
    totalThemes: ${themes.length},
    totalVariables: ${variables.all.length},
    frameworkVariables: ${variables.framework.length},
    consumerVariables: ${variables.consumer.length},
    generatedAt: new Date().toISOString(),
  },
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
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS.themes} = themeConfig;
}

// Export for compatibility
export default themeConfig;
`;
  }

  // === UTILITY METHODS ===

  getThemeHook() {
    return `
// Auto-generated theme hook by @donotdev/config
// Generated at ${new Date().toISOString()}

import { useThemeStore } from '@donotdev/stores';

export function useTheme() {
  return useThemeStore();
}

export default useTheme;
`;
  }
}

export function createNextThemeHandler(options = {}) {
  return new NextThemeHandler(options);
}
