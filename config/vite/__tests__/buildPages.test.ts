import { describe, expect, it, vi } from 'vitest';

import type { ICrudAdapter, QueryOptions } from '@donotdev/types';

import { HIDDEN_STATUSES } from '../../../schemas/src/common/visibility';
import { buildProductJsonLd, deriveEntitySeo } from '../../../utils/src/common/entitySeo';
import * as headTags from '../../../utils/src/common/headTags';
import * as languagePath from '../../../utils/src/common/languagePath';
import { createSchemas } from '../../../schemas/src/common/createSchema';
import { SPA_SHELL_FILE } from '../../constants.js';
import { entityReadSchemas } from '../../utils/entityRecordSeo.js';
import {
  PrerenderEngine,
  pageFilePath,
  renderPrerenderedPage,
} from '../../utils/PrerenderEngine.js';
import { SEOGenerator } from '../../utils/SEOGenerator.js';
import {
  buildPrerenderedPages,
  buildUrlListings,
  publicReader,
  recordBaseUrl,
  recordRoutes,
  writeBuildPages,
} from '../buildPages.js';
import { productEntity } from '@dndev/test-entities';

const BASE = 'https://shop.example';
const FR_EN = { languages: ['fr', 'en'], defaultLanguage: 'fr' };
const SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Loading...</title>
  <meta name="description" content="Modern web application powered by DoNotDev" />
</head>
<body><div id="root"></div></body>
</html>`;

const CORE = {
  ...headTags,
  ...languagePath,
  deriveEntitySeo,
  buildProductJsonLd,
  HIDDEN_STATUSES,
};

const PRODUCT = {
  id: '1',
  slug: 'serum',
  name: 'Bakuchiol Serum',
  shortDescription: 'A gentle <b>retinol</b> alternative.',
  images: [{ fullUrl: '/img/serum.jpg' }],
  rrpInclVat: 32,
  status: 'available',
};

/** Translations per language, `ns:key` → text; missing → defaultValue (the client `t`). */
const TEXTS: Record<string, Record<string, string>> = {
  fr: { 'about:title': 'À propos', 'about:description': 'Qui sommes-nous', 'home:title': 'Accueil', 'catalogue:title': 'Catalogue' },
  en: { 'about:title': 'About', 'about:description': 'Who we are', 'home:title': 'Home', 'catalogue:title': 'Catalog' },
};
const translate = (_namespaces: string[], language: string) =>
  ((key: string, options?: { defaultValue?: string }) =>
    TEXTS[language]?.[key] ?? options?.defaultValue ?? key) as never;

/** Public reader stub applying `not-in` like a real adapter. */
function mockCrud(rows: Record<string, unknown>[]) {
  const query = vi.fn(async (_collection: string, options: QueryOptions) => ({
    items: rows.filter((row) =>
      (options.where ?? []).every(
        ({ field, value }) => !(value as unknown[]).includes(row[field])
      )
    ),
  }));
  return { crud: { query } as unknown as ICrudAdapter, query };
}

const PRODUCT_ROUTE = {
  path: '/produits/:slug',
  meta: { entity: 'products', seo: { type: 'product' } },
};

/** Manifest routes: the product page names the catalogue its parent (no /produits page). */
const MANIFEST_ROUTES = [
  { path: '/catalogue', meta: { namespace: 'catalogue' } },
  { ...PRODUCT_ROUTE, meta: { ...PRODUCT_ROUTE.meta, parent: '/catalogue' } },
];

/** Read schemas of the entity routes, as writeBuildPages builds them. */
const READ_SCHEMAS = entityReadSchemas(
  { productEntity },
  recordRoutes([PRODUCT_ROUTE]).map(({ route }) => route),
  createSchemas
);

/** buildPrerenderedPages options for a fr/en app. */
const options = (overrides: Record<string, unknown> = {}) => ({
  staticRoutes: [] as Array<{ path: string; meta?: object }>,
  records: recordRoutes([PRODUCT_ROUTE]),
  routes: MANIFEST_ROUTES,
  crud: mockCrud([PRODUCT]).crud,
  readSchemas: READ_SCHEMAS,
  core: CORE,
  entities: { productEntity },
  translate,
  routing: FR_EN,
  baseUrl: BASE,
  siteName: 'Shop',
  hreflang: true,
  defaultNamespace: 'home',
  defaultImage: '/og-image.png',
  pageShell: () => SHELL,
  ...overrides,
});

/** The `<head>` of a page's HTML. */
const head = (html: string) => html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
/** The embedded PrerenderedHead of a page. */
const embedded = (html: string) =>
  JSON.parse(
    html.match(
      new RegExp(
        `<script type="application/json" id="${headTags.PRERENDERED_HEAD_ELEMENT_ID}">([^<]*)</script>`
      )
    )![1]!
  );
const page = (pages: Array<{ file: string; html: string }>, file: string) =>
  pages.find((p) => p.file === file)!.html;

describe('pageFilePath (output layout: <path>.html)', () => {
  it('maps a page URL to its .html file, the root to index.html', () => {
    expect(pageFilePath('/')).toBe('/index.html');
    expect(pageFilePath('/en')).toBe('/en.html');
    expect(pageFilePath('/produits/serum')).toBe('/produits/serum.html');
    expect(pageFilePath('/produits/cr%C3%A8me')).toBe('/produits/crème.html');
  });

  it('has no file for a value no file name can hold', () => {
    expect(pageFilePath('/produits/a%2Fb')).toBeNull();
    expect(pageFilePath('/produits/..%2F..%2Fetc')).toBeNull();
    expect(pageFilePath('/produits/..')).toBeNull();
    expect(pageFilePath('/produits/%E0%A4%A')).toBeNull();
  });
});

describe('recordRoutes', () => {
  it('keeps indexable single-param routes whose page declares its entity, with the og:type', () => {
    expect(
      recordRoutes([
        PRODUCT_ROUTE,
        { path: '/blog/:slug', meta: { entity: 'posts' } },
        { path: '/about', meta: {} },
        { path: '/a/:x/:y', meta: { entity: 'products' } },
        { path: '/hidden/:slug', meta: { entity: 'products', seo: { noindex: true } } },
        { path: '/admin/:id', auth: { required: true }, meta: { entity: 'products' } },
      ])
    ).toEqual([
      { route: { path: '/produits/:slug', collection: 'products' }, type: 'product' },
      { route: { path: '/blog/:slug', collection: 'posts' }, type: 'website' },
    ]);
  });
});

describe('publicReader', () => {
  const env = {
    VITE_SUPABASE_URL: 'https://x.supabase.co',
    VITE_SUPABASE_PUBLIC_KEY: 'sb_publishable_x',
    VITE_FIREBASE_API_KEY: 'key',
    VITE_FIREBASE_PROJECT_ID: 'project',
  };

  it("reads with the app provider's public reader and public env", () => {
    const supabase = publicReader({ dependencies: { '@donotdev/supabase': '1' } }, env, ['/p/:s']);
    expect(supabase.module).toBe('@donotdev/supabase/server');
    const createPublicServerClient = vi.fn(() => 'client');
    const SupabasePublicReader = vi.fn(function (this: { client: unknown }, client: unknown) {
      this.client = client;
    });
    expect(supabase.create({ createPublicServerClient, SupabasePublicReader })).toEqual({
      client: 'client',
    });
    expect(createPublicServerClient).toHaveBeenCalledWith('https://x.supabase.co', 'sb_publishable_x');
    const firebase = publicReader({ dependencies: { '@donotdev/firebase': '1' } }, env, ['/p/:s']);
    expect(firebase.module).toBe('@donotdev/firebase/public');
  });

  it('fails the build without a reader or its env, saying what to set', () => {
    expect(() => publicReader({ dependencies: {} }, env, ['/p/:s'])).toThrow(
      /\/p\/:s list published records, but the app's backend provider has no public reader/
    );
    expect(() =>
      publicReader({ dependencies: { '@donotdev/supabase': '1' } }, {}, ['/p/:s'])
    ).toThrow(/Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLIC_KEY: the build lists/);
    expect(() =>
      publicReader({ devDependencies: { '@donotdev/firebase': '1' } }, {}, ['/p/:s'])
    ).toThrow(/Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID/);
  });
});

describe('recordBaseUrl', () => {
  const logger = { warn: vi.fn() };
  const DEPLOY = { DNDEV_DEPLOY: '1' };
  const LOCAL = {};

  it('takes VITE_APP_URL as the browser does, and fails on a value it would misuse', () => {
    expect(recordBaseUrl(BASE, logger, DEPLOY)).toBe(BASE);
    expect(() => recordBaseUrl(`${BASE}/`, logger, LOCAL)).toThrow(/no trailing slash/);
  });

  it('a deploy build needs a public URL', () => {
    expect(() => recordBaseUrl(undefined, logger, DEPLOY)).toThrow(/deploy build without VITE_APP_URL/);
    expect(() => recordBaseUrl('http://localhost:5173', logger, DEPLOY)).toThrow(/local URLs/);
    expect(() => recordBaseUrl('shop.example', logger, DEPLOY)).toThrow(/not an absolute http\(s\) URL/);
  });

  // REGRESSION: a local build failed on a localhost VITE_APP_URL
  it('a local build takes a localhost URL, and builds no record page without one', () => {
    expect(recordBaseUrl('http://localhost:5173', logger, LOCAL)).toBe('http://localhost:5173');
    expect(recordBaseUrl(undefined, logger, LOCAL)).toBeNull();
  });
});

describe('buildPrerenderedPages: static pages', () => {
  const statics = [
    { path: '/', meta: { namespace: 'home' } },
    { path: '/about', meta: { namespace: 'about' } },
  ];

  it('writes one page per language (default at the root), each in its language', async () => {
    const { pages } = await buildPrerenderedPages(options({ staticRoutes: statics, records: [] }));
    expect(pages.map((p) => p.file)).toEqual([
      '/index.html',
      '/en.html',
      '/about.html',
      '/en/about.html',
    ]);
    expect(head(page(pages, '/about.html'))).toContain('<title>À propos | Shop</title>');
    expect(head(page(pages, '/en/about.html'))).toContain('<title>About | Shop</title>');
    expect(head(page(pages, '/en/about.html'))).toContain(
      '<meta name="description" content="Who we are" data-rh="true" />'
    );
  });

  it('marks every tag for Helmet, with canonical, hreflang and absolute images', async () => {
    const { pages } = await buildPrerenderedPages(options({ staticRoutes: statics, records: [] }));
    const tags = head(page(pages, '/en/about.html'));
    expect(tags).not.toContain('Modern web application');
    expect(tags).toContain(`<link rel="canonical" href="${BASE}/en/about" data-rh="true" />`);
    expect(tags).toContain(
      `<link rel="alternate" hreflang="fr" href="${BASE}/about" data-rh="true" />`
    );
    expect(tags).toContain(
      `<link rel="alternate" hreflang="x-default" href="${BASE}/about" data-rh="true" />`
    );
    expect(tags).toContain(
      `<meta name="twitter:image" content="${BASE}/og-image.png" data-rh="true" />`
    );
    // Only data-rh tags besides the title and the embedded data
    expect(tags.match(/<(meta|link) [^>]*>/g)!.every((tag) => tag.includes('data-rh="true"'))).toBe(true);
  });

  it('embeds exactly the identity tags it wrote (routeHeadTags)', async () => {
    const { pages } = await buildPrerenderedPages(options({ staticRoutes: statics, records: [] }));
    const data = embedded(page(pages, '/en/about.html'));
    expect(data.url).toBe(`${BASE}/en/about`);
    expect(data.breadcrumb).toBe(false);
    expect(data.tags).toEqual(
      headTags.routeHeadTags(
        headTags.routeSeo({
          meta: { namespace: 'about' },
          ns: 'about',
          defaultNs: 'home',
          t: translate(['about'], 'en'),
          siteName: 'Shop',
          baseUrl: BASE,
          url: `${BASE}/en/about`,
          defaultImage: '/og-image.png',
          authOnly: false,
        }),
        { siteName: 'Shop', baseUrl: BASE }
      )
    );
  });

  it('writes og:locale in the page language, the other languages as og:locale:alternate', async () => {
    const { pages } = await buildPrerenderedPages(options({ staticRoutes: statics, records: [] }));
    const en = head(page(pages, '/en/about.html'));
    expect(en).toContain('<meta property="og:locale" content="en_US" data-rh="true" />');
    expect(en).toContain('<meta property="og:locale:alternate" content="fr_FR" data-rh="true" />');
    expect(en.match(/og:locale:alternate/g)).toHaveLength(1);
    const fr = head(page(pages, '/about.html'));
    expect(fr).toContain('<meta property="og:locale" content="fr_FR" data-rh="true" />');
    expect(fr).toContain('<meta property="og:locale:alternate" content="en_US" data-rh="true" />');
  });

  it('without an app URL: no canonical, as AutoMetaTags; hreflang off: no alternates', async () => {
    const noUrl = await buildPrerenderedPages(
      options({ staticRoutes: statics, records: [], baseUrl: '', hreflang: false })
    );
    const tags = head(page(noUrl.pages, '/about.html'));
    expect(tags).not.toContain('rel="canonical"');
    expect(tags).not.toContain('hreflang');
    expect(tags).toContain('<meta property="og:locale" content="fr_FR" data-rh="true" />');
    expect(tags).not.toContain('og:locale:alternate');
    expect(tags).toContain('<meta property="og:image" content="/og-image.png" data-rh="true" />');
  });
});

describe('buildPrerenderedPages: entity records', () => {
  it('writes one page per public record and language', async () => {
    const { crud, query } = mockCrud([PRODUCT, { ...PRODUCT, slug: 'draft', status: 'draft' }]);
    const { pages, skipped } = await buildPrerenderedPages(options({ crud }));
    expect(pages.map((p) => p.file)).toEqual(['/produits/serum.html', '/en/produits/serum.html']);
    expect(skipped).toEqual([]);
    // Read with the entity's read schema (rows keyed by the entity's field names)
    expect(query.mock.calls[0]?.[2]).toBe(READ_SCHEMAS.products);
  });

  it('writes the record identity, its BreadcrumbList and the site tags', async () => {
    const { pages } = await buildPrerenderedPages(options());
    const html = page(pages, '/en/produits/serum.html');
    const tags = head(html);
    expect(tags).toContain('<title>Bakuchiol Serum | Shop</title>');
    expect(tags).toContain(
      `<link rel="canonical" href="${BASE}/en/produits/serum" data-rh="true" />`
    );
    expect(tags).toContain('<meta property="og:type" content="product" data-rh="true" />');
    const jsonLd = [
      ...tags.matchAll(/<script type="application\/ld\+json" data-rh="true">([^<]*)<\/script>/g),
    ].map((m) => JSON.parse(m[1]!));
    expect(jsonLd.map((item) => item['@type'])).toEqual(['Product', 'BreadcrumbList']);
    // Home, the declared parent (PageMeta parent, titled in the page language), the record:
    // never the URL prefix /produits (no page there)
    expect(jsonLd[1].itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Shop', item: `${BASE}/en` },
      { '@type': 'ListItem', position: 2, name: 'Catalog', item: `${BASE}/en/catalogue` },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Bakuchiol Serum',
        item: `${BASE}/en/produits/serum`,
      },
    ]);
    expect(embedded(html).breadcrumb).toBe(true);
  });

  it("a record without an image gets appConfig.seo.defaultImage, the static pages' default", async () => {
    const { crud } = mockCrud([{ ...PRODUCT, images: [] }]);
    const { pages } = await buildPrerenderedPages(
      options({ crud, defaultImage: '/og-image.jpg' })
    );
    const tags = head(page(pages, '/en/produits/serum.html'));
    expect(tags).toContain(
      `<meta property="og:image" content="${BASE}/og-image.jpg" data-rh="true" />`
    );
    expect(tags).toContain(
      `<meta name="twitter:image" content="${BASE}/og-image.jpg" data-rh="true" />`
    );
  });

  it('formats the record in each page language', async () => {
    const spy = vi.fn(translate);
    await buildPrerenderedPages(options({ translate: spy }));
    expect(spy).toHaveBeenCalledWith([productEntity.namespace, 'crud'], 'fr');
    expect(spy).toHaveBeenCalledWith([productEntity.namespace, 'crud'], 'en');
  });

  it('leaves to the shell a URL a static page serves, or one no file can serve', async () => {
    const { crud } = mockCrud([
      { ...PRODUCT, slug: 'new' },
      { ...PRODUCT, slug: '../../etc' },
      { ...PRODUCT, slug: 'a/b' },
      { ...PRODUCT, slug: 'crème' },
    ]);
    const { pages, skipped } = await buildPrerenderedPages(
      options({
        routing: { languages: ['fr'], defaultLanguage: 'fr' },
        crud,
        staticRoutes: [{ path: '/produits/new', meta: {} }],
      })
    );
    expect(pages.map((p) => p.file)).toEqual(['/produits/new.html', '/produits/crème.html']);
    expect(skipped).toEqual(['/produits/new', '/produits/..%2F..%2Fetc', '/produits/a%2Fb']);
  });

  it('fails the build when the public read fails', async () => {
    const crud = {
      query: vi.fn(async () => {
        throw new Error('permission denied for table products');
      }),
    } as unknown as ICrudAdapter;
    await expect(buildPrerenderedPages(options({ crud }))).rejects.toThrow(
      /could not read its public "products" records .*permission denied/
    );
  });
});

describe('buildUrlListings (sitemap.xml, llms.txt)', () => {
  it('lists the record URLs of every language, like the Next sitemap', async () => {
    const { crud, query } = mockCrud([PRODUCT]);
    const generator = new SEOGenerator({ baseUrl: BASE, siteName: 'Shop' });
    const [sitemap] = await buildUrlListings({
      routes: [{ path: '/', meta: { seo: { title: 'Accueil' } } }, PRODUCT_ROUTE],
      blogPosts: [],
      generator,
      crud,
      readSchemas: READ_SCHEMAS,
      core: CORE,
      entities: { productEntity },
      routing: FR_EN,
      baseUrl: BASE,
      siteName: 'Shop',
      siteDescription: undefined,
      translations: {},
      sitemap: true,
      llmsTxt: false,
    });
    expect(sitemap!.file).toBe('/sitemap.xml');
    expect(sitemap!.content).toContain(`<loc>${BASE}/produits/serum</loc>`);
    expect(sitemap!.content).toContain(`<loc>${BASE}/en/produits/serum</loc>`);
    expect(sitemap!.content).toContain(
      `<xhtml:link rel="alternate" hreflang="en" href="${BASE}/en/produits/serum" />`
    );
    expect(sitemap!.content).toContain(`<loc>${BASE}/en</loc>`);
    expect(query.mock.calls[0]?.[2]).toBe(READ_SCHEMAS.products);
  });
});

describe('renderPrerenderedPage', () => {
  it('keeps page text literal: `$` patterns, `</script>` in JSON', () => {
    const tags = headTags.recordHeadTags({
      url: `${BASE}/p/x`,
      title: 'Cost $& more | Shop',
      type: 'product',
      jsonLd: { name: '</script><script>alert(1)</script>' },
      breadcrumb: null,
    });
    const html = renderPrerenderedPage(SHELL, {
      tags,
      headScript: headTags.jsonScriptText({ url: `${BASE}/p/x`, tags, breadcrumb: false }),
      headElementId: headTags.PRERENDERED_HEAD_ELEMENT_ID,
    });
    expect(html).toContain('<title>Cost $&amp; more | Shop</title>');
    expect(html).not.toContain('</script><script>alert');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it('fails without a <title> or </head> in the shell', () => {
    expect(() =>
      renderPrerenderedPage('<html><body></body></html>', {
        tags: [],
        headScript: '{}',
        headElementId: headTags.PRERENDERED_HEAD_ELEMENT_ID,
      })
    ).toThrow(/no <title> or <\/head>/);
  });
});

describe('PrerenderEngine.expandRoutes', () => {
  it('expands a glob to page paths only, never a :param template or a catch-all', () => {
    const engine = new PrerenderEngine({ routes: ['/blog/*', '/about'], outDir: '/dist', logger: console });
    expect(
      engine.expandRoutes({
        routes: [
          { path: '/blog' },
          { path: '/blog/intro' },
          { path: '/blog/:slug' },
          { path: '/blog/docs/*' },
          { path: '/about' },
        ],
        errors: [],
      })
    ).toEqual(['/blog', '/blog/intro', '/about']);
  });
});

describe('writeBuildPages', () => {
  it('always writes the SPA shell as the hosting fallback, untouched (private app: only it)', async () => {
    const write = vi.fn(async () => {});
    const result = await writeBuildPages({
      appRoot: '/app',
      mode: 'production',
      manifestRoutes: [{ path: '/', meta: {} }],
      blogPosts: [],
      staticRoutes: [{ path: '/', meta: {} }],
      prerenderRecords: true,
      shellHtml: SHELL,
      seo: { disabled: true },
      loadI18n: vi.fn(),
      pkg: null,
      write,
      logger: console,
    });
    expect(write).toHaveBeenCalledWith(`/${SPA_SHELL_FILE}`, SHELL);
    expect(write).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pages: 0, listings: [] });
  });
});
