/**
 * @fileoverview Copy the app's framework fonts to public/ for Next.js
 * @description Turbopack can't resolve CSS url() from node_modules after inlining, so
 * Next serves framework fonts from public/: woff2 files in public/fonts/ and their
 * @font-face rules in public/dndev-fonts.css (linked by FontPreloadLinks), each
 * family followed by its size-matched fallback face. Called during discovery.
 *
 * Only the files of resolveFontManifest(): the catalogue families the app's themes
 * render text in (ThemeDiscovery fontFamilies), for the subsets of its locales. An app
 * whose themes use its own fonts gets neither file.
 */

import {
  FONT_FALLBACK_CATEGORY,
  FONT_FAMILY_TO_STEMS,
  FONT_WEIGHTS,
} from '../../constants.js';
import { fallbackFontFace, readFontMetrics } from '../../fonts/fontFallback.js';
import {
  catalogueFontStem,
  resolveFontManifest,
  stripWoffFromSrc,
} from '../../fonts/resolveFontManifest.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

const PUBLIC_FONTS_DIR = 'fonts';
const FONTS_CSS_FILENAME = 'dndev-fonts.css';

/** One @font-face rule */
const FONT_FACE_BLOCK_RE = /@font-face\s*\{[^}]*\}/g;
/** url(./files/filename) inside a @fontsource stylesheet */
const URL_FILES_RE = /url\(\.\/files\/([^)]+)\)/g;
/** First url(./files/filename) of a rule (its woff2) */
const FIRST_URL_RE = /url\(\.\/files\/([^)]+)\)/;

/** Web font weight the fallback metrics are read from (next/font/local picks the same). */
const FALLBACK_METRICS_WEIGHT = 400;

/**
 * Size-matched fallback `@font-face` of a catalogue family ('Inter Fallback'), from the
 * metrics of its Latin file at the weight nearest FALLBACK_METRICS_WEIGHT. Read from
 * the @fontsource package whatever the app's subsets: the Latin file holds a-z.
 *
 * @param {string} fontStem - Catalogue stem (e.g. 'inter')
 * @param {string} uiPkg - @donotdev/ui package directory
 * @param {PathResolver} pathResolver
 * @returns {string} CSS rule
 * @throws {Error} When the stylesheet or font file cannot be found or parsed
 */
function fallbackFaceOf(fontStem, uiPkg, pathResolver) {
  const family = Object.keys(FONT_FAMILY_TO_STEMS).find(
    (name) => FONT_FAMILY_TO_STEMS[name] === fontStem
  );
  const weight = FONT_WEIGHTS[fontStem].reduce((best, w) =>
    Math.abs(w - FALLBACK_METRICS_WEIGHT) <
    Math.abs(best - FALLBACK_METRICS_WEIGHT)
      ? w
      : best
  );
  const specifier = `@fontsource/${fontStem}/${weight}.css`;
  const cssFile = pathResolver.resolvePackage(specifier, uiPkg);
  if (!cssFile) {
    throw new Error(`Font copy: cannot resolve ${specifier}`);
  }
  const file = pathResolver.resolvePath(
    `files/${fontStem}-latin-${weight}-normal.woff2`,
    pathResolver.getDirname(cssFile)
  );
  const woff2 = pathResolver.readSync(file, { format: 'buffer' });
  if (!woff2) {
    throw new Error(`Font copy: font file missing: ${file}`);
  }
  return fallbackFontFace({
    family,
    category: FONT_FALLBACK_CATEGORY[fontStem],
    metrics: readFontMetrics(woff2),
  });
}

/**
 * Copy the app's framework font files to public/fonts/ and write
 * public/dndev-fonts.css. Writes nothing when the manifest is empty.
 *
 * Reads each family's `@fontsource/<stem>/<weight>.css` (resolved from @donotdev/ui,
 * which depends on the catalogue): its rules carry the unicode-range of each subset,
 * so the browser downloads a subset only for characters on the page. Each family is
 * followed by its size-matched fallback face (`'Inter Fallback'`, fonts/fontFallback.js),
 * listed after the web font in the theme's font stacks: the swap shifts no layout.
 *
 * @param {Object} options
 * @param {string[]} options.families - From ThemeDiscovery (fontFamilies)
 * @param {string[]} [options.languages] - App locales, for the subsets (e.g. ['en', 'pl'])
 * @param {boolean} [options.debug] - Enable debug logging
 * @param {boolean} [options.force] - Regenerate even if dndev-fonts.css exists
 * @throws {Error} When a catalogue stylesheet or font file cannot be found
 */
export function copyFontsToPublic({
  families,
  languages,
  debug = false,
  force = false,
}) {
  const logger = createLogger('font-copy', debug, false);
  const pathResolver = PathResolver.getInstance();
  const manifest = resolveFontManifest({ families, locales: languages });

  if (manifest.fontStems.size === 0) {
    logger.debug(
      `No framework font used by the theme (families: ${families.join(', ') || 'none'})`
    );
    return;
  }

  const fontsCssPath = pathResolver.resolveAppPath(
    `public/${FONTS_CSS_FILENAME}`
  );
  if (!force && pathResolver.pathExists(fontsCssPath)) {
    logger.debug('dndev-fonts.css already exists, skipping font copy');
    return;
  }

  const uiPkg = pathResolver.resolveFrameworkPackage('@donotdev/ui');
  if (!uiPkg) {
    throw new Error('Font copy: @donotdev/ui not found');
  }

  const fontsDir = pathResolver.resolveAppPath(`public/${PUBLIC_FONTS_DIR}`);
  pathResolver.ensureDirSync(fontsDir);

  const cssChunks = ['/* Auto-generated by @donotdev/core — do not edit */\n'];
  const copiedFiles = new Set();

  for (const fontStem of manifest.fontStems) {
    for (const weight of FONT_WEIGHTS[fontStem]) {
      const specifier = `@fontsource/${fontStem}/${weight}.css`;
      const cssFile = pathResolver.resolvePackage(specifier, uiPkg);
      if (!cssFile) {
        throw new Error(`Font copy: cannot resolve ${specifier}`);
      }
      const css = pathResolver.readSync(cssFile, { format: 'text' });
      const filesDir = pathResolver.resolvePath(
        'files',
        pathResolver.getDirname(cssFile)
      );

      for (const block of css.match(FONT_FACE_BLOCK_RE) ?? []) {
        const stem = catalogueFontStem(FIRST_URL_RE.exec(block)?.[1] ?? '');
        if (!stem || !manifest.stems.has(stem)) continue;

        const rewritten = stripWoffFromSrc(block).replace(
          URL_FILES_RE,
          (_match, filename) => {
            const src = pathResolver.resolvePath(filename, filesDir);
            if (!pathResolver.pathExists(src)) {
              throw new Error(`Font copy: font file missing: ${src}`);
            }
            if (!copiedFiles.has(filename)) {
              pathResolver.copySync(
                src,
                pathResolver.resolvePath(filename, fontsDir),
                { overwrite: true }
              );
              copiedFiles.add(filename);
            }
            return `url(/${PUBLIC_FONTS_DIR}/${filename})`;
          }
        );
        cssChunks.push(rewritten);
      }
    }
    cssChunks.push(fallbackFaceOf(fontStem, uiPkg, pathResolver));
  }

  pathResolver.writeSync(fontsCssPath, cssChunks.join('\n'));
  logger.debug(
    `Font copy: wrote ${FONTS_CSS_FILENAME} (${copiedFiles.size} font files: ${[...manifest.fontStems].join(', ')})`
  );
}

/**
 * Clean up generated font files from public/.
 */
export function cleanFontAssets() {
  const pathResolver = PathResolver.getInstance();
  const fontsCssPath = pathResolver.resolveAppPath(
    `public/${FONTS_CSS_FILENAME}`
  );
  const fontsDir = pathResolver.resolveAppPath(`public/${PUBLIC_FONTS_DIR}`);

  if (pathResolver.pathExists(fontsCssPath)) {
    try {
      pathResolver.removeSync(fontsCssPath);
    } catch {
      /* ignore */
    }
  }

  if (pathResolver.pathExists(fontsDir)) {
    try {
      pathResolver.removeSync(fontsDir);
    } catch {
      /* ignore */
    }
  }
}
