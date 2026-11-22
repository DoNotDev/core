/**
 * Vite build writes the favicon tags into index.html (and so every prerendered page).
 * @vitest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createViteFaviconPlugin } from '../plugins/FaviconPlugin.js';

let appRoot: string | undefined;

/** An app whose public/ holds `files`. */
function appWith(files: string[]) {
  appRoot = mkdtempSync(join(tmpdir(), 'dndev-vite-favicon-'));
  mkdirSync(join(appRoot, 'public'), { recursive: true });
  for (const file of files) writeFileSync(join(appRoot, 'public', file), '');
  PathResolver.getInstance().setAppRoot(appRoot);
}

describe('createViteFaviconPlugin', () => {
  afterEach(() => {
    if (appRoot) rmSync(appRoot, { recursive: true });
    appRoot = undefined;
  });

  it('injects one favicon set into <head>, from public/ and appConfig.favicon', () => {
    appWith(['logo.svg', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192x192.png']);
    const plugin = createViteFaviconPlugin({
      appConfig: { app: { name: 'Shop' }, favicon: { themeColor: '#000000' } },
    });
    const tags = plugin.transformIndexHtml();
    expect(tags.every((t: { injectTo: string }) => t.injectTo === 'head')).toBe(true);
    expect(tags.map((t: { tag: string; attrs: object }) => [t.tag, t.attrs])).toEqual([
      ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
      ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
      ['meta', { name: 'apple-mobile-web-app-title', content: 'Shop' }],
      ['link', { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192x192.png' }],
      ['meta', { name: 'theme-color', content: '#000000' }],
      ['meta', { name: 'color-scheme', content: 'light dark' }],
    ]);
  });

  it('injects nothing with appConfig.favicon: false', () => {
    appWith(['favicon.svg']);
    const plugin = createViteFaviconPlugin({ appConfig: { favicon: false } });
    expect(plugin.transformIndexHtml()).toEqual([]);
  });
});
