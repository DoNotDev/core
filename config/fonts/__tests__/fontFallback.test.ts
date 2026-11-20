/**
 * Size-matched fallback faces: woff2 metrics and the next/font/local formulas.
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fallbackFamilyName,
  fallbackFontFace,
  readFontMetrics,
} from '../fontFallback.js';

const requireFromUi = createRequire(
  new URL('../../../../ui/package.json', import.meta.url)
);
const fontFile = (stem: string, file: string) =>
  readFileSync(
    join(
      dirname(requireFromUi.resolve(`@fontsource/${stem}/400.css`)),
      'files',
      file
    )
  );

describe('readFontMetrics', () => {
  // Expected values: fontkit on the same files (head, hhea, a-z + space average)
  it('reads head / hhea / cmap / hmtx of a woff2 file', () => {
    expect(
      readFontMetrics(fontFile('inter', 'inter-latin-400-normal.woff2'))
    ).toEqual({
      unitsPerEm: 2048,
      ascent: 1984,
      descent: -494,
      lineGap: 0,
      azAvgWidth: 1008.2093023255813,
    });
    expect(
      readFontMetrics(
        fontFile('playfair-display', 'playfair-display-latin-400-normal.woff2')
      )
    ).toEqual({
      unitsPerEm: 1000,
      ascent: 1082,
      descent: -251,
      lineGap: 0,
      azAvgWidth: 463.5348837209302,
    });
  });

  it('throws on a subset without the Latin letters', () => {
    expect(() =>
      readFontMetrics(fontFile('inter', 'inter-latin-ext-400-normal.woff2'))
    ).toThrow(/no glyph for 'a'/);
  });

  it('throws on a non-woff2 buffer', () => {
    expect(() => readFontMetrics(Buffer.alloc(64))).toThrow(/bad signature/);
  });
});

describe('fallbackFontFace', () => {
  it('scales the system font to the web font (next/font/local formulas)', () => {
    const css = fallbackFontFace({
      family: 'Inter',
      category: 'sans-serif',
      metrics: {
        unitsPerEm: 2048,
        ascent: 1984,
        descent: -494,
        lineGap: 0,
        azAvgWidth: 1008.2093023255813,
      },
    });
    expect(css).toContain("font-family: 'Inter Fallback';");
    expect(css).toContain("src: local('Arial'), local('Liberation Sans');");
    expect(css).toContain('ascent-override: 89.79%;');
    expect(css).toContain('descent-override: 22.36%;');
    expect(css).toContain('line-gap-override: 0.00%;');
    expect(css).toContain('size-adjust: 107.89%;');
  });

  it('uses Times New Roman for serif families', () => {
    const css = fallbackFontFace({
      family: 'Playfair Display',
      category: 'serif',
      metrics: {
        unitsPerEm: 1000,
        ascent: 1082,
        descent: -251,
        lineGap: 0,
        azAvgWidth: 463.5348837209302,
      },
    });
    expect(css).toContain(
      "src: local('Times New Roman'), local('Liberation Serif');"
    );
  });

  it('rejects an unknown category', () => {
    expect(() =>
      fallbackFontFace({
        family: 'X',
        category: 'cursive' as 'serif', // invalid on purpose
        metrics: {
          unitsPerEm: 1000,
          ascent: 0,
          descent: 0,
          lineGap: 0,
          azAvgWidth: 1,
        },
      })
    ).toThrow(/unknown category/);
  });

  it('names the face after the family', () => {
    expect(fallbackFamilyName('Inter')).toBe('Inter Fallback');
  });
});
