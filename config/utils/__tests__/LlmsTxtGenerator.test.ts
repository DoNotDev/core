import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ICrudAdapter } from '@donotdev/types';

import { createSchemas } from '../../../schemas/src/common/createSchema';
import { HIDDEN_STATUSES } from '../../../schemas/src/common/visibility';
import { deriveEntitySeo } from '../../../utils/src/common/entitySeo';
import { formatTrailingSlash } from '../../../utils/src/common/languagePath';
import { entityReadSchemas } from '../entityRecordSeo.js';
import { buildLlmsTxt } from '../llmsTxt.js';
import {
  generateLlmsFullTxt,
  getLlmsTxtSource,
  resolvePageDescription,
  resolvePageTitle,
} from '../LlmsTxtGenerator.js';
import { translationT } from '../translationT.js';
import { formatLlmsTxt } from '../llmsTxtFormat.js';
import { SEOGenerator } from '../SEOGenerator.js';
import { productEntity } from '@dndev/test-entities';

// Mock PathResolver
const mockPathResolverPathExists = vi.fn(() => false);
const mockPathResolverReadSync = vi.fn(() => '');

vi.mock('../PathResolver.js', () => ({
  PathResolver: {
    getInstance: () => ({
      resolvePath: (rel: string, base: string) => `${base}/${rel}`,
      pathExists: mockPathResolverPathExists,
      readSync: mockPathResolverReadSync,
      getAppRoot: () => '/app',
    }),
  },
}));

const BASE = 'https://shop.example';

/**
 * A discovered route, as RouteDiscovery builds it: `meta` = file-name title + entity
 * (folder) + the page's PageMeta. The file-name `meta.title` is English and must never
 * reach llms.txt.
 */
function discovered(
  path: string,
  fileTitle: string,
  entity: string,
  metaExport: Record<string, unknown>
) {
  return {
    path,
    auth: metaExport.auth ?? false,
    meta: { title: fileTitle, ...metaExport, entity },
    metaExport,
  };
}

/** Discovered routes of a French shop. */
const ROUTES = [
  discovered('/', 'Home', 'pages', { namespace: 'home', auth: false }),
  discovered('/catalogue', 'Catalogue', 'pages', { namespace: 'catalogue', auth: false }),
  discovered('/legal/cgv', 'Cgv', 'legal', {
    namespace: 'cgv',
    auth: false,
    seo: { title: 'Conditions générales de vente' },
  }),
  discovered('/panier', 'Cart', 'pages', {
    namespace: 'cart',
    auth: { required: true },
    seo: { noindex: true },
  }),
  discovered('/compte', 'Account', 'account', {
    namespace: 'account',
    auth: false,
    seo: { noindex: true },
  }),
  discovered('/commandes/:id', 'Order', 'orders', {
    namespace: 'order',
    auth: { required: true },
  }),
  discovered('/produits/:slug', 'Product', 'products', {
    namespace: 'product',
    auth: false,
  }),
];

const TRANSLATIONS = {
  dndev: {
    fr: { seo: { llmsPages: 'Pages', llmsBlog: 'Blog' } },
    en: { seo: { llmsPages: 'Pages', llmsBlog: 'Blog' } },
  },
  home: { fr: { title: 'Marques coréennes pour instituts' } },
  catalogue: {
    fr: { title: 'Catalogue', description: 'Toute la sélection SOHEE.' },
  },
  cgv: { fr: { intro: 'Conditions' } },
  cart: { fr: { title: 'Panier' } },
  account: { fr: { title: 'Mon compte' } },
  product: { fr: { notFound: 'Ce produit n’est pas disponible.' } },
  'entity-product': { fr: { name: 'Produit', namePlural: 'Produits' } },
  'entity-brand': { fr: { name: 'Marque', namePlural: 'Marques' } },
};

// The shared catalogue product (card title `name`, content `shortDescription`).
const PRODUCT_ENTITY = productEntity;

function shopSource() {
  const seoGenerator = new SEOGenerator({ baseUrl: BASE, siteName: 'Boutique' });
  return getLlmsTxtSource({
    siteName: 'Boutique',
    description: 'Boutique professionnelle.',
    baseUrl: BASE,
    sitemapRoutes: seoGenerator.getSitemapRoutes(ROUTES, []),
    routes: ROUTES,
    translations: TRANSLATIONS,
    language: 'fr',
    defaultNamespace: 'home',
  });
}

function mockCrud(rows: Record<string, Record<string, unknown>[]>) {
  const query = vi.fn(async (collection: string) => ({
    items: rows[collection] ?? [],
  }));
  return { crud: { query } as unknown as ICrudAdapter, query };
}

/** `resolvePageTitle` site of the French shop: translations in `fr`. */
const SITE = {
  siteName: 'Boutique',
  defaultNamespace: 'home',
  t: translationT(
    Object.fromEntries(
      Object.entries(TRANSLATIONS).map(([ns, byLanguage]) => [
        ns,
        (byLanguage as Record<string, object>).fr,
      ])
    )
  ),
};

describe('resolvePageTitle', () => {
  // REGRESSION: labels carried the <title>'s " | <site name>" suffix
  it('is the page\'s own title (routeTitle): PageMeta seo.title, then i18n, never the file-name title', () => {
    expect(resolvePageTitle(ROUTES[0], SITE)).toBe('Marques coréennes pour instituts');
    expect(resolvePageTitle(ROUTES[2], SITE)).toBe('Conditions générales de vente');
    expect(resolvePageTitle(ROUTES[1], SITE)).toBe('Catalogue');
    expect(
      resolvePageTitle(
        { path: '/catalogue', meta: { namespace: 'catalogue', seo: { title: 'Sélection' } } },
        SITE
      )
    ).toBe('Sélection');
    // The page's own title wins over its full title
    expect(
      resolvePageTitle(
        { path: '/catalogue', meta: { namespace: 'catalogue', seo: { fullTitle: 'Catalogue Boutique' } } },
        SITE
      )
    ).toBe('Catalogue');
  });

  // REGRESSION: a page without a title failed the Vite build ("has no title") and made the
  // Next build drop llms.txt; it gets its full title, else the site name
  it('a page without its own title gets its full title, else the site name', () => {
    expect(
      resolvePageTitle({ path: '/presse', meta: { seo: { fullTitle: 'Presse Boutique' } } }, SITE)
    ).toBe('Presse Boutique');
    expect(resolvePageTitle(ROUTES[6], SITE)).toBe('Boutique');
    // Without its own namespace: its PageMeta title, never the site defaults' (home) title
    expect(resolvePageTitle({ path: '/faq', meta: {} }, SITE)).toBe('Boutique');
    expect(resolvePageTitle({ path: '/faq', meta: { seo: { title: 'FAQ' } } }, SITE)).toBe('FAQ');
  });
});

describe('resolvePageDescription', () => {
  it('reads Vite manifest routes (meta only) and drops a null seo.description', () => {
    expect(
      resolvePageDescription({ path: '/catalogue', meta: { namespace: 'catalogue' } }, TRANSLATIONS, 'fr')
    ).toBe('Toute la sélection SOHEE.');
    const route = {
      path: '/catalogue',
      meta: { namespace: 'catalogue', seo: { description: null } },
    };
    expect(resolvePageDescription(route, TRANSLATIONS, 'fr')).toBeUndefined();
  });
});

describe('getLlmsTxtSource', () => {
  it('keeps the sitemap URL set: no auth or noindex route, dynamic routes by collection', () => {
    const source = shopSource();
    expect(source.routes).toEqual([
      { path: '/', title: 'Marques coréennes pour instituts' },
      {
        path: '/catalogue',
        title: 'Catalogue',
        description: 'Toute la sélection SOHEE.',
      },
      { path: '/legal/cgv', title: 'Conditions générales de vente' },
      { path: '/produits/:slug', collection: 'products' },
    ]);
    expect(source.pagesHeading).toBe('Pages');
    expect(source.entityHeadings).toEqual({
      'entity-product': 'Produits',
      'entity-brand': 'Marques',
    });
    expect(source.summary).toBe('Boutique professionnelle.');
  });

  // REGRESSION: "[dndev] llms.txt: page "/about" has no title" failed the Vite build
  it('lists a static page without a title under the site name', () => {
    const routes = [discovered('/about', 'About', 'pages', { namespace: 'about' })];
    expect(
      getLlmsTxtSource({
        siteName: 'Boutique',
        baseUrl: BASE,
        sitemapRoutes: [{ path: '/about' }],
        routes,
        translations: TRANSLATIONS,
        language: 'fr',
        defaultNamespace: 'home',
      }).routes
    ).toEqual([{ path: '/about', title: 'Boutique' }]);
  });

  it('lists blog posts under the localized blog heading', async () => {
    const seoGenerator = new SEOGenerator({ baseUrl: BASE, siteName: 'Boutique' });
    const blogPosts = [
      { slug: 'routine', title: 'La routine', description: 'Matin et soir', date: '2026-01-01' },
    ];
    const source = getLlmsTxtSource({
      siteName: 'Boutique',
      baseUrl: BASE,
      sitemapRoutes: seoGenerator.getSitemapRoutes([ROUTES[0]], blogPosts),
      routes: [ROUTES[0]],
      blogPosts,
      translations: TRANSLATIONS,
      language: 'fr',
      defaultNamespace: 'home',
    });
    const text = await buildLlmsTxt({
      ...source,
      trailingSlash: false,
      formatTrailingSlash,
      entities: {},
      crud: undefined,
      deriveEntitySeo,
      hiddenStatuses: HIDDEN_STATUSES,
    });
    expect(text).toBe(
      [
        '# Boutique',
        '',
        '## Pages',
        '',
        `- [Marques coréennes pour instituts](${BASE}/)`,
        `- [Blog](${BASE}/blog)`,
        '',
        '## Blog',
        '',
        `- [La routine](${BASE}/blog/routine): Matin et soir`,
        '',
      ].join('\n')
    );
  });
});

describe('llms.txt route (Next): build source → runtime buildLlmsTxt', () => {
  it('produces absolute, localized URLs with one link per published record and no template, auth or noindex page', async () => {
    const { crud, query } = mockCrud({
      products: [
        {
          slug: 'creme-bakuchiol',
          name: 'Crème Bakuchiol',
          shortDescription: '<p>Crème <b>douce</b> au bakuchiol.</p>',
          status: 'available',
        },
        { slug: 'serum', name: 'Sérum éclat', status: 'available' },
      ],
    });
    // The generated route serializes the source as JSON
    const source = JSON.parse(JSON.stringify(shopSource()));

    const entities = { productEntity: PRODUCT_ENTITY, SLUG_PATTERN: /x/ };
    // As the generated route builds them
    const readSchemas = entityReadSchemas(entities, source.routes, createSchemas);
    const text = await buildLlmsTxt({
      ...source,
      entities,
      crud,
      readSchemas,
      deriveEntitySeo,
      hiddenStatuses: HIDDEN_STATUSES,
      trailingSlash: false,
      formatTrailingSlash,
    });

    // The entity's read schema: rows keep its field names (the record titles read them)
    expect(query).toHaveBeenCalledWith(
      'products',
      {
        where: [
          { field: 'status', operator: 'not-in', value: [...HIDDEN_STATUSES] },
        ],
        limit: 1000,
      },
      readSchemas.products
    );
    expect(text).toBe(
      [
        '# Boutique',
        '',
        '> Boutique professionnelle.',
        '',
        '## Pages',
        '',
        `- [Marques coréennes pour instituts](${BASE}/)`,
        `- [Catalogue](${BASE}/catalogue): Toute la sélection SOHEE.`,
        `- [Conditions générales de vente](${BASE}/legal/cgv)`,
        '',
        '## Produits',
        '',
        `- [Crème Bakuchiol](${BASE}/produits/creme-bakuchiol): Crème douce au bakuchiol.`,
        `- [Sérum éclat](${BASE}/produits/serum)`,
        '',
      ].join('\n')
    );
    // No route template, no private page, no English file-name label, no local URL
    expect(text).not.toContain(':slug');
    expect(text).not.toMatch(/\/:\w/);
    for (const path of ['/panier', '/compte', '/commandes']) {
      expect(text).not.toContain(`${BASE}${path}`);
    }
    for (const label of ['[Home]', '[Cart]', '[Cgv]', '[Product]']) {
      expect(text).not.toContain(label);
    }
    expect(text).not.toContain('localhost');
    for (const url of text.match(/\]\(([^)]+)\)/g) ?? []) {
      expect(url.startsWith(`](${BASE}/`)).toBe(true);
    }
  });
});

describe('formatLlmsTxt', () => {
  it('collapses whitespace and leaves out empty sections', () => {
    expect(
      formatLlmsTxt({
        name: 'Boutique  K-beauty',
        summary: 'Résumé\nsur deux lignes',
        sections: [
          { heading: 'Pages', links: [{ title: 'Accueil', url: `${BASE}/` }] },
          { heading: 'Vide', links: [] },
          {
            heading: 'Produits',
            links: [{ title: 'Crème', url: `${BASE}/p/a`, description: 'Douce' }],
          },
        ],
      })
    ).toBe(
      [
        '# Boutique K-beauty',
        '',
        '> Résumé sur deux lignes',
        '',
        '## Pages',
        '',
        `- [Accueil](${BASE}/)`,
        '',
        '## Produits',
        '',
        `- [Crème](${BASE}/p/a): Douce`,
        '',
      ].join('\n')
    );
  });
});

describe('generateLlmsFullTxt', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathResolverPathExists.mockReturnValue(false);
    mockPathResolverReadSync.mockReturnValue('');
  });

  it('returns null when siteName is missing', () => {
    const result = generateLlmsFullTxt({
      baseUrl: 'https://x.com',
      logger: mockLogger,
    });
    expect(result).toBeNull();
  });

  it('returns null when no blog posts', () => {
    const result = generateLlmsFullTxt({
      siteName: 'Test',
      baseUrl: 'https://x.com',
      blogPosts: [],
      logger: mockLogger,
    });
    expect(result).toBeNull();
  });

  it('returns null when blog directory does not exist', () => {
    mockPathResolverPathExists.mockReturnValue(false);

    const result = generateLlmsFullTxt({
      siteName: 'Test',
      baseUrl: 'https://x.com',
      appRoot: '/app',
      blogPosts: [
        { slug: 'test', title: 'Test', description: '', date: '2026-01-01' },
      ],
      logger: mockLogger,
    });
    expect(result).toBeNull();
  });

  it('generates full content from blog posts', () => {
    mockPathResolverPathExists.mockReturnValue(true);
    mockPathResolverReadSync.mockReturnValue(
      '---\ntitle: Hello World\ndate: 2026-01-01\n---\n\nThis is the full blog post content.\n\nWith multiple paragraphs.'
    );

    const result = generateLlmsFullTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      description: 'The best app',
      appRoot: '/app',
      blogPosts: [
        {
          slug: 'hello-world',
          title: 'Hello World',
          description: 'First post',
          date: '2026-01-01',
        },
      ],
      logger: mockLogger,
    });

    expect(result).toContain('# My App');
    expect(result).toContain('> The best app');
    expect(result).toContain('## Hello World');
    expect(result).toContain('Source: https://myapp.com/blog/hello-world');
    expect(result).toContain('Date: 2026-01-01');
    expect(result).toContain('This is the full blog post content.');
    expect(result).toContain('With multiple paragraphs.');
    // Frontmatter should be stripped
    expect(result).not.toContain('---');
  });
});
