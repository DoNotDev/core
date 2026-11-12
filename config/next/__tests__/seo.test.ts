import { describe, it, expect, vi } from 'vitest';

import type { ICrudAdapter, QueryOptions } from '@donotdev/types';

import { HIDDEN_STATUSES } from '../../../schemas/src/common/visibility';
import { deriveEntitySeo } from '../../../utils/src/common/entitySeo';
import { languageUrls } from '../../../utils/src/common/languagePath';
import { buildLlmsTxt } from '../seo/llmsTxt.js';
import { buildSitemap, formatSitemapXml } from '../seo/sitemap.js';

const BASE = 'https://shop.example';
const FR = { languages: ['fr'], defaultLanguage: 'fr' };

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

describe('buildSitemap', () => {
  it('lists static routes with root priority 1', async () => {
    const { crud } = mockCrud({});
    const entries = await buildSitemap([{ path: '/' }, { path: '/catalogue' }], {
      baseUrl: BASE,
      routing: FR,
      crud,
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
      { baseUrl: BASE, routing: FR, crud, languageUrls, hiddenStatuses: HIDDEN_STATUSES }
    );

    expect(query).toHaveBeenCalledWith('products', {
      where: [
        { field: 'status', operator: 'not-in', value: [...HIDDEN_STATUSES] },
      ],
      limit: 1000,
    });
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
      { baseUrl: BASE, routing: FR, crud, languageUrls, hiddenStatuses: HIDDEN_STATUSES }
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
      { baseUrl: BASE, routing, crud, languageUrls, hiddenStatuses: HIDDEN_STATUSES }
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

  it('fails loud on a dynamic route without a collection', async () => {
    const { crud } = mockCrud({});
    await expect(
      buildSitemap([{ path: '/x/:id' }], { baseUrl: BASE, routing: FR, crud, languageUrls, hiddenStatuses: HIDDEN_STATUSES })
    ).rejects.toThrow(/noindex/);
  });

  it('fails loud on multi-param routes', async () => {
    const { crud } = mockCrud({});
    await expect(
      buildSitemap([{ path: '/a/:b/c/:d', collection: 'a' }], {
        baseUrl: BASE,
        routing: FR,
        crud,
        languageUrls,
        hiddenStatuses: HIDDEN_STATUSES,
      })
    ).rejects.toThrow(/single-param/);
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
  const BRAND = {
    name: 'Brand',
    collection: 'brands',
    namespace: 'entity-brand',
    fields: { name: { name: 'name', type: 'text' } },
  };

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
      deriveEntitySeo,
      hiddenStatuses: HIDDEN_STATUSES,
      language: 'fr',
      translations: { 'entity-brand': {}, crud: {} },
      ...overrides,
    } as Parameters<typeof buildLlmsTxt>[0];
  }

  it('titles records with the first text field when the entity has no card title', async () => {
    const text = await buildLlmsTxt(source({ brands: [{ slug: 'cosrx', name: 'COSRX' }] }));
    expect(text).toBe(`# Boutique\n\n## Marques\n\n- [COSRX](${BASE}/marques/cosrx)\n`);
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

  it('fails on a published record without a title', async () => {
    await expect(buildLlmsTxt(source({ brands: [{ slug: 'cosrx', name: '' }] }))).rejects.toThrow(
      /has no title/
    );
  });

  it('fails on a static route without a label', async () => {
    await expect(
      buildLlmsTxt(source({}, { routes: [{ path: '/a-propos' }] }))
    ).rejects.toThrow(/"\/a-propos" has no label/);
  });
});
