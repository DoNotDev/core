// packages/core/config/functions/buildVercelFunctions.js

/**
 * @fileoverview Build orchestrator for Vercel Functions (Build Output API v3)
 * @description One call turns `src/api/**` into Vercel Build Output functions.
 * Counterpart of `buildFunctions` (Firebase) for Vercel.
 *
 * Every `src/api/<path>.ts` file is one Node.js function, served at `/api/<path>`:
 * `.vercel/output/functions/api/<path>.func/` holds the bundled handler (`index.mjs`,
 * its dependencies inlined: nothing is installed on Vercel for a prebuilt deploy) and
 * the `.vc-config.json` Vercel reads (Build Output API, Vercel Primitives > Functions).
 * `dndev deploy` uploads these folders with the frontend as one deployment.
 * Files and folders whose name starts with `_` or `.` are shared code, not functions;
 * nor are `*.d.ts` and test files. Paths are literal: a
 * `[param]` segment fails the build (no route is generated for it).
 *
 * @example
 * ```js
 * // Consumer's functions/build.mjs
 * import { buildVercelFunctions } from '@donotdev/core/functions';
 *
 * buildVercelFunctions();
 * ```
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from '../utils/PathResolver.js';

/** Vercel Node.js runtime of the functions: same major as the Firebase functions runtime (`nodejs22`). */
export const VERCEL_FUNCTIONS_RUNTIME = 'nodejs22.x';

/**
 * ESM bundles of CommonJS dependencies (firebase-admin, google-cloud, ...) call
 * `require`, `__filename` and `__dirname`, which ES modules do not define.
 */
const CJS_SHIM = [
  "import { createRequire as __dndevCreateRequire } from 'node:module';",
  "import { fileURLToPath as __dndevFileURLToPath } from 'node:url';",
  "import { dirname as __dndevDirname } from 'node:path';",
  'const require = __dndevCreateRequire(import.meta.url);',
  'const __filename = __dndevFileURLToPath(import.meta.url);',
  'const __dirname = __dndevDirname(__filename);',
].join('\n');

/**
 * Whether a file under `src/api/` is a function entry: `_` / `.` prefixed names are
 * shared code, declarations and tests are not functions either.
 *
 * @param {string} name - File name
 * @returns {boolean}
 */
function isFunctionEntry(name) {
  if (name.startsWith('_') || name.startsWith('.')) return false;
  if (name.endsWith('.d.ts')) return false;
  if (/\.(test|spec)\.ts$/.test(name)) return false;
  return name.endsWith('.ts');
}

/**
 * Function entries under `apiDir`, as paths relative to it (`auth/getCustomClaims.ts`).
 *
 * @param {PathResolver} pathResolver
 * @param {string} apiDir - Absolute `src/api` directory
 * @returns {string[]} Sorted relative paths
 */
function findFunctionEntries(pathResolver, apiDir) {
  const entries = [];
  const walk = (dir, prefix) => {
    for (const dirent of pathResolver.readdirSync(dir, {
      withFileTypes: true,
    })) {
      if (dirent.isDirectory()) {
        if (dirent.name === '__tests__' || dirent.name.startsWith('_'))
          continue;
        if (dirent.name.startsWith('.')) continue;
        walk(`${dir}/${dirent.name}`, `${prefix}${dirent.name}/`);
      } else if (dirent.isFile() && isFunctionEntry(dirent.name)) {
        entries.push(`${prefix}${dirent.name}`);
      }
    }
  };
  walk(apiDir, '');
  return entries.sort();
}

/**
 * Build Output `.vc-config.json` of one Node.js function: `index.mjs` default-exports
 * the `(req, res)` handler; `shouldAddHelpers` gives it `req.query`, `req.body`,
 * `res.status()`, `res.json()` (the `NextApiRequest` / `NextApiResponse` surface
 * the `@donotdev/functions/vercel` handlers use).
 *
 * @param {Object} options
 * @param {string} options.runtime - Vercel runtime (e.g. `nodejs22.x`)
 * @param {boolean} options.sourcemap - Source maps were emitted
 * @returns {Object} `.vc-config.json` content
 */
export function vercelFunctionConfig({ runtime, sourcemap }) {
  return {
    runtime,
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: true,
    shouldAddSourcemapSupport: sourcemap,
  };
}

/**
 * Build Vercel Functions in one call: bundle each `src/api/**` file into a
 * Build Output API v3 function under `<outDir>/functions/api/`.
 * The previous `<outDir>/functions` is removed first, so a deleted source never ships.
 * Fails (exit 1) when `src/api/` is missing, holds no function, has a `[param]`
 * segment, or esbuild fails.
 *
 * @param {Object} [options] - Build options
 * @param {string} [options.apiDir='src/api'] - Function sources (URL `/api/<path>`)
 * @param {string} [options.outDir='.vercel/output'] - Build Output directory
 * @param {string} [options.runtime] - Vercel runtime (default {@link VERCEL_FUNCTIONS_RUNTIME})
 * @param {boolean} [options.minify] - Minify output (default: true in production)
 * @param {boolean} [options.sourcemap=true] - Emit source maps
 * @returns {Promise<string[]>} Function paths built (`api/auth/getCustomClaims`)
 */
export async function buildVercelFunctions(options = {}) {
  const {
    apiDir = 'src/api',
    outDir = '.vercel/output',
    runtime = VERCEL_FUNCTIONS_RUNTIME,
    minify = process.env.NODE_ENV === 'production',
    sourcemap = true,
  } = options;

  const pathResolver = PathResolver.getInstance();
  const cwd = pathResolver.normalizePath(process.cwd());
  const apiRoot = pathResolver.normalizePath(`${cwd}/${apiDir}`);
  const functionsOut = pathResolver.normalizePath(`${cwd}/${outDir}/functions`);

  console.log('Building Vercel functions...');

  try {
    if (!pathResolver.statSync(apiRoot)?.isDirectory()) {
      throw new Error(
        `${apiDir}/ not found in ${cwd}: Vercel functions live in ${apiDir}/<path>.ts (URL /api/<path>)`
      );
    }
    const entries = findFunctionEntries(pathResolver, apiRoot);
    if (entries.length === 0) {
      throw new Error(
        `No function in ${apiDir}/ (expected ${apiDir}/<path>.ts)`
      );
    }
    // Build Output functions are served at their literal path: a `[param]` segment
    // (Vercel api/ and Next.js dynamic routes) would never match a request.
    const dynamic = entries.filter((file) => /[[\]]/.test(file));
    if (dynamic.length > 0) {
      throw new Error(
        `Dynamic route segments are not supported in ${apiDir}/: ${dynamic.join(', ')}. Read the value from the query string or the body instead.`
      );
    }

    pathResolver.removeSync(functionsOut);

    // One esbuild call; no code splitting, so every function bundle is self-contained.
    const entryPoints = Object.fromEntries(
      entries.map((file) => [
        `api/${file.slice(0, -'.ts'.length)}.func/index`,
        `${apiRoot}/${file}`,
      ])
    );

    const { build } = await import('esbuild');
    const result = await build({
      entryPoints,
      outdir: functionsOut,
      outExtension: { '.js': '.mjs' },
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      minify,
      sourcemap,
      keepNames: true,
      treeShaking: true,
      logLevel: 'info',
      loader: { '.css': 'empty' },
      mainFields: ['module', 'main'],
      conditions: ['react-server', 'import', 'module', 'node'],
      banner: { js: CJS_SHIM },
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV || 'production'
        ),
      },
    });

    if (result.errors.length > 0) {
      console.error('Build errors:', result.errors);
      process.exit(1);
    }

    const vcConfig = vercelFunctionConfig({
      runtime,
      sourcemap: Boolean(sourcemap),
    });
    const built = entries.map((file) => `api/${file.slice(0, -'.ts'.length)}`);
    for (const fn of built) {
      pathResolver.writeSync(
        `${functionsOut}/${fn}.func/.vc-config.json`,
        vcConfig,
        {
          format: 'json',
          overwrite: true,
        }
      );
    }

    console.log(
      `Built ${built.length} Vercel function(s) into ${outDir}/functions: ${built.map((fn) => `/${fn}`).join(', ')}`
    );
    return built;
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}
