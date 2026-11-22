import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RouteDiscovery } from '../RouteDiscovery.js';
import { extractMeta } from '../../utils/MetaExtractor.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const ENTITIES: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'entities', type: 'module', main: './index.ts' }),
  'index.ts': [
    "export { productEntity } from './product';",
    "export type { Product } from './product';",
    "export * from './more';",
    "export { contactEntity } from './contact';",
  ].join('\n'),
  'product.ts': [
    "import { defineEntity } from '@donotdev/core';",
    'export type Product = { title: string };',
    'export const productEntity = defineEntity({',
    "  name: 'Product',",
    '  // nested objects do not hide the collection',
    "  fields: { title: { type: 'text', validation: { collection: 'nope' } } },",
    "  collection: 'products',",
    '});',
  ].join('\n'),
  'more.ts': [
    "import { defineEntity as define } from '@donotdev/core';",
    'const brandEntity = define({ name: `Brand`, collection: `brands`, fields: {} });',
    'export { brandEntity };',
    "export const plainObject = { collection: 'plain', fields: {} };",
    "export const noCollection = define({ name: 'N', fields: {} });",
  ].join('\n'),
  'contact.ts': [
    "import { createContactEntity } from './factory';",
    "export const contactEntity = createContactEntity({ collection: 'contacts' });",
  ].join('\n'),
};

/** Monorepo with an `entities` workspace package linked in node_modules and one app. */
function workspace(pages: Record<string, string>, appDependencies: Record<string, string> = { entities: 'workspace:*' }) {
  const root = mkdtempSync(join(tmpdir(), 'dndev-page-entity-'));
  roots.push(root);
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  for (const [file, content] of Object.entries(ENTITIES)) write(`entities/${file}`, content);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  symlinkSync(join(root, 'entities'), join(root, 'node_modules/entities'));
  write('apps/shop/package.json', JSON.stringify({ name: 'shop', dependencies: appDependencies }));
  for (const [file, content] of Object.entries(pages)) write(`apps/shop/${file}`, content);
  return join(root, 'apps/shop');
}

/** Routes RouteDiscovery finds in the app's pages (same per-file path as the build). */
async function discover(
  pages: Record<string, string>,
  appDependencies?: Record<string, string>,
  options: Record<string, unknown> = {}
) {
  const appRoot = workspace(pages, appDependencies);
  const pathResolver = {
    getAppRoot: () => appRoot,
    getFileInfo: (absolutePath: string) => ({
      absolutePath,
      relativePath: relative(appRoot, absolutePath),
    }),
    read: async (path: string) => (await import('node:fs')).readFileSync(path, 'utf8'),
  };
  const discovery = new RouteDiscovery(pathResolver, { additionalPatterns: [], ...options });
  await discovery._performAutoDiscovery(
    { consumerFiles: Object.keys(pages).map((file) => join(appRoot, file)) },
    appRoot
  );
  return discovery.routes as Array<{ path: string; file: string; meta: Record<string, unknown>; metaExport: Record<string, unknown> | null }>;
}

const page = (imports: string, meta: string) =>
  `${imports}\nexport const meta: PageMeta = {\n  ${meta}\n};\nexport default function Page() { return null; }\n`;

describe('PageMeta entity', () => {
  it('extractMeta keeps the entity identifier as a reference', () => {
    expect(
      extractMeta(page("import { productEntity } from 'entities';", "namespace: 'product',\n  entity: productEntity,\n  icon: <Box />"))
    ).toEqual({ namespace: 'product', entity: { identifier: 'productEntity' }, icon: 'Box' });
    expect(extractMeta(page('', "entity: 'products'"))).toEqual({ entity: 'products' });
  });

  it('resolves the declared entity to its collection, through re-exports and aliases', async () => {
    const routes = await discover({
      'src/pages/products/ProductPage.tsx': page(
        "import { useCrud } from '@donotdev/crud';\nimport { productEntity } from 'entities';",
        "namespace: 'product',\n  route: '/produits/:slug',\n  entity: productEntity, // the record's entity"
      ),
      'src/pages/BrandPage.tsx': page(
        "import { brandEntity as brand, type Product } from 'entities';",
        "route: { params: ['slug'] },\n  entity: brand"
      ),
    });
    const byFile = Object.fromEntries(routes.map((route) => [route.file, route]));
    expect(byFile['src/pages/products/ProductPage.tsx']!.meta.entity).toBe('products');
    expect(byFile['src/pages/products/ProductPage.tsx']!.metaExport!.entity).toBe('products');
    expect(byFile['src/pages/BrandPage.tsx']!.meta.entity).toBe('brands');
    expect(byFile['src/pages/BrandPage.tsx']!.path).toBe('/brand/:slug');
  });

  it('never infers it from the folder: undeclared pages, root ones included, have none', async () => {
    const routes = await discover({
      'src/pages/products/ProductsListPage.tsx': page('', "namespace: 'products'"),
      'src/pages/products/ProductPage.tsx': page('', "route: '/produits/:slug',\n  seo: { noindex: true }"),
      'src/pages/AboutPage.tsx': page('', "namespace: 'about'"),
      'src/pages/HomePage.tsx': 'export default function HomePage() { return null; }\n',
    });
    expect(routes).toHaveLength(4);
    for (const route of routes) expect(route.meta).not.toHaveProperty('entity');
    // Folders still shape the path
    expect(routes.map((route) => route.path).sort()).toEqual([
      '/',
      '/about',
      '/products/products-list',
      '/produits/:slug',
    ]);
    expect(routes.find((route) => route.file.endsWith('ProductsListPage.tsx'))!.meta.action).toBe('list');
  });

  it('fails the build on a value that is not the entity definition imported from entities', async () => {
    const cases: Array<[string, string, RegExp]> = [
      ['', "entity: 'products'", /PageMeta entity must be the entity definition imported from 'entities' \(got "products"\)/],
      ["import { productEntity } from './entities';", 'entity: productEntity', /PageMeta entity `productEntity` is not imported from 'entities'/],
      ["import type { productEntity } from 'entities';", 'entity: productEntity', /is not imported from 'entities'/],
      ['', 'entity: productEntity', /is not imported from 'entities'/],
      ["import { missingEntity } from 'entities';", 'entity: missingEntity', /`missingEntity` is not exported by the `entities` package/],
      ["import { plainObject } from 'entities';", 'entity: plainObject', /`plainObject` \(.*more\.ts\) is not a defineEntity definition/],
      ["import { contactEntity } from 'entities';", 'entity: contactEntity', /`contactEntity` \(.*contact\.ts\) is not a defineEntity definition/],
      ["import { noCollection } from 'entities';", 'entity: noCollection', /`noCollection` \(.*more\.ts\) has no literal `collection`/],
    ];
    for (const [imports, meta, message] of cases) {
      await expect(
        discover({ 'src/pages/products/ProductPage.tsx': page(imports, `route: '/produits/:slug',\n  ${meta}`) })
      ).rejects.toThrow(message);
    }
  });

  it('extractMeta never evaluates a non-identifier entity: the rest of the meta survives', () => {
    const meta = extractMeta(
      page(
        "import * as entities from 'entities';",
        "namespace: 'product',\n  route: '/produits/:slug',\n  entity: entities.productEntity, // namespace import\n  auth: false"
      )
    );
    expect(meta).toEqual({
      namespace: 'product',
      route: '/produits/:slug',
      entity: { expression: 'entities.productEntity' },
      auth: false,
    });
    expect(extractMeta(page('', "entity: getEntity('products'), namespace: 'x'"))).toEqual({
      entity: { expression: "getEntity('products')" },
      namespace: 'x',
    });
    expect(extractMeta(page('', 'entity: undefined'))).toEqual({ entity: undefined });
  });

  it('fails the build on a namespace import or any other expression, with the named-import fix', async () => {
    const cases: Array<[string, string, RegExp]> = [
      [
        "import * as entities from 'entities';",
        'entity: entities.productEntity',
        /\[dndev-routes\] src\/pages\/products\/ProductPage\.tsx: PageMeta entity `entities\.productEntity` is not a bare identifier\..*Fix: import \{ productEntity \} from 'entities'; then entity: productEntity/s,
      ],
      [
        "import * as entities from 'entities';",
        "entity: entities['productEntity']",
        /`entities\['productEntity'\]` is not a bare identifier.*import \{ productEntity \} from 'entities'/s,
      ],
      ["import { pick } from './pick';", "entity: pick('products')", /`pick\('products'\)` is not a bare identifier/],
      ["import * as entities from 'entities';", 'entity: entities', /PageMeta entity `entities` is not imported from 'entities'/],
    ];
    for (const [imports, meta, message] of cases) {
      await expect(
        discover({ 'src/pages/products/ProductPage.tsx': page(imports, `route: '/produits/:slug',\n  ${meta}`) })
      ).rejects.toThrow(message);
    }
  });

  it('fails discovery on a public :param page without SEO; a page generateMetadata counts on Next only', async () => {
    const pages = {
      'src/pages/search/SearchPage.tsx':
        page('', "route: '/recherche/:q'") + 'export async function generateMetadata() { return {}; }\n',
    };
    await expect(discover(pages)).rejects.toThrow(
      /\[dndev-routes\] src\/pages\/search\/SearchPage\.tsx: public dynamic route \/recherche\/:q has no per-URL SEO/
    );
    const routes = await discover(pages, undefined, { pageGenerateMetadata: true });
    expect(routes[0]!.exportsGenerateMetadata).toBe(true);
  });

  it('fails the whole discovery, not only the page (discover rethrows build errors)', async () => {
    const appRoot = workspace({
      'src/pages/ProductPage.tsx': page('', "entity: 'products'"),
    });
    const file = join(appRoot, 'src/pages/ProductPage.tsx');
    const discovery = new RouteDiscovery(
      {
        getAppRoot: () => appRoot,
        resolvePatterns: async () => ({}),
        resolveFiles: async () => ({ consumerFiles: [file], frameworkFiles: [] }),
        getFileInfo: (absolutePath: string) => ({ absolutePath, relativePath: relative(appRoot, absolutePath) }),
        read: async (path: string) => (await import('node:fs')).readFileSync(path, 'utf8'),
      },
      { additionalPatterns: [] }
    );
    await expect(discovery.discover(true)).rejects.toThrow(/\[dndev-routes\] src\/pages\/ProductPage\.tsx: PageMeta entity must be/);
  });

  it('fails the build when the app does not depend on an entities package', async () => {
    await expect(
      discover(
        { 'src/pages/ProductPage.tsx': page("import { productEntity } from 'entities';", 'entity: productEntity') },
        {}
      )
    ).rejects.toThrow(/declares a PageMeta entity, but the app has no `entities` package/);
  });
});
