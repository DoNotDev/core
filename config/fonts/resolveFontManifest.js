/**
 * @fileoverview Framework font selection: one source of truth for both bundlers
 * @description Which framework fonts an app ships is derived from its theme tokens,
 * never from the catalogue. Two pure steps:
 *
 * 1. resolveThemeFontFamilies(): the families the app's themes render text in. For the
 *    root scope and each theme class, the first family of every RENDERED_FONT_TOKENS
 *    value, after var() resolution, framework defaults overridden by the app's CSS.
 *    A var() defined nowhere in the scanned CSS (e.g. a next/font variable set by a
 *    class on <html>) is the app's own font: no family.
 * 2. resolveFontManifest(): catalogue families among them (FONT_FAMILY_TO_STEMS) ×
 *    their FONT_WEIGHTS × the subsets of the app's locales (LOCALE_TO_FONT_SUBSETS).
 *
 * Fed by ThemeDiscovery (fontFamilies) and used by Next (copyFontsToPublic) and Vite
 * (FontPreloadPlugin). An app whose themes name no catalogue family gets no framework
 * font file.
 */

import {
  FONT_FAMILY_TO_STEMS,
  FONT_WEIGHTS,
  LOCALE_TO_FONT_SUBSETS,
} from '../constants.js';

/**
 * Font tokens the framework's CSS sets text in: --font-family (body, base.css),
 * --font-headline (headings: base.css, Text.css, HeroSection.css), --font-mono
 * (code). --font-sans / --font-serif count only through these.
 */
export const RENDERED_FONT_TOKENS = [
  '--font-family',
  '--font-headline',
  '--font-mono',
];

/** Scope key of `:root` / `html` declarations (the default theme). */
const ROOT_SCOPE = ':root';

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
/** Innermost rule blocks: `selector { declarations }` (nested @media bodies included). */
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const ROOT_SELECTOR_RE = /^(?::root|html|:where\(:root\))$/;
const THEME_SELECTOR_RE = /^(?::root|html)?\.([a-z][\w-]*)$/i;
const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/;

/**
 * Split a CSS value on top-level commas (ignores commas inside () and quotes).
 * @param {string} value
 * @returns {string[]}
 */
function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * Scope of one selector: ':root' for the root scope, the class name for a theme
 * class (`.luxury`, `:root.dark`, `html.dark`), null for any other rule.
 * @param {string} selector
 * @returns {string|null}
 */
function scopeOf(selector) {
  if (ROOT_SELECTOR_RE.test(selector)) return ROOT_SCOPE;
  const theme = THEME_SELECTOR_RE.exec(selector);
  return theme ? theme[1] : null;
}

/**
 * Custom-property declarations of a stylesheet, per scope (root + theme classes).
 * Later declarations win, as in the cascade.
 *
 * @param {string} css - Stylesheet text
 * @returns {Map<string, Map<string, string>>} scope → (custom property → value)
 */
export function collectThemeTokens(css) {
  const scopes = new Map();
  const clean = css.replace(COMMENT_RE, '');
  for (const [, rawSelector, body] of clean.matchAll(RULE_RE)) {
    // Text before the selector may hold statements (`@import …;`): keep the last part
    const selectorText = rawSelector.split(';').pop();
    const keys = splitTopLevel(selectorText)
      .map(scopeOf)
      .filter((key) => key !== null);
    if (keys.length === 0) continue;

    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      const name = declaration.slice(0, colon).trim();
      if (!name.startsWith('--')) continue;
      const value = declaration
        .slice(colon + 1)
        .replace(/!important\s*$/, '')
        .trim();
      for (const key of keys) {
        if (!scopes.has(key)) scopes.set(key, new Map());
        scopes.get(key).set(name, value);
      }
    }
  }
  return scopes;
}

/**
 * First family of a font-family value, var() resolved against `tokens`.
 * @param {string} value
 * @param {Map<string, string>} tokens
 * @param {Set<string>} seen - Custom properties already followed (cycle guard)
 * @returns {string|null} Family name, or null for an app-provided var()
 */
function firstFamily(value, tokens, seen) {
  const first = splitTopLevel(value)[0];
  if (!first) return null;
  const ref = VAR_RE.exec(first);
  if (ref) {
    const [, name, fallback] = ref;
    if (tokens.has(name) && !seen.has(name)) {
      return firstFamily(tokens.get(name), tokens, new Set([...seen, name]));
    }
    return fallback === undefined ? null : firstFamily(fallback, tokens, seen);
  }
  return first.replace(/^['"]|['"]$/g, '').trim();
}

/**
 * Families the app's themes render text in.
 *
 * Per theme (the root scope and every theme class found), tokens cascade as
 * framework root → app root → framework theme → app theme; the first family of each
 * RENDERED_FONT_TOKENS value is the one the browser renders. The union covers theme
 * switching.
 *
 * @param {Object} params
 * @param {string} params.frameworkCss - The framework's design-token CSS (@donotdev/components styles)
 * @param {string[]} params.appCss - The app's CSS files (themes.css, globals.css…)
 * @returns {string[]} Unique family names, as written (may include system/app families)
 */
export function resolveThemeFontFamilies({ frameworkCss, appCss }) {
  const framework = collectThemeTokens(frameworkCss);
  const app = collectThemeTokens(appCss.join('\n'));
  const themes = new Set([ROOT_SCOPE, ...framework.keys(), ...app.keys()]);

  const families = new Set();
  for (const theme of themes) {
    const tokens = new Map([
      ...(framework.get(ROOT_SCOPE) ?? []),
      ...(app.get(ROOT_SCOPE) ?? []),
      ...(theme === ROOT_SCOPE ? [] : (framework.get(theme) ?? [])),
      ...(theme === ROOT_SCOPE ? [] : (app.get(theme) ?? [])),
    ]);
    for (const token of RENDERED_FONT_TOKENS) {
      if (!tokens.has(token)) continue;
      const family = firstFamily(tokens.get(token), tokens, new Set([token]));
      if (family) families.add(family);
    }
  }
  return [...families];
}

/** Lower-cased catalogue family name → stem. */
const CATALOGUE = new Map(
  Object.entries(FONT_FAMILY_TO_STEMS).map(([family, stem]) => [
    family.toLowerCase(),
    stem,
  ])
);

/**
 * Framework font files an app needs: the catalogue families among `families`, their
 * FONT_WEIGHTS, the subsets of `locales` (latin always).
 *
 * @param {Object} params
 * @param {string[]} params.families - From resolveThemeFontFamilies (ThemeDiscovery fontFamilies)
 * @param {string[]} [params.locales] - From I18nDiscovery (e.g. ['en', 'pl'])
 * @returns {{ fontStems: Set<string>, subsets: Set<string>, stems: Set<string> }}
 *   fontStems: catalogue packages used, e.g. 'inter'
 *   subsets: e.g. 'latin', 'latin-ext'
 *   stems: font file stems to ship, e.g. 'inter-latin-400-normal'
 */
export function resolveFontManifest({ families, locales = [] }) {
  if (!Array.isArray(families)) {
    throw new Error(
      'resolveFontManifest: families is required (ThemeDiscovery fontFamilies)'
    );
  }

  const fontStems = new Set();
  for (const family of families) {
    const stem = CATALOGUE.get(family.toLowerCase());
    if (stem) fontStems.add(stem);
  }

  const subsets = new Set(['latin']);
  for (const locale of locales) {
    for (const subset of LOCALE_TO_FONT_SUBSETS[locale] ?? []) {
      subsets.add(subset);
    }
  }

  const stems = new Set();
  for (const fontStem of fontStems) {
    for (const subset of subsets) {
      for (const weight of FONT_WEIGHTS[fontStem]) {
        stems.add(`${fontStem}-${subset}-${weight}-normal`);
      }
    }
  }

  return { fontStems, subsets, stems };
}

/**
 * Stem of a font file name or URL: 'assets/inter-latin-400-normal-Bx3.woff2' and
 * './files/inter-latin-400-normal.woff2' both → 'inter-latin-400-normal'.
 * @param {string} fileName
 * @returns {string|null} null when the name is no catalogue font file
 */
export function catalogueFontStem(fileName) {
  const base = fileName.split(/[/\\]/).pop().toLowerCase();
  for (const fontStem of Object.keys(FONT_WEIGHTS)) {
    if (!base.startsWith(`${fontStem}-`)) continue;
    const match = new RegExp(
      `^${fontStem}-[a-z-]+?-\\d+-(?:normal|italic)`
    ).exec(base);
    if (match) return match[0];
  }
  return null;
}

/**
 * Strip woff format from @font-face src declarations, keeping only woff2.
 * @param {string} css - CSS content with @font-face src declarations
 * @returns {string} CSS with woff references removed from src
 */
export function stripWoffFromSrc(css) {
  // Remove ", url(...woff) format('woff')" from src declarations
  return css.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
}
