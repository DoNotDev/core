import { describe, expect, it } from 'vitest';

import { AssetDiscovery } from '../AssetDiscovery.js';
import { PathResolver } from '../../utils/PathResolver.js';

const asset = (path: string) => ({ path, isModern: false });

describe('asset manifest: web app manifest', () => {
  const discovery = new AssetDiscovery(PathResolver.getInstance(), { modernFormats: ['svg'] });

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
