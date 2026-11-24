/**
 * @fileoverview Pure Asset Discovery Engine
 * @description Platform-agnostic asset discovery and management. Returns plain data without knowledge of Vite, Next.js, or any platform.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createHash } from 'node:crypto';

import { BaseDiscovery } from './BaseDiscovery.js';
import {
  SCAN_PATTERNS,
  FRAMEWORK_CONFIG,
  DEFAULT_OG_IMAGE,
  DIR_PATHS,
  GLOB_OPTIONS,
  I18N_PATHS,
  getGlobOptionsFor,
} from '../constants.js';
import {
  FLAGS_PUBLIC_PATH,
  flagFileName,
  telFieldFlagCodes,
} from '../utils/flagAsset.js';
import { createBuildError } from '../utils/buildError.js';

/** Link-preview canvas and the box the logo is fitted into. */
const OG_IMAGE = {
  width: 1200,
  height: 630,
  logoWidth: 720,
  logoHeight: 360,
  background: '#ffffff',
};

/**
 * Build warning when the app has no `public/logo.svg` (once per discovery run; the build
 * continues without the logo and the icons generated from it). Framework default icons found
 * in `public/` ({@link FRAMEWORK_DEFAULT_ICON_SHA256}) are named after it.
 */
export const MISSING_LOGO_WARNING =
  'public/logo.svg is missing: it is the site logo (Organization / publisher logo in the JSON-LD, the default logo) and the source of the favicon, PWA icons and og-image.png. Add public/logo.svg.';

/**
 * The icons derived from `public/logo.svg` by {@link AssetDiscovery#_generateMissingAssets}
 * (`sharp`: rasterized, needs the sharp package; `favicon.svg` is a copy of the logo).
 */
const LOGO_OUTPUTS = [
  { name: 'favicon.svg', sharp: false },
  { name: 'favicon.ico', size: 32, sharp: true },
  { name: 'apple-touch-icon.png', size: 180, sharp: true },
  { name: 'icon-192x192.png', size: 192, sharp: true },
  { name: 'icon-512x512.png', size: 512, sharp: true },
  { name: DEFAULT_OG_IMAGE.slice(1), sharp: true },
];

/**
 * Format preference of the asset manifest's `logo.optimal`: `public/logo.svg` whenever it
 * exists, a raster logo (`logo.webp`, `logo.avif`, `logo.png`) only without it.
 */
const LOGO_OPTIMAL_FORMATS = ['svg', 'webp', 'avif', 'png', 'jpg', 'jpeg'];

/** Format preference of `logo.fallback`: the raster logo for consumers that cannot use SVG. */
const LOGO_FALLBACK_FORMATS = ['png', 'jpg', 'jpeg'];

/**
 * Record of the icons generated from `logo.svg`, relative to the app root and committed with
 * the app (outside `public/`: never deployed). JSON, one entry per generated icon:
 * `{ "<file in public/>": { "logo": "<sha256 of logo.svg>", "sha256": "<sha256 of the icon>" } }`.
 * An icon whose bytes still match its entry is the generator's, regenerated when `logo.svg`
 * changes; any other icon is the app's own and never touched.
 */
export const ICON_STATE_FILE = '.dndev/icons.json';

/** Build warning when `logo.svg` exists and sharp is not installed (once per discovery run). */
export const SHARP_MISSING_WARNING =
  'sharp is not installed: favicon.ico, apple-touch-icon.png, icon-192x192.png, icon-512x512.png and og-image.png cannot be generated from public/logo.svg or kept in sync with it. Add sharp to the app devDependencies.';

/**
 * sha256 of every framework `logo.svg` (`packages/ui/assets/logo.svg`, the CLI templates'
 * `logo.svg.example`, `apps/dndev/public/logo.svg`, current and past versions). An app with
 * one of these logos is a DoNotDev app: its DoNotDev icons are correct and never replaced.
 * Regenerate: see {@link FRAMEWORK_DEFAULT_ICON_SHA256}.
 */
export const FRAMEWORK_DEFAULT_LOGO_SHA256 = new Set([
  '2b2e767d7d7b8f8775f6f7c3c670f4dba20d5b721da40812b2e76b70efe5bcb2',
  '8a6ee0566fb17bfd659284911fe9e3913fdb6b33b339b0912a68c9f6f825e690',
]);

/**
 * sha256 of every icon the framework ships or has shipped, which an app must never deploy:
 * `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192x192.png`,
 * `icon-512x512.png`, `og-image.png` (and their `.example` template copies) in every git
 * revision of `packages/ui/assets`, `packages/cli/templates/app-demo/public`,
 * `packages/cli/templates/app-dndev/public` and `apps/dndev/public`, plus the output of
 * {@link AssetDiscovery#_generateMissingAssets} for each {@link FRAMEWORK_DEFAULT_LOGO_SHA256}
 * logo (sharp 0.35.5 / libvips 8.18.7). Hard-coded, never computed at runtime.
 * Regenerate after changing one of those files or the generator's rendering (from the repo
 * root, zsh):
 *   for c in $(git rev-list --all -- packages/ui/assets packages/cli/templates/app-demo/public packages/cli/templates/app-dndev/public apps/dndev/public); do
 *     git ls-tree -r $c -- packages/ui/assets packages/cli/templates/app-demo/public packages/cli/templates/app-dndev/public apps/dndev/public; done |
 *     grep -E '/(favicon\.(svg|ico)|apple-touch-icon\.png|icon-(192x192|512x512)\.png|og-image\.png|logo\.svg)(\.example)?$' |
 *     awk '{print $3}' | sort -u | while read b; do git cat-file blob $b | sha256sum; done
 * (the `logo.svg` hashes go to {@link FRAMEWORK_DEFAULT_LOGO_SHA256}), then, for each
 * framework logo, run discovery on an empty app whose only file is `public/logo.svg` and
 * `sha256sum` its generated `public/` icons.
 */
export const FRAMEWORK_DEFAULT_ICON_SHA256 = new Set([
  // Shipped files
  '2b2e767d7d7b8f8775f6f7c3c670f4dba20d5b721da40812b2e76b70efe5bcb2', // favicon.svg
  '74f31fd5ca0d86421b467b2191f650d18ddc8334103142fcd3fc92d3e64a56b9', // favicon.ico (ui/assets)
  '3ed7374c80df501da384dcbec914e9a2270b2d0af4866061a5f5a61172d68b29', // favicon.ico (apps/dndev)
  'd6f17727836ccdd5dd784e6576bfe3293b4ea8523c25a98aa092be3f30594a59', // favicon.ico.example
  '69970478481c9a5cd9e4c3437c325a315d321e6b4b055a7da29a25d71bcf6b85', // apple-touch-icon.png (ui/assets)
  'c5de4c60c6412ad995ea48f5d4f6204f2874473f28044bc1a21aaf0ee224f6a6', // apple-touch-icon.png (templates, apps/dndev)
  'cf96587a25bbe3d259275f34f22fe5212188c2e1c8e74bf0cf7ad6fb72c82ca1', // icon-192x192.png
  '376d735f3903c8320c41df554900b03a93c1659508e91b75e0a9752464238fff', // icon-512x512.png
  'b6c933dcd6d075296cdff68aaa8f7b64287477fb19d666455ac5b94767ec88dd', // og-image.png (apps/dndev)
  // Generator output from the framework logos
  // (apple-touch-icon.png, icon-*.png and og-image.png equal the shipped files above)
  '8a6ee0566fb17bfd659284911fe9e3913fdb6b33b339b0912a68c9f6f825e690', // favicon.svg
  '3c38ea7022ee2cc83fb8d4cc2e54f09ab88dd056fc5724ba207b5fde762d879d', // favicon.ico
]);

/** @param {Buffer} bytes @returns {string} Hex sha256 */
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Public URL of the web app manifest (`public/manifest.json`, `<link rel="manifest">`). */
const WEB_APP_MANIFEST = '/manifest.json';

export class AssetDiscovery extends BaseDiscovery {
  constructor(pathResolver, options = {}) {
    super(pathResolver, {
      assets: SCAN_PATTERNS.assets.fallback,
      assetPatterns: SCAN_PATTERNS.assets.patterns,
      frameworkPackage: FRAMEWORK_CONFIG.package,
      assetsPath: FRAMEWORK_CONFIG.assetsPath,
      ...options,
    });

    this.hasRunForSession = false;
    // Flag codes of the app's languages and the entities resolver (useFlagCodes): their
    // flags (every country flag with a tel field) are copied to public/flags/
    this.flagCodes = null;
    this.entityResolver = null;
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

  /**
   * What is missing in `public/`, before the scan: the framework default assets
   * (`manifest.json`, not the logo) and the flags of the app's languages
   * ({@link useFlagCodes}, {@link _ensureFlags}) are copied, and the PWA icons, favicon
   * and `og-image.png` are kept in sync with `public/logo.svg` (`generateAssets !== false`,
   * {@link _generateMissingAssets}).
   * @returns {Promise<{ copiedAssets: string[], generatedAssets: string[] }>}
   */
  async _prepareFiles() {
    const appRoot = this.pathResolver.getAppRoot();

    // 1. Ensure default assets (manifest.json, etc.) - but NOT logo assets
    const copiedAssets = await this._ensureDefaultAssets(appRoot);

    // Flags of the app's languages, and every country flag a tel field shows when an
    // entity has one (not listed: flags are no asset of the manifest). No flag codes: a
    // discovery used on its own, without the i18n one (the Vite asset plugin and Next's
    // runDiscoveries always set them).
    if (this.flagCodes) {
      const telField = await this.entityResolver.usesFieldType('tel');
      const copiedFlags = this._ensureFlags(
        telField
          ? [...new Set([...this.flagCodes, ...telFieldFlagCodes()])]
          : this.flagCodes
      );
      if (copiedFlags.length > 0) {
        this.logger.debug(
          `Copied ${copiedFlags.length} flags to public${FLAGS_PUBLIC_PATH}/: ${copiedFlags.join(', ')}`
        );
      }
    }

    // 2. Check if logo.svg exists (user must provide it)
    const logoPath = this.pathResolver.resolveAppPath('public/logo.svg');
    const logoExists = this.pathResolver.pathExists(logoPath);

    if (!logoExists) {
      // A warning, never a failure: the build goes on without the logo and its icons. The
      // framework default icons it finds would deploy the DoNotDev brand: named
      const defaults = [];
      for (const { name } of LOGO_OUTPUTS) {
        const iconPath = this.pathResolver.resolveAppPath(`public/${name}`);
        if (
          this.pathResolver.pathExists(iconPath) &&
          FRAMEWORK_DEFAULT_ICON_SHA256.has(
            sha256(await this.pathResolver.read(iconPath, { format: 'buffer' }))
          )
        ) {
          defaults.push(`public/${name}`);
        }
      }
      this.logger.warn(
        defaults.length > 0
          ? `${MISSING_LOGO_WARNING} These icons are framework defaults (the DoNotDev logo): ${defaults.join(', ')}.`
          : MISSING_LOGO_WARNING
      );
    }

    // 3. Sync the PWA assets with logo.svg (if it exists and generation enabled)
    let generatedAssets = [];
    const finalLogoPath = this.pathResolver.resolveAppPath('public/logo.svg');
    if (
      this.pathResolver.pathExists(finalLogoPath) &&
      this.options.generateAssets !== false
    ) {
      const generationResult = await this._generateMissingAssets(appRoot);
      generatedAssets = generationResult?.generated || [];
    }

    return { copiedAssets, generatedAssets };
  }

  /**
   * Everything in `public/`, scanned after {@link _prepareFiles} copied and generated what
   * was missing: the asset list, asset manifest and PWA icons of a clean build are a
   * rebuild's.
   * @param {{ consumerFiles: string[] }} files - Scanned `public/` files
   * @param {{ copiedAssets: string[], generatedAssets: string[] }} prepared - {@link _prepareFiles}
   * @returns {Promise<Object>}
   */
  async _processFiles(files, { copiedAssets, generatedAssets }) {
    const appRoot = this.pathResolver.getAppRoot();

    // Process files from pattern system (like other discoveries)
    const { consumerFiles } = files;
    const assets = await this._processAssetFiles(consumerFiles);

    // The web app manifest: exactly public/manifest.json (a scanned asset is named by its
    // file name only, `public/x/manifest.json` included)
    const manifest = this._buildAssetManifest(assets, {
      webAppManifest: this.pathResolver.pathExists(
        this.pathResolver.resolveAppPath(`public${WEB_APP_MANIFEST}`)
      ),
    });

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
    };
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
   * Flag codes of the app's languages (the i18n discovery's `flagCodes`: `LANGUAGES`
   * `flagCode`, else the id) and the route discovery's entities resolver, set before
   * discovery by the Vite asset plugin and Next's `runDiscoveries`: discovery copies
   * their flags to `public/flags/` ({@link _ensureFlags}), plus every flag a `tel` field
   * shows (`telFieldFlagCodes`: all `COUNTRIES`) when an entity of the `entities` package
   * has a `tel` field (`entityResolver.usesFieldType('tel')`).
   * @param {string[]} flagCodes - e.g. `['gb', 'fr']`
   * @param {{ usesFieldType: (type: string) => Promise<boolean> }} entityResolver - `createEntityResolver` of the route discovery
   * @since 0.3.2
   */
  useFlagCodes(flagCodes, entityResolver) {
    this.flagCodes = flagCodes;
    this.entityResolver = entityResolver;
  }

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
   * The first discovered `/<baseName>.<format>` in `formatPreference` order (cached assets).
   * @param {string} baseName - File name without extension, e.g. `logo`
   * @param {string[]} formatPreference - Extensions, most preferred first, e.g. `['svg', 'png']`
   * @returns {string|null} Public path, or null when none is discovered
   */
  getOptimalAsset(baseName, formatPreference) {
    return this._getOptimalAsset(
      baseName,
      this.getAssets().map((a) => a.path),
      formatPreference
    );
  }

  // === PRIVATE METHODS ===

  async _ensureDefaultAssets(appRoot) {
    // Always ensure assets are present, don't use session cache
    this.logger.debug('Ensuring default assets...');

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

  /**
   * Copy the flag of each code from the framework artwork (`@donotdev/core/i18n/flags/`,
   * one SVG per code) to `public/flags/<code>.svg` (`Flag` renders `/flags/<code>.svg`),
   * only when the app has no file there: a file in `public/flags/` is never overwritten or
   * deleted, so an app ships other flags (a picker of every language, a `tel` field
   * outside the `entities` package) or its own artwork by putting the SVG there. A code without
   * framework artwork is warned and not copied.
   * @param {string[]} flagCodes - Flag codes (`gb`, `fr`, `gb-sct`)
   * @returns {string[]} File names copied (`fr.svg`)
   * @throws {Error} When `@donotdev/core` cannot be found or a copy fails
   * @since 0.3.2
   */
  _ensureFlags(flagCodes) {
    const corePackage =
      this.pathResolver.resolveFrameworkPackage('@donotdev/core');
    if (!corePackage) {
      throw new Error('Flag copy: @donotdev/core not found');
    }
    const artworkDir = this.pathResolver.normalizePath(
      `${corePackage}/${I18N_PATHS.PUBLISHED_FLAGS}`
    );
    const publicFlagsDir = `${DIR_PATHS.public}${FLAGS_PUBLIC_PATH}`;
    const copied = [];

    for (const code of flagCodes) {
      const fileName = flagFileName(code);
      const target = this.pathResolver.resolveAppPath(
        `${publicFlagsDir}/${fileName}`
      );
      if (this.pathResolver.pathExists(target)) continue;

      const source = `${artworkDir}/${fileName}`;
      if (!this.pathResolver.pathExists(source)) {
        this.logger.warn(
          `No flag artwork for "${code}": add ${publicFlagsDir}/${fileName} to the app`
        );
        continue;
      }
      if (!this.pathResolver.copySync(source, target)) {
        throw new Error(`Flag copy: cannot copy ${source} to ${target}`);
      }
      copied.push(fileName);
    }

    return copied;
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

  /**
   * Whether a file name is exactly an asset pattern's name (`*`: any characters; case
   * insensitive): `manifest.json` is `manifest.json` only, never `asset-manifest.json` or
   * another discovery output a previous build wrote into `public/`.
   * @param {string} filename - File name
   * @param {string} pattern - Asset pattern (`SCAN_PATTERNS.assets.patterns`)
   * @returns {boolean}
   */
  _matchesPattern(filename, pattern) {
    const source = pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${source}$`, 'i').test(filename);
  }

  /**
   * Asset manifest of the scanned public assets. `logo.optimal`: `/logo.svg` whenever it
   * exists, else the first raster logo ({@link LOGO_OPTIMAL_FORMATS}); `logo.fallback`: the
   * raster logo ({@link LOGO_FALLBACK_FORMATS}) or null; `assets`: the public path of every
   * scanned asset.
   * @param {Array<{ path: string }>} assets - Scanned assets
   * @param {{ webAppManifest: boolean }} options - Whether `public/manifest.json` exists
   * @returns {Object}
   */
  _buildAssetManifest(assets, { webAppManifest }) {
    const assetPaths = assets.map((a) => a.path);

    const manifest = {
      logo: {
        optimal: this._getOptimalAsset(
          'logo',
          assetPaths,
          LOGO_OPTIMAL_FORMATS
        ),
        fallback: this._getOptimalAsset(
          'logo',
          assetPaths,
          LOGO_FALLBACK_FORMATS
        ),
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
      // The web app manifest: exactly /manifest.json (the file Next's PWA handler writes and
      // the framework default asset), never another *-manifest.json discovery output
      manifest: webAppManifest ? WEB_APP_MANIFEST : null,
      assets: assetPaths,
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
      assets: [],
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
   * Render the link-preview image: the logo centered on a 1200x630 canvas.
   * The SVG is rasterized at the density of its final size, so it stays sharp.
   * @param {Function} sharp - sharp factory
   * @param {Buffer} logoBytes - logo.svg (bytes, not its path: sharp caches files by path)
   * @returns {Promise<Buffer>} PNG bytes
   */
  async _renderOgImage(sharp, logoBytes) {
    const { width, height } = await sharp(logoBytes).metadata();
    const scale = Math.min(OG_IMAGE.logoWidth / width, OG_IMAGE.logoHeight / height);
    const logo = await sharp(logoBytes, { density: Math.ceil(72 * scale) })
      .resize(OG_IMAGE.logoWidth, OG_IMAGE.logoHeight, {
        fit: 'inside',
      })
      .png()
      .toBuffer();

    return sharp({
      create: {
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        channels: 4,
        background: OG_IMAGE.background,
      },
    })
      .composite([{ input: logo }])
      .png()
      .toBuffer();
  }

  /**
   * sharp, the image library that rasterizes `logo.svg` (an optional peer of the app).
   * @returns {Promise<Function|null>} The sharp factory, or `null` when it is not installed
   */
  async _importSharp() {
    const sharp = await import('sharp').catch(() => null);
    return sharp ? sharp.default : null;
  }

  /**
   * Bytes of one icon derived from `logo.svg` ({@link LOGO_OUTPUTS}).
   * @param {{ name: string, size?: number, sharp: boolean }} output - The icon
   * @param {Buffer} logoBytes - `public/logo.svg` (rendered from its bytes: sharp caches
   *   files by path, a changed logo would render as the old one in the same process)
   * @param {Function} sharp - sharp factory ({@link _importSharp})
   * @returns {Promise<Buffer>}
   */
  async _renderLogoOutput(output, logoBytes, sharp) {
    if (output.name === 'favicon.svg') return logoBytes;
    if (output.name === DEFAULT_OG_IMAGE.slice(1)) {
      return this._renderOgImage(sharp, logoBytes);
    }
    // favicon.ico is PNG bytes: every browser reads a PNG favicon.ico
    return sharp(logoBytes)
      .resize(output.size, output.size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  /**
   * The record of the icons generated from `logo.svg` ({@link ICON_STATE_FILE}).
   * @returns {Promise<Record<string, { logo: string, sha256: string }>>} `{}` when the app has none
   * @throws {Error} Build error when the file is not valid JSON
   */
  async _readIconState() {
    const statePath = this.pathResolver.resolveAppPath(ICON_STATE_FILE);
    if (!this.pathResolver.pathExists(statePath)) return {};
    const text = await this.pathResolver.read(statePath, { format: 'text' });
    try {
      return JSON.parse(text);
    } catch (error) {
      throw createBuildError(
        'dndev-assets',
        `${ICON_STATE_FILE} is not valid JSON (${error.message}): fix it, or delete it and the icons generated from public/logo.svg to regenerate both.`,
        'invalid-configuration'
      );
    }
  }

  /**
   * Keep the icons derived from `public/logo.svg` ({@link LOGO_OUTPUTS}) in sync with it, in
   * the app's `public/` (absolute paths: never relative to the working directory). Each output:
   * - missing: generated;
   * - a framework default ({@link FRAMEWORK_DEFAULT_ICON_SHA256}): replaced, with a warning;
   * - generated by this method (its sha256 is the one in {@link ICON_STATE_FILE}) from another
   *   `logo.svg`: regenerated;
   * - anything else is the app's own icon: never touched.
   * An app whose `logo.svg` is the framework's ({@link FRAMEWORK_DEFAULT_LOGO_SHA256}: the
   * DoNotDev apps) only gets its missing icons: its DoNotDev icons are correct. Every icon this
   * method writes is recorded in {@link ICON_STATE_FILE} (sha256 of `logo.svg` and of the
   * output), written only when the record changes. Without sharp only `favicon.svg` is
   * generated, with a warning.
   * @param {string} appRoot - Application root directory
   * @returns {Promise<{ generated: string[], skipped: string[], error: string|null }>} File
   *   names written, and left as they are
   * @throws {Error} Build error when {@link ICON_STATE_FILE} is not valid JSON
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

    const logoBytes = await this.pathResolver.read(logoPath, {
      format: 'buffer',
    });
    if (!logoBytes) {
      return {
        generated: [],
        skipped: LOGO_OUTPUTS.map((o) => o.name),
        error: 'Failed to read logo.svg',
      };
    }
    const logoHash = sha256(logoBytes);
    const frameworkLogo = FRAMEWORK_DEFAULT_LOGO_SHA256.has(logoHash);
    const state = await this._readIconState();
    const nextState = {};

    const sharp = await this._importSharp();
    if (!sharp) {
      this.logger.warn(SHARP_MISSING_WARNING);
    }

    const generated = [];
    const skipped = [];

    for (const output of LOGO_OUTPUTS) {
      const outputPath = `${publicDir}/${output.name}`;
      const recorded = state[output.name];
      let replacedDefault = false;

      if (this.pathResolver.pathExists(outputPath)) {
        const currentHash = sha256(
          await this.pathResolver.read(outputPath, { format: 'buffer' })
        );
        const tracked = recorded?.sha256 === currentHash;
        if (tracked) nextState[output.name] = recorded;

        if (frameworkLogo) {
          skipped.push(output.name);
          continue;
        }
        if (FRAMEWORK_DEFAULT_ICON_SHA256.has(currentHash)) {
          replacedDefault = true;
        } else if (!tracked) {
          this.logger.debug(
            `public/${output.name} is the app's own (not generated from logo.svg): left as is`
          );
          skipped.push(output.name);
          continue;
        } else if (recorded.logo === logoHash) {
          skipped.push(output.name);
          continue;
        }
      }

      if (output.sharp && !sharp) {
        skipped.push(output.name);
        continue;
      }

      try {
        const bytes = await this._renderLogoOutput(output, logoBytes, sharp);
        if (
          !(await this.pathResolver.write(outputPath, bytes, {
            overwrite: true,
          }))
        ) {
          throw new Error(`cannot write ${outputPath}`);
        }
        nextState[output.name] = { logo: logoHash, sha256: sha256(bytes) };
        generated.push(output.name);
        if (replacedDefault) {
          this.logger.warn(`replaced framework default public/${output.name}`);
        }
      } catch (error) {
        this.logger.debug(`Failed to generate ${output.name}: ${error.message}`);
        skipped.push(output.name);
      }
    }

    await this._writeIconState(state, nextState);

    return { generated, skipped, error: null };
  }

  /**
   * Write {@link ICON_STATE_FILE} when its record changed (never an empty file for an app
   * without generated icons).
   * @param {Record<string, { logo: string, sha256: string }>} previous - {@link _readIconState}
   * @param {Record<string, { logo: string, sha256: string }>} next - Record after generation
   */
  async _writeIconState(previous, next) {
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const statePath = this.pathResolver.resolveAppPath(ICON_STATE_FILE);
    if (Object.keys(next).length === 0) {
      await this.pathResolver.remove(statePath);
      return;
    }
    if (!(await this.pathResolver.write(statePath, next, { overwrite: true }))) {
      throw new Error(`Asset generation: cannot write ${statePath}`);
    }
  }
}
