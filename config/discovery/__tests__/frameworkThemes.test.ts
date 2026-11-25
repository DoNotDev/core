import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ThemeDiscovery } from '../ThemeDiscovery.js';

/**
 * The framework dark theme (components styles/themes.css `.dark`) is offered only to an
 * app whose CSS declares no theme: an app that declares themes owns its theme list.
 */

const here = dirname(fileURLToPath(import.meta.url));
/** Real framework token CSS entry (relative @imports inlined by the discovery). */
const FRAMEWORK_STYLES = resolve(here, '../../../../components/src/styles/index.css');

function discovery(appCss: Record<string, string>) {
  const pathResolver = {
    read: async (path: string) => appCss[path],
    readSync: (path: string) => readFileSync(path, 'utf8'),
    normalizePath: (path: string) => path,
    getRelativePath: (path: string) => path,
    getBasename: (path: string) => basename(path),
    getDirname: (path: string) => dirname(path),
    resolvePath: (rel: string, dir: string) => resolve(dir, rel),
    resolvePackage: () => FRAMEWORK_STYLES,
    resolveFrameworkPackage: () => '/framework/ui',
  };
  return new ThemeDiscovery(null, pathResolver);
}

async function themeNames(appCss: Record<string, string>) {
  const result = await discovery(appCss)._processFiles({
    frameworkFiles: [],
    consumerFiles: Object.keys(appCss),
  });
  return result.themes.map((theme: { name: string; isDark: boolean }) => [theme.name, theme.isDark]);
}

describe('theme discovery: framework dark theme', () => {
  it('offers light + the framework dark to an app that declares no theme', async () => {
    expect(await themeNames({ 'src/globals.css': ':root { --primary: #123456; }' })).toEqual([
      ['light', false],
      ['dark', true],
    ]);
  });

  it('keeps the theme list of an app that declares its own themes', async () => {
    const appCss = {
      'src/themes.css': ".luxury { --theme-label: 'Luxury'; --theme-icon: 'Gem'; --theme-is-dark: 0; }",
    };
    expect(await themeNames(appCss)).toEqual([
      ['light', false],
      ['luxury', false],
    ]);
  });

  it("an app's own dark theme replaces the framework one", async () => {
    const appCss = {
      'src/themes.css': ":root.dark { --theme-label: 'Night'; --theme-icon: 'Moon'; --theme-is-dark: 1; }",
    };
    const result = await discovery(appCss)._processFiles({
      frameworkFiles: [],
      consumerFiles: Object.keys(appCss),
    });
    const dark = result.themes.filter((theme: { name: string }) => theme.name === 'dark');
    expect(dark).toHaveLength(1);
    expect(dark[0].displayName).toBe('Night');
  });
});
