/**
 * Font selection: which framework fonts an app ships, derived from its theme tokens.
 * @vitest-environment node
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FONT_FAMILY_TO_STEMS, FONT_WEIGHTS } from '../../constants.js';
import { copyFontsToPublic } from '../../next/fonts/copyFontsToPublic.js';
import { PathResolver } from '../../utils/PathResolver.js';
import {
  catalogueFontStem,
  collectThemeTokens,
  resolveFontManifest,
  resolveThemeFontFamilies,
} from '../resolveFontManifest.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

/** The framework's real defaults (Inter sans, Playfair serif, system mono). */
const frameworkCss = read('packages/components/src/styles/variables.css');

describe('collectThemeTokens', () => {
  it('keys declarations by root scope and theme class, ignores other rules', () => {
    const scopes = collectThemeTokens(`
      @import './x.css';
      :root, :root.dark, .luxury { --font-sans: 'A', sans-serif; }
      html.retro { --font-mono: 'B'; }
      [data-density='compact'] { --font-sans: 'Nope'; }
      .card .title { --font-sans: 'Nope'; }
      @media (min-width: 1px) { :root { --font-serif: 'C' !important; } }
    `);
    expect([...scopes.keys()].sort()).toEqual([
      ':root',
      'dark',
      'luxury',
      'retro',
    ]);
    expect(scopes.get(':root')?.get('--font-sans')).toBe("'A', sans-serif");
    expect(scopes.get(':root')?.get('--font-serif')).toBe("'C'");
    expect(scopes.get('retro')?.get('--font-mono')).toBe("'B'");
  });
});

describe('resolveThemeFontFamilies', () => {
  it('framework defaults render Inter (body + headings) and the system mono', () => {
    expect(
      resolveThemeFontFamilies({ frameworkCss, appCss: [] }).sort()
    ).toEqual(['Inter', 'ui-monospace']);
  });

  it('an app packing its own fonts (next/font variables) uses no framework family', () => {
    // apps/shop/src/themes.css (shopkb): Manrope + Instrument Serif via next/font/local
    const appCss = `
      :root, :root.light, :root.dark, .luxury {
        --font-sans: var(--font-manrope-ext), var(--font-manrope), -apple-system, sans-serif;
        --font-family: var(--font-sans);
        --font-headline: var(--font-instrument-serif-ext), var(--font-instrument-serif), serif;
        --font-serif: var(--font-instrument-serif-ext), var(--font-instrument-serif), serif;
      }`;
    const families = resolveThemeFontFamilies({
      frameworkCss,
      appCss: [appCss],
    });
    expect(families).toEqual(['ui-monospace']);
    expect(resolveFontManifest({ families }).fontStems.size).toBe(0);
  });

  it('a theme class adds its headline family on top of the root body family', () => {
    const appCss = `.luxury { --font-headline: 'Playfair Display', var(--font-serif); }`;
    expect(
      resolveThemeFontFamilies({ frameworkCss, appCss: [appCss] }).sort()
    ).toEqual(['Inter', 'Playfair Display', 'ui-monospace']);
  });

  it('an unused default token (--font-serif) ships nothing on its own', () => {
    expect(
      resolveThemeFontFamilies({ frameworkCss, appCss: [] })
    ).not.toContain('Playfair Display');
  });

  it('app :root overrides framework defaults; var() fallbacks resolve; cycles stop', () => {
    const appCss = `
      :root {
        --font-sans: 'Roboto', sans-serif;
        --font-headline: var(--undefined-token, 'Space Grotesk');
        --font-mono: var(--loop);
        --loop: var(--font-mono);
      }`;
    expect(
      resolveThemeFontFamilies({ frameworkCss, appCss: [appCss] }).sort()
    ).toEqual(['Roboto', 'Space Grotesk']);
  });
});

describe('resolveFontManifest', () => {
  it('ships only catalogue families, every weight, latin by default', () => {
    const manifest = resolveFontManifest({
      families: ['inter', 'Manrope', 'ui-monospace'],
      locales: ['en', 'fr'],
    });
    expect([...manifest.fontStems]).toEqual(['inter']);
    expect([...manifest.subsets]).toEqual(['latin']);
    expect([...manifest.stems]).toEqual(
      FONT_WEIGHTS.inter.map((w) => `inter-latin-${w}-normal`)
    );
  });

  it('adds latin-ext for Polish, nothing for German (Latin-1 covers ä ö ü ß)', () => {
    expect([
      ...resolveFontManifest({ families: ['Inter'], locales: ['de'] }).subsets,
    ]).toEqual(['latin']);
    expect([
      ...resolveFontManifest({ families: ['Inter'], locales: ['de', 'pl'] })
        .subsets,
    ]).toEqual(['latin', 'latin-ext']);
  });

  it('fails loud without families', () => {
    // @ts-expect-error -- families is required
    expect(() => resolveFontManifest({ locales: ['en'] })).toThrow(/families/);
  });
});

describe('catalogueFontStem', () => {
  it('reads the stem from source and hashed bundle names, null for other fonts', () => {
    expect(catalogueFontStem('./files/inter-latin-ext-400-normal.woff2')).toBe(
      'inter-latin-ext-400-normal'
    );
    expect(
      catalogueFontStem('assets/playfair-display-latin-700-normal-Bx3k.woff2')
    ).toBe('playfair-display-latin-700-normal');
    expect(
      catalogueFontStem('assets/winter-latin-400-normal.woff2')
    ).toBeNull();
    expect(catalogueFontStem('/media/manrope-latin-wght.woff2')).toBeNull();
  });
});

describe('font catalogue parity', () => {
  it('FONT_FAMILY_TO_STEMS and FONT_WEIGHTS name the same packages', () => {
    expect(Object.values(FONT_FAMILY_TO_STEMS).sort()).toEqual(
      Object.keys(FONT_WEIGHTS).sort()
    );
  });

  it('packages/ui/src/dndev.css imports exactly FONT_WEIGHTS', () => {
    const imports = [
      ...read('packages/ui/src/dndev.css').matchAll(
        /@import\s+['"]@fontsource\/([^/]+)\/(\d+)\.css['"]/g
      ),
    ].map(([, stem, weight]) => `${stem}/${weight}`);
    const expected = Object.entries(FONT_WEIGHTS).flatMap(([stem, weights]) =>
      weights.map((w) => `${stem}/${w}`)
    );
    expect(imports.sort()).toEqual(expected.sort());
  });
});

describe('copyFontsToPublic (Next)', () => {
  let appRoot: string;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-fonts-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });

  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  it('writes nothing when the theme uses no framework family', () => {
    copyFontsToPublic({ families: ['ui-monospace'], languages: ['en'] });
    expect(existsSync(join(appRoot, 'public', 'dndev-fonts.css'))).toBe(false);
    expect(existsSync(join(appRoot, 'public', 'fonts'))).toBe(false);
  });

  it('copies only the theme family, locale subsets, woff2, with unicode-range', () => {
    copyFontsToPublic({ families: ['Inter'], languages: ['en', 'pl'] });

    const files = readdirSync(join(appRoot, 'public', 'fonts')).sort();
    const expected = FONT_WEIGHTS.inter
      .flatMap((w) => [
        `inter-latin-${w}-normal.woff2`,
        `inter-latin-ext-${w}-normal.woff2`,
      ])
      .sort();
    expect(files).toEqual(expected);

    const css = readFileSync(
      join(appRoot, 'public', 'dndev-fonts.css'),
      'utf8'
    );
    const faces = css.match(/@font-face/g) ?? [];
    expect(faces).toHaveLength(expected.length);
    expect(css.match(/unicode-range/g) ?? []).toHaveLength(expected.length);
    expect(css).not.toMatch(/\.woff\)|data:|googleapis|gstatic/);
  });
});
