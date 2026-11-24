// packages/core/utils/src/common/__tests__/breadcrumbJsonLd.test.ts

import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  breadcrumbNamespaces,
  buildBreadcrumbJsonLd,
  routeLabel,
} from '../headTags';

/** Translations `ns:key` → text; missing → defaultValue (the i18next contract). */
const TEXTS: Record<string, string> = {
  'catalogue:title': 'Catalogue',
  'product:title': 'Produit',
  'routines:title': 'Routines',
};
const t = ((key: string, options?: { defaultValue?: string }) =>
  TEXTS[key] ?? options?.defaultValue ?? key) as unknown as TFunction;

const BASE = 'https://shop.example';
const pageUrl = (path: string) => `${BASE}${path === '/' ? '' : path}`;

const ROUTES = [
  { path: '/', meta: { namespace: 'home' } },
  { path: '/catalogue', meta: { namespace: 'catalogue' } },
  { path: '/produits/:slug', meta: { namespace: 'product', parent: '/catalogue' } },
  { path: '/routines', meta: { namespace: 'routines' } },
  { path: '/routines/:id', meta: { seo: { title: 'Routine' } } },
  { path: '/aide', meta: { seo: { fullTitle: 'Aide et contact' } } },
];

const items = (pathname: string, lastName?: string) =>
  (
    buildBreadcrumbJsonLd({
      pathname,
      routes: ROUTES,
      siteName: 'Shop',
      t,
      defaultNs: 'home',
      pageUrl,
      lastName,
    }).itemListElement as Array<{ name: string; item: string; position: number }>
  ).map(({ position, name, item }) => [position, name, item]);

describe('routeLabel', () => {
  const site = { t, defaultNs: 'home', siteName: 'Shop' };
  it("is the route's own title by its <title> chain, else its full title, else the site name", () => {
    expect(routeLabel(ROUTES[1]!, site)).toBe('Catalogue'); // namespace title
    expect(routeLabel(ROUTES[4]!, site)).toBe('Routine'); // seo.title
    expect(routeLabel(ROUTES[5]!, site)).toBe('Aide et contact'); // seo.fullTitle
    expect(routeLabel({ path: '/x' }, site)).toBe('Shop');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  // REGRESSION (BUGS #35): the list named /produits ("Produits", a 404) as the parent
  it('home, the declared parent by its title, the record title last', () => {
    expect(items('/produits/serum', 'Bakuchiol Serum')).toEqual([
      [1, 'Shop', BASE],
      [2, 'Catalogue', `${BASE}/catalogue`],
      [3, 'Bakuchiol Serum', `${BASE}/produits/serum`],
    ]);
  });

  it("names the page by its route's title without a record title; no title-cased slug", () => {
    expect(items('/produits/serum')).toEqual([
      [1, 'Shop', BASE],
      [2, 'Catalogue', `${BASE}/catalogue`],
      [3, 'Produit', `${BASE}/produits/serum`],
    ]);
    expect(items('/routines/abc')).toEqual([
      [1, 'Shop', BASE],
      [2, 'Routines', `${BASE}/routines`],
      [3, 'Routine', `${BASE}/routines/abc`],
    ]);
  });

  it('drops URL prefixes that are no route', () => {
    expect(items('/routines/abc/x/y')).toEqual([
      [1, 'Shop', BASE],
      [2, 'Routines', `${BASE}/routines`],
    ]);
  });
});

describe('breadcrumbNamespaces', () => {
  it("lists the trail's namespaces (ancestors, then the page), once each", () => {
    expect(breadcrumbNamespaces('/produits/serum', ROUTES)).toEqual(['catalogue', 'product']);
    expect(breadcrumbNamespaces('/routines/abc', ROUTES)).toEqual(['routines']);
  });
});
