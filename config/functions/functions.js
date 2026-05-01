/**
 * @fileoverview Firebase Functions specific esbuild configuration
 * @description Creates esbuild configs optimized for Firebase Functions deployment
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { getWorkspaceAliases } from './workspace.js';
import { getEsbuildShimConfig } from '../utils/esbuildShim.js';
import { PathResolver } from '../utils/PathResolver.js';

/**
 * Create esbuild configuration for Firebase Functions
 * @param {Object} options - Configuration options
 * @returns {Object} esbuild configuration
 */
export function createFunctionsConfig(options = {}) {
  const {
    entry = 'src/index.ts',
    outDir = 'lib',
    minify = false,
    sourcemap = true,
    platform = 'firebase',
    workspace,
    bundleWorkspaceDeps = false,
    importFramework = false,
    external = false,
    ...restOptions
  } = options;

  const pathResolver = PathResolver.getInstance();
  const aliases = getWorkspaceAliases(workspace);

  // Base configuration
  const config = {
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outdir: outDir,
    outExtension: { '.js': '.js' },
    minify,
    sourcemap,
    metafile: true,
    logLevel: 'info',
    // Ensure TypeScript is handled by esbuild, not pre-compiled
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.css': 'empty', // Ignore CSS imports in functions
    },
    // Handle dynamic requires better
    keepNames: true,
    // Enable tree-shaking for better bundle optimization
    treeShaking: true,
    ...restOptions,
  };

  // Handle workspace dependencies
  if (bundleWorkspaceDeps && Object.keys(aliases).length > 0) {
    config.alias = Object.fromEntries(
      Object.entries(aliases).map(([key, value]) => [
        key,
        pathResolver.normalizePath(value),
      ])
    );
  }

  // ============================================================================
  // EXTERNALIZATION STRATEGY (Firebase Extensions Pattern)
  // ============================================================================
  // BUNDLE (optimized, tree-shaken):
  //   - @donotdev/* workspace packages ONLY - your framework code
  //
  // EXTERNALIZE (keep in node_modules, let Node.js handle them):
  //   - ALL npm packages (stripe, valibot, @sentry/node, qs, etc.)
  //   - firebase-admin, firebase-functions (required by Firebase)
  //   - @google-cloud/* packages (native bindings + GCP runtime)
  //   - Node.js built-ins (fs, path, crypto, etc.)
  //
  // Why: Prevents "Dynamic require" errors, smaller bundles, faster builds
  // This is the proven Firebase Extensions pattern used by Google
  // ============================================================================

  // Add main field resolution for better ES module handling
  config.mainFields = ['module', 'main'];
  config.conditions = ['import', 'module', 'node'];

  // List of Node.js built-ins that must be externalized
  const nodeBuiltins = [
    'fs',
    'path',
    'crypto',
    'util',
    'stream',
    'events',
    'buffer',
    'url',
    'querystring',
    'http',
    'https',
    'zlib',
    'os',
    'child_process',
    'assert',
    'constants',
    'domain',
    'punycode',
    'string_decoder',
    'timers',
    'tty',
    'vm',
    'worker_threads',
    'perf_hooks',
    'async_hooks',
  ];

  // Detect consumer workspace packages (entities, etc.)
  // Works for both framework monorepo (dndev) and consumer projects
  let consumerWorkspaces = [];
  if (bundleWorkspaceDeps) {
    try {
      // Find project root by walking up from current directory
      let projectRoot = workspace?.root || process.cwd();
      let currentDir = process.cwd();
      const maxDepth = 10;

      for (let i = 0; i < maxDepth; i++) {
        const packageJsonPath = pathResolver.normalizePath(
          `${currentDir}/package.json`
        );
        if (pathResolver.pathExists(packageJsonPath)) {
          const packageJson = pathResolver.readSync(packageJsonPath, {
            format: 'json',
          });
          if (packageJson && Array.isArray(packageJson.workspaces)) {
            projectRoot = pathResolver.normalizePath(currentDir);
            // Extract workspace package names from patterns
            for (const workspacePattern of packageJson.workspaces) {
              if (
                workspacePattern === 'apps/*' ||
                workspacePattern === 'functions'
              ) {
                continue; // Skip app/functions patterns
              }
              // Direct package name (e.g., 'entities')
              if (
                !workspacePattern.includes('*') &&
                !workspacePattern.includes('/')
              ) {
                consumerWorkspaces.push(workspacePattern);
              }
            }
            break; // Found root with workspaces
          }
        }

        const parentDir = pathResolver.getDirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
      }
    } catch (error) {
      // Silently fail - workspace detection is optional
    }
  }

  // Plugin to externalize ALL node_modules EXCEPT @donotdev/* and consumer workspace packages
  const externalPlugin = {
    name: 'external-node-modules',
    setup(build) {
      // 1. STUB FIREBASE CLIENT SDK (Clean Architecture)
      // Intercept 'firebase' and 'firebase/*' imports and redirect to empty stub
      // This allows shared code (using client SDK) to be bundled for server without crashing
      build.onResolve({ filter: /^firebase($|\/)/ }, (args) => {
        // CRITICAL: Do NOT stub server-side packages
        if (
          args.path === 'firebase-admin' ||
          args.path.startsWith('firebase-admin/') ||
          args.path === 'firebase-functions' ||
          args.path.startsWith('firebase-functions/')
        ) {
          return null; // Fall through to externalization logic
        }

        // Redirect all other firebase/* imports to the stub
        // For dndev monorepo: use workspace.root path
        // For npm-installed: use __dirname (same directory as this file)
        let stubPath;
        if (workspace?.type === 'dndev' && workspace.root) {
          stubPath = pathResolver.normalizePath(
            `${workspace.root}/packages/core/config/functions/firebase-stub.js`
          );
        } else {
          // For npm installs, stub is in the same directory as this file
          // import.meta.url gives us file:// URL, need to convert to path
          const currentFileUrl = import.meta.url;
          const currentFilePath = new URL(currentFileUrl).pathname;
          // Handle Windows paths (remove leading / before drive letter)
          const normalizedPath = currentFilePath.replace(/^\/([A-Z]:)/i, '$1');
          const currentDir = pathResolver.getDirname(normalizedPath);
          stubPath = pathResolver.normalizePath(
            `${currentDir}/firebase-stub.js`
          );
        }
        return { path: stubPath };
      });

      // Externalize all node_modules packages except @donotdev/* and workspace packages
      // This prevents bundling stripe, valibot, @sentry/node, etc.
      build.onResolve({ filter: /.*/ }, (args) => {
        // Never externalize entry points
        if (args.kind === 'entry-point') {
          return null;
        }

        // Handle @donotdev/functions subpath imports (e.g., @donotdev/functions/firebase)
        if (args.path.match(/@donotdev\/functions\/.+/)) {
          if (bundleWorkspaceDeps && workspace?.type === 'dndev') {
            // Extract subpath (e.g., "firebase" from "@donotdev/functions/firebase")
            const subpath = args.path.replace('@donotdev/functions/', '');
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/functions/src/${subpath}/index.ts`
            );
            return { path: resolvedPath };
          }
        }

        // ============================================================================
        // SERVER BUILD REDIRECTS: main imports → /server for functions builds
        // Pattern: ./ = client + common, ./server = common + server
        // Works for both dndev workspace (source) and npm packages (dist)
        // ============================================================================

        // Redirect @donotdev/utils main import to /server
        if (args.path === '@donotdev/utils') {
          if (workspace?.type === 'dndev') {
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/core/utils/src/server/index.ts`
            );
            return { path: resolvedPath };
          } else {
            // npm: resolve @donotdev/utils/server via package.json exports
            return build.resolve('@donotdev/utils/server', {
              kind: args.kind,
              resolveDir: args.resolveDir,
            });
          }
        }

        // Handle @donotdev/utils subpath imports (e.g., @donotdev/utils/server)
        if (args.path.match(/@donotdev\/utils\/.+/)) {
          if (workspace?.type === 'dndev') {
            const subpath = args.path.replace('@donotdev/utils/', '');
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/core/utils/src/${subpath}/index.ts`
            );
            return { path: resolvedPath };
          }
          // npm: let default resolution handle subpaths via package.json exports
        }

        // Redirect @donotdev/supabase main import to /server
        if (args.path === '@donotdev/supabase') {
          if (workspace?.type === 'dndev') {
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/providers/supabase/src/server/index.ts`
            );
            return { path: resolvedPath };
          } else {
            return build.resolve('@donotdev/supabase/server', {
              kind: args.kind,
              resolveDir: args.resolveDir,
            });
          }
        }

        // Redirect @donotdev/core main import to /server
        // This ensures client code is not bundled into server functions
        if (args.path === '@donotdev/core') {
          if (workspace?.type === 'dndev') {
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/core/server.ts`
            );
            return { path: resolvedPath };
          } else {
            // npm: resolve @donotdev/core/server via package.json exports
            return build.resolve('@donotdev/core/server', {
              kind: args.kind,
              resolveDir: args.resolveDir,
            });
          }
        }

        // Handle @donotdev/core subpath imports (e.g., @donotdev/core/server)
        if (args.path.match(/@donotdev\/core\/.+/)) {
          if (bundleWorkspaceDeps && workspace?.type === 'dndev') {
            const subpath = args.path.replace('@donotdev/core/', '');
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/core/${subpath}.ts`
            );
            return { path: resolvedPath };
          }
        }

        // CRITICAL: Externalize Firebase packages FIRST (must be available at runtime)
        // Must check BEFORE @donotdev/* to prevent bundling
        if (
          args.path === 'firebase-admin' ||
          args.path.startsWith('firebase-admin/') ||
          args.path === 'firebase-functions' ||
          args.path.startsWith('firebase-functions/')
        ) {
          return { path: args.path, external: true };
        }

        // Handle @donotdev/core subpath imports (e.g., @donotdev/core/server)
        if (args.path.match(/@donotdev\/core\/.+/)) {
          if (bundleWorkspaceDeps && workspace?.type === 'dndev') {
            // Extract subpath (e.g., "server" from "@donotdev/core/server")
            const subpath = args.path.replace('@donotdev/core/', '');
            const resolvedPath = pathResolver.normalizePath(
              `${workspace.root}/packages/core/${subpath}.ts`
            );
            return { path: resolvedPath };
          }
        }

        // If it's a @donotdev/* package, let esbuild bundle it (via aliases)
        if (args.path.startsWith('@donotdev/')) {
          return null; // Let esbuild handle it
        }

        // Bundle valibot to avoid version mismatch between bundled schemas and external parser
        if (args.path === 'valibot' || args.path.startsWith('valibot/')) {
          return null; // Let esbuild bundle it
        }

        // Check if it's a consumer workspace package (e.g., 'entities', 'entities/user')
        if (consumerWorkspaces.length > 0) {
          const packageName = args.path.split('/')[0];
          if (consumerWorkspaces.includes(packageName)) {
            return null; // Bundle workspace packages
          }
        }

        // Skip relative/absolute imports (starting with . or /)
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          return null;
        }

        // Externalize everything else from node_modules
        return { path: args.path, external: true };
      });
    },
  };

  // Externalize Node builtins AND Firebase packages
  config.external = [...nodeBuiltins, 'firebase-admin', 'firebase-functions'];
  config.plugins = [externalPlugin, ...(config.plugins || [])];

  // Set NODE_ENV for all platforms (firebase, vercel, framework)
  config.define = {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'production'
    ),
    ...(config.define || {}),
  };

  // Handle framework imports
  if (importFramework && workspace.type === 'dndev') {
    // Framework functions are already bundled, so we can import them directly
    const monorepoRoot = workspace.root;
    const frameworkPath = pathResolver.normalizePath(
      `${monorepoRoot}/functions/lib`
    );
    config.alias = {
      ...config.alias,
      '@donotdev/functions': frameworkPath,
    };
  }

  // Entry file naming: derive from package.json exports (single source of truth)
  if (platform === 'framework') {
    const pathResolver = PathResolver.getInstance();
    const functionsRoot = workspace?.root
      ? pathResolver.normalizePath(`${workspace.root}/packages/functions`)
      : process.cwd();
    const pkgJsonPath = pathResolver.normalizePath(
      `${functionsRoot}/package.json`
    );
    const pkgJson = pathResolver.readSync(pkgJsonPath, { format: 'json' });

    if (pkgJson?.exports) {
      const entries = {};
      for (const [, exportValue] of Object.entries(pkgJson.exports)) {
        const src =
          exportValue?.import ||
          exportValue?.default ||
          (typeof exportValue === 'string' ? exportValue : null);
        if (!src || !src.endsWith('.ts')) continue;
        // "./src/firebase/index.ts" → "firebase/index" (strip ./src/ prefix and .ts extension)
        const outName = src.replace(/^\.\/src\//, '').replace(/\.ts$/, '');
        entries[outName] = src;
      }
      if (Object.keys(entries).length > 0) {
        config.entryPoints = entries;
      }
    }
  }

  return config;
}

/**
 * Create esbuild configuration for root functions (framework package)
 * @param {Object} options - Configuration options
 * @returns {Object} esbuild configuration
 */
export function createRootFunctionsConfig(options = {}) {
  return createFunctionsConfig({
    ...options,
    platform: 'framework',
    bundleWorkspaceDeps: true,
  });
}

/**
 * Create esbuild configuration for app functions
 * @param {Object} options - Configuration options
 * @returns {Object} esbuild configuration
 */
export function createAppFunctionsConfig(options = {}) {
  return createFunctionsConfig({
    ...options,
    platform: 'firebase',
    bundleWorkspaceDeps: true,
    importFramework: true,
  });
}
