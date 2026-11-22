/**
 * @fileoverview Write the font plan's files: the one writer, both bundlers
 * @description `public/fonts/` is framework-owned: emptied, then filled with the plan's
 * woff2 files under their content-hashed names (`inter-latin-400-normal.1a2b3c4d.woff2`).
 * Next serves `public/` as is; Vite serves it in dev and copies it into `dist/` at build.
 * Called once per build by the Next discovery and the Vite font plugin.
 */

import { FONT_PUBLIC_DIR, FONT_URL_PATH } from './buildFontPlan.js';

/**
 * Empty `public/fonts/` and copy the plan's files into it.
 *
 * @param {import('./buildFontPlan.js').FontPlan} plan
 * @param {Object} params
 * @param {import('../utils/PathResolver.js').PathResolver} params.pathResolver
 * @param {string} [params.publicPath] - The prefix the plan's URLs carry (Vite `base`), stripped to name the files
 * @returns {string} The `public/fonts` directory written
 */
export function writeFontPlan(plan, { pathResolver, publicPath = '' }) {
  const dir = pathResolver.resolveAppPath(`public/${FONT_PUBLIC_DIR}`);
  pathResolver.removeSync(dir);
  pathResolver.ensureDirSync(dir);
  const prefix = `${publicPath}${FONT_URL_PATH}/`;
  for (const { source, url } of plan.files) {
    if (!url.startsWith(prefix)) {
      throw new Error(`[dndev-fonts] writeFontPlan: ${url} is not under ${prefix}`);
    }
    pathResolver.copySync(source, pathResolver.resolvePath(url.slice(prefix.length), dir), {
      overwrite: true,
    });
  }
  return dir;
}
