/**
 * The font plan: one declaration (theme font tokens + appConfig.fonts) → the files,
 * inline @font-face and per-language preloads both bundlers emit.
 * @vitest-environment node
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { buildFontPlan, FONT_DISPLAY, languageSubsets } from '../buildFontPlan.js';
import { matchFontWeight } from '../fontSources.js';
import { writeFontPlan } from '../writeFontPlan.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
/** The framework's real token defaults (Inter sans, Playfair serif, system mono, weights 400-700). */
const FRAMEWORK_CSS = readFileSync(
  join(repoRoot, 'packages/components/src/styles/variables.css'),
  'utf8'
);
/** A real woff2 with Latin letters (fallback metrics are read from fixture files). */
const INTER_DIR = dirname(
  fileURLToPath(import.meta.resolve('@fontsource/inter/package.json'))
);
const REAL_WOFF2 = join(INTER_DIR, 'files', 'inter-latin-400-normal.woff2');
const OTHER_WOFF2 = join(INTER_DIR, 'files', 'inter-latin-700-normal.woff2');

const LATIN = 'U+0000-00FF,U+0131';
const LATIN_EXT = 'U+0100-02BA';

let appRoot: string;

beforeEach(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'dndev-font-plan-'));
  writeFileSync(join(appRoot, 'package.json'), '{"name":"fixture-app"}');
  mkdirSync(join(appRoot, 'src'), { recursive: true });
  PathResolver.getInstance().setAppRoot(appRoot);
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

/** A fontsource package in the app's node_modules, files copied from a real woff2. */
function fontsourcePackage(
  name: string,
  metadata: { id: string; family: string; weights: number[]; styles?: string[]; category?: string; wght?: [number, number] }
) {
  const dir = join(appRoot, 'node_modules', ...name.split('/'));
  mkdirSync(join(dir, 'files'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '5.0.0' }));
  const styles = metadata.styles ?? ['normal'];
  writeFileSync(
    join(dir, 'metadata.json'),
    JSON.stringify({
      id: metadata.id,
      family: metadata.family,
      subsets: ['latin', 'latin-ext'],
      weights: metadata.weights,
      styles,
      defSubset: 'latin',
      variable: metadata.wght
        ? { wght: { default: '400', min: String(metadata.wght[0]), max: String(metadata.wght[1]), step: '1' } }
        : false,
      category: metadata.category ?? 'sans-serif',
    })
  );
  writeFileSync(join(dir, 'unicode.json'), JSON.stringify({ 'latin-ext': LATIN_EXT, latin: LATIN }));
  for (const subset of ['latin', 'latin-ext']) {
    for (const style of styles) {
      for (const weight of metadata.wght ? ['wght'] : metadata.weights) {
        copyFileSync(REAL_WOFF2, join(dir, 'files', `${metadata.id}-${subset}-${weight}-${style}.woff2`));
      }
    }
  }
}

/** The app's CSS and source files. */
function appFiles(files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(appRoot, file)), { recursive: true });
    writeFileSync(join(appRoot, file), content);
  }
}

async function plan({
  appCss = '',
  languages = ['en'],
  appFonts,
  publicPath,
}: {
  appCss?: string;
  languages?: string[];
  appFonts?: Record<string, unknown>;
  publicPath?: string;
} = {}) {
  return buildFontPlan({
    fontCss: { framework: FRAMEWORK_CSS, app: appCss ? [{ file: 'src/themes.css', css: appCss }] : [] },
    appFonts: appFonts as never,
    languages,
    publicPath,
    pathResolver: PathResolver.getInstance(),
  });
}

/** The plan's contract, whatever the fixture. */
function expectConsistent(result: Awaited<ReturnType<typeof plan>>) {
  const urls = new Set(result.files.map(({ url }) => url));
  const cssUrls = [...result.css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
  expect(cssUrls.length).toBeGreaterThan(0);
  for (const url of cssUrls) expect(urls.has(url)).toBe(true);
  for (const hrefs of Object.values(result.preloads)) {
    for (const href of hrefs) {
      expect(urls.has(href)).toBe(true);
      expect(cssUrls).toContain(href);
    }
  }
  const webFaces = result.css.split('\n').filter((rule) => rule.includes('src:url('));
  for (const face of webFaces) expect(face).toContain(`font-display:${FONT_DISPLAY};`);
  for (const url of urls) expect(url).toMatch(/^\/fonts\/[a-z0-9-]+\.[0-9a-f]{8}\.woff2$/);
}

describe('buildFontPlan: sources', () => {
  it('default theme: Inter from @donotdev/ui, weights of the --font-weight-* tokens, 2 preloads', async () => {
    const result = await plan();
    expect(FONT_DISPLAY).toBe('optional');
    expect(result.families).toEqual([
      { family: 'Inter', kind: 'static', category: 'sans-serif', source: '@fontsource/inter', fallback: 'Inter Fallback' },
    ]);
    // 400 / 500 / 600 / 700 (framework tokens) × normal + italic × latin
    expect(result.files.map(({ url }) => url.replace(/\.[0-9a-f]{8}\.woff2$/, ''))).toEqual([
      '/fonts/inter-latin-400-normal',
      '/fonts/inter-latin-400-italic',
      '/fonts/inter-latin-500-normal',
      '/fonts/inter-latin-500-italic',
      '/fonts/inter-latin-600-normal',
      '/fonts/inter-latin-600-italic',
      '/fonts/inter-latin-700-normal',
      '/fonts/inter-latin-700-italic',
    ]);
    // Body at --font-weight-normal, headline (Inter too) at --font-weight-bold
    expect(result.preloads.en.map((url) => url.replace(/\.[0-9a-f]{8}\.woff2$/, ''))).toEqual([
      '/fonts/inter-latin-400-normal',
      '/fonts/inter-latin-700-normal',
    ]);
    expect(result.css).toContain("font-family: 'Inter Fallback';");
    expectConsistent(result);
  });

  it('weights follow the app tokens (kbeauty: 300/400/500/600 ships Inter 500)', async () => {
    const result = await plan({
      appCss: `:root {
        --font-weight-normal: 300; --font-weight-medium: 400;
        --font-weight-semibold: 500; --font-weight-bold: 600;
      }`,
    });
    const weights = [...result.css.matchAll(/font-family:'Inter';font-style:normal;font-weight:(\d+)/g)].map((m) => m[1]);
    expect(weights).toEqual(['300', '400', '500', '600']);
    expect(result.preloads.en.map((url) => url.split('/').pop()!.split('.')[0])).toEqual([
      'inter-latin-300-normal',
      'inter-latin-600-normal',
    ]);
    expectConsistent(result);
  });

  it('@fontsource-variable (app) and @fontsource (app) by name; latin-ext preloaded for pl only', async () => {
    fontsourcePackage('@fontsource-variable/manrope', { id: 'manrope', family: 'Manrope', weights: [200, 400, 800], wght: [200, 800] });
    fontsourcePackage('@fontsource/instrument-serif', {
      id: 'instrument-serif', family: 'Instrument Serif', weights: [400, 500, 600, 700], styles: ['normal', 'italic'], category: 'serif',
    });
    const result = await plan({
      languages: ['fr', 'pl'],
      appCss: `:root {
        --font-sans: Manrope, 'Manrope Fallback', -apple-system, 'Segoe UI', sans-serif;
        --font-family: var(--font-sans);
        --font-headline: 'Instrument Serif', 'Instrument Serif Fallback', 'Times New Roman', serif;
      }`,
    });
    expect(result.families.map(({ family, kind, category, source }) => [family, kind, category, source])).toEqual([
      ['Manrope', 'variable', 'sans-serif', '@fontsource-variable/manrope'],
      ['Instrument Serif', 'static', 'serif', '@fontsource/instrument-serif'],
    ]);
    expect(result.css).toContain("font-family:'Manrope';font-style:normal;font-weight:200 800;");
    expect(result.css).toContain(`unicode-range:${LATIN_EXT};`);
    // Fallback faces: Arial for Manrope, Times New Roman for the serif family
    expect(result.css).toMatch(/font-family: 'Manrope Fallback';\n {2}src: local\('Arial'\)/);
    expect(result.css).toMatch(/font-family: 'Instrument Serif Fallback';\n {2}src: local\('Times New Roman'\)/);
    const stems = (language: string) =>
      result.preloads[language].map((url) => url.split('/').pop()!.split('.')[0]);
    expect(stems('fr')).toEqual(['manrope-latin-wght-normal', 'instrument-serif-latin-700-normal']);
    expect(stems('pl')).toEqual([
      'manrope-latin-wght-normal',
      'manrope-latin-ext-wght-normal',
      'instrument-serif-latin-700-normal',
      'instrument-serif-latin-ext-700-normal',
    ]);
    expectConsistent(result);
  });

  it('the app package wins over the @donotdev/ui one, variable over static', async () => {
    fontsourcePackage('@fontsource-variable/inter', { id: 'inter', family: 'Inter', weights: [100, 900], wght: [100, 900] });
    const result = await plan();
    expect(result.families[0]).toMatchObject({ kind: 'variable', source: '@fontsource-variable/inter' });
    // One variable file covers body and headline weights: one preload
    expect(result.preloads.en).toHaveLength(1);
  });

  it('appConfig.fonts: local files, core face preloaded, unicode-range faces never', async () => {
    mkdirSync(join(appRoot, 'src/assets/fonts'), { recursive: true });
    copyFileSync(REAL_WOFF2, join(appRoot, 'src/assets/fonts/brand.woff2'));
    copyFileSync(OTHER_WOFF2, join(appRoot, 'src/assets/fonts/brand-rare-1.woff2'));
    const result = await plan({
      languages: ['ko'],
      appCss: `:root { --font-sans: Brand, 'Brand Fallback', 'Brand Rare', sans-serif; --font-family: var(--font-sans); --font-headline: var(--font-sans); }`,
      appFonts: {
        Brand: { category: 'sans-serif', faces: [{ file: 'src/assets/fonts/brand.woff2', weight: '300 700' }] },
        'Brand Rare': {
          category: 'sans-serif',
          faces: [{ file: 'src/assets/fonts/brand-rare-1.woff2', weight: '300 700', unicodeRange: 'U+3131-318E' }],
        },
      },
    });
    expect(result.families.map(({ family, kind, fallback }) => [family, kind, fallback])).toEqual([
      ['Brand', 'local', 'Brand Fallback'],
      ['Brand Rare', 'local', null],
    ]);
    expect(result.css).toContain("font-family:'Brand Rare';font-style:normal;font-weight:300 700;");
    expect(result.css).toContain('unicode-range:U+3131-318E;');
    expect(result.preloads.ko).toHaveLength(1);
    expect(result.preloads.ko[0]).toMatch(/^\/fonts\/brand\.[0-9a-f]{8}\.woff2$/);
    expectConsistent(result);
  });

  it('a system-only theme ships nothing and preloads nothing', async () => {
    const result = await plan({
      appCss: ':root { --font-family: ui-monospace, Menlo, monospace; --font-headline: var(--font-family); }',
    });
    expect(result).toMatchObject({ families: [], files: [], css: '', preloads: { en: [] } });
  });

  it('every theme class ships its families (theme switching); preloads stay the default theme', async () => {
    const result = await plan({
      appCss: `.retro { --font-family: 'Press Start 2P', 'Press Start 2P Fallback', var(--font-mono);
        --font-weight-normal: 400; --font-weight-medium: 400; --font-weight-semibold: 400; --font-weight-bold: 400; }`,
    });
    expect(result.families.map(({ family }) => family)).toEqual(['Inter', 'Press Start 2P']);
    expect(result.preloads.en.every((url) => url.includes('/inter-'))).toBe(true);
  });
});

describe('buildFontPlan: weights', () => {
  it('a used weight the source lacks: no error, the matched face ships and is preloaded, listed as a notice', async () => {
    fontsourcePackage('@fontsource/instrument-serif', {
      id: 'instrument-serif', family: 'Instrument Serif', weights: [400], styles: ['normal', 'italic'], category: 'serif',
    });
    const result = await plan({
      appCss: ":root { --font-headline: 'Instrument Serif', 'Instrument Serif Fallback', serif; }",
    });
    // Tokens 400/500/600/700: the one face the source has ships, nothing else
    const serif = result.files.map(({ url }) => url).filter((url) => url.includes('instrument-serif'));
    expect(serif.map((url) => url.split('/').pop()!.split('.')[0])).toEqual([
      'instrument-serif-latin-400-normal',
      'instrument-serif-latin-400-italic',
    ]);
    // h1 at --font-weight-bold renders in the 400 face (synthesized bold): that file is preloaded
    expect(result.preloads.en[1]).toContain('/instrument-serif-latin-400-normal.');
    expect(result.notices).toEqual([
      'Instrument Serif: weight 500 not in source, browser-synthesized',
      'Instrument Serif: weight 600 not in source, browser-synthesized',
      'Instrument Serif: weight 700 not in source, browser-synthesized',
    ]);
    // No rule sets font-synthesis: matching and synthesis stay the browser's
    expect(result.css).not.toContain('font-synthesis');
    expectConsistent(result);
  });

  it('every used weight the source has ships (Playfair 400/500/600 of a 300-600 theme; 300 is a notice)', async () => {
    const result = await plan({
      appCss: `.luxury { --font-family: var(--font-sans);
        --font-headline: 'Playfair Display', 'Playfair Display Fallback', var(--font-serif);
        --font-weight-normal: 300; --font-weight-medium: 400; --font-weight-semibold: 500; --font-weight-bold: 600; }`,
    });
    const weights = [...result.css.matchAll(/font-family:'Playfair Display';font-style:normal;font-weight:(\d+)/g)].map((m) => m[1]);
    expect(weights).toEqual(['400', '500', '600']);
    // Inter has 300: it ships
    expect(result.css).toContain("font-family:'Inter';font-style:normal;font-weight:300;");
    expect(result.notices).toEqual(['Playfair Display: weight 300 not in source, browser-synthesized']);
  });

  it('matchFontWeight follows CSS font matching', () => {
    const single = [[400, 400]] as Array<[number, number]>;
    expect(matchFontWeight(700, single)).toBe(400);
    expect(matchFontWeight(300, [[400, 400], [700, 700]])).toBe(400);
    expect(matchFontWeight(450, [[300, 300], [700, 700]])).toBe(300);
    expect(matchFontWeight(450, [[300, 300], [500, 500]])).toBe(500);
    expect(matchFontWeight(600, [[400, 400], [800, 800]])).toBe(800);
    expect(matchFontWeight(600, [[300, 500]])).toBe(500);
    expect(matchFontWeight(350, [[200, 800]])).toBe(350);
  });
});

describe('buildFontPlan: files', () => {
  it('names files by content hash, with the Vite base as prefix', async () => {
    const a = await plan({ publicPath: '/app' });
    expect(a.files[0].url).toMatch(/^\/app\/fonts\/inter-latin-400-normal\.[0-9a-f]{8}\.woff2$/);
    expect(a.css).toContain('url(/app/fonts/');

    mkdirSync(join(appRoot, 'src/assets'), { recursive: true });
    const fonts = (file: string) => ({
      Brand: { category: 'sans-serif', faces: [{ file, weight: '100 900' }] },
    });
    const css = ":root { --font-family: Brand, 'Brand Fallback', sans-serif; --font-headline: var(--font-family); }";
    copyFileSync(REAL_WOFF2, join(appRoot, 'src/assets/brand.woff2'));
    const first = await plan({ appCss: css, appFonts: fonts('src/assets/brand.woff2') });
    copyFileSync(OTHER_WOFF2, join(appRoot, 'src/assets/brand.woff2'));
    const second = await plan({ appCss: css, appFonts: fonts('src/assets/brand.woff2') });
    expect(first.files[0].url).not.toBe(second.files[0].url);
  });

  it('writeFontPlan empties public/fonts/ and writes the hashed files', async () => {
    const pathResolver = PathResolver.getInstance();
    mkdirSync(join(appRoot, 'public/fonts'), { recursive: true });
    writeFileSync(join(appRoot, 'public/fonts/stale.woff2'), '');
    const result = await plan();
    writeFontPlan(result, { pathResolver });
    const written = readdirSync(join(appRoot, 'public/fonts')).sort();
    expect(written).toEqual(result.files.map(({ url }) => url.split('/').pop()).sort());
    expect(existsSync(join(appRoot, 'public/fonts/stale.woff2'))).toBe(false);
  });

  it('emission order: web faces, then fallback faces; body preload before headline', async () => {
    fontsourcePackage('@fontsource/instrument-serif', {
      id: 'instrument-serif', family: 'Instrument Serif', weights: [400, 500, 600, 700], category: 'serif',
    });
    const result = await plan({
      appCss: ":root { --font-headline: 'Instrument Serif', 'Instrument Serif Fallback', serif; }",
    });
    const lastWebFace = result.css.lastIndexOf('src:url(');
    expect(lastWebFace).toBeLessThan(result.css.indexOf('Fallback'));
    expect(result.preloads.en[0]).toContain('/inter-latin-400-normal.');
    expect(result.preloads.en[1]).toContain('/instrument-serif-latin-700-normal.');
  });

  it('languageSubsets: the locale subsets, latin when the locale lists none', () => {
    expect(languageSubsets('pl')).toEqual(['latin', 'latin-ext']);
    expect(languageSubsets('ko')).toEqual(['latin']);
    expect(languageSubsets('xx')).toEqual(['latin']);
  });
});

describe('buildFontPlan: fails loud', () => {
  it("a leading family without its 'X Fallback' prints the exact line to paste", async () => {
    await expect(
      plan({ appCss: ".luxury { --font-headline: 'Playfair Display', var(--font-serif); }" })
    ).rejects.toThrow(
      "src/themes.css (.luxury): --font-headline lacks 'Playfair Display Fallback' right after 'Playfair Display' (the size-matched fallback face: no layout shift, no flicker). Write:\n    --font-headline: 'Playfair Display', 'Playfair Display Fallback', var(--font-serif);"
    );
  });

  it('reports the declaration that writes the family, through var()', async () => {
    await expect(
      plan({ appCss: ':root { --font-sans: Roboto, Arial, sans-serif; }' })
    ).rejects.toThrow("--font-sans: Roboto, 'Roboto Fallback', Arial, sans-serif;");
  });

  it('a family nothing provides', async () => {
    await expect(
      plan({ appCss: ":root { --font-family: 'Totally Unknown', 'Totally Unknown Fallback', sans-serif; }" })
    ).rejects.toThrow(
      "--font-family (:root) names 'Totally Unknown', which nothing provides: install @fontsource-variable/totally-unknown or @fontsource/totally-unknown"
    );
  });

  it('a var() no CSS defines (a next/font class variable)', async () => {
    await expect(
      plan({ appCss: ':root { --font-sans: var(--font-manrope), sans-serif; }' })
    ).rejects.toThrow('--font-sans: var(--font-manrope), sans-serif uses var(--font-manrope), which no theme CSS defines');
  });

  it('a package whose family differs from the stack', async () => {
    fontsourcePackage('@fontsource/brand', { id: 'brand', family: 'Brand Sans', weights: [400, 500, 600, 700] });
    await expect(
      plan({ appCss: ":root { --font-family: Brand, 'Brand Fallback', sans-serif; }" })
    ).rejects.toThrow("@fontsource/brand is the family 'Brand Sans', the font stack names 'Brand'.");
  });

  it('an appConfig.fonts file that is missing or not woff2', async () => {
    const css = ":root { --font-family: Brand, 'Brand Fallback', sans-serif; }";
    await expect(
      plan({ appCss: css, appFonts: { Brand: { category: 'sans-serif', faces: [{ file: 'src/none.woff2', weight: 400 }] } } })
    ).rejects.toThrow("appConfig.fonts['Brand'].faces[0].file: src/none.woff2 does not exist.");
    appFiles({ 'src/fake.woff2': 'not a font' });
    await expect(
      plan({ appCss: css, appFonts: { Brand: { category: 'sans-serif', faces: [{ file: 'src/fake.woff2', weight: 400 }] } } })
    ).rejects.toThrow('src/fake.woff2 is not a woff2 font.');
  });

  it('next/font, @fontsource imports and @font-face in the app', async () => {
    appFiles({
      'src/app/AppDocument.tsx': "import localFont from 'next/font/local';\n// import x from 'next/font/google'\n",
      'src/main.tsx': "import '@fontsource/inter/400.css';\n",
      'src/fonts.generated.ts': "export const css = '@font-face{}';\n",
    });
    const error = await plan({
      appCss: "@import '@fontsource-variable/manrope';\n@font-face { font-family: X; }\n",
    }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('src/themes.css:1 imports an @fontsource package');
    expect(message).toContain('src/themes.css:2 declares @font-face');
    expect(message).toContain('src/app/AppDocument.tsx:1 imports next/font');
    expect(message).toContain('src/main.tsx:1 imports an @fontsource package');
    // Comments and generated files are not app code
    expect(message).not.toContain('AppDocument.tsx:2');
    expect(message).not.toContain('fonts.generated');
  });

  it('@font-face in the Vite index.html', async () => {
    await expect(
      buildFontPlan({
        fontCss: { framework: FRAMEWORK_CSS, app: [] },
        languages: ['en'],
        indexHtml: '<html><head><!-- @font-face --><style>@font-face{font-family:A}</style></head></html>',
        pathResolver: PathResolver.getInstance(),
      })
    ).rejects.toThrow('index.html:1 declares @font-face');
  });

  it('no theme discovery input', async () => {
    await expect(
      buildFontPlan({ fontCss: undefined as never, languages: ['en'], pathResolver: PathResolver.getInstance() })
    ).rejects.toThrow('fontCss is required');
  });
});
