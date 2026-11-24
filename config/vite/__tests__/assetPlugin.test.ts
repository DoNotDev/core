/**
 * Vite `virtual:assets`: the logo helpers over the app's public/ (AssetDiscovery manifest).
 * @vitest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { VIRTUAL_MODULES } from '../../constants.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { createViteAssetPlugin } from '../plugins/AssetPlugin.js';

const resolver = PathResolver.getInstance();
const previousRoot = resolver.getAppRoot();
let appRoot: string | undefined;

/** `virtual:assets` of an app whose public/ holds `files` (no icon generation). */
async function virtualAssets(files: string[]) {
  appRoot = mkdtempSync(join(tmpdir(), 'dndev-vite-assets-'));
  mkdirSync(join(appRoot, 'public'));
  for (const file of files) writeFileSync(join(appRoot, 'public', file), '<svg/>');
  resolver.setAppRoot(appRoot);
  const plugin = createViteAssetPlugin({
    generateAssets: false,
    i18nStore: { ready: async () => ({ flagCodes: null }) },
    routeManifest: { entityResolver: async () => null },
  });
  await plugin.buildStart();
  const code = await plugin.load(`\0${VIRTUAL_MODULES.assets}`);
  const modulePath = join(appRoot, 'virtual-assets.mjs');
  writeFileSync(modulePath, code);
  return import(pathToFileURL(modulePath).href);
}

describe('virtual:assets logo', () => {
  afterEach(() => {
    resolver.setAppRoot(previousRoot);
    if (appRoot) rmSync(appRoot, { recursive: true });
    appRoot = undefined;
  });

  // REGRESSION: on Vite no logo was ever optimal (its format list held file names)
  it('is logo.svg whenever it exists; logo.png only the raster fallback', async () => {
    const assets = await virtualAssets(['logo.svg', 'logo.png']);
    expect(assets.logo).toEqual({ optimal: '/logo.svg', fallback: '/logo.png' });
    expect(assets.getLogo('svg')).toBe('/logo.svg');
    expect(assets.getLogo()).toBe('/logo.png');
    expect(assets.stats.hasLogo).toBe(true);
  });

  it('is logo.svg with logo.svg alone', async () => {
    const assets = await virtualAssets(['logo.svg']);
    expect(assets.logo).toEqual({ optimal: '/logo.svg', fallback: null });
    expect(assets.getLogo('svg')).toBe('/logo.svg');
    expect(assets.getLogo()).toBe('/logo.svg');
    expect(assets.stats.hasLogo).toBe(true);
  });

  it('is logo.png without logo.svg', async () => {
    const assets = await virtualAssets(['logo.png']);
    expect(assets.logo).toEqual({ optimal: '/logo.png', fallback: '/logo.png' });
    expect(assets.getLogo('svg')).toBe('/logo.png');
    expect(assets.stats.hasLogo).toBe(true);
  });
});

describe('virtual:assets asset list', () => {
  afterEach(() => {
    resolver.setAppRoot(previousRoot);
    if (appRoot) rmSync(appRoot, { recursive: true });
    appRoot = undefined;
  });

  // getAllAssets() and assets: the manifest's one asset list (no modern / fallback split)
  it('is every listed public asset', async () => {
    const assets = await virtualAssets(['favicon.svg', 'logo.svg', 'not-an-asset.txt']);
    expect([...assets.getAllAssets()].sort()).toEqual(['/favicon.svg', '/logo.svg']);
    expect([...assets.assets].sort()).toEqual(['/favicon.svg', '/logo.svg']);
  });
});
