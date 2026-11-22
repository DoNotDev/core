/**
 * Vite emitter of the font plan: preloads + inline @font-face in index.html, files in
 * public/fonts/, per-language preloads in prerendered pages.
 * @vitest-environment node
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createFontPlanStore, createViteFontPlugin, localizeFontPreloads } from '../plugins/FontPlugin.js';
import { createI18nStore } from '../plugins/I18nPlugin.js';

let appRoot: string;

beforeEach(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'dndev-vite-fonts-'));
  writeFileSync(join(appRoot, 'package.json'), '{"name":"fixture-app"}');
  mkdirSync(join(appRoot, 'src'), { recursive: true });
  PathResolver.getInstance().setAppRoot(appRoot);
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

async function plugin(themesCss: string, languages = ['en'], base = '/') {
  writeFileSync(join(appRoot, 'src', 'themes.css'), themesCss);
  const i18nStore = createI18nStore();
  i18nStore.set({ supportedLanguages: languages, fallbackLanguage: languages[0] });
  const fontPlan = createFontPlanStore();
  const font = createViteFontPlugin({ appConfig: {}, i18nStore, fontPlan });
  (font.configResolved as (config: object) => void)({ command: 'build', root: appRoot, base });
  await (font.buildStart as () => Promise<void>)();
  const tags = (font.transformIndexHtml as { order: string; handler: () => Array<Record<string, unknown>> });
  return { tags, fontPlan };
}

describe('Vite font plugin', () => {
  it('injects the default language preloads, then one inline style, before Vite adds the stylesheet', async () => {
    const { tags, fontPlan } = await plugin('');
    expect(tags.order).toBe('pre');
    const result = tags.handler();
    expect(result.map(({ tag }) => tag)).toEqual(['link', 'link', 'style']);
    expect(result[0]).toEqual({
      tag: 'link',
      attrs: {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: fontPlan.get().preloads.en[0],
        crossorigin: 'anonymous',
      },
      injectTo: 'head',
    });
    expect(result[2]).toMatchObject({ attrs: { id: 'dndev-fonts' }, injectTo: 'head' });
    expect(result[2].children).toContain('font-display:optional');
    // Files under public/fonts/, the names the plan's URLs use
    const written = readdirSync(join(appRoot, 'public', 'fonts'));
    for (const href of fontPlan.get().preloads.en) {
      expect(written).toContain(href.split('/').pop());
    }
  });

  it('prefixes the Vite base', async () => {
    const { fontPlan } = await plugin('', ['en'], '/sub/');
    expect(fontPlan.get().preloads.en[0]).toMatch(/^\/sub\/fonts\//);
    expect(existsSync(join(appRoot, 'public', 'fonts'))).toBe(true);
  });

  it('a system-only theme injects nothing', async () => {
    const { tags } = await plugin(':root { --font-family: system-ui, sans-serif; --font-headline: var(--font-family); }');
    expect(tags.handler()).toEqual([]);
  });

  it('fails the build when the theme cannot ship (fail loud)', async () => {
    await expect(plugin(":root { --font-family: Unknownia, 'Unknownia Fallback', sans-serif; }")).rejects.toThrow(
      "names 'Unknownia', which nothing provides"
    );
  });

  it('requires the i18n and font plan stores', () => {
    expect(() => createViteFontPlugin({ appConfig: {} } as never)).toThrow('options.i18nStore and options.fontPlan are required');
  });
});

describe('localizeFontPreloads', () => {
  const shell = [
    '<head>',
    '    <link rel="preload" as="font" type="font/woff2" href="/fonts/a.1.woff2" crossorigin="anonymous">',
    '    <style id="dndev-fonts">@font-face{}</style>',
    '    <link rel="stylesheet" href="/assets/index.css">',
    '</head>',
  ].join('\n');

  it("swaps the shell's preloads for the page language's, in place", () => {
    const html = localizeFontPreloads(shell, ['/fonts/a.1.woff2', '/fonts/a-ext.2.woff2']);
    expect(html).toBe(
      [
        '<head>',
        '    <link rel="preload" as="font" type="font/woff2" href="/fonts/a.1.woff2" crossorigin="anonymous">',
        '    <link rel="preload" as="font" type="font/woff2" href="/fonts/a-ext.2.woff2" crossorigin="anonymous">',
        '    <style id="dndev-fonts">@font-face{}</style>',
        '    <link rel="stylesheet" href="/assets/index.css">',
        '</head>',
      ].join('\n')
    );
    expect(html.indexOf('as="font"')).toBeLessThan(html.indexOf('rel="stylesheet"'));
  });

  it('same preloads: same HTML; no preload for the language: none', () => {
    expect(localizeFontPreloads(shell, ['/fonts/a.1.woff2'])).toBe(shell);
    expect(localizeFontPreloads(shell, [])).not.toContain('as="font"');
  });

  it('inserts before the font style when the shell has no preload', () => {
    const noPreload = shell.replace(/ {4}<link rel="preload"[^\n]*\n/, '');
    const html = localizeFontPreloads(noPreload, ['/fonts/b.3.woff2']);
    expect(html.indexOf('/fonts/b.3.woff2')).toBeLessThan(html.indexOf('<style id="dndev-fonts"'));
  });

  it('fails when the shell lost the font tags', () => {
    expect(() => localizeFontPreloads('<head></head>', ['/fonts/a.woff2'])).toThrow('the SPA shell has no font tags');
  });
});
