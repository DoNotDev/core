import { describe, it, expect, vi } from 'vitest';

import type { ICrudAdapter, QueryOptions } from '@donotdev/types';

import { HIDDEN_STATUSES } from '../../../schemas/src/common/visibility';
import { deriveEntitySeo } from '../../../utils/src/common/entitySeo';
import {
  formatTrailingSlash,
  languageUrls,
} from '../../../utils/src/common/languagePath';
import { createSchemas } from '../../../schemas/src/common/createSchema';
import { appBaseUrl } from '../seo/baseUrl.js';
import { entityReadSchemas } from '../../utils/entityRecordSeo.js';
import { buildLlmsTxt } from '../../utils/llmsTxt.js';
import { listStaticParams } from '../../utils/publicPages.js';
import { buildSitemap, formatSitemapXml } from '../../utils/sitemap.js';
import {
  apartmentEntity,
  brandEntity,
  productEntity,
  prototypeNamedEntity,
} from '@dndev/test-entities';

const BASE = 'https://shop.example';
const FR = { languages: ['fr'], defaultLanguage: 'fr' };

/** Read schemas of the collections these tests list, as the generated routes build them. */
const READ_SCHEMAS = entityReadSchemas(
  { apartmentEntity, brandEntity, productEntity },
  [
    { path: '/apartments/:id', collection: 'apartments' },
    { path: '/marques/:slug', collection: 'brands' },
    { path: '/produits/:slug', collection: 'products' },
  ],
  createSchemas
);

function mockCrud(rows: Record<string, Record<string, unknown>[]>) {
  // Applies `not-in` clauses like a real adapter, so tests see what the query keeps.
  const query = vi.fn(async (collection: string, options: QueryOptions) => ({
    items: (rows[collection] ?? []).filter((row) =>
      (options.where ?? []).every(
        ({ field, operator, value }) =>
          operator !== 'not-in' || !(value as unknown[]).includes(row[field])
      )
    ),
  }));
  return { crud: { query } as unknown as ICrudAdapter, query };
}

describe('appBaseUrl', () => {
  it('trims, drops trailing slashes and adds https:// when the scheme is missing', () => {
    expect(appBaseUrl(' https://shop.example/ ')).toBe('https://shop.example');
    expect(appBaseUrl('shop.example//')).toBe('https://shop.example');
    expect(appBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('fails when the URL is unset', () => {
    expect(() => appBaseUrl(undefined)).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => appBaseUrl('  ')).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});

describe('buildSitemap', () => {
  it('lists static routes with root priority 1', async () => {
    const { crud } = mockCrud({});
    const entries = await buildSitemap([{ path: '/' }, { path: '/catalogue' }], {
      baseUrl: BASE,
      routing: FR,
      crud,
      trailingSlash: false,
      languageUrls,
      hiddenStatuses: HIDDEN_STATUSES,
    });
    expect(entries).toEqual([
      { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
      { url: `${BASE}/catalogue`, changeFrequency: 'weekly', priority: 0.8 },
    ]);
  });

  it('expands a dynamic route to one URL per published record', async () => {
    const { crud, query } = mockCrud({
      products: [
        { id: '1', slug: 'creme a', updatedAt: '2026-11-01T00:00:00.000Z' },
        { id: '2', slug: 'serum', updatedAt: new Date('2026-11-02T00:00:00Z') },
        { id: '3', slug: null },
      ],
    });

    const entries = await buildSitemap(
      [{ path: '/produits/:slug', collection: 'products' }],
      { baseUrl: BASE, routing: FR, crud, trailingSlash: false, languageUrls, hiddenStatuses: HIDDEN_STATUSES, readSchemas: READ_SCHEMAS }
    );

    // REGRESSION: queried with the entity's read schema (rows keyed by the entity's field
    // names), as the client lists; without it Supabase camelCased snake_case fields
    expect(query).toHaveBeenCalledWith(
      'products',
      {
        where: [
          { field: 'status', operator: 'not-in', value: [...HIDDEN_STATUSES] },
        ],
        limit: 1000,
      },
      READ_SCHEMAS.products
    );
    expect(entries.map((e) => e.url)).toEqual([
      `${BASE}/produits/creme%20a`,
      `${BASE}/produits/serum`,
    ]);
    expect(entries[1]?.lastModified).toBe('2026-11-02T00:00:00.000Z');
  });

  it('lists records of any public status, never draft or deleted', async () => {
    const { crud } = mockCrud({
      products: [
        { slug: 'a', status: 'available' },
        { slug: 'b', status: 'reserved' },
        { slug: 'c', status: 'draft' },
        { slug: 'd', status: 'deleted' },
      ],
    });

    const entries = await buildSitemap(
      [{ path: '/produits/:slug', collection: 'products' }],
      { baseUrl: BASE, routing: FR, crud, trailingSlash: false, languageUrls, hiddenStatuses: HIDDEN_STATUSES, readSchemas: READ_SCHEMAS }
    );

    expect(entries.map((e) => e.url)).toEqual([
      `${BASE}/produits/a`,
      `${BASE}/produits/b`,
    ]);
  });

  it('lists every language URL with its alternates (2+ languages)', async () => {
    const { crud } = mockCrud({ products: [{ id: '1', slug: 'serum' }] });
    const routing = { languages: ['fr', 'en'], defaultLanguage: 'fr' };

    const entries = await buildSitemap(
      [{ path: '/' }, { path: '/produits/:slug', collection: 'products' }],
      { baseUrl: BASE, routing, crud, trailingSlash: false, languageUrls, hiddenStatuses: HIDDEN_STATUSES, readSchemas: READ_SCHEMAS }
    );

    expect(entries.map((e) => e.url)).toEqual([
      `${BASE}/`,
      `${BASE}/en`,
      `${BASE}/produits/serum`,
      `${BASE}/en/produits/serum`,
    ]);
    const productAlternates = {
      languages: {
        fr: `${BASE}/produits/serum`,
        en: `${BASE}/en/produits/serum`,
      },
    };
    expect(entries[2]?.alternates).toEqual(productAlternates);
    expect(entries[3]?.alternates).toEqual(productAlternates);
    expect(entries[1]?.priority).toBe(1);
  });

  it('ends every page URL and alternate with `/` under trailingSlash', async () => {
    const { crud } = mockCrud({ products: [{ id: '1', slug: 'serum' }] });
    const routing = { languages: ['fr', 'en'], defaultLanguage: 'fr' };

    const entries = await buildSitemap(
      [{ path: '/' }, { path: '/produits/:slug', collection: 'products' }],
      { baseUrl: BASE, routing, crud, trailingSlash: true, languageUrls, hiddenStatuses: HIDDEN_STATUSES, readSchemas: READ_SCHEMAS }
    );

    expect(entries.map((e) => e.url)).toEqual([
      `${BASE}/`,
      `${BASE}/en/`,
      `${BASE}/produits/serum/`,
      `${BASE}/en/produits/serum/`,
    ]);
    expect(entries[1]?.alternates).toEqual({
      languages: { fr: `${BASE}/`, en: `${BASE}/en/` },
    });
  });

  it('fails loud on a dynamic route without a collection', async () => {
    const { crud } = mockCrud({});
    await expect(
      buildSitemap([{ path: '/x/:id' }], { baseUrl: BASE, routing: FR, crud, trailingSlash: false, languageUrls, hiddenStatuses: HIDDEN_STATUSES, readSchemas: READ_SCHEMAS })
    ).rejects.toThrow(/noindex/);
  });

  it('fails loud on multi-param routes', async () => {
    const { crud } = mockCrud({});
    await expect(
      buildSitemap([{ path: '/a/:b/c/:d', collection: 'a' }], {
        baseUrl: BASE,
        routing: FR,
        crud,
        trailingSlash: false,
      languageUrls,
        hiddenStatuses: HIDDEN_STATUSES,
      })
    ).rejects.toThrow(/single-param/);
  });
});

describe('listStaticParams', () => {
  const PRODUCTS = [
    { id: '1', slug: 'creme a', status: 'available' },
    { id: '2', slug: 'serum', status: 'reserved' },
    { id: '3', slug: 'brouillon', status: 'draft' },
    { id: '4', slug: 'supprime', status: 'deleted' },
    { id: '5', slug: null },
  ];
  const ROUTE = { path: '/produits/:slug', collection: 'products' };

  it('returns raw params of the same records as the sitemap URLs', async () => {
    const { crud, query } = mockCrud({ products: PRODUCTS });
    const params = await listStaticParams(ROUTE, crud, HIDDEN_STATUSES, READ_SCHEMAS);
    // Raw values: Next encodes them into the URL
    expect(params).toEqual([{ slug: 'creme a' }, { slug: 'serum' }]);

    const entries = await buildSitemap([ROUTE], {
      baseUrl: BASE,
      routing: FR,
      crud,
      trailingSlash: false,
      languageUrls,
      hiddenStatuses: HIDDEN_STATUSES,
      readSchemas: READ_SCHEMAS,
    });
    expect(entries.map((e) => e.url)).toEqual(
      params.map(({ slug }) => `${BASE}/produits/${encodeURIComponent(slug!)}`)
    );
    // One query for both (status filter, limit, the entity's read schema)
    expect(query.mock.calls[0]).toEqual(query.mock.calls[1]);
    expect(query.mock.calls[0]?.[2]).toBe(READ_SCHEMAS.products);
  });

  it('fills the route param name from the record field of that name', async () => {
    const { crud } = mockCrud({ apartments: [{ id: 42 }, { id: 'b-7' }] });
    expect(
      await listStaticParams({ path: '/apartments/:id', collection: 'apartments' }, crud, HIDDEN_STATUSES, READ_SCHEMAS)
    ).toEqual([{ id: '42' }, { id: 'b-7' }]);
  });

  it('fails loud without a reader, a collection, a read schema, or when the read fails', async () => {
    await expect(
      listStaticParams(ROUTE, undefined as unknown as ICrudAdapter, HIDDEN_STATUSES, READ_SCHEMAS)
    ).rejects.toThrow(/no server CRUD reader/);
    const { crud, query } = mockCrud({});
    await expect(
      listStaticParams({ path: '/produits/:slug' }, crud, HIDDEN_STATUSES, READ_SCHEMAS)
    ).rejects.toThrow(/Cannot list the public URLs/);
    await expect(
      listStaticParams({ path: '/a/:x/:y', collection: 'products' }, crud, HIDDEN_STATUSES, READ_SCHEMAS)
    ).rejects.toThrow(/Cannot list the public URLs/);
    // No read schema for the collection: never an unmapped read (Supabase camelCases columns)
    await expect(
      listStaticParams({ path: '/commandes/:id', collection: 'orders' }, crud, HIDDEN_STATUSES, READ_SCHEMAS)
    ).rejects.toThrow(/Route "\/commandes\/:id" reads "orders" records but no read schema was given/);
    expect(query).not.toHaveBeenCalled();
    const failing = {
      query: vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    } as unknown as ICrudAdapter;
    await expect(listStaticParams(ROUTE, failing, HIDDEN_STATUSES, READ_SCHEMAS)).rejects.toThrow(
      /Route "\/produits\/:slug" could not read its public "products" records.*fetch failed/
    );
    // A CRUD error's generic message gives way to the provider's own (details.originalMessage).
    const wrapped = {
      query: vi.fn(async () => {
        throw Object.assign(new Error('Request failed.'), {
          details: { originalMessage: 'Missing or insufficient permissions.' },
        });
      }),
    } as unknown as ICrudAdapter;
    await expect(listStaticParams(ROUTE, wrapped, HIDDEN_STATUSES, READ_SCHEMAS)).rejects.toThrow(
      /records \(signed-out visitor: RLS \/ Security Rules must allow it\): Missing or insufficient permissions\./
    );
  });
});

describe('entityReadSchemas', () => {
  it("maps each listed collection to its entity's read schema (createSchemas(entity).get)", () => {
    const schemas = entityReadSchemas(
      { productEntity, brandEntity, notAnEntity: 'x' },
      [
        { path: '/' },
        { path: '/produits/:slug', collection: 'products' },
        { path: '/en-promo/:slug', collection: 'products' },
      ],
      createSchemas
    );
    expect(Object.keys(schemas)).toEqual(['products']);
    expect(Object.keys(schemas.products!.entries)).toEqual(
      Object.keys(createSchemas(productEntity).get.entries)
    );
  });

  it('keys any collection name as its own (no prototype)', () => {
    const schemas = entityReadSchemas(
      { prototypeNamedEntity },
      [{ path: '/x/:id', collection: '__proto__' }],
      createSchemas
    );
    expect(Object.hasOwn(schemas, '__proto__')).toBe(true);
    expect(Object.hasOwn(schemas, 'toString')).toBe(false);
  });

  it('fails on a collection without an entity definition', () => {
    expect(() =>
      entityReadSchemas({ brandEntity }, [{ path: '/produits/:slug', collection: 'products' }], createSchemas)
    ).toThrow(/no entity definition for collection "products"/);
  });
});

describe('formatSitemapXml', () => {
  it('writes sitemaps.org XML, escaped, with hreflang alternates', () => {
    const xml = formatSitemapXml([
      {
        url: `${BASE}/a?x=1&y=2`,
        lastModified: '2026-11-02T00:00:00.000Z',
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: { languages: { fr: `${BASE}/a`, en: `${BASE}/en/a` } },
      },
    ]);
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        '  <url>',
        `    <loc>${BASE}/a?x=1&amp;y=2</loc>`,
        `    <xhtml:link rel="alternate" hreflang="fr" href="${BASE}/a" />`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${BASE}/en/a" />`,
        '    <lastmod>2026-11-02T00:00:00.000Z</lastmod>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
        '</urlset>',
        '',
      ].join('\n')
    );
  });

  it('omits the xhtml namespace with one language', () => {
    expect(formatSitemapXml([{ url: `${BASE}/` }])).not.toContain('xmlns:xhtml');
  });
});

describe('buildLlmsTxt', () => {
  const BRAND = brandEntity;

  function source(
    rows: Record<string, Record<string, unknown>[]>,
    overrides: Record<string, unknown> = {}
  ) {
    return {
      name: 'Boutique',
      baseUrl: BASE,
      pagesHeading: 'Pages',
      routes: [{ path: '/marques/:slug', collection: 'brands' }],
      entityHeadings: { 'entity-brand': 'Marques' },
      entities: { brandEntity: BRAND },
      crud: mockCrud(rows).crud,
      readSchemas: READ_SCHEMAS,
      deriveEntitySeo,
      hiddenStatuses: HIDDEN_STATUSES,
      trailingSlash: false,
      formatTrailingSlash,
      language: 'fr',
      translations: { 'entity-brand': {}, crud: {} },
      ...overrides,
    } as Parameters<typeof buildLlmsTxt>[0];
  }

  it('titles records with the first text field when the entity has no card title', async () => {
    const text = await buildLlmsTxt(source({ brands: [{ slug: 'cosrx', name: 'COSRX' }] }));
    expect(text).toBe(`# Boutique\n\n## Marques\n\n- [COSRX](${BASE}/marques/cosrx)\n`);
  });

  it('ends page URLs with `/` under trailingSlash', async () => {
    const text = await buildLlmsTxt(
      source({ brands: [{ slug: 'cosrx', name: 'COSRX' }] }, { trailingSlash: true })
    );
    expect(text).toContain(`- [COSRX](${BASE}/marques/cosrx/)`);
  });

  it('uses the route section over the entity heading', async () => {
    const text = await buildLlmsTxt(
      source(
        { brands: [{ slug: 'cosrx', name: 'COSRX' }] },
        { routes: [{ path: '/marques/:slug', collection: 'brands', section: 'Nos marques' }] }
      )
    );
    expect(text).toContain('## Nos marques');
  });

  it('fails when the collection has no entity definition', async () => {
    await expect(
      buildLlmsTxt(source({ brands: [{ slug: 'cosrx', name: 'COSRX' }] }, { entities: {} }))
    ).rejects.toThrow(/no entity definition for collection "brands"/);
  });

  it('fails when the entity has no plural name in the app language', async () => {
    await expect(
      buildLlmsTxt(source({ brands: [{ slug: 'cosrx', name: 'COSRX' }] }, { entityHeadings: {} }))
    ).rejects.toThrow(/namePlural.*entity-brand/);
  });

  // REGRESSION: a published record without a title failed the Vite build and dropped the
  // Next llms.txt; it gets the site name, the title its page carries
  it('titles a published record without a title with the site name', async () => {
    const text = await buildLlmsTxt(source({ brands: [{ slug: 'cosrx', name: '' }] }));
    expect(text).toBe(`# Boutique\n\n## Marques\n\n- [Boutique](${BASE}/marques/cosrx)\n`);
  });

  it('fails on a source static route without a title (not from getLlmsTxtSource)', async () => {
    await expect(
      buildLlmsTxt(source({}, { routes: [{ path: '/a-propos' }] }))
    ).rejects.toThrow(/"\/a-propos" has no title/);
  });
});
