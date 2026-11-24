// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AssetDiscovery,
  FRAMEWORK_DEFAULT_ICON_SHA256,
  FRAMEWORK_DEFAULT_LOGO_SHA256,
  ICON_STATE_FILE,
  MISSING_LOGO_WARNING,
  SHARP_MISSING_WARNING,
} from '../AssetDiscovery.js';
import { PathResolver } from '../../utils/PathResolver.js';

/** The framework's shipped assets (packages/ui/assets). */
const UI_ASSETS = join(__dirname, '..', '..', '..', '..', 'ui', 'assets');

const OUTPUTS = [
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192x192.png',
  'icon-512x512.png',
  'og-image.png',
];

const logoSvg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${fill}"/></svg>`;

const sha256 = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');

describe('asset discovery: icons derived from public/logo.svg', () => {
  const resolver = PathResolver.getInstance();
  const previousRoot = resolver.getAppRoot();
  const roots: string[] = [];
  afterEach(() => {
    resolver.setAppRoot(previousRoot);
    vi.restoreAllMocks();
    for (const root of roots.splice(0))
      rmSync(root, { recursive: true, force: true });
  });

  /** An app with `public/` (and `public/logo.svg` when given). */
  const app = (logo?: string | Buffer) => {
    const appRoot = mkdtempSync(join(tmpdir(), 'dndev-icons-'));
    roots.push(appRoot);
    mkdirSync(join(appRoot, 'public'));
    if (logo !== undefined)
      writeFileSync(join(appRoot, 'public', 'logo.svg'), logo);
    resolver.setAppRoot(appRoot);
    return appRoot;
  };

  /** A discovery with its warn and debug logs captured. */
  const discovery = () => {
    const d = new AssetDiscovery(resolver);
    const warn = vi.spyOn(d.logger, 'warn').mockImplementation(() => {});
    const debug = vi.spyOn(d.logger, 'debug').mockImplementation(() => {});
    return { d, warn, debug };
  };

  const file = (appRoot: string, name: string) =>
    readFileSync(join(appRoot, 'public', name));
  const state = (appRoot: string) =>
    JSON.parse(readFileSync(join(appRoot, ICON_STATE_FILE), 'utf8'));

  it('1. generates every missing output and records the logo and output hashes', async () => {
    const logo = logoSvg('#a07030');
    const appRoot = app(logo);
    const { d, warn } = discovery();

    const result = await d.discover(true);

    expect(result.generatedAssets).toEqual(OUTPUTS);
    expect(warn).not.toHaveBeenCalled();
    expect(file(appRoot, 'favicon.svg').toString()).toBe(logo);
    const record = state(appRoot);
    expect(Object.keys(record)).toEqual(OUTPUTS);
    for (const name of OUTPUTS) {
      expect(record[name]).toEqual({
        logo: sha256(logo),
        sha256: sha256(file(appRoot, name)),
      });
    }
    // Nothing to do on the next run: no file and no record rewritten
    const again = discovery();
    expect((await again.d.discover(true)).generatedAssets).toEqual([]);
    expect(state(appRoot)).toEqual(record);
  });

  it('2. replaces an output byte-identical to a framework default, with a warning', async () => {
    const appRoot = app(logoSvg('#a07030'));
    for (const name of ['icon-192x192.png', 'favicon.ico', 'favicon.svg']) {
      copyFileSync(join(UI_ASSETS, name), join(appRoot, 'public', name));
    }
    const { d, warn } = discovery();

    const result = await d.discover(true);

    expect(result.generatedAssets).toEqual(OUTPUTS);
    expect(warn.mock.calls).toEqual([
      ['replaced framework default public/favicon.svg'],
      ['replaced framework default public/favicon.ico'],
      ['replaced framework default public/icon-192x192.png'],
    ]);
    for (const name of ['icon-192x192.png', 'favicon.ico', 'favicon.svg']) {
      expect(FRAMEWORK_DEFAULT_ICON_SHA256.has(sha256(file(appRoot, name)))).toBe(
        false
      );
      expect(state(appRoot)[name].sha256).toBe(sha256(file(appRoot, name)));
    }
  });

  it('3. regenerates only the outputs still equal to their record when logo.svg changes', async () => {
    const appRoot = app(logoSvg('#a07030'));
    await discovery().d.discover(true);
    const before = Object.fromEntries(
      OUTPUTS.map((name) => [name, file(appRoot, name)])
    );
    // The app replaced one generated icon with its own, then changed its logo
    const ownIcon = Buffer.from('hand-made apple touch icon');
    writeFileSync(join(appRoot, 'public', 'apple-touch-icon.png'), ownIcon);
    const newLogo = logoSvg('#205080');
    writeFileSync(join(appRoot, 'public', 'logo.svg'), newLogo);
    const { d, warn } = discovery();

    const result = await d.discover(true);

    const regenerated = OUTPUTS.filter((n) => n !== 'apple-touch-icon.png');
    expect(result.generatedAssets).toEqual(regenerated);
    expect(warn).not.toHaveBeenCalled();
    expect(file(appRoot, 'apple-touch-icon.png')).toEqual(ownIcon);
    const record = state(appRoot);
    expect(Object.keys(record)).toEqual(regenerated);
    for (const name of regenerated) {
      expect(file(appRoot, name).equals(before[name])).toBe(false);
      expect(record[name]).toEqual({
        logo: sha256(newLogo),
        sha256: sha256(file(appRoot, name)),
      });
    }
  });

  it('4. never touches a hand-made output (no framework default, no record)', async () => {
    const appRoot = app(logoSvg('#a07030'));
    const ownIcon = Buffer.from('hand-made 512 icon');
    writeFileSync(join(appRoot, 'public', 'icon-512x512.png'), ownIcon);
    const { d, debug } = discovery();

    const result = await d.discover(true);

    expect(result.generatedAssets).toEqual(
      OUTPUTS.filter((n) => n !== 'icon-512x512.png')
    );
    expect(file(appRoot, 'icon-512x512.png')).toEqual(ownIcon);
    expect(state(appRoot)['icon-512x512.png']).toBeUndefined();
    expect(debug).toHaveBeenCalledWith(
      "public/icon-512x512.png is the app's own (not generated from logo.svg): left as is"
    );
  });

  it('5. without logo.svg: one warning naming the framework default icons, nothing written', async () => {
    const appRoot = app();
    copyFileSync(
      join(UI_ASSETS, 'icon-192x192.png'),
      join(appRoot, 'public', 'icon-192x192.png')
    );
    copyFileSync(
      join(UI_ASSETS, 'apple-touch-icon.png'),
      join(appRoot, 'public', 'apple-touch-icon.png')
    );
    writeFileSync(join(appRoot, 'public', 'favicon.ico'), 'hand-made');
    const { d, warn } = discovery();

    const result = await d.discover(true);

    expect(warn.mock.calls).toEqual([
      [
        `${MISSING_LOGO_WARNING} These icons are framework defaults (the DoNotDev logo): public/apple-touch-icon.png, public/icon-192x192.png.`,
      ],
    ]);
    expect(result.generatedAssets).toEqual([]);
    expect(existsSync(join(appRoot, 'public', 'favicon.svg'))).toBe(false);
    expect(existsSync(join(appRoot, ICON_STATE_FILE))).toBe(false);
  });

  it('6. without sharp: a visible warning, only favicon.svg generated', async () => {
    const appRoot = app(logoSvg('#a07030'));
    const { d, warn } = discovery();
    vi.spyOn(d, '_importSharp').mockResolvedValue(null);

    const result = await d.discover(true);

    expect(warn.mock.calls).toEqual([[SHARP_MISSING_WARNING]]);
    expect(result.generatedAssets).toEqual(['favicon.svg']);
    expect(existsSync(join(appRoot, 'public', 'favicon.ico'))).toBe(false);
    expect(Object.keys(state(appRoot))).toEqual(['favicon.svg']);
  });

  it('7. framework logo.svg (DoNotDev apps): defaults kept, only missing outputs generated', async () => {
    const logo = readFileSync(join(UI_ASSETS, 'logo.svg'));
    expect(FRAMEWORK_DEFAULT_LOGO_SHA256.has(sha256(logo))).toBe(true);
    const appRoot = app(logo);
    const shipped = ['favicon.ico', 'apple-touch-icon.png', 'icon-192x192.png'];
    for (const name of shipped) {
      copyFileSync(join(UI_ASSETS, name), join(appRoot, 'public', name));
    }
    const { d, warn } = discovery();

    const result = await d.discover(true);

    expect(warn).not.toHaveBeenCalled();
    expect(result.generatedAssets).toEqual(
      OUTPUTS.filter((n) => !shipped.includes(n))
    );
    for (const name of shipped) {
      expect(file(appRoot, name)).toEqual(readFileSync(join(UI_ASSETS, name)));
    }
  });

  it('fails the build on an invalid state file', async () => {
    const appRoot = app(logoSvg('#a07030'));
    mkdirSync(join(appRoot, '.dndev'));
    writeFileSync(join(appRoot, ICON_STATE_FILE), '{ not json');
    const { d } = discovery();
    vi.spyOn(d.logger, 'error').mockImplementation(() => {});

    await expect(d.discover(true)).rejects.toThrow(
      `[dndev-assets] ${ICON_STATE_FILE} is not valid JSON`
    );
  });
});
