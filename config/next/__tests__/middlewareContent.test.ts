import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import { hasSupabaseSessionCookie } from '../../../../providers/supabase/src/server/proxySession';
import * as utils from '../../../utils/src/common';
import { NEXT_RENDER } from '../../constants.js';
import { NextRouteHandler } from '../handlers/RouteHandler.js';

const transpile = (code: string) =>
  ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.Preserve,
    },
  });

type Result = { type: string; url?: string; status?: number };

/** Supabase auth cookie (name only matters: refreshSupabaseSession is stubbed). */
const AUTH_COOKIE = 'sb-ref-auth-token=x';

/**
 * Proxy request stub: URL, headers and the cookies of its `cookie` header.
 *
 * @param path - Path and query
 * @param headers - Request headers (`cookie` feeds `cookies.getAll()`)
 */
function makeRequest(path: string, headers: Record<string, string> = {}) {
  const url = `https://shop.example${path}`;
  const cookies = (headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      return { name: part.slice(0, eq), value: part.slice(eq + 1) };
    });
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers(headers),
    cookies: { getAll: () => cookies },
  };
}

/** Request of a visitor with an auth cookie (`signedIn`) or without. */
const withCookie = (path: string) => makeRequest(path, { cookie: AUTH_COOKIE });

/**
 * Run generated proxy content: real language rules (@donotdev/utils) and auth-cookie
 * check (@donotdev/supabase), NextResponse and refreshSupabaseSession stubs. `applied` = responses passed through the session's
 * `apply`; `forwarded` = next / rewrite responses that forward the request.
 */
function loadProxy(content: string, session: unknown) {
  const js = transpile(content)
    .outputText.replace(/^import .*$/gm, '')
    .replace(/^export (async function|function|const)/gm, '$1');
  const applied: Result[] = [];
  const forwarded: Result[] = [];
  const forward = (result: Result, init?: { request?: unknown }) => {
    if (init?.request) forwarded.push(result);
    return result;
  };
  const NextResponse = Object.assign(
    function NextResponse(_body: unknown, init: { status: number }): Result {
      return { type: 'status', status: init.status };
    },
    {
      next: (init?: { request?: unknown }): Result =>
        forward({ type: 'next' }, init),
      redirect: (url: URL, status?: number): Result => ({
        type: 'redirect',
        url: url.pathname + url.search,
        status,
      }),
      rewrite: (url: URL, init?: { request?: unknown }): Result =>
        forward({ type: 'rewrite', url: url.pathname + url.search }, init),
    }
  );
  const refreshSupabaseSession = vi.fn(async () => ({
    session,
    apply: (response: Result) => {
      applied.push(response);
      return response;
    },
  }));
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: 'sb_publishable_x',
  };
  const factory = new Function(
    'NextResponse',
    'utils',
    'refreshSupabaseSession',
    'hasSupabaseSessionCookie',
    'process',
    `const { LANGUAGE_COOKIE, localizePath, parseAcceptLanguage, readCookieValue, resolveLanguageRoute, splitLanguagePath, hasRoleAccess } = utils;\n${js}\nreturn { proxy, config };`
  );
  const loaded = factory(
    NextResponse,
    utils,
    refreshSupabaseSession,
    hasSupabaseSessionCookie,
    { env }
  ) as {
    proxy: (request: unknown) => Result | Promise<Result>;
    config: { matcher: string[] };
  };
  return { ...loaded, applied, forwarded, refreshSupabaseSession };
}

/**
 * Regression: the old generated middleware did not parse (`/\*\/g` lost its
 * backslash inside a template literal), matched catch-alls on one segment only and
 * read an `auth-token` cookie no provider sets.
 */
describe('RouteHandler proxy.ts', () => {
  const handler = new NextRouteHandler({
    auth: { authRoute: '/connexion', roleRoute: '/404' },
  });
  const content = handler.generateMiddlewareContent([
    { path: '/commandes/:id', auth: { required: true } },
    { path: '/docs/*', auth: true },
    { path: '/admin', auth: { required: true, role: 'admin' } },
  ]);

  it('emits a proxy that parses', () => {
    expect(transpile(content).diagnostics ?? []).toEqual([]);
    expect(content).toContain('export async function proxy(');
    expect(content).toContain(
      "import { hasSupabaseSessionCookie, refreshSupabaseSession, type SupabaseProxySession } from '@donotdev/supabase/server';"
    );
    expect(content).not.toContain('readSupabaseSessionCookie');
  });

  it('matches dynamic, catch-all and exact protected routes', () => {
    const js = transpile(content).outputText;
    const routesSrc = js.slice(
      js.indexOf('const protectedRoutes'),
      js.indexOf('export async function proxy')
    );
    const routes = new Function(
      `${routesSrc}\nreturn protectedRoutes;`
    )() as Array<{
      pattern: RegExp;
      role?: string;
    }>;
    const match = (p: string) => routes.find((r) => r.pattern.test(p));

    expect(match('/commandes/42')).toBeTruthy();
    expect(match('/commandes/42/x')).toBeUndefined();
    expect(match('/docs/a/b')).toBeTruthy();
    expect(match('/admin')?.role).toBe('admin');
    expect(match('/produits/x')).toBeUndefined();
  });

  it('inlines the configured redirect targets', () => {
    expect(content).toContain('const AUTH_ROUTE: string | null = "/connexion"');
    expect(content).toContain('const ROLE_ROUTE: string | null = "/404"');
  });

  it('runs on every page request (fresh session snapshot), not on API routes or files', () => {
    const { config } = loadProxy(content, { user: null });
    expect(config.matcher).toEqual(['/((?!api|_next|.*\\..*).*)']);
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test('/')).toBe(true);
    expect(re.test('/catalogue')).toBe(true);
    expect(re.test('/api/checkout')).toBe(false);
    expect(re.test('/_next/static/a.js')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
  });
});

/**
 * Regression (stale session): the proxy redirected on the unverified cookie user, so a
 * visitor whose session was dead was sent to the signed-in page. It now refreshes the
 * Supabase session first and decides on the verified verdict only.
 */
describe('RouteHandler proxy.ts session refresh', () => {
  const handler = new NextRouteHandler({ auth: { authRoute: '/' } });
  const home = { path: '/', meta: { signedInRedirect: '/catalogue' } };
  const compte = { path: '/compte', auth: { required: true } };

  it('refreshes once per request with an auth cookie, and redirects on the verdict', async () => {
    const content = handler.generateMiddlewareContent(
      [compte],
      [home, compte],
      [home],
      true
    );
    expect(content).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL');
    expect(content).toContain('process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY');
    const signedOut = loadProxy(content, { user: null });
    expect(await signedOut.proxy(withCookie('/'))).toEqual({ type: 'next' });
    expect(await signedOut.proxy(withCookie('/compte'))).toEqual({
      type: 'redirect',
      url: '/?returnTo=%2Fcompte',
      status: undefined,
    });
    expect(signedOut.refreshSupabaseSession).toHaveBeenCalledTimes(2);
    expect(signedOut.refreshSupabaseSession.mock.calls[0]).toEqual([
      expect.anything(),
      'https://ref.supabase.co',
      'sb_publishable_x',
    ]);
  });

  it('writes the session cookies on every response, redirects included, and forwards the request', async () => {
    const content = handler.generateMiddlewareContent(
      [compte],
      [home, compte],
      [home],
      true
    );
    const signedIn = loadProxy(content, { user: { role: 'user' } });
    const redirect = await signedIn.proxy(withCookie('/'));
    const page = await signedIn.proxy(withCookie('/compte'));
    expect(page).toEqual({ type: 'rewrite', url: '/dndev-session/compte' });
    expect(signedIn.applied).toEqual([redirect, page]);
    expect(signedIn.forwarded).toEqual([page]);
  });

  it('serves a guest (no auth cookie) the cached page: no refresh, no cookie write, signed-out redirects', async () => {
    const content = handler.generateMiddlewareContent(
      [compte],
      [home, compte],
      [home],
      true
    );
    const guest = loadProxy(content, { user: { role: 'user' } });
    expect(await guest.proxy(makeRequest('/'))).toEqual({ type: 'next' });
    expect(await guest.proxy(makeRequest('/compte'))).toEqual({
      type: 'redirect',
      url: '/?returnTo=%2Fcompte',
      status: undefined,
    });
    expect(
      await guest.proxy(makeRequest('/', { cookie: 'dndev-lang=fr' }))
    ).toEqual({ type: 'next' });
    expect(guest.refreshSupabaseSession).not.toHaveBeenCalled();
    expect(guest.applied).toEqual([]);
  });

  it('renders per request when signed in or unknown, the cached page when the session is gone', async () => {
    const content = handler.generateMiddlewareContent([], [home], [], true);
    expect(transpile(content).diagnostics ?? []).toEqual([]);
    expect(content).not.toContain('authRedirect');
    expect(content).not.toContain('SupabaseProxySession');
    const unknown = loadProxy(content, null);
    const result = await unknown.proxy(withCookie('/?x=1'));
    expect(result).toEqual({ type: 'rewrite', url: '/dndev-session?x=1' });
    expect(unknown.applied).toEqual([result]);
    expect(unknown.forwarded).toEqual([result]);
    expect(
      await loadProxy(content, { user: { role: 'user' } }).proxy(
        withCookie('/')
      )
    ).toEqual({ type: 'rewrite', url: '/dndev-session' });
    const gone = loadProxy(content, { user: null });
    expect(await gone.proxy(withCookie('/'))).toEqual({ type: 'next' });
    expect(gone.applied).toHaveLength(1);
  });

  it('leaves hand-written routes alone and 404s a direct hit on the internal tree', async () => {
    const content = handler.generateMiddlewareContent([], [home], [], true);
    const signedIn = loadProxy(content, { user: { role: 'user' } });
    expect(await signedIn.proxy(withCookie('/hand-written'))).toEqual({
      type: 'next',
    });
    for (const path of ['/dndev-session', '/dndev-session/compte']) {
      expect(await signedIn.proxy(withCookie(path))).toEqual({
        type: 'status',
        status: 404,
      });
      expect(await signedIn.proxy(makeRequest(path))).toEqual({
        type: 'status',
        status: 404,
      });
    }
  });

  it('composes the per-request tree with the language rewrite (2+ languages)', async () => {
    const multi = new NextRouteHandler({ auth: { authRoute: '/' } });
    multi.useLanguages({ languages: ['fr', 'en'], defaultLanguage: 'fr' });
    const content = multi.generateMiddlewareContent(
      [],
      [home, { path: '/produits/:slug' }],
      [],
      true
    );
    expect(transpile(content).diagnostics ?? []).toEqual([]);
    const signedOut = loadProxy(content, { user: null });
    const result = await signedOut.proxy(withCookie('/'));
    expect(result).toEqual({ type: 'rewrite', url: '/fr' });
    expect(signedOut.applied).toEqual([result]);
    expect(signedOut.forwarded).toEqual([result]);
    const signedIn = loadProxy(content, { user: { role: 'user' } });
    const guest = loadProxy(content, null);
    expect(await signedIn.proxy(withCookie('/produits/serum?x=1'))).toEqual({
      type: 'rewrite',
      url: '/fr/dndev-session/produits/serum?x=1',
    });
    expect(await signedIn.proxy(withCookie('/en/produits/serum'))).toEqual({
      type: 'rewrite',
      url: '/en/dndev-session/produits/serum',
    });
    expect(await signedIn.proxy(withCookie('/en'))).toEqual({
      type: 'rewrite',
      url: '/en/dndev-session',
    });
    // Direct hits on the internal tree, after the language or first
    for (const path of ['/fr/dndev-session/produits/serum', '/en/dndev-session', '/dndev-session']) {
      expect(await signedIn.proxy(withCookie(path))).toEqual({
        type: 'status',
        status: 404,
      });
      expect(await guest.proxy(makeRequest(path))).toEqual({
        type: 'status',
        status: 404,
      });
    }
    // First-visit language redirect first, never cached
    expect(
      await signedIn.proxy(
        makeRequest('/produits/serum', {
          cookie: AUTH_COOKIE,
          'accept-language': 'en',
        })
      )
    ).toEqual({ type: 'redirect', url: '/en/produits/serum', status: 307 });
    expect(await guest.proxy(makeRequest('/produits/serum'))).toEqual({
      type: 'rewrite',
      url: '/fr/produits/serum',
    });
    expect(guest.refreshSupabaseSession).not.toHaveBeenCalled();
  });

  it('uses the internal tree of NEXT_RENDER, the segment the routing hooks strip', () => {
    expect(NEXT_RENDER.sessionSegment).toBe(utils.SESSION_RENDER_SEGMENT);
    expect(utils.publicPathname('/en/dndev-session/x')).toBe('/en/x');
    expect(utils.publicPathname('/en/dndev-session')).toBe('/en');
    expect(utils.publicPathname('/dndev-session/x')).toBe('/x');
    expect(utils.publicPathname('/dndev-session')).toBe('/');
    expect(utils.publicPathname('/en/a/dndev-session')).toBe('/en/a/dndev-session');
    expect(utils.publicPathname('/dndev-sessions/x')).toBe('/dndev-sessions/x');
  });

  it('fails loud without the Supabase env', () => {
    const content = handler.generateMiddlewareContent(
      [compte],
      [compte],
      [],
      true
    );
    const js = transpile(content)
      .outputText.replace(/^import .*$/gm, '')
      .replace(/^export (async function|function|const)/gm, '$1');
    expect(() =>
      new Function(
        'NextResponse',
        'utils',
        'refreshSupabaseSession',
        'process',
        js
      )({}, {}, () => {}, { env: {} })
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe('RouteHandler generated page guard', () => {
  const handler = new NextRouteHandler({});
  const page = (auth: unknown) =>
    handler.generatePageFileContent({
      path: '/compte',
      filePath: '/app/src/pages/AccountPage.tsx',
      relativePath: 'src/pages/AccountPage.tsx',
      auth,
    });

  it('wraps a page whose PageMeta sets auth in AuthGuard (parity with Vite)', () => {
    const code = page({ required: true });
    expect(code).toContain("import { AuthGuard } from '@donotdev/ui';");
    expect(code).toContain('<AuthGuard auth={{"required":true}}>');
  });

  it('leaves public pages unwrapped', () => {
    expect(page(false)).not.toContain('AuthGuard');
  });
});

/**
 * P-a: one URL per language. The proxy content is executed with the real language
 * rules (@donotdev/utils) and a NextResponse stub.
 */
describe('RouteHandler proxy.ts with 2+ languages', () => {
  const handler = new NextRouteHandler({
    auth: { authRoute: '/connexion', roleRoute: null },
  });
  handler.useLanguages({
    languages: ['fr', 'en', 'ko'],
    defaultLanguage: 'fr',
  });
  // src/app/hand-written/route.next.ts (findAppRouteSegments)
  handler.appRouteSegments = ['hand-written'];
  const pages = [
    { path: '/' },
    { path: '/produits/:slug' },
    { path: '/compte', auth: { required: true } },
  ];

  const run = (content: string, session: unknown = { user: null }) =>
    loadProxy(content, session);
  const request = makeRequest;

  const languageOnly = handler.generateMiddlewareContent([], pages);
  const withAuth = handler.generateMiddlewareContent([pages[2]!], pages);

  it('emits proxies that parse, with and without auth', () => {
    expect(transpile(languageOnly).diagnostics ?? []).toEqual([]);
    expect(transpile(withAuth).diagnostics ?? []).toEqual([]);
    expect(languageOnly).not.toContain('@donotdev/supabase/server');
    expect(withAuth).toContain('@donotdev/supabase/server');
  });

  it('serves unprefixed URLs as the default language (internal rewrite)', async () => {
    const { proxy } = run(languageOnly);
    expect(await proxy(request('/produits/serum?x=1'))).toEqual({
      type: 'rewrite',
      url: '/fr/produits/serum?x=1',
    });
    expect(await proxy(request('/'))).toEqual({ type: 'rewrite', url: '/fr' });
  });

  it('redirects a first visit once to the visitor language: cookie, then Accept-Language', async () => {
    const { proxy } = run(languageOnly);
    expect(
      await proxy(
        request('/produits/serum', { 'accept-language': 'ko-KR,ko;q=0.9' })
      )
    ).toEqual({ type: 'redirect', url: '/ko/produits/serum', status: 307 });
    expect(
      await proxy(
        request('/', { cookie: 'dndev-lang=en', 'accept-language': 'ko' })
      )
    ).toEqual({ type: 'redirect', url: '/en', status: 307 });
    // The visitor picked the default language (switcher wrote the cookie): served
    expect(
      await proxy(
        request('/', { cookie: 'dndev-lang=fr', 'accept-language': 'ko' })
      ).type
    ).toBe('rewrite');
  });

  it('passes prefixed URLs, sends /<default>/… to the root URL, ignores non-pages', async () => {
    const { proxy } = run(languageOnly);
    expect(await proxy(request('/en/produits/serum'))).toEqual({
      type: 'next',
    });
    expect(await proxy(request('/fr/produits/serum'))).toEqual({
      type: 'redirect',
      url: '/produits/serum',
      status: 308,
    });
    expect(
      await proxy(request('/hand-written', { 'accept-language': 'ko' }))
    ).toEqual({
      type: 'next',
    });
    // An unknown unprefixed URL is not read as a language segment: default-language 404
    expect(await proxy(request('/nope/produits/serum?x=1'))).toEqual({
      type: 'rewrite',
      url: '/fr/nope/produits/serum?x=1',
    });
    expect(await proxy(request('/en/nope'))).toEqual({ type: 'next' });
  });

  it('runs on every page path, not on API routes or files', () => {
    const { config } = run(languageOnly);
    const [matcher] = config.matcher;
    const re = new RegExp(`^${matcher}$`);
    expect(re.test('/produits/serum')).toBe(true);
    expect(re.test('/api/routes')).toBe(false);
    expect(re.test('/_next/static/a.js')).toBe(false);
    expect(re.test('/sitemap.xml')).toBe(false);
  });

  it('localizes the auth redirect and keeps the language URL as returnTo', async () => {
    const { proxy } = run(withAuth);
    expect(await proxy(request('/en/compte'))).toEqual({
      type: 'redirect',
      url: '/en/connexion?returnTo=%2Fen%2Fcompte',
      status: undefined,
    });
    expect(await proxy(request('/compte'))).toEqual({
      type: 'redirect',
      url: '/connexion?returnTo=%2Fcompte',
      status: undefined,
    });
    expect(
      await run(withAuth, { user: { role: 'user' } }).proxy(
        withCookie('/compte')
      )
    ).toEqual({
      type: 'rewrite',
      url: '/fr/dndev-session/compte',
    });
  });
});

describe('RouteHandler pages with 2+ languages', () => {
  const handler = new NextRouteHandler({ ssr: true });
  handler.useLanguages({ languages: ['fr', 'en'], defaultLanguage: 'fr' });

  it('puts pages under app/[lang]/(site) and imports two levels further up', () => {
    expect(handler.appDirFor('/produits/:slug')).toBe(
      '/[lang]/(site)/produits/[slug]'
    );
    expect(handler.appDirFor('/')).toBe('/[lang]/(site)');
    expect(handler.appDirFor('/', 'session')).toBe('/[lang]/dndev-session');
    expect(
      handler.calculateRelativeImportPath('src/pages/HomePage.tsx', '/')
    ).toBe('../../../pages/HomePage');
    expect(
      handler.calculateRelativeImportPath(
        'src/pages/products/ProductPage.tsx',
        '/produits/:slug'
      )
    ).toBe('../../../../../pages/products/ProductPage');
  });

  it("generates the root layout under [lang]: the page's <html lang>, the languages listed, other segments 404", () => {
    const layout = handler.generateRootLayoutContent();
    expect(transpile(layout).diagnostics ?? []).toEqual([]);
    expect(layout).toContain(
      'const LANGUAGES: readonly string[] = ["fr","en"]'
    );
    expect(layout).toContain('export function generateStaticParams()');
    expect(layout).toContain('if (!LANGUAGES.includes(lang)) notFound();');
    expect(layout).toContain('<AppDocument lang={lang}>{children}</AppDocument>');
    expect(layout).toContain("export { metadata } from '../AppDocument';");
    const written: string[] = [];
    Object.assign(Object.create(handler), {
      writeGeneratedFile: (path: string) => written.push(path),
    }).generateRootLayout();
    expect(written).toEqual(['src/app/[lang]/layout.next.tsx']);
  });

  it('renders the tree layouts under [lang], importing ClientLayout two levels up', () => {
    for (const layout of [
      handler.generateSiteLayoutContent(),
      handler.generateSessionLayoutContent(),
    ]) {
      expect(layout).toContain("import { ClientLayout } from '../../ClientLayout';");
    }
  });

  it("generates the 404 pages: [lang]/not-found, and the global one in the proxy's language", () => {
    const written: Array<{ path: string; content: string }> = [];
    Object.assign(Object.create(handler), {
      writeGeneratedFile: (path: string, content: string) =>
        written.push({ path, content }),
    }).generateNotFoundPages();
    expect(written.map((w) => w.path)).toEqual([
      'src/app/[lang]/not-found.next.tsx',
      'src/app/global-not-found.next.tsx',
    ]);
    const [notFound, global] = written.map((w) => w.content);
    for (const code of [notFound!, global!]) {
      expect(transpile(code).diagnostics ?? []).toEqual([]);
      expect(code).toContain('<ClientLayout serverCookies="" acceptLanguage={null}>');
      expect(code).toContain('<NotFoundPage />');
    }
    expect(notFound).toContain("import { ClientLayout } from '../ClientLayout';");
    expect(global).toContain(
      `(await headers()).get(${JSON.stringify(NEXT_RENDER.languageHeader)})`
    );
    expect(global).toContain(
      'requested && LANGUAGES.includes(requested) ? requested : "fr"'
    );
    expect(global).toContain('<AppDocument lang={lang}>');
    expect(global).toContain("export { metadata } from './AppDocument';");
  });

  it('sets the URL language on requests that are not a page (the 404 reads it)', async () => {
    const multi = new NextRouteHandler({});
    multi.useLanguages({ languages: ['fr', 'en'], defaultLanguage: 'fr' });
    const { proxy } = loadProxy(
      multi.generateMiddlewareContent([], [{ path: '/' }]),
      null
    );
    for (const [path, language, result] of [
      ['/en/nope', 'en', { type: 'next' }],
      ['/nope', 'fr', { type: 'rewrite', url: '/fr/nope' }],
      ['/zz/nope', 'fr', { type: 'rewrite', url: '/fr/zz/nope' }],
    ] as const) {
      const request = makeRequest(path, { 'accept-language': 'en' });
      expect(await proxy(request)).toEqual(result);
      expect(request.headers.get(NEXT_RENDER.languageHeader)).toBe(language);
    }
  });

  it('refuses a default language without translations', () => {
    expect(() =>
      new NextRouteHandler({}).useLanguages({
        languages: ['en', 'ko'],
        defaultLanguage: 'fr',
      })
    ).toThrow(/fallbackLanguage "fr"/);
  });
});

/**
 * Guests are served cached pages: the claim that the provider tree cannot render
 * without a request (force-dynamic on every page) was wrong; the prerender failure was
 * the layout reading the query string (useLocation → useSearchParams).
 */
describe('RouteHandler render trees (cached pages, per-request pages)', () => {
  const handler = new NextRouteHandler({ ssr: true });
  const page = (route: Record<string, unknown>) =>
    handler.generatePageFileContent({
      filePath: '/app/src/pages/AccountPage.tsx',
      relativePath: 'src/pages/AccountPage.tsx',
      ...route,
    });

  it('exports no dynamic segment config on pages, auth pages included', () => {
    for (const auth of [false, { required: true }]) {
      const code = page({ path: '/compte', auth });
      expect(code).not.toContain('export const dynamic');
      expect(code).not.toContain('generateStaticParams');
      expect(transpile(code).diagnostics ?? []).toEqual([]);
    }
  });

  it('renders dynamic-segment pages on first request, then caches them', () => {
    for (const path of ['/produits/:slug', '/docs/*']) {
      const code = page({ path, auth: false });
      expect(code).toContain(
        'export function generateStaticParams() {\n  return [];\n}'
      );
      expect(transpile(code).diagnostics ?? []).toEqual([]);
    }
  });

  it('renders the cached tree without request data, revalidated per NEXT_RENDER', () => {
    const layout = handler.generateSiteLayoutContent();
    expect(transpile(layout).diagnostics ?? []).toEqual([]);
    expect(layout).toContain(
      `export const revalidate = ${NEXT_RENDER.revalidateSeconds};`
    );
    expect(NEXT_RENDER.revalidateSeconds).toBe(3600);
    expect(layout).toContain('<ClientLayout serverCookies="" acceptLanguage={null}>');
    expect(layout).toContain('<Suspense fallback={null}>{children}</Suspense>');
    expect(layout).not.toContain('next/headers');
    expect(layout).not.toContain('export const dynamic');
  });

  it('renders the per-request tree with the request cookies', () => {
    const layout = handler.generateSessionLayoutContent();
    expect(transpile(layout).diagnostics ?? []).toEqual([]);
    expect(layout).toContain("import { headers } from 'next/headers';");
    expect(layout).toContain("serverCookies={requestHeaders.get('cookie') ?? ''}");
    expect(layout).not.toContain('revalidate');
  });

  it('re-exports the cached page in the per-request tree', () => {
    const multi = new NextRouteHandler({ ssr: true });
    multi.useLanguages({ languages: ['fr', 'en'], defaultLanguage: 'fr' });
    const written: Array<{ path: string; content: string }> = [];
    Object.assign(multi, {
      writeGeneratedFile: (path: string, content: string) =>
        written.push({ path, content }),
    });
    multi.generateSessionPage({ path: '/produits/:slug' });
    multi.generateSessionPage({ path: '/' });
    multi.generateSessionPage({
      path: '/blog/:slug',
      metaExport: { namespace: 'blog' },
    });
    expect(written.map((w) => w.path)).toEqual([
      'src/app/[lang]/dndev-session/produits/[slug]/page.next.tsx',
      'src/app/[lang]/dndev-session/page.next.tsx',
      'src/app/[lang]/dndev-session/blog/[slug]/page.next.tsx',
    ]);
    expect(written[0]!.content).toContain(
      "export { default } from '../../../../[lang]/(site)/produits/[slug]/page.next';"
    );
    expect(written[1]!.content).toContain(
      "export { default } from '../../[lang]/(site)/page.next';"
    );
    expect(written[2]!.content).toContain(
      "export { default, generateMetadata } from '../../../../[lang]/(site)/blog/[slug]/page.next';"
    );
  });

  it('generates the root layout in the default language with one language', () => {
    const single = new NextRouteHandler({ ssr: true });
    single.useLanguages({ languages: ['fr'], defaultLanguage: 'fr' });
    const layout = single.generateRootLayoutContent();
    expect(transpile(layout).diagnostics ?? []).toEqual([]);
    expect(layout).toContain('<AppDocument lang="fr">{children}</AppDocument>');
    expect(layout).toContain("export { metadata } from './AppDocument';");
    expect(layout).not.toContain('[lang]');
    const written: string[] = [];
    Object.assign(single, {
      writeGeneratedFile: (path: string) => written.push(path),
    });
    single.generateRootLayout();
    single.generateNotFoundPages();
    expect(written).toEqual([
      'src/app/layout.next.tsx',
      'src/app/not-found.next.tsx',
      'src/app/global-not-found.next.tsx',
    ]);
    const global = single.generateGlobalNotFoundContent();
    expect(transpile(global).diagnostics ?? []).toEqual([]);
    expect(global).toContain('const lang = "fr";');
    expect(global).not.toContain('next/headers');
    expect(single.generateSiteLayoutContent()).toContain(
      "import { ClientLayout } from '../ClientLayout';"
    );
    expect(single.generateNotFoundContent()).toContain(
      "import { ClientLayout } from './ClientLayout';"
    );
  });

  it('fails the build on an app-owned root layout / 404, a missing AppDocument, or one reading the request', async () => {
    const MARKER = '// Generated by @donotdev/config - DO NOT EDIT\n';
    const withFiles = (files: Record<string, string>) =>
      Object.assign(new NextRouteHandler({}), {
        pathResolver: {
          resolveAppPath: (p: string) => p,
          pathExists: (p: string) => p in files,
          read: async (p: string) => files[p],
        },
      });
    const shell = `export const metadata = {};
export function AppDocument({ lang, children }) {
  return <html lang={lang}><body>{children}</body></html>;
}`;

    await expect(
      withFiles({
        'src/app/layout.next.tsx': 'export default function RootLayout() {}',
        'src/app/not-found.next.tsx': 'export default function NotFound() {}',
        'src/app/AppDocument.tsx': shell,
      }).assertAppDocument()
    ).rejects.toThrow(
      /src\/app\/layout\.next\.tsx, src\/app\/not-found\.next\.tsx: the framework generates the root layout and the 404 pages.*Move the HTML shell into src\/app\/AppDocument\.tsx/
    );
    await expect(withFiles({}).assertAppDocument()).rejects.toThrow(
      /src\/app\/AppDocument\.tsx is missing: .*AppDocument\(\{ lang, children \}\)/
    );
    await expect(
      withFiles({
        'src/app/AppDocument.tsx': `import { headers } from 'next/headers';
export const dynamic = 'force-dynamic';
export function AppDocument({ lang, children }) {
  return <html lang={lang}><body><ClientLayout serverCookies="">{children}</ClientLayout></body></html>;
}`,
      }).assertAppDocument()
    ).rejects.toThrow(
      /renders <ClientLayout>, imports next\/headers, exports `dynamic`\. It must be the HTML shell/
    );
    await expect(
      withFiles({
        'src/app/layout.next.tsx': `${MARKER}export default function RootLayout() {}`,
        'src/app/[lang]/not-found.next.tsx': `${MARKER}export default function NotFound() {}`,
        'src/app/AppDocument.tsx': `// Providers: ClientLayout, rendered by the generated layouts\n${shell}`,
      }).assertAppDocument()
    ).resolves.toBeUndefined();
  });
});

/**
 * PageMeta `signedInRedirect`: a signed-in visitor of the page is redirected by the
 * proxy (no flash of the page), unless a return-to is pending or the session is unknown.
 */
describe('RouteHandler proxy.ts signedInRedirect', () => {
  const run = (content: string, session: unknown) =>
    loadProxy(content, session);
  const request = withCookie;
  const home = { path: '/', meta: { signedInRedirect: '/catalogue' } };
  const signedIn = { user: { role: 'user' } };

  describe('one language, no protected routes', () => {
    const content = new NextRouteHandler({}).generateMiddlewareContent(
      [],
      [home, { path: '/catalogue' }],
      [home]
    );

    it('parses, reads the Supabase cookie and needs no core import', () => {
      expect(transpile(content).diagnostics ?? []).toEqual([]);
      expect(content).toContain("from '@donotdev/supabase/server'");
      expect(content).not.toContain('@donotdev/core/server');
      expect(content).not.toContain('authRedirect');
    });

    it('redirects a signed-in visitor of the page to its target', async () => {
      expect(await run(content, signedIn).proxy(request('/'))).toEqual({
        type: 'redirect',
        url: '/catalogue',
      });
    });

    it('lets the page render when signed out, unknown, or a returnTo is pending', async () => {
      expect(await run(content, { user: null }).proxy(request('/'))).toEqual({
        type: 'next',
      });
      expect(await run(content, null).proxy(request('/'))).toEqual({
        type: 'rewrite',
        url: '/dndev-session',
      });
      expect(
        await run(content, signedIn).proxy(request('/?returnTo=%2Fcompte'))
      ).toEqual({ type: 'rewrite', url: '/dndev-session?returnTo=%2Fcompte' });
      expect(await run(content, signedIn).proxy(request('/catalogue'))).toEqual(
        { type: 'rewrite', url: '/dndev-session/catalogue' }
      );
      expect(await run(content, signedIn).proxy(makeRequest('/'))).toEqual({
        type: 'next',
      });
    });

    it('runs on every page request', () => {
      expect(run(content, null).config.matcher).toEqual([
        '/((?!api|_next|.*\\..*).*)',
      ]);
    });
  });

  it('chains after the auth redirect', async () => {
    const handler = new NextRouteHandler({ auth: { authRoute: '/' } });
    const compte = { path: '/compte', auth: { required: true } };
    const content = handler.generateMiddlewareContent(
      [compte],
      [home, compte],
      [home]
    );
    expect(transpile(content).diagnostics ?? []).toEqual([]);
    const { proxy, config } = run(content, signedIn);
    expect(config.matcher).toHaveLength(1);
    expect(await proxy(request('/'))).toEqual({
      type: 'redirect',
      url: '/catalogue',
    });
    expect(await proxy(request('/compte'))).toEqual({
      type: 'rewrite',
      url: '/dndev-session/compte',
    });
  });

  it('localizes the target with 2+ languages', async () => {
    const handler = new NextRouteHandler({});
    handler.useLanguages({ languages: ['fr', 'en'], defaultLanguage: 'fr' });
    const content = handler.generateMiddlewareContent(
      [],
      [home, { path: '/catalogue' }],
      [home]
    );
    expect(transpile(content).diagnostics ?? []).toEqual([]);
    const { proxy } = run(content, signedIn);
    expect(await proxy(request('/en'))).toEqual({
      type: 'redirect',
      url: '/en/catalogue',
    });
    expect(await proxy(request('/'))).toEqual({
      type: 'redirect',
      url: '/catalogue',
    });
  });
});

describe('RouteHandler generateMiddleware with signedInRedirect only', () => {
  const written: Array<{ path: string; content: string }> = [];
  const handler = new NextRouteHandler({ proxyPath: 'src/proxy.next.ts' });
  Object.assign(handler, {
    removeLegacyMiddleware: () => {},
    usesCookieSession: () => true,
    pathResolver: {
      resolveAppPath: (p: string) => `/app/${p}`,
      pathExists: () => false,
      remove: async () => {},
    },
    writeGeneratedFile: (path: string, content: string) =>
      written.push({ path, content }),
  });

  it('generates the proxy with one language and no protected routes', async () => {
    written.length = 0;
    await handler.generateMiddleware({
      routes: [
        { path: '/', auth: false, meta: { signedInRedirect: '/catalogue' } },
        { path: '/catalogue', auth: false, meta: {} },
      ],
    });
    expect(written).toHaveLength(1);
    expect(written[0]!.content).toContain(
      '{ pattern: new RegExp("^/$"), to: "/catalogue" },'
    );
  });

  it('generates a refresh-only proxy for a cookie session with no redirects at all', async () => {
    written.length = 0;
    await handler.generateMiddleware({
      routes: [{ path: '/catalogue', auth: false, meta: {} }],
    });
    expect(written).toHaveLength(1);
    expect(written[0]!.content).toContain('refreshSupabaseSession(request');
    expect(handler.rendersSessionTree).toBe(true);
  });

  it('generates no proxy with one language and no cookie session', async () => {
    written.length = 0;
    Object.assign(handler, { usesCookieSession: () => false });
    await handler.generateMiddleware({
      routes: [{ path: '/compte', auth: { required: true }, meta: {} }],
    });
    expect(written).toHaveLength(0);
    expect(handler.rendersSessionTree).toBe(false);
    Object.assign(handler, { usesCookieSession: () => true });
  });
});

describe('RouteHandler generated page signedInRedirect', () => {
  const handler = new NextRouteHandler({});
  const page = (auth: unknown) =>
    handler.generatePageFileContent({
      path: '/',
      filePath: '/app/src/pages/HomePage.tsx',
      relativePath: 'src/pages/HomePage.tsx',
      auth,
      meta: { signedInRedirect: '/catalogue' },
    });

  it('wraps the page in SignedInRedirect, inside AuthGuard when both apply', () => {
    const plain = page(false);
    expect(plain).toContain("import { SignedInRedirect } from '@donotdev/ui';");
    expect(plain).toContain('<SignedInRedirect to={"/catalogue"}>');
    expect(transpile(plain).diagnostics ?? []).toEqual([]);
    const both = page({ required: true });
    expect(both).toContain(
      "import { AuthGuard, SignedInRedirect } from '@donotdev/ui';"
    );
    expect(both).toMatch(/<AuthGuard [^>]*><SignedInRedirect /);
  });
});
