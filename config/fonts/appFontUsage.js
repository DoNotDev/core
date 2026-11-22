/**
 * @fileoverview The app loads no font itself: the font plan is the one pipeline
 * @description A framework app names its families in its theme tokens and the framework
 * ships them (fonts/buildFontPlan.js: preloads, inline `@font-face`, hashed
 * `/fonts/` files, fallback faces). A second pipeline in app code duplicates files,
 * cannot be preloaded by the framework and brings back the flash it removes:
 *
 * - `next/font` (its preload is dead in a framework app: page files carry the `.next.`
 *   marker, Next's font manifest is keyed without it);
 * - an `@fontsource` / `@fontsource-variable` import (JS or CSS `@import`);
 * - an `@font-face` rule in the app's CSS (or its Vite `index.html`).
 *
 * Each fails the build with the file, the line and the remedy.
 */

import { createBuildError } from '../utils/buildError.js';

/** App source files scanned for font imports, relative to the app root. */
export const APP_CODE_PATTERN = 'src/**/*.{ts,tsx,js,jsx,mjs,cjs}';

const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
/** A `//` comment: at line start or after whitespace (never inside `https://`). */
const LINE_COMMENT_RE = /(^|\s)\/\/.*$/gm;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

const NEXT_FONT_RE =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]next\/font(?:\/[^'"]*)?['"]/g;
const FONTSOURCE_CODE_RE =
  /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"]@fontsource(?:-variable)?\/[^'"]*['"]/g;
const FONTSOURCE_CSS_RE = /@import\s+(?:url\(\s*)?['"]?@fontsource(?:-variable)?\/[^'";)]*/g;
const FONT_FACE_RE = /@font-face\b/g;

const REMEDY_FAMILY =
  "Name the family in src/themes.css (e.g. --font-sans: Manrope, 'Manrope Fallback', sans-serif;) " +
  'and keep @fontsource-variable/<slug> or @fontsource/<slug> in package.json, or declare its woff2 files in appConfig.fonts.';

const RULES = {
  'next-font': {
    message:
      'imports next/font: its preload cannot work in a framework app (page files carry the `.next.` marker, ' +
      "Next's font manifest is keyed without it) and it is a second font pipeline. The framework ships the " +
      `theme's fonts (preloaded, inline @font-face, size-matched fallback). ${REMEDY_FAMILY}`,
  },
  fontsource: {
    message:
      'imports an @fontsource package: the framework ships the fonts the theme names (preloaded, inline ' +
      `@font-face, hashed /fonts/ files). Remove the import. ${REMEDY_FAMILY}`,
  },
  'font-face': {
    message:
      'declares @font-face: the framework writes every @font-face of the app (one place, preloaded, hashed ' +
      'files). Declare the woff2 files in appConfig.fonts (src/config/app.ts: { category, faces: [{ file, weight, ' +
      'unicodeRange? }] }) and name the family in src/themes.css.',
  },
};

/**
 * Same text with comments blanked, newlines kept (line numbers stay right).
 * @param {string} text
 * @param {RegExp[]} comments
 * @returns {string}
 */
function stripComments(text, comments) {
  let clean = text;
  for (const re of comments) {
    clean = clean.replace(re, (match, lead) => {
      const kept = typeof lead === 'string' ? lead : '';
      return kept + match.slice(kept.length).replace(/[^\n]/g, ' ');
    });
  }
  return clean;
}

/**
 * Line number (1-based) of an index.
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Font loading the app does itself.
 *
 * @param {Array<{ file: string, content: string }>} files - App files (relative path, text):
 *   code (`.ts`, `.tsx`, …), CSS (`.css`) and the Vite `index.html`
 * @returns {Array<{ file: string, line: number, rule: 'next-font'|'fontsource'|'font-face' }>}
 */
export function findAppFontLoading(files) {
  const found = [];
  for (const { file, content } of files) {
    if (/\.generated\.[a-z]+$/.test(file)) continue;
    const isCss = file.endsWith('.css');
    const isHtml = file.endsWith('.html');
    const text = stripComments(
      content,
      isHtml ? [HTML_COMMENT_RE, BLOCK_COMMENT_RE] : isCss ? [BLOCK_COMMENT_RE] : [BLOCK_COMMENT_RE, LINE_COMMENT_RE]
    );
    const checks = isCss
      ? [['fontsource', FONTSOURCE_CSS_RE], ['font-face', FONT_FACE_RE]]
      : isHtml
        ? [['font-face', FONT_FACE_RE]]
        : [['next-font', NEXT_FONT_RE], ['fontsource', FONTSOURCE_CODE_RE]];
    for (const [rule, re] of checks) {
      for (const match of text.matchAll(re)) {
        found.push({ file, line: lineOf(text, match.index), rule });
      }
    }
  }
  return found;
}

/**
 * Fail the build when the app loads a font itself ({@link findAppFontLoading}).
 *
 * @param {Array<{ file: string, content: string }>} files
 * @returns {void}
 * @throws {Error} Build error listing every occurrence with its remedy
 */
export function assertNoAppFontLoading(files) {
  const found = findAppFontLoading(files);
  if (found.length === 0) return;
  const lines = found.map(({ file, line, rule }) => `  ${file}:${line} ${RULES[rule].message}`);
  throw createBuildError(
    'dndev-fonts',
    `the app loads fonts itself; the framework font plan is the one way:\n${lines.join('\n')}`,
    'configuration-error'
  );
}
