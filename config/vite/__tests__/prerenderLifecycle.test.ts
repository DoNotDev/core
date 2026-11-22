import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createRouteManifestStore } from '../../utils/routeParser.js';
import { createI18nStore } from '../plugins/I18nPlugin.js';
import { createVitePrerenderPlugin } from '../plugins/PrerenderPlugin.js';

const SHELL = '<!DOCTYPE html><html><head><title>App</title></head><body><script type="module" src="/main.js"></script></body></html>';

/**
 * A real Vite build (Rollup lifecycle: Vite calls `bundle.close()`, hence closeBundle, in a
 * `finally`, also after a failed build), not the hooks called one by one.
 */
describe('prerender plugin in a real Vite build', () => {
  let workspace: string;
  let appRoot: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'dndev-prerender-build-'));
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
    appRoot = join(workspace, 'apps', 'shop');
    mkdirSync(appRoot, { recursive: true });
    writeFileSync(join(appRoot, 'package.json'), JSON.stringify({ name: 'shop' }));
    writeFileSync(join(appRoot, 'index.html'), SHELL);
    writeFileSync(join(appRoot, 'main.js'), 'console.log("app");\n');
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
    PathResolver._reset();
  });

  const viteBuild = (plugins: unknown[]) => {
    const routeManifest = createRouteManifestStore();
    routeManifest.set({ routes: [{ path: '/' }], source: 'test', blogPosts: [] });
    return build({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      plugins: [
        createVitePrerenderPlugin({
          routes: [],
          seo: { disabled: true },
          routeManifest,
          i18nStore: createI18nStore(),
        }),
        ...(plugins as never[]),
      ],
    });
  };

  // REGRESSION: the prerender threw "the build output has no index.html" from Vite's
  // cleanup, replacing the build's own error (e.g. a localhost VITE_APP_URL)
  it('a failed build reports its own error', async () => {
    const failing = {
      name: 'fails',
      generateBundle() {
        throw new Error('the real build error');
      },
    };
    await expect(viteBuild([failing])).rejects.toThrow('the real build error');
    expect(existsSync(join(appRoot, 'dist', '_shell.html'))).toBe(false);
  });

  it('a written build gets its SPA shell fallback (dist/_shell.html)', async () => {
    await viteBuild([]);
    const shell = readFileSync(join(appRoot, 'dist', '_shell.html'), 'utf8');
    expect(shell).toBe(readFileSync(join(appRoot, 'dist', 'index.html'), 'utf8'));
  });
});
