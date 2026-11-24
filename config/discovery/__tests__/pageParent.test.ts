import { describe, expect, it } from 'vitest';

import { assertParentChains, validatePageParent } from '../RouteDiscovery.js';
import { extractMeta } from '../../utils/MetaExtractor.js';

const FILE = 'src/pages/ProductPage.tsx';
const ROUTES = [
  { path: '/', file: 'src/pages/HomePage.tsx', meta: {} },
  { path: '/catalogue', file: 'src/pages/CataloguePage.tsx', meta: {} },
  { path: '/routines', file: 'src/pages/RoutinesPage.tsx', meta: {} },
];
const page = (parent: unknown, path = '/produits/:slug') => ({ path, file: FILE, meta: { parent } });
const validate = (parent: unknown, path?: string) => {
  const route = page(parent, path);
  validatePageParent(route, [...ROUTES, route]);
};

describe('PageMeta parent', () => {
  it('reaches the route meta through extractMeta (read statically, like route)', () => {
    const meta = extractMeta(
      "export const meta: PageMeta = {\n  route: '/produits/:slug',\n  parent: '/catalogue',\n};"
    );
    expect(meta).toMatchObject({ route: '/produits/:slug', parent: '/catalogue' });
  });

  it('accepts an existing static page, home, and pages without the field', () => {
    expect(() => validate('/catalogue')).not.toThrow();
    expect(() => validate('/')).not.toThrow();
    expect(() => validatePageParent({ path: '/x', file: FILE, meta: {} }, ROUTES)).not.toThrow();
  });

  it('fails the build on a value that is no static app path', () => {
    for (const bad of ['catalogue', '//evil.example', 'https://x.example', '/p/:id', '/docs/*', '/a?x', '/a#b', 42]) {
      expect(() => validate(bad)).toThrow(
        /^\[dndev-routes\] src\/pages\/ProductPage\.tsx: PageMeta parent .* must be the static path of one of the app's pages/
      );
    }
  });

  // REGRESSION (BUGS #35): /produits is no page (live 404)
  it('fails the build on a path no page has, naming existing ones', () => {
    expect(() => validate('/produits')).toThrow(
      /PageMeta parent "\/produits" is not the path of a page of the app\. .*\/catalogue/
    );
  });

  it('fails the build on the page itself, and on a parent never read (the URL prefix is a page)', () => {
    expect(() => validate('/catalogue', '/catalogue')).toThrow(/is the page itself/);
    expect(() => validate('/catalogue', '/routines/:id')).toThrow(
      /is never used: the URL prefix \/routines is a page, so it is the parent/
    );
  });

  it('fails the build on a loop of parents', () => {
    const routes = [
      { path: '/a', file: 'src/pages/APage.tsx', meta: { parent: '/b' } },
      { path: '/b', file: 'src/pages/BPage.tsx', meta: { parent: '/a' } },
    ];
    for (const route of routes) expect(() => validatePageParent(route, routes)).not.toThrow();
    expect(() => assertParentChains(routes)).toThrow(
      /^\[dndev-routes\] src\/pages\/APage\.tsx: PageMeta parent loop: \/a → \/b → \/a/
    );
    expect(() => assertParentChains([...ROUTES, page('/catalogue')])).not.toThrow();
  });
});
