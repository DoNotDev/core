import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { NextRouteHandler } from '../handlers/RouteHandler.js';
import { SEOHandler } from '../handlers/SEOHandler.js';

/** Route manifest the generated route config sets on `_DNDEV_CONFIG_.routes`. */
function manifestOf(handler: NextRouteHandler, routes: unknown[] = []) {
  const code: string = handler.generateConfigContent({ routes, source: 'auto' });
  const json = code.match(/const routeManifest = (\{[\s\S]*?\n\});/)?.[1];
  if (!json) throw new Error('route manifest not found in the generated config');
  return JSON.parse(json) as Record<string, unknown>;
}

describe('RouteHandler route manifest', () => {
  let appRoot: string;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-route-manifest-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });

  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  it("carries the app's next.config trailingSlash to the runtime SEO head", () => {
    expect(manifestOf(new NextRouteHandler({ trailingSlash: true })).trailingSlash).toBe(true);
    expect(manifestOf(new NextRouteHandler({ trailingSlash: false })).trailingSlash).toBe(false);
  });

  it('is false when the app does not set it', () => {
    expect(manifestOf(new NextRouteHandler({})).trailingSlash).toBe(false);
  });

  it('lists the routes whose page sets its identity on the server (AutoMetaTags emits none there)', () => {
    const handler = Object.assign(new NextRouteHandler({ siteName: 'Shop' }), {
      appDependsOn: (name: string) => ['@donotdev/supabase', 'entities'].includes(name),
      isClientComponent: (file: string) => file !== 'src/pages/search/SearchPage.tsx',
    });
    handler.useLanguages({ languages: ['fr'], defaultLanguage: 'fr' });
    const routes = [
      { path: '/', file: 'src/pages/HomePage.tsx', meta: {} },
      { path: '/produits/:slug', file: 'src/pages/products/ProductPage.tsx', meta: { entity: 'products' } },
      { path: '/brouillons/:slug', file: 'src/pages/drafts/DraftPage.tsx', meta: { entity: 'drafts', seo: { noindex: true } } },
      { path: '/blog/:slug', file: 'src/pages/blog/BlogPostPage.tsx', meta: {}, metaExport: { namespace: 'blog' } },
      { path: '/recherche/:q', file: 'src/pages/search/SearchPage.tsx', meta: {}, exportsGenerateMetadata: true },
      { path: '/docs/*', file: 'src/pages/DocsPage.tsx', meta: {} },
    ];
    expect(manifestOf(handler, routes).serverMetadataPaths).toEqual([
      '/produits/:slug',
      '/blog/:slug',
      '/recherche/:q',
    ]);
    expect(manifestOf(new NextRouteHandler({ generateAppPages: false }), routes).serverMetadataPaths).toEqual([]);
  });

  it("fails the build on a 'use client' page exporting generateMetadata", () => {
    const handler = Object.assign(new NextRouteHandler({}), { isClientComponent: () => true });
    expect(() =>
      manifestOf(handler, [
        { path: '/recherche/:q', file: 'src/pages/SearchPage.tsx', meta: {}, exportsGenerateMetadata: true },
      ])
    ).toThrow(/exports `generateMetadata` but is a client module/);
  });

  it("lets route discovery count a page's generateMetadata (Next only), from both handlers that discover routes", () => {
    expect(new NextRouteHandler({}).discovery.options.pageGenerateMetadata).toBe(true);
    expect(new SEOHandler({}).discovery.options.pageGenerateMetadata).toBe(true);
  });
});
