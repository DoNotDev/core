import { describe, expect, it } from 'vitest';

import {
  FAVICON_DEFAULTS,
  faviconHeadTags,
  resolveFaviconFiles,
} from '../headTags';

/** The files the build generates from public/logo.svg (AssetDiscovery). */
const GENERATED = new Set([
  '/logo.svg',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
]);
const generated = (path: string) => GENERATED.has(path);

describe('resolveFaviconFiles (FaviconHead on Next, the Vite build)', () => {
  it('uses each slot file the site serves', () => {
    expect(resolveFaviconFiles(generated)).toEqual({
      svg: '/favicon.svg',
      ico: '/favicon.ico',
      png16: undefined,
      png32: undefined,
      apple180: '/apple-touch-icon.png',
      android192: '/icon-192x192.png',
      android512: '/icon-512x512.png',
    });
  });

  // REGRESSION: a missing file was filled with another one (the 512 px icon declared
  // as 16x16 and 32x32, favicon.svg typed image/x-icon)
  it('leaves a slot empty when its file is missing', () => {
    expect(Object.values(resolveFaviconFiles(() => false)).every((v) => v === undefined)).toBe(
      true
    );
  });

  it('keeps the app own sized favicons', () => {
    const own = new Set([...GENERATED, '/favicon-16x16.png', '/favicon-32x32.png']);
    const set = resolveFaviconFiles((path) => own.has(path));
    expect(set.png16).toBe('/favicon-16x16.png');
    expect(set.png32).toBe('/favicon-32x32.png');
  });
});

describe('faviconHeadTags', () => {
  const set = resolveFaviconFiles(generated);
  const config = { ...FAVICON_DEFAULTS, appName: 'Shop' };

  it('writes one favicon set: icons, apple-touch-icon, theme-color, color-scheme', () => {
    expect(faviconHeadTags(set, config)).toEqual([
      { tag: 'link', attributes: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
      { tag: 'link', attributes: { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' } },
      {
        tag: 'link',
        attributes: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      },
      { tag: 'meta', attributes: { name: 'apple-mobile-web-app-title', content: 'Shop' } },
      {
        tag: 'link',
        attributes: { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192x192.png' },
      },
      {
        tag: 'link',
        attributes: { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512x512.png' },
      },
      { tag: 'meta', attributes: { name: 'theme-color', content: '#2563eb' } },
      { tag: 'meta', attributes: { name: 'color-scheme', content: 'light dark' } },
    ]);
  });

  // REGRESSION: FaviconHead also wrote an empty `shortcut icon` (data:,) and the
  // status-bar-style meta AutoMetaTags already writes
  it('writes no empty icon and no status-bar-style meta', () => {
    const tags = faviconHeadTags(set, config);
    expect(tags.some((t) => t.attributes.href === 'data:,')).toBe(false);
    expect(tags.some((t) => t.attributes.rel === 'shortcut icon')).toBe(false);
    expect(
      tags.some((t) => t.attributes.name === 'apple-mobile-web-app-status-bar-style')
    ).toBe(false);
  });

  it('follows the config: manifest icons, Microsoft tiles, app name', () => {
    const withPng32 = { ...set, png32: '/favicon-32x32.png' };
    const hrefs = (c: object, s = set) =>
      faviconHeadTags(s, { ...config, ...c }).map(
        (t) => t.attributes.href ?? t.attributes.name
      );
    expect(hrefs({ includeManifestIcons: false })).not.toContain('/icon-192x192.png');
    expect(hrefs({ includeMSIcons: true })).not.toContain('msapplication-TileImage');
    expect(hrefs({ includeMSIcons: true }, withPng32)).toEqual(
      expect.arrayContaining(['msapplication-TileImage', 'msapplication-TileColor'])
    );
    // REGRESSION: pointed at /browserconfig.xml, which nothing generates
    expect(hrefs({ includeMSIcons: true }, withPng32)).not.toContain('msapplication-config');
    // REGRESSION: `enabled: false` was ignored (only `favicon: false` disabled)
    expect(faviconHeadTags(set, { ...config, enabled: false })).toEqual([]);
    expect(hrefs({ appName: undefined })).not.toContain('apple-mobile-web-app-title');
  });
});
