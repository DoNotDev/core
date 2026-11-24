import { describe, expect, it, vi } from 'vitest';

import type { ICrudAdapter, QueryOptions } from '@donotdev/types';

import { HIDDEN_STATUSES } from '../../../schemas/src/common/visibility';
import { buildProductJsonLd, deriveEntitySeo } from '../../../utils/src/common/entitySeo';
import { buildBreadcrumbJsonLd } from '../../../utils/src/common/headTags';
import { DEFAULT_OG_IMAGE } from '../../constants.js';
import { languageUrl } from '../../../utils/src/common/languagePath';
import {
  entityPageSeo,
  jsonLdScript,
  readEntityPageRecord,
} from '../seo/entityPage.js';
import { createSchemas } from '../../../schemas/src/common/createSchema';
import { entityReadSchemas } from '../../utils/entityRecordSeo.js';
import { productEntity } from '@dndev/test-entities';

const BASE = 'https://shop.example';
const ROUTE = { path: '/produits/:slug', collection: 'products' };
const FR_EN = { languages: ['fr', 'en'], defaultLanguage: 'fr' };
/** The page's read schemas, as the generated page builds them. */
const READ_SCHEMAS = entityReadSchemas({ productEntity }, [ROUTE], createSchemas);

/** Public reader stub applying `==` and `not-in` like a real adapter. */
function mockCrud(rows: Record<string, unknown>[]) {
  const query = vi.fn(async (_collection: string, options: QueryOptions) => ({
    items: rows.filter((row) =>
      (options.where ?? []).every(({ field, operator, value }) =>
        operator === '=='
          ? row[field] === value
          : !(value as unknown[]).includes(row[field])
      )
    ),
  }));
  return { crud: { query } as unknown as ICrudAdapter, query };
}

const PRODUCT = {
  id: '1',
  slug: 'serum',
  name: 'Bakuchiol Serum',
  size: '30 ml',
  shortDescription: 'A gentle <b>retinol</b> alternative.',
  images: [{ fullUrl: '/img/serum.jpg' }, { fullUrl: 'https://cdn.example/b.jpg' }],
  rrpInclVat: 32,
  status: 'available',
};

/** entityPageSeo context of a page in `language`, translations stubbed (key → key). */
const context = (overrides: Record<string, unknown> = {}) => ({
  route: ROUTE,
  value: 'serum',
  language: 'en',
  routing: FR_EN,
  baseUrl: BASE,
  trailingSlash: false,
  siteName: 'Shop',
  defaultImage: DEFAULT_OG_IMAGE,
  type: 'product' as const,
  entities: { productEntity, notAnEntity: 'x' },
  translate: vi.fn(() => (key: string) => key),
  deriveEntitySeo,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  languageUrl,
  routes: [ROUTE],
  defaultNamespace: 'home',
  ...overrides,
});

describe('readEntityPageRecord', () => {
  it('reads the public record of the URL: param field and not-hidden status, one row, read schema', async () => {
    const { crud, query } = mockCrud([PRODUCT]);
    expect(await readEntityPageRecord(ROUTE, 'serum', crud, HIDDEN_STATUSES, READ_SCHEMAS)).toEqual(PRODUCT);
    // REGRESSION: queried with the entity's read schema (rows keyed by the entity's field
    // names); without it Supabase camelCased snake_case fields and the page's
    // description, title and JSON-LD lost them
    expect(query).toHaveBeenCalledWith(
      'products',
      {
        where: [
          { field: 'slug', operator: '==', value: 'serum' },
          { field: 'status', operator: 'not-in', value: [...HIDDEN_STATUSES] },
        ],
        limit: 1,
      },
      READ_SCHEMAS.products
    );
  });

  it('returns null for an unknown value or a hidden record (the page 404s)', async () => {
    const { crud } = mockCrud([{ ...PRODUCT, status: HIDDEN_STATUSES[0] }]);
    expect(await readEntityPageRecord(ROUTE, 'serum', crud, HIDDEN_STATUSES, READ_SCHEMAS)).toBeNull();
    expect(await readEntityPageRecord(ROUTE, 'other', crud, HIDDEN_STATUSES, READ_SCHEMAS)).toBeNull();
  });

  it('fails without a read schema for the collection, before any read', async () => {
    const { crud, query } = mockCrud([PRODUCT]);
    await expect(readEntityPageRecord(ROUTE, 'serum', crud, HIDDEN_STATUSES, {})).rejects.toThrow(
      /Route "\/produits\/:slug" reads "products" records but no read schema was given/
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('fails loud on a read error, a route it cannot read, or no reader', async () => {
    const crud = {
      query: vi.fn(async () => {
        throw Object.assign(new Error('wrapped'), {
          details: { originalMessage: 'permission denied for table products' },
        });
      }),
    } as unknown as ICrudAdapter;
    await expect(readEntityPageRecord(ROUTE, 'serum', crud, HIDDEN_STATUSES, READ_SCHEMAS)).rejects.toThrow(
      /"\/produits\/:slug" could not read its public "products" record .*permission denied for table products/
    );
    await expect(
      readEntityPageRecord({ path: '/a/:x/:y', collection: 'products' }, 'x', crud, HIDDEN_STATUSES, READ_SCHEMAS)
    ).rejects.toThrow(/only single-param routes/);
    await expect(
      readEntityPageRecord(ROUTE, 'serum', undefined as unknown as ICrudAdapter, HIDDEN_STATUSES, READ_SCHEMAS)
    ).rejects.toThrow(/no server CRUD reader/);
  });
});

describe('entityPageSeo', () => {
  it('titles the page with the record and the site name, absolute (no layout template)', () => {
    const { metadata } = entityPageSeo(PRODUCT, context());
    expect(metadata.title).toEqual({ absolute: 'Bakuchiol Serum | Shop' });
    expect(metadata.description).toBe('A gentle retinol alternative.');
    expect(metadata.openGraph).toEqual({
      title: { absolute: 'Bakuchiol Serum | Shop' },
      description: 'A gentle retinol alternative.',
      images: [`${BASE}/img/serum.jpg`],
    });
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: { absolute: 'Bakuchiol Serum | Shop' },
      description: 'A gentle retinol alternative.',
      images: [`${BASE}/img/serum.jpg`],
    });
    // No canonical / hreflang / og:url: AutoMetaTags emits them on every route
    expect(metadata).not.toHaveProperty('alternates');
    expect(metadata.openGraph).not.toHaveProperty('url');
  });

  it("formats the record in the page's language with the entity's translations", () => {
    const translate = vi.fn(() => (key: string) => key);
    entityPageSeo(PRODUCT, context({ translate, language: 'fr' }));
    expect(translate).toHaveBeenCalledWith([productEntity.namespace, 'crud']);
  });

  it('emits Product JSON-LD with the page URL in its language and URL form', () => {
    const en = entityPageSeo(PRODUCT, context());
    expect(en.ogType).toBe('product');
    expect(en.jsonLd).toMatchObject({
      '@type': 'Product',
      name: 'Bakuchiol Serum',
      image: [`${BASE}/img/serum.jpg`, 'https://cdn.example/b.jpg'],
      url: `${BASE}/en/produits/serum`,
      offers: { '@type': 'Offer', price: 32, priceCurrency: 'EUR', url: `${BASE}/en/produits/serum` },
    });
    const fr = entityPageSeo(PRODUCT, context({ language: 'fr', trailingSlash: true }));
    expect(fr.jsonLd).toMatchObject({ url: `${BASE}/produits/serum/` });
    const encoded = entityPageSeo({ ...PRODUCT, slug: 'crème a' }, context({ value: 'crème a' }));
    expect(encoded.jsonLd).toMatchObject({ url: `${BASE}/en/produits/cr%C3%A8me%20a` });
  });

  it('sets og:type through the metadata API for website / article, with no JSON-LD', () => {
    for (const type of ['website', 'article'] as const) {
      const seo = entityPageSeo(PRODUCT, context({ type }));
      expect(seo.metadata.openGraph).toMatchObject({ type });
      expect(seo.ogType).toBeNull();
      expect(seo.jsonLd).toBeNull();
    }
  });

  it('falls back to the site name without a record title, and to the default og image without a record image', () => {
    const { metadata } = entityPageSeo({ id: '2', slug: 'x' }, context({ type: 'website' }));
    expect(metadata.title).toEqual({ absolute: 'Shop' });
    expect(metadata).not.toHaveProperty('description');
    expect(metadata.openGraph.images).toEqual([`${BASE}${DEFAULT_OG_IMAGE}`]);
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: { absolute: 'Shop' },
      images: [`${BASE}${DEFAULT_OG_IMAGE}`],
    });
  });

  it("uses appConfig.seo.defaultImage (the other pages' default) for a record without an image", () => {
    const { metadata } = entityPageSeo(
      { id: '2', slug: 'x' },
      context({ type: 'website', defaultImage: '/og-image.jpg' })
    );
    expect(metadata.openGraph.images).toEqual([`${BASE}/og-image.jpg`]);
    expect(metadata.twitter.images).toEqual([`${BASE}/og-image.jpg`]);
    // An absolute default stays as written
    const absolute = entityPageSeo(
      { id: '2', slug: 'x' },
      context({ type: 'website', defaultImage: 'https://cdn.example/og.png' })
    );
    expect(absolute.metadata.openGraph.images).toEqual(['https://cdn.example/og.png']);
  });

  it('emits the BreadcrumbList: home, the ancestors by title, the record title last', () => {
    // REGRESSION (BUGS #35): the URL prefix /produits (no page there, a 404) was an item
    // named "Produits"; the PageMeta parent is the ancestor, titled in the page language
    const texts: Record<string, string> = { 'catalogue:title': 'Catalog' };
    const translate = vi.fn(() => (key: string, options?: { defaultValue?: string }) =>
      texts[key] ?? options?.defaultValue ?? key);
    const routes = [
      { path: '/catalogue', meta: { namespace: 'catalogue' } },
      { path: '/produits/:slug', meta: { parent: '/catalogue' } },
    ];
    expect(entityPageSeo(PRODUCT, context({ routes, translate })).breadcrumb).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Shop', item: `${BASE}/en` },
        { '@type': 'ListItem', position: 2, name: 'Catalog', item: `${BASE}/en/catalogue` },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Bakuchiol Serum',
          item: `${BASE}/en/produits/serum`,
        },
      ],
    });
    // No ancestor page: home, then the record (the URL prefix is no item)
    expect(entityPageSeo(PRODUCT, context()).breadcrumb).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Shop', item: `${BASE}/en` },
        { position: 2, name: 'Bakuchiol Serum', item: `${BASE}/en/produits/serum` },
      ],
    });
    // No record title: no record breadcrumb
    expect(entityPageSeo({ id: '2', slug: 'x' }, context()).breadcrumb).toBeNull();
  });

  it("fails loud when the collection has no entity definition in the app's entities", () => {
    expect(() => entityPageSeo(PRODUCT, context({ entities: {} }))).toThrow(
      /no entity definition for collection "products"/
    );
  });
});

describe('jsonLdScript', () => {
  it('escapes `<` so a record value cannot close the script', () => {
    expect(jsonLdScript({ name: '</script><script>x' })).toBe(
      '{"name":"\\u003c/script>\\u003cscript>x"}'
    );
  });
});
