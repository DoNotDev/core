/**
 * @fileoverview Lower Destructuring Webpack Plugin (Next.js)
 * @description Production client builds only. After minification, rewrites JS
 * destructuring (`let {a} = o`, `for (let [x] of y)`, `fn({a}){}`) into plain
 * member access so the bundle parses on older Safari.
 *
 * Why: Safari < 14.1 (iOS/macOS pre-2021) has a parser bug on destructuring and
 * aborts the whole script with
 *   "SyntaxError: Unexpected keyword 'in'. Expected a ';' following a return statement."
 * → blank page. Next.js/SWC does not lower destructuring (its compat data treats
 * it as supported from Safari 12), and `browserslist` does not change that, so the
 * only reliable fix is a post-emit codemod. esbuild cannot lower destructuring
 * ("not supported yet"); Babel can.
 *
 * Filenames are content-hashed before this runs, so only bytes change — cache
 * headers and the build manifest stay valid (no SRI is emitted by the framework).
 *
 * @version 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createRequire } from 'node:module';
import { createLogger } from '../../utils/debugLog.js';

const require = createRequire(import.meta.url);

// Resolve plugins to absolute paths against @donotdev/core's own deps so Babel
// finds them regardless of the consumer app's dependency tree. Resolved lazily
// (at build time, not import time) so a missing dep degrades to a skipped fix
// instead of crashing every Next config load, dev included.
let resolvedPlugins;
function resolveBabelPlugins() {
  if (resolvedPlugins === undefined) {
    resolvedPlugins = [
      [require.resolve('@babel/plugin-transform-destructuring'), { loose: true }],
      require.resolve('@babel/plugin-transform-parameters'),
    ];
  }
  return resolvedPlugins;
}

/**
 * @param {Object} options
 * @param {Object} [options.logger] - Framework logger
 * @param {boolean} [options.debug] - Debug logging
 * @returns {Object} Webpack plugin
 */
export function createLowerDestructuringWebpackPlugin({
  logger = createLogger('lower-destructuring-next', false, false),
  debug = false,
} = {}) {
  return {
    apply(compiler) {
      const { webpack } = compiler;
      const { Compilation, sources } = webpack;
      const { RawSource } = sources;

      compiler.hooks.thisCompilation.tap(
        'DndevLowerDestructuring',
        (compilation) => {
          // Client production builds only: server code runs on modern Node, and
          // dev builds don't ship to her phone.
          if (compilation.compiler.isChild()) return;
          if (compilation.compiler.name?.includes('server')) return;
          if (compilation.options.mode !== 'production') return;

          compilation.hooks.processAssets.tapPromise(
            {
              name: 'DndevLowerDestructuring',
              // Run last, on the final minified bytes.
              stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
            },
            async (assets) => {
              let babel;
              let babelPlugins;
              try {
                babel = (await import('@babel/core')).default;
                babelPlugins = resolveBabelPlugins();
              } catch (e) {
                logger.warn(
                  `Safari destructuring fix skipped — Babel not resolvable: ${e?.message}`
                );
                return;
              }

              let changed = 0;
              for (const name of Object.keys(assets)) {
                if (!name.endsWith('.js')) continue;
                const input = compilation.getAsset(name).source.source();
                const code =
                  typeof input === 'string' ? input : input.toString('utf8');

                let out;
                try {
                  out = babel.transformSync(code, {
                    babelrc: false,
                    configFile: false,
                    compact: true,
                    comments: false,
                    sourceMaps: false,
                    parserOpts: {
                      sourceType: 'unambiguous',
                      allowReturnOutsideFunction: true,
                    },
                    plugins: babelPlugins,
                  });
                } catch (e) {
                  // Fail loud: a chunk we cannot parse is one we cannot prove safe.
                  throw new Error(
                    `[lower-destructuring] failed to transform ${name}: ${e.message}`
                  );
                }

                if (out?.code && out.code !== code) {
                  compilation.updateAsset(name, new RawSource(out.code));
                  changed++;
                }
              }

              if (debug) {
                logger.debug(
                  `Safari destructuring fix: lowered ${changed} client chunks`
                );
              }
            }
          );
        }
      );
    },
  };
}
