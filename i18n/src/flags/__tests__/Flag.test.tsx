// @vitest-environment node
// packages/core/i18n/src/flags/__tests__/Flag.test.tsx

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { COUNTRIES, LANGUAGES } from '../../utils/constants';
import { Flag } from '../Flag';
import {
  FLAGS_PUBLIC_PATH,
  flagFileName,
  flagSrc,
  languageFlagCode,
  telFieldFlagCodes,
} from '../flagAsset';
import { getFlagCodes, hasFlag } from '../index';

/** The flag artwork: packages/core/i18n/flags/<code>.svg */
const ARTWORK_DIR = fileURLToPath(new URL('../../../flags/', import.meta.url));

describe('Flag', () => {
  it('renders an <img> of /flags/<code>.svg with its 4:3 box, no Suspense boundary', () => {
    const html = renderToString(createElement(Flag, { code: 'FR' }));

    // React's server render adds its own image preload before the <img>
    expect(html).toBe(
      '<link rel="preload" as="image" href="/flags/fr.svg"/><img src="/flags/fr.svg" width="20" height="15" alt="FR flag" style="width:var(--icon-md, 20px);height:auto;aspect-ratio:4/3"/>'
    );
    // A Suspense boundary renders <!--$-->: the server HTML holds the image itself
    expect(html).not.toContain('<!--$');
  });

  it('uses title as alt, class on the <img>, style merged over the default size', () => {
    const html = renderToString(
      createElement(Flag, {
        code: 'gb-sct',
        title: 'Scotland',
        className: 'flag',
        style: { width: 48 },
      })
    );

    expect(html).toContain(
      '<img src="/flags/gb-sct.svg" width="20" height="15" alt="Scotland" class="flag" style="width:48px;height:auto;aspect-ratio:4/3"/>'
    );
  });
});

describe('flag files', () => {
  it('names a flag by its lower-case code under /flags', () => {
    expect(FLAGS_PUBLIC_PATH).toBe('/flags');
    expect(flagFileName('GB-SCT')).toBe('gb-sct.svg');
    expect(flagSrc('Fr')).toBe('/flags/fr.svg');
  });

  it('maps a language to its flag as the pickers do: LANGUAGES flagCode, else the id', () => {
    expect(languageFlagCode('en')).toBe('gb');
    expect(languageFlagCode('fr')).toBe('fr');
    // REGRESSION: the build mapped br (Portuguese, Brazil) to the Breton flag (bzh)
    expect(languageFlagCode('br')).toBe('br');
    expect(languageFlagCode('br-fr')).toBe('bzh');
    expect(languageFlagCode('xx')).toBe('xx');
    for (const language of LANGUAGES) {
      expect(languageFlagCode(language.id)).toBe(
        language.flagCode || language.id
      );
    }
  });

  it('lists the flags a tel field shows: every COUNTRIES flag code once, the default FR included', () => {
    const codes = telFieldFlagCodes();

    expect(new Set(codes)).toEqual(
      new Set(COUNTRIES.map((country) => country.flagCode))
    );
    expect(codes).toHaveLength(new Set(codes).size);
    expect(codes).toContain('fr');
  });

  it('has artwork for every language and country flag, as standalone SVG files', () => {
    const files = new Set(readdirSync(ARTWORK_DIR));
    const codes = [
      ...getFlagCodes(),
      ...COUNTRIES.map((country) => country.flagCode),
    ];

    expect(codes.filter((code) => !files.has(flagFileName(code)))).toEqual([]);
    for (const file of files) {
      expect(file).toMatch(/^[a-z-]+\.svg$/);
      const svg = readFileSync(`${ARTWORK_DIR}${file}`, 'utf8');
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(
        true
      );
      expect(svg).toMatch(/^<svg[^>]* viewBox="/);
      // An <img> document needs every prefix it uses declared
      if (svg.includes('xlink:')) expect(svg).toContain('xmlns:xlink=');
    }
  });

  it('keeps getFlagCodes and hasFlag', () => {
    expect(getFlagCodes()).toContain('gb');
    expect(hasFlag('FR')).toBe(true);
    expect(hasFlag('en')).toBe(false);
  });
});
