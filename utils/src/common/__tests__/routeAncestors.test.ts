// packages/core/utils/src/common/__tests__/routeAncestors.test.ts

import { describe, expect, it } from 'vitest';

import { getPathPrefixes, routeAncestors } from '../routeAncestors';

type Route = { path: string; meta?: { parent?: string } };

const paths = (pathname: string, routes: Route[]) =>
  routeAncestors(pathname, routes).map((route) => route.path);

describe('getPathPrefixes', () => {
  it('lists cumulative prefixes', () => {
    expect(getPathPrefixes('/a/b/c')).toEqual(['/a', '/a/b', '/a/b/c']);
    expect(getPathPrefixes('/')).toEqual([]);
  });
});

describe('routeAncestors', () => {
  const routes: Route[] = [
    { path: '/' },
    { path: '/routines' },
    { path: '/routines/:id' },
    { path: '/fournisseur' },
    { path: '/catalogue' },
    { path: '/produits/:slug', meta: { parent: '/catalogue' } },
  ];

  it('URL prefixes that are routes, top first; home excluded', () => {
    expect(paths('/routines/abc', routes)).toEqual(['/routines']);
    expect(paths('/routines', routes)).toEqual([]);
    expect(paths('/', routes)).toEqual([]);
  });

  it('drops URL prefixes that are no route (param values are never routes)', () => {
    expect(paths('/fournisseur/abc/reception', routes)).toEqual(['/fournisseur']);
    // /routines/abc matches /routines/:id, but a prefix is a route only by its static path
    expect(paths('/routines/abc/edit', routes)).toEqual(['/routines']);
    expect(paths('/unknown/x', routes)).toEqual([]);
  });

  // REGRESSION (BUGS #35): /produits is no page; the product page's parent is the catalogue
  it('takes the declared PageMeta parent when the URL prefix is no route', () => {
    expect(paths('/produits/serum', routes)).toEqual(['/catalogue']);
  });

  it("recurses through the parent's own chain (its URL prefixes and its parent)", () => {
    const tree: Route[] = [
      { path: '/boutique' },
      { path: '/boutique/catalogue' },
      { path: '/marques', meta: { parent: '/boutique/catalogue' } },
      { path: '/marques/:brand/produits/:slug', meta: { parent: '/marques' } },
    ];
    expect(paths('/marques/cosrx/produits/serum', tree)).toEqual([
      '/boutique',
      '/boutique/catalogue',
      '/marques',
    ]);
  });

  it('the direct URL prefix route wins over a declared parent', () => {
    const tree: Route[] = [
      { path: '/a' },
      { path: '/x' },
      { path: '/a/:id', meta: { parent: '/x' } },
    ];
    expect(paths('/a/1', tree)).toEqual(['/a']);
  });

  it("a declared parent wins over a shorter URL prefix; '/' means home (no ancestor)", () => {
    const tree: Route[] = [
      { path: '/a' },
      { path: '/x' },
      { path: '/a/b/:id', meta: { parent: '/x' } },
      { path: '/a/c/:id', meta: { parent: '/' } },
    ];
    expect(paths('/a/b/1', tree)).toEqual(['/x']);
    expect(paths('/a/c/1', tree)).toEqual([]);
  });

  it('ignores trailing slashes', () => {
    expect(paths('/routines/abc/', [{ path: '/routines/' }, { path: '/routines/:id' }])).toEqual([
      '/routines/',
    ]);
  });

  it('throws on a parent that is no static route, and on a loop (the build rejects both)', () => {
    expect(() =>
      routeAncestors('/p/1', [{ path: '/p/:id', meta: { parent: '/nowhere' } }])
    ).toThrow(/PageMeta parent "\/nowhere" is not a static route path/);
    expect(() =>
      routeAncestors('/a', [
        { path: '/a', meta: { parent: '/b' } },
        { path: '/b', meta: { parent: '/a' } },
      ])
    ).toThrow(/PageMeta parent loop: \/a → \/b → \/a/);
  });
});
