/**
 * @fileoverview Locale-aware font manifest resolver
 * @description Pure function that computes which @fontsource subset+weight CSS files
 * an app needs based on installed fonts and locales (from I18n discovery).
 * Used by both Vite (load hook) and Next.js (copyFontsToPublic) paths.
 *
 * Strategy: all fonts in FONT_WEIGHTS are installed framework fonts.
 * Keep their woff2 for the app's locale subsets, drop everything else.
 */

import { FONT_WEIGHTS, LOCALE_TO_FONT_SUBSETS } from '../constants.js';

/**
 * Resolve which @fontsource CSS imports and file stems an app needs.
 *
 * @param {string[]} locales - From I18nDiscovery (e.g. ['en', 'fr']). Empty/null defaults to ['latin'].
 * @returns {{ imports: string[], stems: Set<string>, subsets: Set<string>, fontStems: Set<string> }}
 *   imports: ['@fontsource/inter/latin-400.css', ...]
 *   stems: Set of file stems like 'inter-latin-400-normal' (for preload matching)
 *   subsets: Set of needed subset names like 'latin', 'cyrillic'
 *   fontStems: Set of font package names like 'inter', 'playfair-display'
 */
export function resolveFontManifest(locales) {
  const fontStems = new Set(Object.keys(FONT_WEIGHTS));

  // 1. Map locales → subsets (always include latin)
  const subsets = new Set(['latin']);
  for (const locale of locales || []) {
    const localeSubsets = LOCALE_TO_FONT_SUBSETS[locale];
    if (localeSubsets) {
      for (const s of localeSubsets) subsets.add(s);
    }
  }

  // 2. Generate import paths and file stems
  const imports = [];
  const stems = new Set();

  for (const fontStem of fontStems) {
    const weights = FONT_WEIGHTS[fontStem];

    for (const subset of subsets) {
      for (const weight of weights) {
        const importPath = `@fontsource/${fontStem}/${subset}-${weight}.css`;
        const fileStem = `${fontStem}-${subset}-${weight}-normal`;
        imports.push(importPath);
        stems.add(fileStem);
      }
    }
  }

  return { imports, stems, subsets, fontStems };
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
