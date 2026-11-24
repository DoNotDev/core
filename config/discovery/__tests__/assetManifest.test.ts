import { describe, expect, it } from 'vitest';

import { AssetDiscovery } from '../AssetDiscovery.js';
import { PathResolver } from '../../utils/PathResolver.js';

const asset = (path: string) => ({ path });

describe('asset manifest: web app manifest', () => {
  const discovery = new AssetDiscovery(PathResolver.getInstance());

  // REGRESSION: the first path containing `manifest.json` won (/asset-manifest.json, /i18n-manifest.json)
  it('is exactly /manifest.json, never another *-manifest.json discovery output', () => {
    const manifest = discovery._buildAssetManifest(
      ['/asset-manifest.json', '/i18n-manifest.json', '/manifest.json', '/route-manifest.json'].map(asset),
      { webAppManifest: true }
    );
    expect(manifest.manifest).toBe('/manifest.json');
  });

  it('is null when the app has no web app manifest', () => {
    expect(
      discovery._buildAssetManifest(['/i18n-manifest.json'].map(asset), { webAppManifest: false }).manifest
    ).toBeNull();
  });
});

describe('asset patterns', () => {
  const discovery = new AssetDiscovery(PathResolver.getInstance());

  // REGRESSION: `manifest.json` matched as a substring, so a rebuild listed the framework's
  // own asset-manifest.json, pwa-manifest.json, seo-manifest.json
  it('match exact file names, `*` for any characters', () => {
    expect(discovery._matchesPattern('manifest.json', 'manifest.json')).toBe(true);
    for (const output of ['asset-manifest.json', 'i18n-manifest.json', 'pwa-manifest.json', 'seo-manifest.json']) {
      expect(discovery._matchesPattern(output, 'manifest.json')).toBe(false);
    }
    expect(discovery._matchesPattern('favicon-32x32.png', 'favicon-*.png')).toBe(true);
    expect(discovery._matchesPattern('Logo.SVG', 'logo.svg')).toBe(true);
    expect(discovery._matchesPattern('my-logo.svg', 'logo.svg')).toBe(false);
    expect(discovery._matchesPattern('icon-192x192.png', 'icon-*x*.png')).toBe(true);
    expect(discovery._analyzeAsset('og-image.png', 10)).toMatchObject({ path: '/og-image.png' });
    expect(discovery._analyzeAsset('manifest.json', 10)).toBeNull();
  });
});

describe('asset manifest: logo', () => {
  const logo = (paths: string[]) =>
    new AssetDiscovery(PathResolver.getInstance())._buildAssetManifest(paths.map(asset), {
      webAppManifest: false,
    }).logo;

  // REGRESSION: on Next a stale /logo.png was the optimal logo, never /logo.svg
  it('is /logo.svg whenever it exists, the raster logo its fallback', () => {
    expect(logo(['/logo.png', '/logo.svg', '/logo.webp'])).toEqual({
      optimal: '/logo.svg',
      fallback: '/logo.png',
    });
  });

  it('is the raster logo without logo.svg', () => {
    expect(logo(['/logo.png'])).toEqual({ optimal: '/logo.png', fallback: '/logo.png' });
  });

  it('has no raster fallback with logo.svg alone', () => {
    expect(logo(['/logo.svg', '/favicon.svg'])).toEqual({ optimal: '/logo.svg', fallback: null });
  });
});

describe('asset manifest: asset list', () => {
  // REGRESSION: the list was split into modernFormats / fallbackFormats by an `isModern`
  // flag (file names on Vite, raster formats on Next): one list of every scanned path now
  it('lists every scanned asset path once, in scan order', () => {
    const paths = ['/favicon.ico', '/favicon.svg', '/icon-192x192.png', '/logo.svg', '/og-image.png'];
    const manifest = new AssetDiscovery(PathResolver.getInstance())._buildAssetManifest(paths.map(asset), {
      webAppManifest: false,
    });
    expect(manifest.assets).toEqual(paths);
    expect(manifest).not.toHaveProperty('modernFormats');
    expect(manifest).not.toHaveProperty('fallbackFormats');
  });

  it('is empty in the empty manifest', () => {
    expect(new AssetDiscovery(PathResolver.getInstance()).getManifest().assets).toEqual([]);
  });
});
