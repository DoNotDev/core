/**
 * Vite build keeps only the framework fonts the app's theme renders text in.
 * @vitest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createViteFontPreloadPlugin } from '../plugins/FontPreloadPlugin.js';
import { createI18nStore } from '../plugins/I18nPlugin.js';

type Asset = { type: 'asset'; source: string };

const face = (family: string, file: string) =>
  `@font-face{font-family:'${family}';src:url(/assets/${file}.woff2) format('woff2'),url(/assets/${file}.woff) format('woff')}`;

/** A Vite bundle as dndev.css produces it: whole catalogue + one app font. */
function catalogueBundle(): Record<string, Asset> {
  const files = [
    'inter-latin-400-normal-A1',
    'inter-latin-ext-400-normal-A2',
    'playfair-display-latin-400-normal-B1',
    'roboto-latin-400-normal-C1',
    'manrope-latin-wght-normal-M1',
  ];
  const bundle: Record<string, Asset> = {
    'assets/index-X.css': {
      type: 'asset',
      source: [
        face('Inter', 'inter-latin-400-normal-A1'),
        face('Inter', 'inter-latin-ext-400-normal-A2'),
        face('Playfair Display', 'playfair-display-latin-400-normal-B1'),
        face('Roboto', 'roboto-latin-400-normal-C1'),
        face('Manrope', 'manrope-latin-wght-normal-M1'),
      ].join(''),
    },
  };
  for (const file of files) {
    bundle[`assets/${file}.woff2`] = { type: 'asset', source: '' };
    bundle[`assets/${file}.woff`] = { type: 'asset', source: '' };
  }
  return bundle;
}

async function build(themesCss: string) {
  const appRoot = mkdtempSync(join(tmpdir(), 'dndev-vite-fonts-'));
  mkdirSync(join(appRoot, 'src'), { recursive: true });
  writeFileSync(join(appRoot, 'src', 'themes.css'), themesCss);
  PathResolver.getInstance().setAppRoot(appRoot);

  const i18nStore = createI18nStore();
  i18nStore.set({ supportedLanguages: ['en'] });
  const plugin = createViteFontPreloadPlugin({ i18nStore });
  plugin.configResolved({ command: 'build', root: appRoot, base: '/' });
  await plugin.buildStart();
  const bundle = catalogueBundle();
  plugin.generateBundle({}, bundle);
  rmSync(appRoot, { recursive: true, force: true });
  return bundle;
}

describe('Vite font filter', () => {
  beforeEach(() => PathResolver._reset());
  afterEach(() => PathResolver._reset());

  it('keeps the theme family only (Inter by default), woff2 only', async () => {
    const bundle = await build('');
    const fonts = Object.keys(bundle).filter((f) => /\.woff2?$/.test(f));
    expect(fonts.sort()).toEqual([
      'assets/inter-latin-400-normal-A1.woff2',
      'assets/manrope-latin-wght-normal-M1.woff',
      'assets/manrope-latin-wght-normal-M1.woff2',
    ]);
    const css = bundle['assets/index-X.css'].source;
    expect(css).toContain("font-family:'Inter'");
    expect(css).toContain("font-family:'Manrope'");
    expect(css).not.toMatch(/Playfair|Roboto|inter-latin-ext/);
    expect(css).not.toContain('url(/assets/inter-latin-400-normal-A1.woff)');
  });

  it('ships no framework font when the theme uses only its own fonts', async () => {
    const bundle = await build(`:root {
      --font-family: 'Manrope', sans-serif;
      --font-headline: var(--font-display);
    }`);
    const fonts = Object.keys(bundle).filter((f) => f.endsWith('.woff2'));
    expect(fonts).toEqual(['assets/manrope-latin-wght-normal-M1.woff2']);
    expect(bundle['assets/index-X.css'].source).not.toMatch(
      /Inter|Playfair|Roboto/
    );
  });
});
