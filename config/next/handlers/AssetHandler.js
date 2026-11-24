/**
 * @fileoverview Next.js Asset Handler - Platform Adapter
 * @description Transforms pure asset data from AssetDiscovery into Next.js compatible format.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseNextHandler } from './BaseNextHandler.js';
import { GENERATED_PATHS, CONFIG_KEYS } from '../../constants.js';
import { AssetDiscovery } from '../../discovery/AssetDiscovery.js';

export class NextAssetHandler extends BaseNextHandler {
  constructor(options = {}) {
    super(AssetDiscovery, options);
  }

  // === HANDLER CONFIGURATION ===

  getHandlerDefaults() {
    return {
      manifestPath: GENERATED_PATHS.next.assetManifest,
      generateManifest: true,
    };
  }

  createDiscovery(discoveryClass) {
    return new discoveryClass(this.pathResolver, this.options);
  }

  getHandlerName() {
    return 'Asset';
  }

  /**
   * Override generateConfigContent to match Vite's structure
   * Vite uses: _DNDEV_CONFIG_.assets = { mapping, logoSvgContent, manifest }
   */
  generateConfigContent(assetData) {
    const logoSvgContent = assetData.manifest?.logoSvgContent || null;

    return `// Auto-generated DnDev config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_ with discovery results

const assetConfig = ${JSON.stringify(assetData, null, 2)};

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
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS.assets} = {
    mapping: assetConfig.manifest,
    logoSvgContent: ${JSON.stringify(logoSvgContent)},
    manifest: {
      totalAssets: ${assetData.assets?.length || 0},
      generatedAt: '${new Date().toISOString()}',
    },
  };
}

// Export for compatibility
export default assetConfig;
`;
  }

  // Enterprise-grade: Log discovery results (business metrics, not process)
  logDiscoveryResults(assetData) {
    const totalAssets = assetData.assets?.length || 0;
    const generatedAssets = assetData.generatedAssets?.length || 0;

    if (generatedAssets > 0) {
      this.logger.info(
        `🎯 Assets: ${totalAssets} found, ${generatedAssets} generated`
      );
    } else {
      this.logger.info(`🎯 Assets: ${totalAssets} found`);
    }
  }

  // === DISCOVERY INTEGRATION ===

  /**
   * Flag codes of the app's languages, from the i18n discovery, and the route discovery's
   * entities resolver (set by runDiscoveries): the asset discovery copies their flags,
   * plus every country flag when an entity has a `tel` field, to `public/flags/`
   * (AssetDiscovery.useFlagCodes).
   * @param {string[]} flagCodes - The i18n discovery's `flagCodes`
   * @param {{ usesFieldType: (type: string) => Promise<boolean> }} entityResolver - `createEntityResolver`
   * @since 0.3.2
   */
  useFlagCodes(flagCodes, entityResolver) {
    this.discovery.useFlagCodes(flagCodes, entityResolver);
  }

  async getDiscoveryData() {
    return await this.discovery.discoverAssets();
  }

  getAPIRewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/assets',
          destination: '/api/assets/asset',
        },
      ],
      fallback: [],
    };
  }


  createManifestContent(assetData) {
    return {
      assets: assetData.assets.map((asset) => ({
        path: asset.path,
        type: asset.type,
        format: asset.format,
        size: asset.size,
        optimized: asset.optimized,
      })),
      manifest: assetData.manifest,
      copiedAssets: assetData.copiedAssets,
      source: assetData.source,
      totalAssets: assetData.assets.length,
      generatedAt: new Date().toISOString(),
    };
  }

  getGenerationSummary(assetData) {
    return `${assetData.assets.length} assets, ${assetData.copiedAssets.length} copied from framework`;
  }

  // === FILE GENERATION ===

  async generateSpecificFiles(assetData) {
    if (this.options.generateManifest) {
      await this.generateAssetManifest(assetData);
    }
  }

  async generateAssetManifest(assetData) {
    const manifestContent = this.generateAssetManifestContent(assetData);
    this.writeGeneratedFile(
      'src/app/assets.generated.ts',
      manifestContent,
      'asset manifest'
    );
  }

  generateAssetManifestContent(assetData) {
    const assetExports = assetData.assets
      .map((asset) => {
        return `  {
    path: '${asset.path}',
    type: '${asset.type}',
    format: '${asset.format}',
    size: ${asset.size},
    optimized: ${asset.optimized || false}
  }`;
      })
      .join(',\n');

    const manifestExports = Object.entries(assetData.manifest)
      .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
      .join(',\n');

    const logoSvgContent = assetData.manifest.logoSvgContent || null;

    return `// Auto-generated asset manifest by @donotdev/config
// Generated at ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_ with discovery results

export const assets = [
${assetExports}
];

export const assetManifest = {
${manifestExports}
};

export const copiedAssets = ${JSON.stringify(assetData.copiedAssets, null, 2)};

export const assetStats = {
  totalAssets: ${assetData.assets.length},
  copiedAssets: ${assetData.copiedAssets.length},
  source: '${assetData.source}',
  generatedAt: '${new Date().toISOString()}'
};

export default assets;
`;
  }
}

// Export factory function for easier usage
export function createNextAssetHandler(options = {}) {
  return new NextAssetHandler(options);
}
