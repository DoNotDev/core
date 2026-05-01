/**
 * @fileoverview Vite Build Configuration
 * @description Build-specific configuration for DoNotDev applications. Do NOT define defaults in this file. All defaults come from options.js (already merged with user config). This ensures: User config > Framework defaults (options.js) > Nothing.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import strip from '@rollup/plugin-strip';
import { visualizer } from 'rollup-plugin-visualizer';

import { getChunkingConfig } from './chunking.js';
import { createLogger } from '../utils/debugLog.js';
import { PathResolver } from '../utils/PathResolver.js';

/**
 * Utility to check if a package is installed (ESM-compatible)
 * @param {string} packageName - Package name to check
 * @returns {boolean} Whether the package is installed
 */
function isPackageInstalled(packageName) {
  try {
    const pathResolver = PathResolver.getInstance();
    // ESM-compatible: Check if package exists in node_modules
    const modulePath = pathResolver.resolveAppPath(
      `node_modules/${packageName}`
    );
    return pathResolver.pathExists(modulePath);
  } catch {
    return false;
  }
}

/**
 * Create Vite build configuration
 * @param {Object} options - Build options
 * @returns {Object} Build configuration
 */
export function createViteBuildConfig(options = {}) {
  const {
    mode = 'development',
    chunkingOptions = {},
    debug,
    verbose = true,
    isDev,
    isDebug,
    shouldAnalyze,
    build: buildOverrides = {},
  } = options;

  const logger = createLogger('build', debug, verbose);

  // Trust merged config - chunkingOptions already merged from DEFAULT_OPTIONS
  const chunkingConfig = getChunkingConfig(mode, chunkingOptions);

  // Debug mode logging (logger reads from env var)
  logger.debug('🐛 DEBUG MODE ENABLED:');
  logger.debug('  - Minification: DISABLED');
  logger.debug('  - Sourcemaps: ENABLED');
  logger.debug('  - Console logs: PRESERVED');
  logger.debug('  - Debugger statements: PRESERVED');

  // Bundle analyzer notification
  if (shouldAnalyze) {
    logger.info('📊 Bundle analysis enabled');
    logger.info('   Visual treemap will open after build (stats.html)\n');
  }

  const baseConfig = {
    outDir: 'dist',
    // Source maps only in development or debug mode
    // Production builds have no source maps for 100% Lighthouse score
    sourcemap: isDev || isDebug,
    cacheDir: 'node_modules/.vite',
    target: 'baseline-widely-available',
    minify: isDebug ? false : 'esbuild',
    // Enterprise-grade: Clean output, visual tools for details
    reportCompressedSize: false, // Skip gzip calculations - faster builds, use stats.html instead
    chunkSizeWarningLimit: 2048, // Only warn on really large chunks (2MB = 2048KB)
    assetsInlineLimit: 0, // Never inline assets - always load as files
    esbuild: {
      format: 'esm',
      drop: isDebug ? [] : ['console', 'debugger'],
      legalComments: 'none',
    },
    // CSS minification handled by Vite's built-in esbuild minifier
    cssMinify: isDebug ? false : 'esbuild',
    // Enable CSS code splitting for better caching and parallel loading
    cssCodeSplit: true,
    rollupOptions: {
      external: getExternalDependencies(),
      output: {
        format: 'es',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
        // Only apply chunking if configured (undefined = no chunking, used in dev)
        ...(chunkingConfig.manualChunks && {
          manualChunks: chunkingConfig.manualChunks,
        }),
        // Enterprise-grade: Clean console output
        compact: true, // Minimize output noise
      },
      // Suppress harmless 'use client' directive warnings in SPA builds
      // These directives are for React Server Components and don't apply to Vite SPAs
      onwarn(warning, warn) {
        // Ignore MODULE_LEVEL_DIRECTIVE warnings (caused by 'use client', 'use server', etc.)
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        // Pass all other warnings through
        warn(warning);
      },
      plugins: [
        // Enterprise-grade: Remove console statements (robust, cross-platform)
        // Uses @rollup/plugin-strip - official Rollup plugin, works with Vite 7.2.2
        ...(isDebug
          ? []
          : [
              strip({
                include: ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.jsx'],
                functions: ['console.*', 'debugger'],
                labels: ['debug'],
              }),
            ]),
        // Enterprise-grade: Visual bundle analysis, not console spam
        ...(shouldAnalyze
          ? [
              (() => {
                const pathResolver = PathResolver.getInstance();
                const appRoot = pathResolver.getAppRoot();
                const outDir = 'dist';
                const statsPath = pathResolver.resolveAppPath(
                  `${outDir}/stats.html`
                );

                // Ensure output directory exists before visualizer tries to write
                const ensureDir = () => {
                  try {
                    const dir = pathResolver.resolveAppPath(outDir);
                    if (!pathResolver.pathExists(dir)) {
                      pathResolver.mkdir(dir);
                    }
                  } catch (error) {
                    // Directory creation failed - visualizer will handle it
                  }
                };

                const visualizerPlugin = visualizer({
                  filename: statsPath,
                  open: true, // Auto-open treemap after build
                  gzipSize: true,
                  brotliSize: true,
                  template: 'treemap',
                  sourcemap: isDev || isDebug, // Include sourcemaps in dev or debug builds
                  projectRoot: appRoot, // Note: visualizer plugin expects 'projectRoot' key
                });

                // Ensure directory exists before any hook runs
                if (visualizerPlugin.buildStart) {
                  const originalBuildStart =
                    visualizerPlugin.buildStart.bind(visualizerPlugin);
                  visualizerPlugin.buildStart = function (...args) {
                    ensureDir();
                    const result = originalBuildStart.apply(this, args);
                    if (result && typeof result.then === 'function') {
                      return result.catch((error) => {
                        // Ignore errors in buildStart
                      });
                    }
                    return result;
                  };
                } else {
                  visualizerPlugin.buildStart = function () {
                    ensureDir();
                  };
                }

                // Wrap hooks to catch errors (visualizer may fail to open file on Windows/CI)
                // Preserve original function signature and Rollup context
                const hooksToWrap = [
                  'generateBundle',
                  'writeBundle',
                  'closeBundle',
                ];
                for (const hookName of hooksToWrap) {
                  if (visualizerPlugin[hookName]) {
                    const originalHook = visualizerPlugin[hookName];
                    visualizerPlugin[hookName] = function (...args) {
                      try {
                        ensureDir(); // Ensure directory exists before each hook
                        // Preserve 'this' context (Rollup context) and call original hook
                        const result = originalHook.apply(this, args);
                        // Handle async hooks
                        if (result && typeof result.then === 'function') {
                          return result.catch((error) => {
                            const errorMsg =
                              error?.message ||
                              error?.toString() ||
                              String(error) ||
                              'Unknown error';
                            logger.warn(
                              `Bundle visualizer warning in ${hookName}: ${errorMsg}`
                            );
                            if (hookName === 'closeBundle') {
                              logger.warn(
                                `You can manually open ${statsPath} to view the bundle analysis`
                              );
                            }
                            // Don't rethrow - allow build to continue
                          });
                        }
                        return result;
                      } catch (error) {
                        // Log but don't fail the build if visualizer fails (e.g., can't open file)
                        const errorMsg =
                          error?.message ||
                          error?.toString() ||
                          String(error) ||
                          'Unknown error';
                        logger.warn(
                          `Bundle visualizer warning in ${hookName}: ${errorMsg}`
                        );
                        if (hookName === 'closeBundle') {
                          logger.warn(
                            `   You can manually open ${statsPath} to view the bundle analysis`
                          );
                        }
                        // Don't rethrow - allow build to continue
                      }
                    };
                  }
                }

                return visualizerPlugin;
              })(),
            ]
          : []),
      ],
    },
  };

  return baseConfig;
}

/**
 * Get external dependencies based on build mode
 * @param {boolean} ssr - Whether this is an SSR build
 * @returns {Array} Array of external dependencies
 */
function getExternalDependencies(ssr) {
  if (ssr) {
    return [
      'firebase-admin',
      'gcp-metadata',
      'google-logging-utils',
      '@google-cloud/firestore',
      /\.node$/,
      'esbuild',
      /@esbuild\/.*/,
    ];
  }

  return [
    'gcp-metadata',
    'google-logging-utils',
    'payload',
    'file-type',
    // Firebase Admin SDK dependencies - server-only
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    'firebase-admin/firestore',
    'firebase-admin/functions',
    'firebase-admin/credential',
    '@google-cloud/firestore',
    // Google Cloud dependencies
    'google-auth-library',
    'google-gax',
    'googleapis-common',
  ];
}

/**
 * Detect if we're running in Docker or WSL2 environment
 * These environments may need polling mode for file watching to work properly
 *
 * Cross-platform detection:
 * - Docker: Linux containers, Docker Desktop (Windows/Mac), CI environments
 * - WSL2: Running inside WSL2 (Linux) or from Windows accessing WSL2 filesystem
 *
 * @returns {Object} Environment detection results
 */
function detectEnvironment() {
  // Docker detection - multiple methods for cross-platform support
  let isDocker = false;
  const pathResolver = PathResolver.getInstance();

  // Method 1: Linux container markers (works in Linux containers)
  if (
    pathResolver.pathExists('/.dockerenv') ||
    pathResolver.pathExists('/run/.containerenv')
  ) {
    isDocker = true;
  }

  // Method 2: Environment variables (works in Docker Desktop on Windows/Mac)
  if (
    !isDocker &&
    (process.env.DOCKER_CONTAINER === 'true' ||
      process.env.IS_DOCKER === 'true' ||
      process.env.DOCKER_BUILDKIT === '1' ||
      (process.env.CI === 'true' && process.env.DOCKER === 'true'))
  ) {
    isDocker = true;
  }

  // Method 3: Check if running in Docker Desktop (Windows/Mac)
  // Docker Desktop sets specific environment variables
  if (
    !isDocker &&
    process.env.DOCKER_HOST &&
    process.env.DOCKER_HOST.includes('docker')
  ) {
    isDocker = true;
  }

  // Method 4: Check cgroup (Linux containers)
  if (
    !isDocker &&
    process.platform === 'linux' &&
    pathResolver.pathExists('/proc/self/cgroup')
  ) {
    try {
      const cgroup = pathResolver.readSync('/proc/self/cgroup');
      if (
        cgroup &&
        (cgroup.includes('docker') || cgroup.includes('containerd'))
      ) {
        isDocker = true;
      }
    } catch {
      // Ignore errors - file might not be readable
    }
  }

  // WSL2 detection - multiple methods for cross-platform support
  let isWSL2 = false;

  // Method 1: Environment variables (works from Windows side accessing WSL2)
  if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
    isWSL2 = true;
  }

  // Method 2: Check /proc/version (works when running inside WSL2)
  if (
    !isWSL2 &&
    process.platform === 'linux' &&
    pathResolver.pathExists('/proc/version')
  ) {
    try {
      const version = (
        pathResolver.readSync('/proc/version') || ''
      ).toLowerCase();
      isWSL2 = version.includes('microsoft') || version.includes('wsl');
    } catch {
      // Ignore errors - file might not be readable
    }
  }

  // Method 3: Check /proc/sys/kernel/osrelease (WSL2 specific)
  if (
    !isWSL2 &&
    process.platform === 'linux' &&
    pathResolver.pathExists('/proc/sys/kernel/osrelease')
  ) {
    try {
      const osrelease =
        (
          pathResolver.readSync('/proc/sys/kernel/osrelease') || ''
        ).toLowerCase() || '';
      if (osrelease.includes('microsoft') || osrelease.includes('wsl')) {
        isWSL2 = true;
      }
    } catch {
      // Ignore errors - file might not be readable
    }
  }

  // Method 4: Check if running on Windows but accessing Linux filesystem (WSL2 mount)
  if (!isWSL2 && process.platform === 'win32') {
    // Check if current working directory is a WSL2 mount
    const cwd = process.cwd();
    if (cwd && (cwd.includes('\\wsl$') || cwd.includes('\\wsl.localhost'))) {
      isWSL2 = true;
    }
  }

  // Bun runtime: Node's fs.watch can throw EINVAL on some paths (workspace consumers)
  const isBun = typeof process.versions?.bun === 'string';

  return { isDocker, isWSL2, isBun };
}

/**
 * Determine if polling should be enabled based on environment
 * @param {boolean|undefined} userPreference - User's explicit preference
 * @param {Object} logger - Logger instance
 * @returns {boolean|undefined} Whether to use polling (undefined = let Vite decide)
 */
function shouldUsePolling(userPreference, logger) {
  // User preference always takes precedence
  if (userPreference !== undefined) {
    return userPreference;
  }

  // Auto-detect: enable polling for Docker/WSL2/Bun (Bun + fs.watch can EINVAL)
  const { isDocker, isWSL2, isBun } = detectEnvironment();

  if (isDocker || isWSL2 || isBun) {
    const env = isDocker ? 'Docker' : isWSL2 ? 'WSL2' : 'Bun';
    logger.info(
      `Detected ${env} environment - enabling polling mode for file watching`
    );
    return true;
  }

  // Use native watching (undefined lets Vite use its defaults)
  return undefined;
}

/**
 * Create Vite server configuration
 *
 * 🚨 FRAMEWORK RULE: NO DEFAULTS HERE
 * ====================================
 * Do NOT define defaults in this file.
 * All defaults come from options.js (already merged with user config).
 *
 * @param {number} port - Server port (from DEFAULT_OPTIONS)
 * @param {Object} overrides - Server configuration overrides
 * @param {Object} logger - Logger instance
 * @returns {Object} Server configuration
 */
export function createViteServerConfig(port, overrides = {}, logger) {
  const pathResolver = PathResolver.getInstance();
  const repoRoot = pathResolver.getRepoRoot();

  // Extract watch overrides if provided, to merge properly
  const {
    watch: _watch,
    hmr: userHmr,
    host: serverHost,
    ...restOverrides
  } = overrides || {};

  // Auto-configure HMR to match server port/host by default
  // CRITICAL: HMR host MUST be a valid hostname string for WebSocket connections
  // - If server host is true (all interfaces), HMR host should be 'localhost' (browser connects via localhost)
  // - If server host is a string (e.g., 'localhost', '0.0.0.0'), HMR host should match it
  // - Browser always connects from localhost, so even if server binds to all interfaces, HMR uses localhost
  // - User can override with explicit hmr config if needed (e.g., different port for WebSocket)
  const hmrConfig = userHmr || {};
  // When server host is true (all interfaces), use localhost for HMR (browser-side connection)
  const defaultHmrHost =
    serverHost === true ? 'localhost' : serverHost || 'localhost';
  // Let Vite auto-detect protocol based on actual server configuration
  // Only set protocol if user explicitly provided it, otherwise let Vite handle it
  // CRITICAL: Don't set port/clientPort explicitly - let Vite auto-detect from actual server port
  // This ensures HMR matches the actual port even when Vite auto-selects a different port
  const defaultHmr = {
    // Only set port/clientPort if user explicitly provided them
    // Otherwise, Vite will auto-detect from the actual server port (even if auto-selected)
    ...(hmrConfig.port && { port: hmrConfig.port }),
    ...(hmrConfig.clientPort && { clientPort: hmrConfig.clientPort }),
    host: hmrConfig.host ?? defaultHmrHost, // Default: localhost when server is all interfaces
    // Protocol: Only set if user explicitly provided, otherwise let Vite auto-detect
    // Vite will automatically use wss for HTTPS and ws for HTTP
    ...(hmrConfig.protocol && { protocol: hmrConfig.protocol }),
    overlay: hmrConfig.overlay ?? true, // Default: show error overlay
    timeout: hmrConfig.timeout ?? 5000, // Default: 5 second timeout
  };

  // Determine server host: user override takes precedence, otherwise default to true (all interfaces)
  const finalServerHost = serverHost !== undefined ? serverHost : true;

  // HTTPS disabled by default - enable explicitly for production PWA if needed
  const forceHttps = restOverrides.https === true;

  return {
    port,
    host: finalServerHost,
    open: overrides.open !== undefined ? overrides.open : true, // Default from options.js
    https: forceHttps, // Opt-in: server: { https: true } to enable self-signed cert
    fs: {
      // CRITICAL: Allow access to workspace packages and symlinks
      allow: [
        repoRoot,
        // Limit to repo-level paths to avoid parent dir event storms
        pathResolver.resolveRepoPath('packages'),
        pathResolver.resolveRepoPath('node_modules'),
      ],
      // CRITICAL: Strict file serving for security while allowing workspace access
      strict: false,
    },
    // File watching — auto-configured by shouldUsePolling():
    // - Native (inotify/FSEvents/ReadDirectoryChangesW): used when Node runtime on bare metal
    // - Polling: auto-enabled for Docker, WSL2, Bun (Bun's fs.watch can EINVAL on workspace paths)
    //
    // When polling is active, awaitWriteFinish prevents duplicate change events:
    // without it, the poller can fire twice per save → cascading server restarts → port not bound.
    //
    // To force polling manually: { server: { watch: { usePolling: true } } }
    // watch.ignored is set in dndev-file-watcher-fix plugin (pluginsConfig.js) using config.root
    watch: (() => {
      const usePolling = shouldUsePolling(overrides?.watch?.usePolling, logger);
      return {
        usePolling,
        interval: overrides?.watch?.interval ?? 2000,
        // When polling, wait for file writes to stabilize before emitting events.
        // Prevents duplicate change events that cause cascading server restarts
        // (Bun + polling fires multiple events per save → restart interrupted → port not bound).
        // Only active when usePolling is true — no effect on native file watching.
        ...(usePolling && {
          awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100,
          },
        }),
        // Apply other watch overrides (ignored is set by plugin using config.root)
        ...(overrides?.watch || {}),
      };
    })(),
    hmr: {
      ...defaultHmr,
      // Let Vite auto-detect protocol - it handles wss/ws based on actual server configuration
      // User can override with explicit protocol if needed
      ...hmrConfig,
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    // CRITICAL: Add middleware for workspace package resolution debugging
    middlewareMode: false,
    ...restOverrides,
  };
}

/**
 * Create Vite preview configuration
 *
 * 🚨 FRAMEWORK RULE: NO DEFAULTS HERE
 * ====================================
 * Do NOT define defaults in this file.
 * All defaults come from options.js (already merged with user config).
 *
 * SPA Routing Support:
 * The preview server needs explicit SPA configuration to serve index.html
 * for all routes (History API fallback). This ensures that direct navigation
 * and page refreshes work correctly for client-side routes.
 *
 * @param {Object} config - Preview configuration (from DEFAULT_OPTIONS merge)
 * @returns {Object} Preview configuration
 */
export function createVitePreviewConfig(config = {}) {
  // HTTPS disabled by default - enable explicitly for production PWA if needed
  const forceHttps = config.https === true;

  return {
    ...config,
    https: forceHttps,
  };
}
