/**
 * @fileoverview Vite Plugins Configuration
 * @description Plugin creation and configuration for DoNotDev applications. Do NOT define defaults in this file. All defaults come from options.js (already merged with user config). This ensures: User config > Framework defaults (options.js) > Nothing.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

import { createViteAssetPlugin } from './plugins/AssetPlugin.js';
import { createViteBlogPlugin } from './plugins/BlogPlugin.js';
import { createViteEnvPlugin } from './plugins/EnvPlugin.js';
import { createViteFontPreloadPlugin } from './plugins/FontPreloadPlugin.js';
import { createViteI18nPlugin } from './plugins/I18nPlugin.js';
import { createOptionalDepResolverPlugin } from './plugins/OptionalDepResolver.js';
import { createPeerDependencyResolverPlugin } from './plugins/PeerDependencyResolver.js';
import { createVitePrerenderPlugin } from './plugins/PrerenderPlugin.js';
import { createVitePWAPlugin } from './plugins/PWAPlugin.js';
import { createViteRoutePlugin } from './plugins/RoutePlugin.js';
import { createViteSEOPlugin } from './plugins/SEOPlugin.js';
import { createServerShimPlugin } from './plugins/ServerShimPlugin.js';
import { createViteThemePlugin } from './plugins/ThemePlugin.js';
import {
  discoverAppPackages,
  SERVER_ONLY_PACKAGES,
} from '../utils/discoverAppPackages.js';
import { createLogger } from '../utils/debugLog.js';
import { PathResolver } from '../utils/PathResolver.js';

export function createVitePlugins(options = {}) {
  const logger = createLogger('vite-plugins', options.debug, options.verbose);

  try {
    const {
      mode,
      debug,
      verbose,
      isDev,
      isPreview = false,
      server: serverOptions = {},
      routes: routeOptions = {},
      themes: themeOptions = {},
      i18n: i18nOptions = {},
      assets: assetOptions = {},
      seo: seoOptions = {},
      prerender: prerenderOptions = {},
      pwa: pwaOptions = {},
      serverShim: serverShimOptions = {},
      pluginFactory: pluginFactoryOptions = {},
    } = options;

    // Enterprise-grade debug cascade: global debug cascades to all plugins unless explicitly overridden
    // This is the DRY pattern - all plugins inherit global debug unless plugin-specific override exists
    const routeDebug = routeOptions.debug ?? debug;
    const themeDebug = themeOptions.debug ?? debug;
    const i18nDebug = i18nOptions.debug ?? debug;
    const assetDebug = assetOptions.debug ?? debug;
    const serverShimDebug = serverShimOptions.debug ?? debug;

    const plugins = [];

    // CRITICAL: ServerShimPlugin MUST run first to block node: imports before any other plugin processes them
    // This prevents Node.js built-in modules from being bundled into client code
    plugins.push(
      createServerShimPlugin({
        ...serverShimOptions,
        debug: serverShimDebug,
      })
    );

    // Shared PathResolver singleton - set once in configResolved, used by all plugins
    let sharedPathResolver;
    try {
      sharedPathResolver = PathResolver.getInstance();
    } catch (error) {
      throw new Error(
        `Failed to initialize PathResolver: ${error.message || error}`
      );
    }

    // CRITICAL: Set shared PathResolver app root - MUST happen in configResolved
    // All discovery engines wait for configResolved to ensure appRoot is set
    plugins.push({
      name: 'dndev-file-watcher-fix',
      enforce: 'pre',
      configResolved(config) {
        // Debug: Show resolved config (helps diagnose if Vite merged correctly)
        if (debug) {
          logger.debug('📋 Vite resolved config (configResolved):');
          // Extract key config values (plugins are objects, so just show count and names)
          const resolvedConfig = {
            root: config.root,
            mode: config.mode,
            envDir: config.envDir,
            base: config.base,
            build: config.build
              ? {
                  outDir: config.build.outDir,
                  minify: config.build.minify,
                }
              : undefined,
            server: config.server
              ? {
                  port: config.server.port,
                  host: config.server.host,
                }
              : undefined,
            plugins: config.plugins
              ? {
                  count: config.plugins.length,
                  names: config.plugins
                    .map((p) => p?.name || 'unnamed')
                    .filter(Boolean),
                }
              : undefined,
          };
          logger.debug(JSON.stringify(resolvedConfig, null, 2));
        }

        // Set app root once - all plugins can now access via PathResolver.getInstance()
        // config.root is always set by Vite (defaults to process.cwd() if not specified)
        sharedPathResolver.setAppRoot(config.root);
        const appRoot = sharedPathResolver.getAppRoot();

        // Discover @donotdev/* from app's package.json (SSOT: discoverAppPackages.js).
        // MUST happen here in configResolved, NOT in config() — see discoverAppPackages.js.
        // Reason: appRoot is only reliable after Vite resolves config.root (just set above).
        // Consumer's existing optimizeDeps.include entries are preserved — we only append.
        const dndevPackages = discoverAppPackages();
        if (dndevPackages.length > 0) {
          const existing = config.optimizeDeps?.include || [];
          config.optimizeDeps.include = [
            ...new Set([...existing, ...dndevPackages]),
          ];
          logger.verbose(
            `optimizeDeps: added ${dndevPackages.length} @donotdev packages`
          );
        }

        // Exclude server-only packages from Vite's dep optimizer.
        // Even if not imported by app code, Vite's automatic discovery
        // may scan them from node_modules and fail on missing browser entries.
        if (SERVER_ONLY_PACKAGES.size > 0) {
          const existingExclude = config.optimizeDeps?.exclude || [];
          const serverPkgs = [...SERVER_ONLY_PACKAGES];
          config.optimizeDeps.exclude = [
            ...new Set([...existingExclude, ...serverPkgs]),
          ];
          logger.verbose(
            `optimizeDeps: excluded ${serverPkgs.length} server-only packages`
          );
        }

        // Set VITE_APP_URL with requested port (strictPort: true ensures it matches actual port)
        // If user opts out (strictPort: false), they handle port mismatch themselves
        // Production URL comes from .env files, not set here
        if (isDev && config.server?.port) {
          const protocol = config.server.https ? 'https' : 'http';
          process.env.VITE_APP_URL = `${protocol}://localhost:${config.server.port}`;
          if (debug || verbose) {
            logger.debug(`VITE_APP_URL set: ${process.env.VITE_APP_URL}`);
          }
        } else if (isDev) {
          logger.warn(
            `VITE_APP_URL not set in dev mode. Server port not available.`
          );
        }

        // Update PathResolver values logging now that app root is set
        try {
          const repoRoot = sharedPathResolver.getRepoRoot();
          logger.verbose(`Repo: ${repoRoot}`);
          logger.verbose(`App: ${appRoot}`);
        } catch (error) {
          logger.debug(`Could not log PathResolver values: ${error.message}`);
        }

        // Fix file watcher to use app root instead of repo root
        // Only set up file watcher in dev mode (not preview - no HMR/watching needed)
        if (config.server && !isPreview) {
          const ignoredFunction = (path) => {
            const normalizedPath = path.replace(/\\/g, '/');
            const appRootNormalized = appRoot.replace(/\\/g, '/');
            return !normalizedPath.startsWith(appRootNormalized);
          };

          if (!config.server.watch) {
            config.server.watch = {};
          }
          const defaultIgnored = [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.turbo/**',
            '**/.vite/**',
            // Backend and generated dirs: avoid fs.watch EINVAL (Bun/workspace) and reduce inotify usage
            '**/functions/**',
            '**/.generated/**',
          ];
          config.server.watch = {
            ...config.server.watch,
            ignored: [
              ...(config.server.watch.ignored || []),
              ...defaultIgnored,
              ignoredFunction,
            ],
          };
          logger.verbose(`Fixed file watcher to use app root: ${appRoot}`);
        }
      },
    });

    // Peer dependency resolver - ensures peer deps resolve from app's node_modules
    // Must run early (pre) to intercept resolution before other plugins
    plugins.push(
      createPeerDependencyResolverPlugin({
        debug,
        verbose,
      })
    );

    // Optional dependency resolver - aliases missing optional deps to empty module
    // Runs in configResolved to get correct appRoot, resolveId intercepts at resolve time
    plugins.push(
      createOptionalDepResolverPlugin({
        debug,
      })
    );

    // React plugin with Fast Refresh enabled
    plugins.push(
      react({
        fastRefresh: true,
        jsxRuntime: 'automatic',
      })
    );
    plugins.push(
      tsconfigPaths({
        ignoreConfigErrors: true,
      })
    );

    // HTTPS support - self-signed cert for dev/preview (opt-in)
    // localhost is a secure context - HTTPS only needed for LAN testing with trusted certs
    // Enable with server: { https: true } in vite.config.ts
    if (serverOptions.https === true) {
      plugins.push(basicSsl());
    }

    plugins.push(
      createViteRoutePlugin({
        ...pluginFactoryOptions,
        ...routeOptions,
        debug: routeDebug,
      })
    );

    plugins.push(
      createViteThemePlugin({
        ...pluginFactoryOptions,
        ...themeOptions,
        debug: themeDebug,
      })
    );

    plugins.push(
      ...createViteI18nPlugin({
        ...pluginFactoryOptions,
        ...i18nOptions,
        debug: i18nDebug,
      })
    );

    plugins.push(
      createViteAssetPlugin({
        ...pluginFactoryOptions,
        ...assetOptions,
        debug: assetDebug,
      })
    );

    plugins.push(
      createViteEnvPlugin({
        ...pluginFactoryOptions,
        mode: mode,
        debug: debug,
        verbose: verbose,
      })
    );

    plugins.push(
      createViteSEOPlugin({
        ...seoOptions,
        debug: debug,
        isDev: isDev,
        // Note: appUrl removed - plugin reads process.env.VITE_APP_URL directly
      })
    );

    if (pwaOptions.enabled) {
      plugins.push(
        createVitePWAPlugin({
          ...pwaOptions,
          debug: debug,
        })
      );
    }

    plugins.push(
      createViteFontPreloadPlugin({
        debug,
      })
    );

    // Blog content virtual module — resolves virtual:donotdev/blog
    plugins.push(createViteBlogPlugin());

    // CSS handled natively by Vite (blocking, but reliable)
    // Removed non-blocking CSS plugin - causes issues on redirects
    // SPA fallback not needed - React Router v7 + Vite handle routing natively

    // Build summary — log asset counts after build completes
    let isBuildMode = false;
    plugins.push({
      name: 'dndev-build-summary',
      enforce: 'post',
      configResolved(config) {
        isBuildMode = config.command === 'build';
      },
      closeBundle() {
        if (!isBuildMode) return;
        const pr = sharedPathResolver;
        const outDir = pr.resolveAppPath('dist/assets');
        if (!pr.pathExists(outDir)) return;

        try {
          const files = pr.readdirSync(outDir);
          const js = files.filter((f) => f.endsWith('.js'));
          const css = files.filter((f) => f.endsWith('.css'));
          const other = files.length - js.length - css.length;

          logger.info(
            `\n  Build output: ${js.length} JS, ${css.length} CSS, ${other} other — ${files.length} files total`
          );
        } catch {
          // Non-critical — skip if dist isn't readable
        }
      },
    });

    // Prerender — MUST be last: runs after build-summary, SEO files, font preloads
    // are all written. Serves the complete dist/ and captures rendered HTML.
    plugins.push(
      createVitePrerenderPlugin({
        ...prerenderOptions,
        debug,
        verbose,
      })
    );

    return plugins;
  } catch (error) {
    const logger = createLogger('vite-plugins', false, true);
    logger.error(`Failed to create Vite plugins: ${error.message}`);
    throw error;
  }
}
