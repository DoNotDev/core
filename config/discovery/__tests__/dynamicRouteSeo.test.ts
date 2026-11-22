import { describe, expect, it } from 'vitest';

import { assertDynamicRouteSeo } from '../RouteDiscovery.js';

const route = (overrides: Record<string, unknown> = {}) => ({
  path: '/produits/:slug',
  file: 'src/pages/products/ProductPage.tsx',
  auth: false,
  meta: {},
  metaExport: {},
  exportsGenerateMetadata: false,
  ...overrides,
});

const NEXT = { pageGenerateMetadata: true };

describe('public indexable :param route without per-URL SEO (assertDynamicRouteSeo)', () => {
  it('fails the build on Next with the three ways out', () => {
    expect(() => assertDynamicRouteSeo(route(), NEXT)).toThrow(
      "[dndev-routes] src/pages/products/ProductPage.tsx: public dynamic route /produits/:slug has no per-URL SEO: " +
        'every URL would get the same title and description (PageMeta + i18n), duplicate pages for search engines. Fix, one of:\n' +
        "  1. declare the record entity it shows: import { productEntity } from 'entities'; then entity: productEntity in its PageMeta (title, description and image from the record)\n" +
        "  2. export Next's generateMetadata from the page module (a server module, no 'use client')\n" +
        '  3. keep it out of search engines: seo: { noindex: true } in its PageMeta'
    );
  });

  it('fails the build on Vite with entity or noindex only (no server: generateMetadata does not count)', () => {
    let message = '';
    try {
      assertDynamicRouteSeo(route({ exportsGenerateMetadata: true }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/1\. declare the record entity it shows/);
    expect(message).toMatch(/2\. keep it out of search engines: seo: \{ noindex: true \}/);
    expect(message).not.toMatch(/generateMetadata/);
  });

  it('passes with an entity, a Next generateMetadata or noindex', () => {
    expect(() => assertDynamicRouteSeo(route({ meta: { entity: 'products' } }))).not.toThrow();
    expect(() => assertDynamicRouteSeo(route({ exportsGenerateMetadata: true }), NEXT)).not.toThrow();
    for (const platform of [NEXT, {}]) {
      expect(() =>
        assertDynamicRouteSeo(route({ meta: { seo: { noindex: true } } }), platform)
      ).not.toThrow();
    }
  });

  it('exempts static, auth-only, error, catch-all and blog post routes', () => {
    for (const exempt of [
      route({ path: '/produits' }),
      route({ auth: true }),
      route({ auth: { required: true, role: 'admin' } }),
      route({ path: '/404' }),
      route({ path: '/not-found' }),
      route({ path: '*' }),
      route({ path: '/docs/*' }),
      route({ path: '/docs/:section/*' }),
      route({ path: '/blog/:slug', metaExport: { namespace: 'blog' } }),
    ]) {
      expect(() => assertDynamicRouteSeo(exempt, NEXT)).not.toThrow();
      expect(() => assertDynamicRouteSeo(exempt)).not.toThrow();
    }
  });
});
