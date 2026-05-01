/**
 * @fileoverview Pure Asset Discovery Engine
 * @description Platform-agnostic asset discovery and management. Returns plain data without knowledge of Vite, Next.js, or any platform.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseDiscovery } from './BaseDiscovery.js';
import {
  SCAN_PATTERNS,
  FRAMEWORK_CONFIG,
  DIR_PATHS,
  GLOB_OPTIONS,
  getGlobOptionsFor,
} from '../constants.js';

export class AssetDiscovery extends BaseDiscovery {
  constructor(pathResolver, options = {}) {
    super(pathResolver, {
      assets: SCAN_PATTERNS.assets.fallback,
      assetPatterns: SCAN_PATTERNS.assets.patterns,
      frameworkPackage: FRAMEWORK_CONFIG.package,
      assetsPath: FRAMEWORK_CONFIG.assetsPath,
      modernFormats: SCAN_PATTERNS.assets.modern,
      ...options,
    });

    this.hasRunForSession = false;
  }

  // === ABSTRACT METHOD IMPLEMENTATIONS ===

  _getDiscoveryType() {
    return 'Asset';
  }

  async _getPatterns() {
    return await this.pathResolver.resolvePatterns('assets');
  }

  _getPatternType() {
    return 'assets';
  }

  async _processFiles(files) {
    const appRoot = this.pathResolver.getAppRoot();

    // 1. Ensure default assets (manifest.json, etc.) - but NOT logo assets
    const copiedAssets = await this._ensureDefaultAssets(appRoot);

    // 2. Check if logo.svg exists (user must provide it)
    const logoPath = this.pathResolver.resolveAppPath('public/logo.svg');
    const logoExists = this.pathResolver.pathExists(logoPath);

    if (!logoExists) {
      // Warn user - they need to provide logo.svg
      this.logger.warn(
        'logo.svg not found in public/. Add your logo.svg to generate PWA assets, or copy from node_modules/@donotdev/ui/assets/logo.svg'
      );
    }

    // 3. Generate missing PWA assets from logo.svg (if it exists and generation enabled)
    let generatedAssets = [];
    const finalLogoPath = this.pathResolver.resolveAppPath('public/logo.svg');
    if (
      this.pathResolver.pathExists(finalLogoPath) &&
      this.options.generateAssets !== false
    ) {
      const generationResult = await this._generateMissingAssets(appRoot);
      generatedAssets = generationResult?.generated || [];
    }

    // Process files from pattern system (like other discoveries)
    const { consumerFiles } = files;
    const assets = await this._processAssetFiles(consumerFiles);

    // Build asset manifest
    const manifest = this._buildAssetManifest(assets);

    // Try to read logo.svg content for inlining (may be null if missing)
    const logoSvgContent = await this._readLogoSvgContent('/logo.svg', appRoot);

    return {
      assets,
      manifest: {
        ...manifest,
        logoSvgContent,
      },
      copiedAssets,
      generatedAssets,
      // Expose PWA icons for PWADiscovery to use (avoids re-scanning)
      pwaIcons: this._extractPWAIcons(assets),
    };
  }

  /**
   * Extract PWA icons from discovered assets
   * Used by PWADiscovery to avoid re-scanning filesystem
   * @param {Array} assets - Discovered assets
   * @returns {Array} PWA icon data
   */
  _extractPWAIcons(assets) {
    const pwaIconPatterns = [
      /icon-(\d+)x(\d+)\.(png|jpg|jpeg|webp|svg)/i,
      /apple-touch-icon/i,
      /android-chrome/i,
      /favicon\.(ico|svg)/i,
    ];

    return assets
      .filter((asset) => {
        const fileName = asset.path.split('/').pop() || '';
        return pwaIconPatterns.some((pattern) => pattern.test(fileName));
      })
      .map((asset) => {
        const fileName = asset.path.split('/').pop() || '';
        const sizeMatch = fileName.match(/(\d+)x(\d+)/);
        const size = sizeMatch
          ? { width: parseInt(sizeMatch[1]), height: parseInt(sizeMatch[2]) }
          : this._getDefaultIconSize(fileName);

        return {
          type: 'icon',
          path: asset.path.replace(/^\/?public\//, ''),
          size,
          format: asset.format || this._getFormatFromPath(asset.path),
          purpose: this._getIconPurpose(fileName),
        };
      });
  }

  _getDefaultIconSize(fileName) {
    if (fileName.includes('apple-touch-icon')) {
      return { width: 180, height: 180 };
    }
    if (fileName.includes('favicon')) {
      return { width: 32, height: 32 };
    }
    return { width: 192, height: 192 };
  }

  _getFormatFromPath(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    return ext || 'png';
  }

  _getIconPurpose(fileName) {
    if (fileName.includes('maskable') || fileName.includes('mask')) {
      return 'maskable';
    }
    return 'any';
  }

  _getEmptyResult() {
    return {
      assets: [],
      manifest: this._getEmptyManifest(),
      copiedAssets: [],

      timestamp: Date.now(),
    };
  }

  _getDiscoverySummary() {
    const assetCount = this.cache?.assets?.length || 0;
    const copiedCount = this.cache?.copiedAssets?.length || 0;
    return `${assetCount} assets, ${copiedCount} copied`;
  }

  // === PUBLIC API METHODS ===

  /**
   * Discover assets and ensure fallbacks, return pure data
   * @param {boolean} force - Force re-discovery
   * @returns {Object} Pure asset data
   */
  async discoverAssets(force = false) {
    return await this.discover(force);
  }

  /**
   * Get discovered assets (cached)
   */
  getAssets() {
    return this.cache?.assets || [];
  }

  /**
   * Get asset manifest (cached)
   */
  getManifest() {
    return this.cache?.manifest || this._getEmptyManifest();
  }

  /**
   * Get optimal asset for a given base name
   */
  getOptimalAsset(baseName, formatPreference) {
    const assets = this.getAssets().map((a) => a.path);
    const preference = formatPreference || this.options.modernFormats;

    for (const format of preference) {
      const candidate = `/${baseName}.${format}`;
      if (assets.includes(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  // === PRIVATE METHODS ===

  async _ensureDefaultAssets(appRoot) {
    // Always ensure assets are present, don't use session cache
    this.logger.debug('Ensuring default assets with modern format support...');

    const copiedAssets = [];

    try {
      // Resolve framework assets directory
      const frameworkAssetsDir = await this._resolveFrameworkAssetsDir(appRoot);
      this.logger.debug(
        `Framework assets directory resolved to: ${frameworkAssetsDir}`
      );
      if (!frameworkAssetsDir) {
        this.logger.debug(
          'Framework assets directory not found, skipping defaults'
        );
        return copiedAssets;
      }

      const publicDir = this.pathResolver.resolveAppPath(DIR_PATHS.public);
      if (!this.pathResolver.pathExists(publicDir)) {
        this.pathResolver.mkdir(publicDir);
        this.logger.debug(`Created public directory: ${publicDir}`);
      }

      // Copy default assets
      for (const asset of this.options.assets) {
        const success = await this._ensureAsset(
          asset,
          publicDir,
          frameworkAssetsDir
        );
        if (success) {
          copiedAssets.push(asset);
        }
      }

      if (copiedAssets.length > 0) {
        this.logger.debug(
          `Added ${copiedAssets.length} default assets from DNDev framework`
        );
      }

      // Don't set session cache - always ensure assets are present
    } catch (error) {
      this.logger.debug(`Failed to ensure default assets: ${error.message}`);
    }

    return copiedAssets;
  }

  async _ensureAsset(assetName, publicDir, frameworkAssetsDir) {
    const assetPath = this.pathResolver.resolveAppPath(
      `${DIR_PATHS.public}/${assetName}`
    );

    // Asset already exists - return false (not copied, just exists)
    if (this.pathResolver.pathExists(assetPath)) {
      this.logger.debug(`Asset exists: ${assetName}`);
      return false;
    }

    // Try to copy from framework (binary-safe for images, fonts, etc.)
    const frameworkAssetPath = this.pathResolver.normalizePath(
      `${frameworkAssetsDir}/${assetName}`
    );
    if (this.pathResolver.pathExists(frameworkAssetPath)) {
      if (await this.pathResolver.copy(frameworkAssetPath, assetPath)) {
        this.logger.debug(`Copied framework asset: ${assetName}`);
        return true;
      } else {
        this.logger.debug(`Failed to copy framework asset: ${assetName}`);
      }
    }

    return false;
  }

  async _processAssetFiles(consumerFiles) {
    const assets = [];

    for (const filePath of consumerFiles) {
      try {
        const fileInfo = this.pathResolver.getFileInfo(filePath);
        if (fileInfo && fileInfo.isFile) {
          // Extract filename from full path
          const fileName =
            filePath.split('/').pop() || filePath.split('\\').pop();
          const assetInfo = this._analyzeAsset(fileName, fileInfo.size);
          if (assetInfo) {
            assets.push(assetInfo);
          }
        }
      } catch (error) {
        this.logger.debug(
          `Error processing asset file ${filePath}: ${error.message}`
        );
      }
    }

    this.logger.debug(
      `Processed ${assets.length} assets from ${consumerFiles.length} files`
    );

    return assets;
  }

  _analyzeAsset(fileName, size) {
    const type = this._determineAssetType(fileName);
    const format = this._determineAssetFormat(fileName);

    // Check if asset matches any of our patterns
    const matchesPattern = this.options.assetPatterns.some((pattern) =>
      this._matchesPattern(fileName, pattern)
    );

    if (!matchesPattern) {
      this.logger.debug(
        `Asset ${fileName} does not match any pattern, skipping`
      );
      return null;
    }

    return {
      path: `/${fileName}`,
      name: fileName,
      type,
      format,
      size,
      sizeFormatted: this._formatBytes(size),
      isModern: this.options.modernFormats.includes(format),
    };
  }

  _determineAssetType(fileName) {
    const lowerName = fileName.toLowerCase();

    if (lowerName.includes('favicon')) return 'favicon';
    if (lowerName.includes('logo')) return 'logo';
    if (lowerName.includes('icon')) return 'icon';
    if (lowerName.includes('apple-touch')) return 'apple-touch-icon';
    if (lowerName.includes('android-chrome')) return 'android-icon';
    if (lowerName.includes('manifest')) return 'manifest';

    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(ext)) {
      return 'image';
    }
    if (['woff2', 'woff', 'ttf', 'otf'].includes(ext)) return 'font';
    if (['json'].includes(ext)) return 'json';
    if (['ico'].includes(ext)) return 'icon';

    return 'unknown';
  }

  _determineAssetFormat(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _matchesPattern(filename, pattern) {
    const lowerFilename = filename.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    return lowerFilename.includes(lowerPattern.replace('*', ''));
  }

  _buildAssetManifest(assets) {
    const assetPaths = assets.map((a) => a.path);

    const manifest = {
      logo: {
        optimal: this._getOptimalAsset(
          'logo',
          assetPaths,
          this.options.modernFormats
        ),
        fallback: this._getOptimalAsset('logo', assetPaths, [
          'png',
          'jpg',
          'jpeg',
        ]),
      },
      favicon: {
        optimal: this._getOptimalAsset('favicon', assetPaths, ['svg', 'ico']),
        fallback: this._getOptimalAsset('favicon', assetPaths, ['ico']),
      },
      appleTouchIcon: this._getOptimalAsset('apple-touch-icon', assetPaths, [
        'png',
      ]),
      androidChrome: {
        192: this._getOptimalAsset('android-chrome-192x192', assetPaths, [
          'png',
        ]),
        512: this._getOptimalAsset('android-chrome-512x512', assetPaths, [
          'png',
        ]),
      },
      manifest:
        assetPaths.find((path) => path.includes('manifest.json')) || null,
      modernFormats: assets.filter((a) => a.isModern).map((a) => a.path),
      fallbackFormats: assets.filter((a) => !a.isModern).map((a) => a.path),
    };

    return manifest;
  }

  _getOptimalAsset(baseName, assetPaths, formatPreference) {
    for (const format of formatPreference) {
      const candidate = `/${baseName}.${format}`;
      if (assetPaths.includes(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  async _resolveFrameworkAssetsDir(appRoot) {
    try {
      // Resolve @donotdev/ui package from repo root (not app root)
      // This ensures we get the correct framework package, not a corrupted copy from app's node_modules
      const repoRoot = this.pathResolver.getRepoRoot();
      const uiPackagePath = await this._resolvePackage(
        '@donotdev/ui',
        repoRoot
      );
      if (!uiPackagePath) {
        this.logger.debug('@donotdev/ui package not found');
        return null;
      }

      // Append /assets to resolved package path
      const assetsDir = this.pathResolver.normalizePath(
        `${uiPackagePath}/assets`
      );

      if (!this.pathResolver.pathExists(assetsDir)) {
        this.logger.debug(`Assets directory not found: ${assetsDir}`);
        return null;
      }

      this.logger.debug(`Using framework assets from: ${assetsDir}`);
      return assetsDir;
    } catch (error) {
      this.logger.debug(
        `Error resolving framework assets directory: ${error.message}`
      );
      return null;
    }
  }

  async _resolvePackage(packageName, appRoot) {
    try {
      // Use unified resolveFrameworkPackage() method
      const resolved = this.pathResolver.resolveFrameworkPackage(
        packageName,
        appRoot
      );
      if (resolved) {
        this.logger.debug(`Found package: ${resolved}`);
        return resolved;
      }

      this.logger.debug(`Package ${packageName} not found`);
      return null;
    } catch (error) {
      this.logger.debug(
        `Error resolving package ${packageName}: ${error.message}`
      );
      return null;
    }
  }

  _getEmptyManifest() {
    return {
      logo: { optimal: null, fallback: null },
      favicon: { optimal: null, fallback: null },
      appleTouchIcon: null,
      androidChrome: { 192: null, 512: null },
      manifest: null,
      modernFormats: [],
      fallbackFormats: [],
      logoSvgContent: null,
    };
  }

  /**
   * Read SVG content from logo file if it's an SVG
   * @param {string|null} logoPath - Path to logo file (web path format, e.g., /logo.svg)
   * @param {string} appRoot - App root directory
   * @returns {Promise<string|null>} SVG content or null
   */
  async _readLogoSvgContent(logoPath, appRoot) {
    if (!logoPath || !logoPath.endsWith('.svg')) {
      return null;
    }

    try {
      // Convert web path to filesystem path
      // logoPath is like "/logo.svg", need to resolve to actual file
      const logoFileName = logoPath.slice(1); // Remove leading slash: "logo.svg"
      const logoFilePath = this.pathResolver.resolveAppPath(
        `${DIR_PATHS.public}/${logoFileName}`
      );

      // Only read from public/ - no framework fallback
      if (!this.pathResolver.pathExists(logoFilePath)) {
        return null;
      }

      // Read as text (logo files are text-based SVGs or similar)
      const content = await this.pathResolver.read(logoFilePath, {
        format: 'text',
      });
      return content || null;
    } catch (error) {
      this.logger.debug(`Failed to read logo SVG content: ${error.message}`);
      return null;
    }
  }

  /**
   * Copy framework logo.svg to public/logo.svg
   * @param {string} appRoot - Application root directory
   * @returns {Promise<boolean>} True if copied successfully
   */
  async _copyFrameworkLogo(appRoot) {
    try {
      const frameworkAssetsDir = await this._resolveFrameworkAssetsDir(appRoot);
      if (!frameworkAssetsDir) {
        this.logger.debug('Framework assets directory not found');
        return false;
      }

      const frameworkLogoPath = this.pathResolver.normalizePath(
        `${frameworkAssetsDir}/logo.svg`
      );
      if (!this.pathResolver.pathExists(frameworkLogoPath)) {
        this.logger.debug('Framework logo.svg not found');
        return false;
      }

      const publicDir = this.pathResolver.resolveAppPath(DIR_PATHS.public);
      if (!this.pathResolver.pathExists(publicDir)) {
        this.pathResolver.mkdir(publicDir);
      }

      const publicLogoPath =
        this.pathResolver.resolveAppPath('public/logo.svg');

      const success = await this.pathResolver.copy(
        frameworkLogoPath,
        publicLogoPath
      );
      return success;
    } catch (error) {
      this.logger.debug(`Failed to copy framework logo: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate missing PWA assets from logo.svg
   * Creates favicon, icons, and manifest assets from logo.svg if they don't exist
   * @param {string} appRoot - Application root directory
   * @returns {Promise<Object>} Generation results
   */
  async _generateMissingAssets(appRoot) {
    const logoPath = this.pathResolver.resolveAppPath('public/logo.svg');
    const publicDir = this.pathResolver.resolveAppPath('public');

    if (!this.pathResolver.pathExists(logoPath)) {
      this.logger.debug(
        'logo.svg not found in public/, skipping asset generation'
      );
      return {
        generated: [],
        skipped: [],
        error: 'logo.svg not found in public/',
      };
    }

    // Assets that require sharp for conversion
    const sharpAssets = [
      { name: 'favicon.ico', size: 32, format: 'ico' },
      { name: 'apple-touch-icon.png', size: 180, format: 'png' },
      { name: 'icon-192x192.png', size: 192, format: 'png' },
      { name: 'icon-512x512.png', size: 512, format: 'png' },
    ];

    // Assets that are simple copies (no sharp needed)
    const copyAssets = [{ name: 'favicon.svg', format: 'svg' }];

    const generated = [];
    const skipped = [];

    try {
      // Read logo content once (as text - logo files are text-based SVGs or similar)
      const logoContent = await this.pathResolver.read(logoPath, {
        format: 'text',
      });
      if (!logoContent) {
        return {
          generated: [],
          skipped: [...copyAssets, ...sharpAssets].map((a) => a.name),
          error: 'Failed to read logo.svg',
        };
      }

      // 1. Handle copy assets first (no sharp needed)
      for (const asset of copyAssets) {
        const publicPath = `${publicDir}/${asset.name}`;
        if (this.pathResolver.pathExists(publicPath)) {
          skipped.push(asset.name);
          continue;
        }

        try {
          await this.pathResolver.write(`public/${asset.name}`, logoContent);
          generated.push(asset.name);
        } catch (error) {
          this.logger.debug(`Failed to copy ${asset.name}: ${error.message}`);
          skipped.push(asset.name);
        }
      }

      // 2. Handle sharp assets (require image conversion)
      const sharp = await import('sharp').catch(() => null);
      if (!sharp) {
        this.logger.debug('sharp not installed, skipping PNG/ICO generation');
        skipped.push(...sharpAssets.map((a) => a.name));
      } else {
        for (const asset of sharpAssets) {
          const publicPath = `${publicDir}/${asset.name}`;
          if (this.pathResolver.pathExists(publicPath)) {
            skipped.push(asset.name);
            continue;
          }

          try {
            const sharpInstance = sharp
              .default(logoPath)
              .resize(asset.size, asset.size, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 },
              });

            let outputBuffer;
            if (asset.format === 'ico') {
              outputBuffer = await sharpInstance.toFormat('png').toBuffer();
            } else {
              outputBuffer = await sharpInstance
                .toFormat(asset.format)
                .toBuffer();
            }

            await this.pathResolver.write(`public/${asset.name}`, outputBuffer);
            generated.push(asset.name);
          } catch (error) {
            this.logger.debug(
              `Failed to generate ${asset.name}: ${error.message}`
            );
            skipped.push(asset.name);
          }
        }
      }

      return {
        generated,
        skipped,
        error: null,
      };
    } catch (error) {
      this.logger.debug(`Asset generation failed: ${error.message}`);
      return {
        generated: [],
        skipped: requiredAssets.map((a) => a.name),
        error: error.message,
      };
    }
  }
}
