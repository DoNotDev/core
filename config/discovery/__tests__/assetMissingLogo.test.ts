// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssetDiscovery, MISSING_LOGO_WARNING } from '../AssetDiscovery.js';
import { PathResolver } from '../../utils/PathResolver.js';

describe('asset discovery without public/logo.svg', () => {
  const resolver = PathResolver.getInstance();
  const previousRoot = resolver.getAppRoot();
  const roots: string[] = [];
  afterEach(() => {
    resolver.setAppRoot(previousRoot);
    for (const root of roots.splice(0))
      rmSync(root, { recursive: true, force: true });
  });

  it('warns exactly once and completes the discovery (a warning, never a failure)', async () => {
    const appRoot = mkdtempSync(join(tmpdir(), 'dndev-no-logo-'));
    roots.push(appRoot);
    mkdirSync(join(appRoot, 'public'));
    resolver.setAppRoot(appRoot);
    const discovery = new AssetDiscovery(resolver);
    const warn = vi
      .spyOn(discovery.logger, 'warn')
      .mockImplementation(() => {});
    const error = vi
      .spyOn(discovery.logger, 'error')
      .mockImplementation(() => {});

    const result = await discovery.discover(true);

    expect(warn.mock.calls).toEqual([[MISSING_LOGO_WARNING]]);
    expect(error).not.toHaveBeenCalled();
    expect(MISSING_LOGO_WARNING).toBe(
      'public/logo.svg is missing: it is the site logo (Organization / publisher logo in the JSON-LD, the default logo) and the source of the favicon, PWA icons and og-image.png. Add public/logo.svg.'
    );
    // The discovery result is complete, without the logo and the icons generated from it
    expect(result.manifest.logo).toEqual({ optimal: null, fallback: null });
    expect(result.manifest.logoSvgContent).toBeNull();
    expect(result.generatedAssets).toEqual([]);
    expect(existsSync(join(appRoot, 'public', 'favicon.svg'))).toBe(false);
  });
});
