/**
 * @fileoverview Discovery Orchestrator for Next.js
 * @description Orchestrates all discovery handlers in correct order
 */

import { GENERATED_PATHS, CONFIG_KEYS } from '../constants.js';
import { PathResolver } from '../utils/PathResolver.js';
import {
  copyFontsToPublic,
  cleanFontAssets,
} from './fonts/copyFontsToPublic.js';

/** Artifacts to clean at build start */
const DISCOVERY_ARTIFACTS = [
  'public/route-manifest.json',
  'public/theme-manifest.json',
  'public/i18n-manifest.json',
  'public/asset-manifest.json',
  'public/seo-manifest.json',
  'public/pwa-manifest.json',
  'public/dndev-fonts.css',
  // SEO output files — must be cleaned to prevent stale content
  'public/robots.txt',
  'public/sitemap.xml',
  'public/rss.xml',
  'public/llms.txt',
  'public/llms-full.txt',
];

/** Config files pattern prefix */
const CONFIG_PREFIX = 'dndev-config-';

/** Build marker file for multi-worker coordination */
const BUILD_MARKER = '.dndev-build';

/**
 * Check if current build already completed discoveries
 * Uses BUILD_ID marker file for cross-worker coordination
 * @param {string} appRoot - App root directory
 * @returns {boolean} True if this build already ran discoveries
 */
export function isBuildComplete(appRoot) {
  if (!appRoot) return false;
  const pathResolver = PathResolver.getInstance();
  const markerPath = pathResolver.resolveAppPath(BUILD_MARKER);
  const buildId = process.env.DNDEV_BUILD_ID;

  try {
    // Read as text (marker file, not JSON)
    const marker = (
      pathResolver.readSync(markerPath, { format: 'text' }) || ''
    ).trim();
    return marker === buildId;
  } catch {
    return false;
  }
}

/**
 * Mark current build as complete
 * @param {string} appRoot - App root directory
 */
function markBuildComplete(appRoot) {
  if (!appRoot) return;
  const pathResolver = PathResolver.getInstance();
  const markerPath = pathResolver.resolveAppPath(BUILD_MARKER);
  const buildId = process.env.DNDEV_BUILD_ID;

  try {
    pathResolver.writeSync(markerPath, buildId);
  } catch {
    // Ignore errors
  }
}

/**
 * Clean discovery artifacts from previous builds
 * @param {string} appRoot - App root directory
 * @param {Object} logger - Logger instance
 */
export function cleanDiscoveryArtifacts(appRoot, logger) {
  if (!appRoot) return;

  const pathResolver = PathResolver.getInstance();

  // Clean manifest files
  for (const artifact of DISCOVERY_ARTIFACTS) {
    const filePath = pathResolver.resolveAppPath(artifact);
    if (pathResolver.pathExists(filePath)) {
      try {
        pathResolver.removeSync(filePath);
        logger.debug(`Cleaned: ${artifact}`);
      } catch {
        // Ignore errors (file might be locked)
      }
    }
  }

  // Clean generated font assets (public/fonts/ directory)
  cleanFontAssets();

  // Clean dndev-config-*.js files in src/config
  const configDir = pathResolver.resolveAppPath('src/config');
  if (pathResolver.pathExists(configDir)) {
    try {
      const files = pathResolver.readdirSync(configDir);
      for (const file of files) {
        if (file.startsWith(CONFIG_PREFIX) && file.endsWith('.js')) {
          try {
            const filePath = pathResolver.resolvePath(file, configDir);
            pathResolver.removeSync(filePath);
            logger.debug(`Cleaned: src/config/${file}`);
          } catch {
            // Ignore errors
          }
        }
      }
    } catch {
      // Ignore errors reading directory
    }
  }
}

/**
 * Run all discovery handlers in correct order
 * Discovery order: Routes → Themes → I18n → Assets → SEO → PWA
 *
 * @param {Object} handlers - Handler instances
 * @param {Object} logger - Logger instance
 * @returns {Promise<void>}
 */
export async function runDiscoveries(
  {
    routeHandler,
    themeHandler,
    i18nHandler,
    assetHandler,
    seoHandler,
    pwaHandler,
    blogContentHandler,
  },
  logger
) {
  // CRITICAL: Ensure appRoot is set before running discovery
  const pathResolver = routeHandler?.pathResolver;
  if (!pathResolver) {
    throw new Error(
      'PathResolver not available - handlers must be initialized with PathResolver'
    );
  }

  const appRoot = pathResolver.getAppRoot();
  const repoRoot = pathResolver.getRepoRoot();

  // Guard: appRoot must be set and different from repoRoot
  if (!appRoot || appRoot === repoRoot) {
    logger.warn(
      '⚠️  App root not properly set before discovery - waiting for appRoot resolution'
    );
    // Wait a tick for appRoot to be set (should already be set, but guard just in case)
    await new Promise((resolve) => setTimeout(resolve, 0));
    const retryAppRoot = pathResolver.getAppRoot();
    if (!retryAppRoot || retryAppRoot === repoRoot) {
      throw new Error(
        'App root not set before discovery. Ensure resolveAppRoot() is called before runDiscoveries().'
      );
    }
  }

  // Skip if this build already completed discoveries (multi-worker coordination).
  // Turbopack evaluates next.config.ts in separate workers — module-level state
  // doesn't persist. The .dndev-build marker file is the only reliable guard.
  if (isBuildComplete(appRoot)) {
    logger.debug('Discoveries already completed this build, skipping');
    return;
  }

  // Claim the build IMMEDIATELY to prevent concurrent workers from re-entering.
  // This must happen BEFORE any async work to avoid race conditions.
  markBuildComplete(appRoot);

  // Clean stale artifacts from previous builds
  cleanDiscoveryArtifacts(appRoot, logger);

  const discoveryStartTime = Date.now();

  // 1. Routes (must be first - Next.js needs app/page.tsx before compilation)
  if (routeHandler) {
    try {
      logger.info('🔍 Starting route discovery...');
      const routeData = await routeHandler.generateFiles();
      const routeCount = routeData?.routes?.length || 0;
      logger.info(`✅ Routes generated: ${routeCount} routes found`);
      if (routeCount === 0) {
        logger.error(
          '❌ NO ROUTES FOUND! Check that pages exist in src/pages/'
        );
      }
    } catch (error) {
      logger.error(`❌ Route generation failed: ${error.message}`);
      if (error.stack) logger.error(`Stack: ${error.stack}`);
      throw error;
    }
  } else {
    logger.warn('⚠️ Route handler is disabled - no routes will be discovered');
  }

  // 2-6: Other discoveries (non-critical, continue on error)
  const nonCriticalHandlers = [
    { name: 'Theme', handler: themeHandler },
    { name: 'I18n', handler: i18nHandler },
    { name: 'Asset', handler: assetHandler },
    { name: 'SEO', handler: seoHandler },
    { name: 'PWA', handler: pwaHandler },
    { name: 'BlogContent', handler: blogContentHandler },
  ];

  /** @type {string[]|undefined} */
  let supportedLanguages;

  for (const { name, handler } of nonCriticalHandlers) {
    try {
      const result = await handler.generateFiles();
      // Capture I18n languages for font subset filtering
      if (name === 'I18n' && result?.supportedLanguages?.length) {
        supportedLanguages = result.supportedLanguages;
      }
    } catch (error) {
      logger.debug(`${name} generation failed: ${error.message}`);
    }
  }

  // Generate env config (NEXT_PUBLIC_* vars → _DNDEV_CONFIG_.env)
  try {
    generateEnvConfig(pathResolver, logger);
  } catch (error) {
    logger.debug(
      `Env config generation failed (non-critical): ${error.message}`
    );
  }

  // Copy @fontsource font files to public/ (Turbopack CSS url() workaround)
  // When languages are known, filter to only needed subsets + woff2 only
  try {
    copyFontsToPublic({ languages: supportedLanguages });
  } catch (error) {
    logger.debug(`Font copy failed (non-critical): ${error.message}`);
  }

  const discoveryDuration = Date.now() - discoveryStartTime;
  logger.verbose?.(
    `✅ All discoveries completed in ${discoveryDuration}ms - Next.js can now compile`
  );

  // Build marker was claimed at the top — no need to mark again.
}

/**
 * Generate env config file that populates _DNDEV_CONFIG_.env
 * with all NEXT_PUBLIC_* environment variables.
 *
 * Next.js only inlines static process.env.NEXT_PUBLIC_* references at build time.
 * Dynamic property access (process.env[name]) returns undefined in the browser.
 * This generated config bridges the gap — same pattern as Vite's EnvPlugin.
 *
 * @param {import('../utils/PathResolver.js').PathResolver} pathResolver
 * @param {Object} logger
 */
function generateEnvConfig(pathResolver, logger) {
  // Collect all NEXT_PUBLIC_* vars from process.env
  const envVars = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') && value !== undefined) {
      envVars[key] = value;
    }
  }

  const configContent = `// Auto-generated DnDev env config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_.env with NEXT_PUBLIC_* environment variables

const envConfig = ${JSON.stringify(envVars, null, 2)};

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
  globalThis._DNDEV_CONFIG_.${CONFIG_KEYS.env} = envConfig;
}

// Export for compatibility
export default envConfig;
`;

  const fullPath = pathResolver.resolveAppPath(GENERATED_PATHS.next.configEnv);
  pathResolver.writeSync(fullPath, configContent);
  const varCount = Object.keys(envVars).length;
  logger.debug(`Generated env config: ${varCount} NEXT_PUBLIC_* vars`);
}

/**
 * Copy assets from framework to app public directory
 * @param {Object} assetHandler - Asset handler instance
 * @param {Object} logger - Logger instance
 * @param {boolean} alreadyCopied - Guard flag
 * @returns {Promise<boolean>} True if copied
 */
export async function copyFrameworkAssets(assetHandler, logger, alreadyCopied) {
  if (alreadyCopied) return false;

  try {
    const assetData = await assetHandler.getDiscoveryData();
    if (assetData?.copiedAssets?.length > 0) {
      logger.info(
        `📦 Copied ${assetData.copiedAssets.length} assets from framework`
      );
    }
    return true;
  } catch (error) {
    logger.debug(`Asset discovery failed (non-critical): ${error.message}`);
    return false;
  }
}
