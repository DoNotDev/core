// @vitest-environment node
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import { decodePathParams } from 'next/dist/server/lib/router-utils/decode-path-params.js';

import { readDatabaseWebhook } from '../../../../providers/supabase/src/server/databaseWebhook';
import { GENERATED_PATHS } from '../../constants.js';
import { NextRouteHandler } from '../handlers/RouteHandler.js';
import {
  handleRevalidationWebhook,
  revalidationPaths,
  REVALIDATE_ROUTE_PATH,
} from '../revalidation.js';

const ROUTES = [
  { path: '/' },
  { path: '/catalogue' },
  { path: '/produits/:slug', collection: 'products' },
  { path: '/marques/:slug', collection: 'brands' },
];
const FR_EN = { languages: ['fr', 'en'], defaultLanguage: 'fr' };
const FR = { languages: ['fr'], defaultLanguage: 'fr' };

describe('revalidationPaths', () => {
  it('2+ languages: the record page, static pages and feeds, internal /<lang>/ paths', () => {
    const paths = revalidationPaths(
      ROUTES,
      { schema: 'public', table: 'products', record: { slug: 'creme' }, oldRecord: { slug: 'creme' } },
      FR_EN
    );
    expect(paths).toEqual([
      '/en',
      '/en/catalogue',
      '/en/produits/creme',
      '/fr',
      '/fr/catalogue',
      '/fr/produits/creme',
      '/llms.txt',
      '/sitemap.xml',
    ]);
  });

  it('one language: unprefixed paths', () => {
    expect(
      revalidationPaths(ROUTES, { schema: 'public', table: 'brands', record: { slug: 'b' }, oldRecord: null }, FR)
    ).toEqual(['/', '/catalogue', '/llms.txt', '/marques/b', '/sitemap.xml']);
  });

  it('renamed slug and delete: the old URL too', () => {
    expect(
      revalidationPaths(
        ROUTES,
        { schema: 'public', table: 'products', record: { slug: 'new' }, oldRecord: { slug: 'old' } },
        FR
      )
    ).toEqual(expect.arrayContaining(['/produits/new', '/produits/old']));
    expect(
      revalidationPaths(ROUTES, { schema: 'public', table: 'products', record: null, oldRecord: { slug: 'gone' } }, FR)
    ).toContain('/produits/gone');
  });

  it("writes param values in Next's cache-tag form (the pathname Next tags a render with)", () => {
    // Next: param encodeURIComponent'd into the path (interpolateDynamicPath), then
    // decodePathParams for the cache key / implicit tag (route-module.js)
    const nextTag = (value: string) =>
      decodePathParams(`/produits/${encodeURIComponent(value)}`) as string;
    for (const value of ['a&b', 'x+y', 'p,q;r=s@t$', 'new name', 'crème', 'a/b', 'what?#', 'back\\slash', '50%', 'lit%2fral']) {
      const paths = revalidationPaths(
        [{ path: '/produits/:slug', collection: 'products' }],
        { schema: 'public', table: 'products', record: { slug: value }, oldRecord: null },
        FR
      );
      expect(paths.filter((path) => path.startsWith('/produits/'))).toEqual([nextTag(value)]);
    }
  });

  it('a table no entity route uses: static pages only, no feed', () => {
    expect(
      revalidationPaths(ROUTES, { schema: 'public', table: 'campaigns', record: { id: 'c1' }, oldRecord: null }, FR)
    ).toEqual(['/', '/catalogue']);
  });

  it('skips entity routes with several params (not revalidated per record)', () => {
    expect(
      revalidationPaths(
        [{ path: '/a/:x/:y', collection: 'products' }],
        { schema: 'public', table: 'products', record: { x: 1, y: 2 }, oldRecord: null },
        FR
      )
    ).toEqual([]);
  });
});

describe('handleRevalidationWebhook', () => {
  const body = {
    type: 'UPDATE',
    table: 'products',
    schema: 'public',
    record: { id: 'p1', slug: 'creme', updated_at: '2026-11-19 10:00:00' },
    old_record: { id: 'p1', slug: 'creme', updated_at: '2026-11-18 10:00:00' },
  };
  const SECRET = 's3cret-s3cret-s3cret-s3cret-s3cret';
  const call = (init: { authorization?: string; body?: unknown; secret?: string }) => {
    const secret = 'secret' in init ? init.secret : SECRET;
    const revalidatePath = vi.fn();
    const request = new Request(`https://shop.example${REVALIDATE_ROUTE_PATH}`, {
      method: 'POST',
      headers: init.authorization ? { authorization: init.authorization } : {},
      body: JSON.stringify(init.body ?? body),
    });
    return {
      revalidatePath,
      response: handleRevalidationWebhook(request, {
        secret,
        routes: ROUTES,
        routing: FR_EN,
        readChange: readDatabaseWebhook,
        revalidatePath,
      }),
    };
  };

  it('revalidates every path of the change with the right secret', async () => {
    const { response, revalidatePath } = call({ authorization: `Bearer ${SECRET}` });
    const res = await response;
    expect(res.status).toBe(200);
    const { revalidated } = await res.json();
    expect(revalidated).toContain('/fr/produits/creme');
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(revalidated);
  });

  it('401 without or with a wrong secret, nothing revalidated', async () => {
    for (const authorization of [undefined, 'Bearer nope', SECRET]) {
      const { response, revalidatePath } = call({ authorization });
      expect((await response).status).toBe(401);
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  });

  it('400 on a body that is not a row event', async () => {
    const { response, revalidatePath } = call({
      authorization: `Bearer ${SECRET}`,
      body: { type: 'TRUNCATE', table: 'products', schema: 'public', record: null, old_record: null },
    });
    const res = await response;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Not a Supabase database webhook row event/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('400 on a table outside the public schema', async () => {
    const { response, revalidatePath } = call({
      authorization: `Bearer ${SECRET}`,
      body: { ...body, schema: 'auth', table: 'users' },
    });
    const res = await response;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/"auth\.users" is not in the "public" schema/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('throws when the secret is unset or shorter than 32 characters: no default secret', async () => {
    for (const secret of [undefined, '', 'x'.repeat(31)]) {
      const { response } = call({ authorization: `Bearer ${secret}`, secret });
      await expect(response).rejects.toThrow(/DNDEV_REVALIDATE_SECRET.*at least 32 characters/);
    }
  });

  it('rethrows a reader failure that is not an Error', async () => {
    const request = new Request(`https://shop.example${REVALIDATE_ROUTE_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
      body: JSON.stringify(body),
    });
    await expect(
      handleRevalidationWebhook(request, {
        secret: SECRET,
        routes: ROUTES,
        routing: FR_EN,
        readChange: () => {
          throw 'not an error';
        },
        revalidatePath: vi.fn(),
      })
    ).rejects.toBe('not an error');
  });
});

describe('RouteHandler revalidation route', () => {
  const app = (deps: string[], options: Record<string, unknown> = {}) =>
    Object.assign(new NextRouteHandler({ ssr: true, ...options }), {
      appDependsOn: (name: string) => deps.includes(name),
    });
  const routes = [
    { path: '/', auth: false, meta: {} },
    { path: '/produits/:slug', auth: false, meta: { entity: 'products' } },
    { path: '/brouillons/:slug', auth: false, meta: { entity: 'drafts', seo: { noindex: true } } },
    { path: '/recherche/:q', auth: false, meta: {} },
    { path: '/a/:x/:y', auth: false, meta: { entity: 'products' } },
    { path: '/docs/*', auth: false, meta: {} },
  ];

  it('maps cached pages: static ones, single-param entity ones (noindex included)', () => {
    const handler = app(['@donotdev/supabase']);
    expect(routes.map((route) => handler.revalidationRoute(route)).filter(Boolean)).toEqual([
      { path: '/' },
      { path: '/produits/:slug', collection: 'products' },
      { path: '/brouillons/:slug', collection: 'drafts' },
    ]);
  });

  it('skips per-request-only pages (auth, cookie session): they have no cached copy', () => {
    const handler = Object.assign(app(['@donotdev/supabase']), { rendersSessionTree: true });
    expect(handler.revalidationRoute({ path: '/compte', auth: { required: true }, meta: {} })).toBeNull();
  });

  it('emits a POST route that parses, reads the secret env and the Supabase webhook reader', () => {
    const handler = app(['@donotdev/supabase']);
    handler.useLanguages(FR_EN);
    const code = handler.generateRevalidationContent({ routes });
    const { diagnostics } = ts.transpileModule(code, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    expect(diagnostics ?? []).toEqual([]);
    expect(code).toContain("import { revalidatePath } from 'next/cache';");
    expect(code).toContain("import { readDatabaseWebhook } from '@donotdev/supabase/server';");
    expect(code).toContain('secret: process.env.DNDEV_REVALIDATE_SECRET,');
    expect(code).toContain('"collection": "products"');
    expect(code).toContain('"languages":["fr","en"]');
    expect(code).not.toMatch(/SERVICE_ROLE|SECRET_KEY|service_role/i);
  });

  it('writes the route only for a Supabase app in app routing mode', () => {
    for (const [deps, mode, written] of [
      [['@donotdev/supabase'], 'app', true],
      [['@donotdev/firebase'], 'app', false],
      [['@donotdev/supabase'], 'pages', false],
    ] as const) {
      const handler = app([...deps], { routingMode: mode });
      const write = vi.fn();
      Object.assign(handler, { writeGeneratedFile: write });
      handler.generateRevalidationRoute({ routes });
      expect(write.mock.calls.map(([file]) => file)).toEqual(
        written ? [GENERATED_PATHS.next.revalidateRoute] : []
      );
    }
  });
});
