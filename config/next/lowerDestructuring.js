/**
 * @fileoverview Safari < 14.1 destructuring fix (Next.js production builds)
 * @description After the production compile (`compiler.runAfterProductionCompile`, which
 * Next runs after Turbopack and webpack alike), rewrites JS destructuring
 * (`let {a} = o`, `for (let [x] of y)`, `fn({a}){}`) in the client chunks of
 * `<distDir>/static` into plain member access, so the bundle parses on older Safari.
 *
 * Why: Safari < 14.1 (iOS/macOS pre-2021) has a parser bug on destructuring and
 * aborts the whole script with
 *   "SyntaxError: Unexpected keyword 'in'. Expected a ';' following a return statement."
 * → blank page. Next.js/SWC does not lower destructuring (its compat data treats it as
 * supported from Safari 12), and `browserslist` does not change that, so the only
 * reliable fix is a post-compile codemod. esbuild cannot lower destructuring; Babel can.
 *
 * Only for apps whose browserslist reaches Safari / iOS Safari below 14.1: Next's
 * default targets (no browserslist: Safari 16.4) never need it.
 *
 * File names are content-hashed before this runs, so only bytes change: cache headers and
 * the build manifest stay valid (the framework emits no SRI).
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

/** First Safari without the destructuring parser bug. */
const FIXED_SAFARI = [14, 1];

/** Whether a Babel target version (`12.0.0`) is below {@link FIXED_SAFARI}. */
function belowFixedSafari(version) {
  if (!version) return false;
  const [major, minor = 0] = String(version).split('.').map(Number);
  return major < FIXED_SAFARI[0] || (major === FIXED_SAFARI[0] && minor < FIXED_SAFARI[1]);
}

/**
 * Whether the app targets a Safari with the destructuring bug: its browserslist (package.json
 * `browserslist`, `.browserslistrc`), resolved by Babel, reaches Safari or iOS Safari below
 * 14.1. Without a browserslist Next targets Safari 16.4: no.
 *
 * @param {string} projectDir - App directory
 * @returns {boolean}
 * @since 0.3.2
 */
export function targetsBuggySafari(projectDir) {
  const babel = require('@babel/core');
  const { targets } = babel.loadPartialConfig({
    cwd: projectDir,
    root: projectDir,
    babelrc: false,
    configFile: false,
    filename: join(projectDir, 'index.js'),
  }).options;
  return belowFixedSafari(targets?.safari) || belowFixedSafari(targets?.ios);
}

/** Every `.js` file under a directory. */
function* jsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(path);
    else if (entry.name.endsWith('.js')) yield path;
  }
}

/**
 * Lower destructuring in the client chunks (`<distDir>/static/**\/*.js`) when the app targets a
 * Safari with the bug ({@link targetsBuggySafari}).
 *
 * @param {{ distDir: string, projectDir: string }} build - `runAfterProductionCompile` metadata
 * @returns {Promise<number>} Chunks rewritten (0 when the app's targets do not need it)
 * @throws {Error} When a chunk cannot be parsed (a chunk that cannot be proven safe fails the build)
 * @since 0.3.2
 */
export async function lowerClientDestructuring({ distDir, projectDir }) {
  if (!targetsBuggySafari(projectDir)) return 0;
  const babel = require('@babel/core');
  const plugins = [
    [require.resolve('@babel/plugin-transform-destructuring'), { loose: true }],
    require.resolve('@babel/plugin-transform-parameters'),
  ];
  let changed = 0;
  for (const file of jsFiles(join(resolve(projectDir, distDir), 'static'))) {
    const code = readFileSync(file, 'utf8');
    let out;
    try {
      out = babel.transformSync(code, {
        babelrc: false,
        configFile: false,
        compact: true,
        comments: false,
        sourceMaps: false,
        parserOpts: { sourceType: 'unambiguous', allowReturnOutsideFunction: true },
        plugins,
      });
    } catch (error) {
      throw new Error(`[dndev] Safari destructuring fix: cannot transform ${file}: ${error.message}`);
    }
    if (out?.code && out.code !== code) {
      writeFileSync(file, out.code);
      changed++;
    }
  }
  return changed;
}
