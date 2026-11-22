import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createNextSEOHandler } from '../handlers/SEOHandler.js';

const ROUTES = [
  { path: '/', auth: false, meta: { namespace: 'home' }, metaExport: { namespace: 'home' } },
  {
    path: '/produits/:slug',
    auth: false,
    meta: { namespace: 'product', entity: 'products' },
    metaExport: { namespace: 'product' },
  },
  {
    path: '/panier',
    auth: { required: true },
    meta: { namespace: 'cart', seo: { noindex: true } },
    metaExport: { namespace: 'cart', seo: { noindex: true } },
  },
];

const TRANSLATIONS = {
  dndev: { fr: { seo: { llmsPages: 'Pages', llmsBlog: 'Blog' } } },
  home: { fr: { title: 'Accueil' } },
  'entity-product': { fr: { namePlural: 'Produits' } },
};

/** The sitemap's routes of discovered routes (no blog posts), as generateSpecificFiles lists them. */
const sitemapRoutes = (seo: ReturnType<typeof createNextSEOHandler>, routes: typeof ROUTES) =>
  seo.seoGenerator.getSitemapRoutes(routes, []);

/** Value import of a client-containing root (type imports are erased). */
const CLIENT_ROOT_IMPORT = /^import\s+(?!type\b)[^;]*from\s+'@donotdev\/(core|supabase|firebase|ui|crud|components)'/m;

describe('generated SEO routes', () => {
  let appRoot: string;
  const write = (rel: string, content: string) => {
    const file = join(appRoot, rel);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  };
  const read = (rel: string) => readFileSync(join(appRoot, rel), 'utf8');

  function handler(dependencies: Record<string, string>) {
    write('package.json', JSON.stringify({ name: 'app', dependencies }));
    const seo = createNextSEOHandler({
      siteName: 'Boutique',
      baseUrl: 'https://shop.example',
      isDev: true,
    });
    seo.useLanguages({ languages: ['fr'], defaultLanguage: 'fr' });
    seo.useTranslations(TRANSLATIONS);
    return seo;
  }

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-seo-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
    write('src/config/providers.ts', "import { configureProviders } from '@donotdev/core';\n");
    write('entities-src/product.ts', "import { defineEntity } from '@donotdev/core';\n");
    mkdirSync(join(appRoot, 'node_modules'), { recursive: true });
    symlinkSync(join(appRoot, 'entities-src'), join(appRoot, 'node_modules/entities'));
  });

  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  it('import only server entries and build their own public reader', async () => {
    const seo = handler({ '@donotdev/supabase': '^0.2.3', entities: 'workspace:*' });
    await seo.generateSitemapRoute(sitemapRoutes(seo, ROUTES));
    await seo.generateLlmsTxtRoute(ROUTES, [], sitemapRoutes(seo, ROUTES));

    for (const rel of ['src/app/sitemap.xml/route.next.ts', 'src/app/llms.txt/route.next.ts']) {
      const code = read(rel);
      expect(code).not.toMatch(CLIENT_ROOT_IMPORT);
      expect(code).not.toContain('config/providers');
      expect(code).toContain("from '@donotdev/core/next'");
      expect(code).toContain("from '@donotdev/supabase/server'");
      expect(code).toContain('createPublicServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY)');
      expect(code).toContain('export const revalidate = 3600;');
      expect(code).toContain('export async function GET()');
      // REGRESSION: records read with the entity's read schema (rows keyed by the entity's
      // field names); without it Supabase camelCased snake_case fields (llms.txt "undefined")
      expect(code).toContain("import * as entities from 'entities';");
      expect(code).toContain(
        'const READ_SCHEMAS = entityReadSchemas(entities, [{"path":"/produits/:slug","collection":"products"}], createSchemas);'
      );
      expect(code).toMatch(/^import \{ HIDDEN_STATUSES, [^}]*\bcreateSchemas \} from '@donotdev\/core\/server';$/m);
      expect(code).toMatch(/^import \{ appBaseUrl, [^}]*\bentityReadSchemas \} from '@donotdev\/core\/next';$/m);
      expect(code).toContain('crud: CRUD,\n    readSchemas: READ_SCHEMAS,');
      expect(code.match(/from 'entities'/g)).toHaveLength(1);
    }
    // noindex / auth routes never reach the generated file
    expect(read('src/app/sitemap.xml/route.next.ts')).not.toContain('/panier');
  });

  it('read Firestore as a signed-out visitor on a Firebase app (public entry, no Admin SDK)', async () => {
    const seo = handler({ '@donotdev/firebase': '^0.3.2', entities: 'workspace:*' });
    await seo.generateSitemapRoute(sitemapRoutes(seo, ROUTES));
    await seo.generateLlmsTxtRoute(ROUTES, [], sitemapRoutes(seo, ROUTES));

    for (const rel of ['src/app/sitemap.xml/route.next.ts', 'src/app/llms.txt/route.next.ts']) {
      const code = read(rel);
      expect(code).not.toMatch(CLIENT_ROOT_IMPORT);
      expect(code).not.toContain('config/providers');
      expect(code).toContain(
        "import { createPublicServerFirestore, FirestorePublicReader } from '@donotdev/firebase/public';"
      );
      expect(code).toContain(
        'createPublicServerFirestore({ apiKey: FIREBASE_API_KEY, projectId: FIREBASE_PROJECT_ID })'
      );
      expect(code).toContain('const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;');
      expect(code).toContain('const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;');
      expect(code).toContain(
        "'[dndev] Set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID: the sitemap and llms.txt list published records.'"
      );
      expect(code).toContain('crud: CRUD,');
      expect(code).not.toContain('@donotdev/firebase/server');
      expect(code).not.toContain('@donotdev/supabase');
      expect(code).not.toMatch(/ADMIN|PRIVATE_KEY|CLIENT_EMAIL|SERVICE_ACCOUNT/i);
    }
  });

  // REGRESSION: the llms.txt route imported `entities` in an app without entity routes, and
  // an entities package that is comments only (what init wrote) is no module: TS2306
  it('import entities only for entity routes', async () => {
    const seo = handler({ '@donotdev/supabase': '^0.2.3', entities: 'workspace:*' });
    await seo.generateLlmsTxtRoute([ROUTES[0]], [], sitemapRoutes(seo, [ROUTES[0]]));
    await seo.generateSitemapRoute(sitemapRoutes(seo, [ROUTES[0]]));
    for (const rel of ['src/app/llms.txt/route.next.ts', 'src/app/sitemap.xml/route.next.ts']) {
      expect(read(rel)).not.toContain("from 'entities'");
    }
    expect(read('src/app/llms.txt/route.next.ts')).toContain('entities: {},');
  });

  // REGRESSION: an entity route in an app without an entities package wrote `entities: {}`
  // into the llms.txt route, which failed at request time; the sitemap reads records with
  // the entity's read schema too
  it('fails the build on an entity route when the app has no entities package', async () => {
    const seo = handler({ '@donotdev/supabase': '^0.2.3' });
    for (const generate of [
      () => seo.generateLlmsTxtRoute(ROUTES, [], sitemapRoutes(seo, ROUTES)),
      () => seo.generateSitemapRoute(sitemapRoutes(seo, ROUTES)),
    ]) {
      await expect(generate()).rejects.toThrow(
        /^\[dndev-routes\] \/produits\/:slug lists published "products" records.*`entities` package/
      );
    }
  });

  it('needs no reader when no route lists records', async () => {
    const seo = handler({});
    await seo.generateSitemapRoute(sitemapRoutes(seo, [ROUTES[0]]));
    const code = read('src/app/sitemap.xml/route.next.ts');
    expect(code).not.toContain('CRUD');
    expect(code).not.toContain('@donotdev/supabase');
  });

  it("pass the app's next.config trailingSlash to the sitemap and llms.txt URLs", async () => {
    for (const trailingSlash of [false, true]) {
      write('package.json', JSON.stringify({ name: 'app', dependencies: {} }));
      const seo = createNextSEOHandler({
        siteName: 'Boutique',
        baseUrl: 'https://shop.example',
        isDev: true,
        ...(trailingSlash && { trailingSlash }),
      });
      seo.useLanguages({ languages: ['fr'], defaultLanguage: 'fr' });
      seo.useTranslations(TRANSLATIONS);
      await seo.generateSitemapRoute(sitemapRoutes(seo, [ROUTES[0]]));
      await seo.generateLlmsTxtRoute([ROUTES[0]], [], sitemapRoutes(seo, [ROUTES[0]]));
      for (const rel of ['src/app/sitemap.xml/route.next.ts', 'src/app/llms.txt/route.next.ts']) {
        const code = read(rel);
        expect(code).toContain(`const TRAILING_SLASH = ${trailingSlash};`);
        expect(code).toContain('trailingSlash: TRAILING_SLASH,');
      }
      expect(read('src/app/llms.txt/route.next.ts')).toContain('formatTrailingSlash,');
    }
  });

  it('fails when a route lists records and the provider has no server reader', async () => {
    const seo = handler({ '@donotdev/graphql': '^0.3.0' });
    await expect(seo.generateSitemapRoute(sitemapRoutes(seo, ROUTES))).rejects.toThrow(
      /no server reader \(supported: @donotdev\/supabase, @donotdev\/firebase\)/
    );
  });

  it('generates nothing when SEO is disabled (appConfig.seo: false)', async () => {
    write('package.json', JSON.stringify({ name: 'app', dependencies: {} }));
    const seo = createNextSEOHandler({
      siteName: 'Admin',
      baseUrl: 'https://admin.example',
      disabled: true,
      isDev: true,
    });
    expect(seo.disabled).toBe(true);
    await seo.generateSpecificFiles({ routes: ROUTES });
    expect(existsSync(join(appRoot, 'src/app/sitemap.xml/route.next.ts'))).toBe(false);
    expect(existsSync(join(appRoot, 'src/app/llms.txt/route.next.ts'))).toBe(false);
    expect(existsSync(join(appRoot, 'public/robots.txt'))).toBe(false);
  });

  // REGRESSION: any error dropped robots.txt, the sitemap, llms.txt and llms-full.txt behind
  // one logged line, deploy builds included
  describe('a failing SEO file', () => {
    const fail = (seo: ReturnType<typeof createNextSEOHandler>) =>
      vi.spyOn(seo, 'generateLlmsTxtRoute').mockRejectedValue(new Error('disk full'));
    afterEach(() => vi.unstubAllEnvs());

    it('fails a deploy build with a build error naming the file', async () => {
      vi.stubEnv('DNDEV_DEPLOY', '1');
      const seo = handler({});
      fail(seo);
      await expect(seo.generateSpecificFiles({ routes: [ROUTES[0]] })).rejects.toThrow(
        /\[dndev-seo\] llms\.txt not written: disk full/
      );
    });

    it('is one warning line on a local build, the other files still written', async () => {
      for (const name of ['CI', 'VERCEL', 'DNDEV_DEPLOY']) vi.stubEnv(name, '');
      const seo = handler({});
      fail(seo);
      const warn = vi.spyOn(seo.logger, 'warn');
      await seo.generateSpecificFiles({ routes: [ROUTES[0]] });
      expect(warn).toHaveBeenCalledWith(
        '[dndev] Local build: llms.txt not written: disk full (a deploy build fails on it).'
      );
      expect(existsSync(join(appRoot, 'public/robots.txt'))).toBe(true);
      expect(existsSync(join(appRoot, 'src/app/sitemap.xml/route.next.ts'))).toBe(true);
    });

    it('a build error fails every build', async () => {
      const seo = handler({ '@donotdev/graphql': '^0.3.0' });
      vi.spyOn(seo, 'generateLlmsTxtRoute').mockRejectedValue(
        Object.assign(new Error('[dndev-x] misconfigured'), { pluginName: 'dndev-x' })
      );
      vi.spyOn(seo, 'generateSitemapRoute').mockResolvedValue(undefined);
      await expect(seo.generateSpecificFiles({ routes: [ROUTES[0]] })).rejects.toThrow(/misconfigured/);
    });
  });
});

describe('generated SEO routes: base URL', () => {
  let appRoot: string;
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-seo-url-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
    writeFileSync(join(appRoot, 'package.json'), JSON.stringify({ name: 'app', dependencies: {} }));
  });

  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
    if (envUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = envUrl;
  });

  async function generate(url: string, isDev: boolean) {
    process.env.NEXT_PUBLIC_APP_URL = url;
    const seo = createNextSEOHandler({ siteName: 'Boutique', isDev });
    seo.useLanguages({ languages: ['fr'], defaultLanguage: 'fr' });
    seo.useTranslations(TRANSLATIONS);
    await seo.generateSitemapRoute(sitemapRoutes(seo, [ROUTES[0]]));
    await seo.generateLlmsTxtRoute([ROUTES[0]], [], sitemapRoutes(seo, [ROUTES[0]]));
    return ['src/app/sitemap.xml/route.next.ts', 'src/app/llms.txt/route.next.ts'].map((rel) =>
      readFileSync(join(appRoot, rel), 'utf8')
    );
  }

  it('reads NEXT_PUBLIC_APP_URL at request time: same source after dev and build', async () => {
    const dev = await generate('http://localhost:3000', true);
    const build = await generate('https://shop.example', false);
    expect(build).toEqual(dev);
    for (const code of build) {
      expect(code).toContain('const BASE_URL = appBaseUrl(process.env.NEXT_PUBLIC_APP_URL);');
      expect(code).not.toContain('localhost');
      expect(code).not.toContain('shop.example');
    }
  });

});
