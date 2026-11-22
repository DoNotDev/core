// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AssetDiscovery } from '../AssetDiscovery.js';
import { PathResolver } from '../../utils/PathResolver.js';

const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#123456"/></svg>';

describe('asset discovery: a clean build lists what a rebuild lists', () => {
  const resolver = PathResolver.getInstance();
  const previousRoot = resolver.getAppRoot();
  const roots: string[] = [];
  afterEach(() => {
    resolver.setAppRoot(previousRoot);
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  // REGRESSION: public/ was scanned before the defaults were copied and the icons generated,
  // so a clean build's asset list missed them (a rebuild had them)
  it('scans public/ after copying the defaults and generating the icons', async () => {
    const appRoot = mkdtempSync(join(tmpdir(), 'dndev-assets-'));
    roots.push(appRoot);
    mkdirSync(join(appRoot, 'public'));
    writeFileSync(join(appRoot, 'public', 'logo.svg'), LOGO);
    // The working directory stays elsewhere (the repo): files go to the app's public/
    resolver.setAppRoot(appRoot);

    const clean = await new AssetDiscovery(resolver).discover(true);
    // What the rest of the first build writes into public/ (discovery outputs)
    for (const output of ['asset-manifest.json', 'i18n-manifest.json', 'pwa-manifest.json', 'seo-manifest.json']) {
      writeFileSync(join(appRoot, 'public', output), '{}');
    }
    const rebuild = await new AssetDiscovery(resolver).discover(true);

    expect(clean.copiedAssets).toContain('manifest.json');
    expect(clean.generatedAssets).toContain('favicon.svg');
    expect(rebuild.copiedAssets).toEqual([]);
    expect(rebuild.generatedAssets).toEqual([]);
    const paths = clean.assets.map((asset: { path: string }) => asset.path);
    expect(paths).toEqual(expect.arrayContaining(['/logo.svg', '/favicon.svg']));
    // REGRESSION: the generated PWA icons and og-image.png matched no asset pattern
    expect(paths).toEqual(
      expect.arrayContaining(['/icon-192x192.png', '/icon-512x512.png', '/og-image.png'])
    );
    // REGRESSION: the copied default manifest.json was listed with its size, which the Next
    // PWA step changes afterwards (a rebuild listed another size); it is the `manifest` entry
    expect(paths).not.toContain('/manifest.json');
    expect(clean.manifest.manifest).toBe('/manifest.json');
    writeFileSync(join(appRoot, 'public', 'manifest.json'), '{"name":"Shop","icons":[]}');
    const afterPwa = await new AssetDiscovery(resolver).discover(true);
    expect(afterPwa.assets).toEqual(clean.assets);
    expect(paths).toEqual(rebuild.assets.map((asset: { path: string }) => asset.path));
    // The PWA step scans public/ itself: the asset result hands it no icons
    expect(clean).not.toHaveProperty('pwaIcons');
    expect(clean.manifest.favicon.optimal).toBe('/favicon.svg');
    // REGRESSION: generated assets were written to public/ of the working directory
    expect(existsSync(join(appRoot, 'public', 'favicon.svg'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'public', 'favicon.svg'))).toBe(false);
  });
});
