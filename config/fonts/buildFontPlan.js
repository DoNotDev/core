/**
 * @fileoverview The app's font plan: the one source of truth of web fonts, both bundlers
 * @description From one declaration (the theme font tokens of the framework and the app,
 * `appConfig.fonts` for the app's own files) the plan computes everything the document
 * head needs to paint text in the right font on the first frame, with no flicker:
 *
 * - families: every family of a rendered stack (FONT_ROLE_TOKENS, every theme) resolved
 *   to a source (fonts/fontSources.js); generic and SYSTEM_FONT_FAMILIES need none;
 * - weights: the resolved `--font-weight-*` tokens of each theme the family appears in.
 *   Each one the source provides ships. One it lacks is no error: the face CSS font
 *   matching renders it in ships (the browser synthesizes bold, as without the plan) and
 *   the plan lists it in `notices` (`<Family>: weight 700 not in source, browser-synthesized`);
 * - subsets: `latin` + LOCALE_TO_FONT_SUBSETS of the app's languages;
 * - files: woff2 only, served at `/fonts/<stem>.<sha256:8>.woff2` (content-hashed,
 *   cached immutable: headerPolicy.js);
 * - css: one inline `@font-face` per shipped face (`font-display: optional`,
 *   {@link FONT_DISPLAY}) and one size-matched `'<Family> Fallback'` face per family that
 *   leads a stack (fonts/fontFallback.js);
 * - preloads per language: the files the first paint of the default theme needs (body
 *   font at `--font-weight-normal`, headline font at `--font-weight-bold`, or the face
 *   font matching picks when the source lacks that weight; normal style; the subsets of
 *   the page language).
 *
 * Emitted as head tags only, never through a bundler's CSS pipeline: Next renders them
 * from the generated root layout (`FontHead`), Vite writes them into `index.html` and
 * every prerendered page (vite/plugins/FontPlugin.js). Fails the build (fail loud) on:
 * the app loading fonts itself (fonts/appFontUsage.js), a family no source provides, a
 * leading family not followed by its `'<Family> Fallback'`, an undefined `var()` in a
 * stack, a missing file of a weight the source declares.
 */

import { createHash } from 'node:crypto';

import { DIR_PATHS, LOCALE_TO_FONT_SUBSETS, SYSTEM_FONT_FAMILIES } from '../constants.js';
import { createBuildError } from '../utils/buildError.js';
import { assertNoAppFontLoading, APP_CODE_PATTERN } from './appFontUsage.js';
import { fallbackFamilyName, fallbackFontFace, readFontMetrics } from './fontFallback.js';
import { fontSlug, resolveFontSource } from './fontSources.js';
import {
  declarationLocation,
  FONT_ROLE_TOKENS,
  resolveThemeFonts,
  ROOT_SCOPE,
} from './resolveThemeFonts.js';

/**
 * `font-display` of every web face. `optional`: the browser never swaps a font in after
 * the first paint (zero flicker). The first-paint files are preloaded and Chrome waits
 * for preloaded optional fonts on the first render; a file that misses that window is
 * not shown for the page (the size-matched fallback face is), and comes from the
 * immutable cache on the next page. One value, not configurable.
 */
export const FONT_DISPLAY = 'optional';

/** Folder of the shipped files under the app's `public/` (framework-owned, rewritten each build). */
export const FONT_PUBLIC_DIR = DIR_PATHS.fonts;

/** URL path of the shipped files (headerPolicy.js caches it immutable). */
export const FONT_URL_PATH = `/${FONT_PUBLIC_DIR}`;

/** CSS generic families: never need a source. */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);
const SYSTEM_FAMILIES = new Set(SYSTEM_FONT_FAMILIES.map((family) => family.toLowerCase()));

/** Weight tokens of the first paint (preloads): body text, h1/h2 (base.css). */
const BODY_WEIGHT_TOKEN = '--font-weight-normal';
const HEADLINE_WEIGHT_TOKEN = '--font-weight-bold';

/**
 * @param {string} message
 * @returns {Error}
 */
const fontError = (message) => createBuildError('dndev-fonts', message, 'configuration-error');

/**
 * Subsets of a page language: LOCALE_TO_FONT_SUBSETS, `latin` when it lists none (CJK,
 * RTL: the web font covers the Latin text, the system font the rest).
 * @param {string} language
 * @returns {string[]}
 */
export function languageSubsets(language) {
  const subsets = LOCALE_TO_FONT_SUBSETS[language];
  return subsets && subsets.length > 0 ? [...subsets] : ['latin'];
}

/**
 * Quote a family for CSS.
 * @param {string} family
 * @returns {string}
 */
const cssFamily = (family) => `'${family.replace(/'/g, "\\'")}'`;

/**
 * One `@font-face` rule.
 * @param {string} family
 * @param {import('./fontSources.js').FontFace & { url: string }} face
 * @returns {string}
 */
function faceCss(family, face) {
  return [
    '@font-face{',
    `font-family:${cssFamily(family)};`,
    `font-style:${face.style};`,
    `font-weight:${face.weight};`,
    `font-display:${FONT_DISPLAY};`,
    `src:url(${face.url}) format('woff2');`,
    face.unicodeRange ? `unicode-range:${face.unicodeRange};` : '',
    '}',
  ].join('');
}

/**
 * Whether a weight is in a CSS font-weight value (`400`, `200 800`).
 * @param {string} faceWeight
 * @param {number} weight
 */
function faceHasWeight(faceWeight, weight) {
  const [min, max = min] = faceWeight.split(' ').map(Number);
  return weight >= min && weight <= max;
}

/**
 * The app's font plan.
 *
 * @param {Object} params
 * @param {{ framework: string, app: Array<{ file: string, css: string }> }} params.fontCss -
 *   ThemeDiscovery `fontCss`: the framework token CSS and the app's CSS files
 * @param {Readonly<Record<string, import('@donotdev/types').LocalFontConfig>>} [params.appFonts] - `appConfig.fonts`
 * @param {string[]} params.languages - App languages (i18n discovery `supportedLanguages`)
 * @param {string} [params.publicPath] - Prefix of the public URLs (Vite `base` without trailing slash; '' on Next)
 * @param {string|null} [params.indexHtml] - The Vite `index.html` text (scanned for `@font-face`)
 * @param {import('../utils/PathResolver.js').PathResolver} params.pathResolver
 * @returns {Promise<FontPlan>}
 * @throws {Error} Build error ({@link createBuildError}) on every misconfiguration listed in the file overview
 */
export async function buildFontPlan({
  fontCss,
  appFonts = {},
  languages,
  publicPath = '',
  indexHtml = null,
  pathResolver,
}) {
  if (!fontCss || typeof fontCss.framework !== 'string' || !Array.isArray(fontCss.app)) {
    throw new Error(
      '[dndev-fonts] buildFontPlan: fontCss is required (ThemeDiscovery fontCss: theme discovery failed?)'
    );
  }
  if (!Array.isArray(languages) || languages.length === 0) {
    throw new Error('[dndev-fonts] buildFontPlan: languages is required (i18n discovery supportedLanguages)');
  }
  const appRoot = pathResolver.getAppRoot();

  // 0. One pipeline: the app loads no font itself
  const codeFiles = await pathResolver.findFiles(appRoot, APP_CODE_PATTERN);
  assertNoAppFontLoading([
    ...fontCss.app.map(({ file, css }) => ({ file, content: css })),
    ...codeFiles.map((file) => ({
      file: pathResolver.getRelativePath(file),
      content: pathResolver.readSync(file, { format: 'text' }) ?? '',
    })),
    ...(indexHtml === null ? [] : [{ file: 'index.html', content: indexHtml }]),
  ]);

  const themes = resolveThemeFonts({ frameworkCss: fontCss.framework, appCss: fontCss.app });
  const uiRoot = pathResolver.resolveFrameworkPackage('@donotdev/ui');
  const sources = new Map();
  const sourceOf = (family) => {
    const key = family.toLowerCase();
    if (!sources.has(key)) {
      sources.set(key, resolveFontSource(family, { appFonts, appRoot, uiRoot, pathResolver }));
    }
    return sources.get(key);
  };

  const unknown = new Map();
  const missingFallback = new Map();
  /** `${family}:${weight}` → info line: a used weight the source does not have */
  const synthesized = new Map();
  /** family (lower) → { source, weights: Set<number> } (provided weights to ship), in order of first appearance */
  const shipped = new Map();
  /** Families leading a stack: get a fallback face */
  const leading = new Map();

  for (const { scope, roles, weights } of themes) {
    for (const [role, entry] of Object.entries(roles)) {
      if (!entry) continue;
      const token = FONT_ROLE_TOKENS[role];
      entry.stack.forEach((family, position) => {
        const key = family.toLowerCase();
        if (GENERIC_FAMILIES.has(key) || SYSTEM_FAMILIES.has(key)) return;
        const fallbackOf = /^(.+) fallback$/i.exec(family)?.[1];
        if (fallbackOf && sourceOf(fallbackOf)) return;
        const source = sourceOf(family);
        if (!source) {
          if (!unknown.has(key)) unknown.set(key, { family, token, scope });
          return;
        }
        if (!shipped.has(key)) shipped.set(key, { source, weights: new Set(), scopes: new Set() });
        const target = shipped.get(key);
        target.scopes.add(scope);
        // Every used weight the source has ships; one it lacks renders in the face CSS
        // font matching picks (that face ships), synthesized by the browser as today
        for (const { weight } of weights.values()) {
          target.weights.add(source.matchWeight(weight));
          if (!source.provides(weight) && !synthesized.has(`${key}:${weight}`)) {
            synthesized.set(
              `${key}:${weight}`,
              `${source.family}: weight ${weight} not in source, browser-synthesized`
            );
          }
        }
        if (position !== 0) return;
        leading.set(key, source);
        // '<Family> Fallback' right after the family, in the declaration that writes it
        const origin = entry.origin;
        const next = origin ? origin.entries[1] : entry.stack[1];
        const expected = fallbackFamilyName(family);
        if (next && next.replace(/^['"]|['"]$/g, '').trim().toLowerCase() === expected.toLowerCase()) return;
        const declaration = origin?.declaration ?? { source: '', scope };
        const declared = origin?.token ?? token;
        // One report per declaration (a selector list shares it between scopes)
        const id = `${declaration.source}|${declared}|${declaration.value ?? family}`;
        if (missingFallback.has(id)) return;
        const entries = origin ? origin.entries : [family];
        const line = `${declared}: ${[entries[0], cssFamily(expected), ...entries.slice(1)].join(', ')};`;
        missingFallback.set(id, { location: declarationLocation(declaration), declared, family, expected, line });
      });
    }
  }

  const problems = [];
  for (const { family, token, scope } of unknown.values()) {
    problems.push(
      `${token} (${scope === ROOT_SCOPE ? ':root' : `.${scope}`}) names '${family}', which nothing provides: install ` +
        `@fontsource-variable/${fontSlug(family)} or @fontsource/${fontSlug(family)} in the app, declare its woff2 files in ` +
        `appConfig.fonts['${family}'], or use a system family (SYSTEM_FONT_FAMILIES) or a generic one (sans-serif, serif, monospace, system-ui…).`
    );
  }
  for (const { location, declared, family, expected, line } of missingFallback.values()) {
    problems.push(
      `${location}: ${declared} lacks '${expected}' right after '${family}' (the size-matched fallback face: no layout shift, no flicker). Write:\n    ${line}`
    );
  }
  if (problems.length > 0) {
    throw fontError(`the theme fonts cannot ship:\n  - ${problems.join('\n  - ')}`);
  }

  // Faces and files
  const subsets = [...new Set(['latin', ...languages.flatMap(languageSubsets)])];
  const urls = new Map();
  const urlOf = (file) => {
    if (!urls.has(file)) {
      const content = pathResolver.readSync(file, { format: 'buffer' });
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
      const stem = pathResolver.getBasename(file).replace(/\.woff2$/, '');
      urls.set(file, `${publicPath}${FONT_URL_PATH}/${stem}.${hash}.woff2`);
    }
    return urls.get(file);
  };

  const families = [];
  const faces = [];
  for (const [key, { source, weights }] of shipped) {
    const familyFaces = source
      .faces({ weights: [...weights].sort((a, b) => a - b), subsets })
      .map((face) => ({ ...face, family: source.family, url: urlOf(face.file) }));
    faces.push(...familyFaces);
    families.push({
      family: source.family,
      kind: source.kind,
      category: source.category,
      source: source.label,
      fallback: leading.has(key) ? fallbackFamilyName(source.family) : null,
    });
  }

  const fallbackFaces = [...leading.values()].map((source) => {
    try {
      return fallbackFontFace({
        family: source.family,
        category: source.category,
        metrics: readFontMetrics(pathResolver.readSync(source.metricsFile, { format: 'buffer' })),
      });
    } catch (error) {
      throw fontError(
        `'${source.family}' (${source.label}): cannot measure ${source.metricsFile} for its fallback face (${error.message}). ` +
          'Its core file must be a woff2 with the Latin letters a-z.'
      );
    }
  });

  // Preloads: the default theme's first paint, per page language
  const root = themes.find(({ scope }) => scope === ROOT_SCOPE);
  const firstPaint = [
    ['body', BODY_WEIGHT_TOKEN],
    ['headline', HEADLINE_WEIGHT_TOKEN],
  ].flatMap(([role, weightToken]) => {
    const family = root.roles[role]?.stack[0];
    if (!family || !shipped.has(family.toLowerCase())) return [];
    const weight = root.weights.get(weightToken)?.weight;
    if (weight === undefined) {
      throw fontError(`${weightToken} is not defined: the framework tokens (@donotdev/components/styles) define it.`);
    }
    // The face the browser renders that weight in (never a weight the source lacks)
    const { source } = shipped.get(family.toLowerCase());
    return [{ family: source.family, weight: source.matchWeight(weight) }];
  });
  const preloads = {};
  for (const language of languages) {
    const pageSubsets = languageSubsets(language);
    const hrefs = [];
    for (const { family, weight } of firstPaint) {
      for (const face of faces) {
        if (face.family !== family || face.style !== 'normal' || !faceHasWeight(face.weight, weight)) continue;
        const core = face.subset === null ? face.unicodeRange === null : pageSubsets.includes(face.subset);
        if (core && !hrefs.includes(face.url)) hrefs.push(face.url);
      }
    }
    preloads[language] = hrefs;
  }

  return {
    display: FONT_DISPLAY,
    families,
    files: [...urls].map(([source, url]) => ({ source, url })),
    css: [...faces.map((face) => faceCss(face.family, face)), ...fallbackFaces].join('\n'),
    preloads,
    notices: [...synthesized.values()],
  };
}

/**
 * The app's font plan: what the document head carries and the files `public/fonts/` serves.
 *
 * @typedef {Object} FontPlan
 * @property {'optional'} display - {@link FONT_DISPLAY}
 * @property {Array<{ family: string, kind: 'local'|'variable'|'static', category: 'sans-serif'|'serif', source: string, fallback: string|null }>} families - Shipped families
 * @property {Array<{ source: string, url: string }>} files - woff2 to copy (absolute path → public URL)
 * @property {string} css - Inline `@font-face` rules (web faces, then fallback faces)
 * @property {Record<string, string[]>} preloads - Per app language: first-paint font URLs, in order
 * @property {string[]} notices - Info lines for the build output: each used weight a family's
 *   source does not have (`Instrument Serif: weight 700 not in source, browser-synthesized`)
 */
