import { describe, expect, it } from 'vitest';

import { matchRoute } from '../routeMatch';

const routes = [
  { path: '/' },
  { path: '/docs/*' },
  { path: '/docs/api/*' },
  { path: '/docs/:section' },
  { path: '/docs/guide' },
  { path: '/shop/:id/*' },
  { path: '/produits/:slug' },
  { path: '/produits/nouveau' },
  { path: '/blog/:slug/:x' },
  { path: '/blog/:slug/comments' },
];

const pathOf = (pathname: string) => matchRoute(routes, pathname)?.route.path;

describe('matchRoute (one matcher: AutoMetaTags and crud useCrudDoc)', () => {
  it('exact path first, trailing slash ignored', () => {
    expect(pathOf('/')).toBe('/');
    expect(pathOf('/docs/guide')).toBe('/docs/guide');
    expect(pathOf('/produits/nouveau/')).toBe('/produits/nouveau');
    expect(matchRoute(routes, '/docs/guide')?.params).toEqual({});
  });

  it('then the most specific `:param` pattern, with decoded params', () => {
    expect(pathOf('/docs/intro')).toBe('/docs/:section');
    expect(pathOf('/blog/a/comments')).toBe('/blog/:slug/comments');
    expect(matchRoute(routes, '/produits/s%C3%A9rum')).toEqual({
      route: { path: '/produits/:slug' },
      params: { slug: 'sérum' },
    });
    // A malformed escape stays as written
    expect(matchRoute(routes, '/produits/%E0')?.params).toEqual({ slug: '%E0' });
  });

  it('then catch-alls: longest prefix, then the most static one', () => {
    expect(pathOf('/docs/a/b')).toBe('/docs/*');
    expect(pathOf('/docs/api/users/1')).toBe('/docs/api/*');
    expect(matchRoute(routes, '/shop/42/reviews/1')).toEqual({
      route: { path: '/shop/:id/*' },
      params: { id: '42' },
    });
  });

  it('null outside every route', () => {
    expect(matchRoute(routes, '/other/a')).toBeNull();
    expect(matchRoute([], '/')).toBeNull();
  });
});
