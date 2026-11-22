/**
 * @fileoverview Where a font family's files come from
 * @description Resolves a family named in the app's font stacks to its files, by
 * convention, first hit wins (deterministic, not a runtime fallback):
 *
 * 1. `appConfig.fonts['<Family>']`: the app's own woff2 files ({@link LocalFontConfig});
 * 2. `@fontsource-variable/<slug>` resolvable from the app root;
 * 3. `@fontsource/<slug>` resolvable from the app root;
 * 4. the same two resolved from `@donotdev/ui` (its bundled families: Inter, Playfair
 *    Display, Space Grotesk, Roboto, Press Start 2P), so the default theme and the
 *    essences need no install.
 *
 * `slug` = the family lower-cased, spaces → `-`. A fontsource package is read from its
 * own `metadata.json` (family, weights, styles, subsets, variable axes, category) and
 * `unicode.json` (the unicode-range of each subset); its files follow the fontsource
 * naming (`files/<id>-<subset>-<weight>-<style>.woff2`, variable
 * `files/<id>-<subset>-wght-<style>.woff2`). woff2 only.
 */

import { createBuildError } from '../utils/buildError.js';

/** woff2 file signature ('wOF2'). */
const WOFF2_SIGNATURE = 0x774f4632;

/** Weight the fallback face's metrics are read at (next/font/local picks the same). */
export const FALLBACK_METRICS_WEIGHT = 400;

/**
 * Package slug of a family: `Playfair Display` → `playfair-display`.
 * @param {string} family
 * @returns {string}
 */
export function fontSlug(family) {
  return family.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Parse a CSS font-weight value (`400` or a variable range `300 600`).
 * @param {number|string} weight
 * @returns {[number, number]} min, max
 */
function weightRange(weight) {
  const [min, max = min] = String(weight).trim().split(/\s+/).map(Number);
  return [min, max];
}

/** @param {[number, number]} range @param {number} weight */
const covers = ([min, max], weight) => weight >= min && weight <= max;

/**
 * The weight CSS font matching renders `desired` in, among the weights a family's faces
 * have (CSS Fonts 4, font-weight matching): `desired` itself when a face covers it; else
 * from 400 to 500, the nearest above up to 500, then below, then above 500; below 400,
 * the nearest below, then above; above 500, the nearest above, then below. The browser
 * synthesizes bold when the matched face is lighter than a bold request.
 *
 * @param {number} desired - A weight the theme sets text in
 * @param {Array<[number, number]>} ranges - The faces' weights (`[400, 400]`, a variable `[200, 800]`)
 * @returns {number} The weight of the face the browser uses
 * @since 0.3.3
 */
export function matchFontWeight(desired, ranges) {
  if (ranges.some((range) => covers(range, desired))) return desired;
  const points = [...new Set(ranges.flat())];
  const above = (limit = Infinity) =>
    points.filter((w) => w > desired && w <= limit).sort((a, b) => a - b)[0];
  const below = () => points.filter((w) => w < desired).sort((a, b) => b - a)[0];
  if (desired >= 400 && desired <= 500) return above(500) ?? below() ?? above();
  if (desired < 400) return below() ?? above();
  return above() ?? below();
}

/**
 * Error of the font plan (fails the build with its message).
 * @param {string} message
 * @returns {Error}
 */
function fontError(message) {
  return createBuildError('dndev-fonts', message, 'configuration-error');
}

/**
 * Whether a buffer is a woff2 file.
 * @param {Buffer|null} buffer
 * @returns {boolean}
 */
export function isWoff2(buffer) {
  return Boolean(buffer && buffer.length >= 4 && buffer.readUInt32BE(0) === WOFF2_SIGNATURE);
}

/**
 * A family's source: its kind, what it can provide, its faces for a set of weights and
 * subsets, and the file the size-matched fallback face is measured on.
 *
 * @typedef {Object} FontSource
 * @property {string} family - As written in the font stack
 * @property {'local'|'variable'|'static'} kind
 * @property {'sans-serif'|'serif'} category - Picks the fallback face's system font
 * @property {string} label - `@fontsource/inter`, `appConfig.fonts['Pretendard']`
 * @property {(weight: number) => boolean} provides - Whether a normal face has this weight
 * @property {(weight: number) => number} matchWeight - The provided weight the browser renders a
 *   requested weight in ({@link matchFontWeight}; the weight itself when provided)
 * @property {(params: { weights: number[], subsets: string[] }) => FontFace[]} faces - Faces to ship
 * @property {string} metricsFile - Absolute path of the woff2 the fallback metrics are read from
 */

/**
 * One `@font-face` of the plan.
 *
 * @typedef {Object} FontFace
 * @property {string} file - Absolute path of the woff2
 * @property {string} weight - CSS font-weight (`400`, `200 800`)
 * @property {'normal'|'italic'} style
 * @property {string|null} subset - Fontsource subset or local `subset` (null: core file of a local family)
 * @property {string|null} unicodeRange
 */

/**
 * Category of the fallback face from a fontsource category (`serif` → serif, any other
 * → sans-serif).
 * @param {string} category
 * @returns {'sans-serif'|'serif'}
 */
const fallbackCategory = (category) => (category === 'serif' ? 'serif' : 'sans-serif');

/**
 * Source of a fontsource package (static or variable).
 *
 * @param {Object} params
 * @param {string} params.family
 * @param {string} params.packageName - `@fontsource/inter`
 * @param {string} params.dir - Package directory
 * @param {import('../utils/PathResolver.js').PathResolver} params.pathResolver
 * @returns {FontSource}
 */
function fontsourceSource({ family, packageName, dir, pathResolver }) {
  const metadata = pathResolver.readSync(pathResolver.resolvePath('metadata.json', dir), {
    format: 'json',
  });
  const ranges = pathResolver.readSync(pathResolver.resolvePath('unicode.json', dir), {
    format: 'json',
  });
  if (!metadata || !ranges) {
    throw fontError(`${packageName}: metadata.json or unicode.json missing in ${dir} (not a fontsource package?).`);
  }
  if (String(metadata.family).toLowerCase() !== family.toLowerCase()) {
    throw fontError(
      `${packageName} is the family '${metadata.family}', the font stack names '${family}'. Write the family as the package names it.`
    );
  }
  const variable = packageName.startsWith('@fontsource-variable/');
  const wght = metadata.variable?.wght;
  if (variable && !wght) {
    throw fontError(`${packageName} has no wght axis: use @fontsource/${metadata.id} (static weights).`);
  }
  const range = variable ? [Number(wght.min), Number(wght.max)] : null;
  const styles = ['normal', 'italic'].filter((style) => metadata.styles.includes(style));
  const file = (subset, weight, style) =>
    pathResolver.resolvePath(
      `files/${metadata.id}-${subset}-${variable ? 'wght' : weight}-${style}.woff2`,
      dir
    );
  const existing = (path) => {
    if (!pathResolver.pathExists(path)) {
      throw fontError(`${packageName}: font file missing: ${path}`);
    }
    return path;
  };
  const coreSubset = metadata.subsets.includes('latin') ? 'latin' : metadata.defSubset;
  const nearest = metadata.weights.reduce((best, w) =>
    Math.abs(w - FALLBACK_METRICS_WEIGHT) < Math.abs(best - FALLBACK_METRICS_WEIGHT) ? w : best
  );

  return {
    family,
    kind: variable ? 'variable' : 'static',
    category: fallbackCategory(metadata.category),
    label: packageName,
    provides: (weight) =>
      variable ? covers(range, weight) : metadata.weights.includes(weight),
    matchWeight: (weight) =>
      matchFontWeight(weight, variable ? [range] : metadata.weights.map((w) => [w, w])),
    faces({ weights, subsets }) {
      const shipped = subsets.filter((subset) => metadata.subsets.includes(subset));
      const faceWeights = variable ? [`${range[0]} ${range[1]}`] : weights.map(String);
      const faces = [];
      for (const subset of shipped) {
        for (const weight of faceWeights) {
          for (const style of styles) {
            faces.push({
              file: existing(file(subset, weight, style)),
              weight,
              style,
              subset,
              unicodeRange: ranges[subset] ?? null,
            });
          }
        }
      }
      return faces;
    },
    metricsFile: existing(file(coreSubset, nearest, 'normal')),
  };
}

/**
 * Source of an `appConfig.fonts` entry: the app's own woff2 files.
 *
 * @param {Object} params
 * @param {string} params.family
 * @param {import('@donotdev/types').LocalFontConfig} params.config
 * @param {import('../utils/PathResolver.js').PathResolver} params.pathResolver
 * @returns {FontSource}
 */
function localSource({ family, config, pathResolver }) {
  const label = `appConfig.fonts['${family}']`;
  if (config?.category !== 'sans-serif' && config?.category !== 'serif') {
    throw fontError(`${label}.category must be 'sans-serif' or 'serif' (picks the size-matched fallback face's system font).`);
  }
  if (!Array.isArray(config.faces) || config.faces.length === 0) {
    throw fontError(`${label}.faces must list the family's woff2 files ({ file, weight, style?, unicodeRange?, subset? }).`);
  }
  const faces = config.faces.map((face, index) => {
    const where = `${label}.faces[${index}]`;
    if (typeof face?.file !== 'string' || !face.file.endsWith('.woff2')) {
      throw fontError(`${where}.file must be a .woff2 path relative to the app root (e.g. 'src/assets/fonts/brand.woff2').`);
    }
    const [min, max] = weightRange(face.weight);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw fontError(`${where}.weight must be a weight (400) or a variable range ('300 600'). Got ${JSON.stringify(face.weight)}.`);
    }
    const style = face.style ?? 'normal';
    if (style !== 'normal' && style !== 'italic') {
      throw fontError(`${where}.style must be 'normal' or 'italic'.`);
    }
    const file = pathResolver.resolveAppPath(face.file);
    const content = pathResolver.pathExists(file)
      ? pathResolver.readSync(file, { format: 'buffer' })
      : null;
    if (!content) throw fontError(`${where}.file: ${face.file} does not exist.`);
    if (!isWoff2(content)) throw fontError(`${where}.file: ${face.file} is not a woff2 font.`);
    return {
      file,
      weight: min === max ? String(min) : `${min} ${max}`,
      range: [min, max],
      style,
      subset: face.subset ?? null,
      unicodeRange: face.unicodeRange ?? null,
    };
  });
  const normal = faces.filter((face) => face.style === 'normal');
  // Metrics: a core face (no unicode-range: it holds a-z), the one nearest the metrics weight
  const core = normal.filter((face) => face.unicodeRange === null);
  const distance = ({ range }) =>
    covers(range, FALLBACK_METRICS_WEIGHT)
      ? 0
      : Math.min(...range.map((w) => Math.abs(w - FALLBACK_METRICS_WEIGHT)));
  const metricsFace = [...(core.length > 0 ? core : normal)].sort(
    (a, b) => distance(a) - distance(b)
  )[0];
  if (!metricsFace) {
    throw fontError(`${label}.faces has no normal-style face: the size-matched fallback face is measured on one.`);
  }

  return {
    family,
    kind: 'local',
    category: config.category,
    label,
    provides: (weight) => normal.some((face) => covers(face.range, weight)),
    matchWeight: (weight) => matchFontWeight(weight, normal.map((face) => face.range)),
    faces: () => faces.map(({ range: _range, ...face }) => face),
    metricsFile: metricsFace.file,
  };
}

/**
 * Directory of a package resolvable from `base`, or null.
 * @param {string} packageName
 * @param {string|null} base
 * @param {import('../utils/PathResolver.js').PathResolver} pathResolver
 * @returns {string|null}
 */
function packageDir(packageName, base, pathResolver) {
  if (!base) return null;
  const manifest = pathResolver.resolvePackage(`${packageName}/package.json`, base);
  return manifest ? pathResolver.getDirname(manifest) : null;
}

/**
 * Source of a family named in a font stack, or null when nothing provides it.
 *
 * @param {string} family - As written in the stack (unquoted)
 * @param {Object} params
 * @param {Readonly<Record<string, import('@donotdev/types').LocalFontConfig>>} [params.appFonts] - `appConfig.fonts`
 * @param {string} params.appRoot - App root (fontsource packages resolved from it first)
 * @param {string|null} params.uiRoot - `@donotdev/ui` package directory (its bundled families)
 * @param {import('../utils/PathResolver.js').PathResolver} params.pathResolver
 * @returns {FontSource|null}
 * @throws {Error} Build error on an invalid `appConfig.fonts` entry, a package whose family
 *   differs, or a missing file
 */
export function resolveFontSource(family, { appFonts = {}, appRoot, uiRoot, pathResolver }) {
  const localKey = Object.keys(appFonts).find((key) => key.toLowerCase() === family.toLowerCase());
  if (localKey) return localSource({ family, config: appFonts[localKey], pathResolver });

  const slug = fontSlug(family);
  for (const base of [appRoot, uiRoot]) {
    for (const packageName of [`@fontsource-variable/${slug}`, `@fontsource/${slug}`]) {
      const dir = packageDir(packageName, base, pathResolver);
      if (dir) return fontsourceSource({ family, packageName, dir, pathResolver });
    }
  }
  return null;
}
