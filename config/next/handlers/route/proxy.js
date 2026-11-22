/**
 * @fileoverview Next route handler: Generated proxy (`src/proxy.next.ts`)
 * @description The request gate before anything renders: language routing (2+ languages), the cookie session refresh and per-request tree rewrite, auth and signed-in redirects. Methods of {@link NextRouteHandler} (mixed into its prototype by
 * `../RouteHandler.js`); `this` is the route handler.
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { NEXT_FILE_MARKER } from '../../nextFiles.js';
import { GENERATED_PATHS, NEXT_RENDER } from '../../../constants.js';

export const proxyMethods = {
  /**
   * Generate `src/proxy.next.ts` (Next 16), the request gate before anything renders:
   *
   * - 2+ languages: serves an unprefixed URL as the default language (internal
   *   rewrite to `/<default>/…`, the app/[lang] route), redirects a first visit to the
   *   visitor's language (language cookie, then Accept-Language) and `/<default>/…`
   *   to the root URL (resolveLanguageRoute in @donotdev/core).
   * - Session in cookies (Supabase `createBrowserClient`): a request without an auth
   *   cookie is signed out and gets the cached page (src/app/(site)); with one, the
   *   session is verified and refreshed when expired (refreshSupabaseSession in
   *   @donotdev/supabase/server: `getUser()` for documents, local `getClaims()` for
   *   RSC soft navigations and prefetches) and, signed in or unknown, the page renders per
   *   request (internal rewrite to src/app/dndev-session, under src/app/[lang] with 2+
   *   languages; 404 on a direct hit). The redirects below use a verified session only.
   * - 2+ languages, a request that is not a page: sets NEXT_RENDER.languageHeader to
   *   the URL's language (an unknown URL's 404 renders in it).
   * - Auth redirects for pages whose PageMeta sets `auth`, cookie session only: a
   *   session the server cannot read (Firebase, localStorage) would redirect signed-in
   *   users, so those apps rely on the page's AuthGuard alone. Redirect gate only: data
   *   access stays enforced by RLS. Not redirected, those pages render per request for
   *   every visitor (internal rewrite to src/app/dndev-session): they have no cached copy.
   * - Signed-in redirects for pages whose PageMeta sets `signedInRedirect`, same
   *   cookie-session condition (else the page's SignedInRedirect alone).
   *
   * Generated when any applies; removed (if generated) when none does.
   *
   * @param {Object} routeData - Discovered routes
   */
  async generateMiddleware(routeData) {
    this.removeLegacyMiddleware();
    this.rendersSessionTree = false;

    const authRoutes = routeData.routes.filter((route) =>
      Boolean(this.normalizeAuth(route.auth))
    );
    const signedInPages = routeData.routes.filter(
      (route) => route.meta?.signedInRedirect
    );
    const cookieSession = this.usesCookieSession();
    if ((authRoutes.length > 0 || signedInPages.length > 0) && !cookieSession) {
      this.logger.debug(
        'Auth session not in cookies (no Supabase createBrowserClient): pages use the client AuthGuard / SignedInRedirect only, no proxy auth redirects'
      );
    }
    const protectedRoutes = cookieSession ? authRoutes : [];
    const signedInRoutes = cookieSession ? signedInPages : [];

    const proxyPath = this.pathResolver.resolveAppPath(this.options.proxyPath);
    const isHandWritten =
      this.pathResolver.pathExists(proxyPath) &&
      !(await this.hasGenerationMarker(proxyPath));

    if (!this.isMultilingual() && !cookieSession) {
      this.logger.debug('One language and no cookie session: no proxy.next.ts');
      if (this.pathResolver.pathExists(proxyPath) && !isHandWritten) {
        await this.pathResolver.remove(proxyPath);
      }
      return;
    }
    if (isHandWritten) {
      this.logger.warn(
        `${this.options.proxyPath} is hand-written: not generating language routing / session refresh / auth redirects / per-request pages (add them to your proxy; every visitor gets the cached pages)`
      );
      return;
    }

    if (this.isMultilingual()) {
      this.appRouteSegments = await this.findAppRouteSegments();
    }
    this.writeGeneratedFile(
      this.options.proxyPath,
      this.generateMiddlewareContent(
        protectedRoutes,
        routeData.routes,
        signedInRoutes,
        cookieSession
      ),
      'proxy'
    );
    this.rendersSessionTree = cookieSession;
  },

  /**
   * First URL segments of the app's own (not generated) route files outside
   * `src/app/[lang]` (2+ languages): route handlers such as
   * `src/app/auth/callback/route.next.ts` → `auth`. Route groups are not URL segments.
   *
   * @returns {Promise<string[]>} Sorted, unique
   * @since 0.2.3
   */
  async findAppRouteSegments() {
    const appRoot = this.pathResolver.getAppRoot();
    const appDir = this.pathResolver.resolveAppPath(GENERATED_PATHS.next.appPages);
    const files = await this.pathResolver._globWithNormalization(
      [`${GENERATED_PATHS.next.appPages}/**/{route,page}.${NEXT_FILE_MARKER}.{ts,tsx,js,jsx}`],
      { cwd: appRoot, absolute: true, onlyFiles: true, braceExpansion: true }
    );
    const segments = new Set();
    for (const file of files) {
      if (await this.hasGenerationMarker(file)) continue;
      const [first] = file
        .slice(appDir.length + 1)
        .split('/')
        .slice(0, -1)
        .filter((segment) => !/^\(.*\)$/.test(segment));
      if (first && first !== '[lang]') segments.add(first);
    }
    return [...segments].sort();
  },

  /**
   * Regex source of a route path (`/produits/:slug` → `^/produits/[^/]+$`).
   *
   * @param {string} path - Route path in React Router syntax
   * @returns {string}
   */
  routePattern(path) {
    return (
      '^' +
      path
        .split('/')
        .map((seg) => {
          if (seg === '*') return '.*';
          if (seg.startsWith(':')) return '[^/]+';
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
    );
  },

  /**
   * Content of the generated proxy.next.ts.
   *
   * @param {Array<Object>} protectedRoutes - Routes whose auth requires a user (cookie session only)
   * @param {Array<Object>} [pageRoutes] - Every discovered route (language routing, 2+ languages)
   * @param {Array<Object>} [signedInRoutes] - Routes whose PageMeta sets `signedInRedirect` (cookie session only)
   * @param {boolean} [cookieSession] - The auth session lives in cookies: refresh it on every page request with an auth cookie (implied by protected or signed-in routes)
   * @returns {string}
   */
  generateMiddlewareContent(
    protectedRoutes,
    pageRoutes = [],
    signedInRoutes = [],
    cookieSession = false
  ) {
    const multilingual = this.isMultilingual();
    const hasAuth = protectedRoutes.length > 0;
    const hasSignedIn = signedInRoutes.length > 0;
    const hasRedirects = hasAuth || hasSignedIn;
    const hasSession = cookieSession || hasRedirects;
    const auth = this.options.auth ?? {};

    const authEntries = protectedRoutes
      .map((route) => {
        const { role } = this.normalizeAuth(route.auth);
        return `  { pattern: new RegExp(${JSON.stringify(this.routePattern(route.path))})${
          role ? `, role: ${JSON.stringify(role)}` : ''
        } },`;
      })
      .join('\n');
    const signedInEntries = signedInRoutes
      .map(
        (route) =>
          `  { pattern: new RegExp(${JSON.stringify(this.routePattern(route.path))}), to: ${JSON.stringify(route.meta.signedInRedirect)} },`
      )
      .join('\n');
    const pageEntries = [...new Set(pageRoutes.map((r) => r.path))]
      .map((path) => `  new RegExp(${JSON.stringify(this.routePattern(path))}),`)
      .join('\n');
    // Every page request: language routing sees every page, and every page renders
    // the session snapshot (refreshed here). Not API routes, _next or files.
    const matcherLines = `    ${JSON.stringify('/((?!api|_next|.*\\..*).*)')},`;

    const coreImports = [
      ...(hasAuth ? ['hasRoleAccess'] : []),
      ...(multilingual
        ? [
            'LANGUAGE_COOKIE',
            ...(hasRedirects ? ['localizePath'] : []),
            'parseAcceptLanguage',
            'readCookieValue',
            'resolveLanguageRoute',
            'splitLanguagePath',
          ]
        : []),
    ];
    const supabaseImports = [
      'hasSupabaseSessionCookie',
      'refreshSupabaseSession',
      ...(hasRedirects ? ['type SupabaseProxySession'] : []),
    ];
    const sessionParam = hasRedirects
      ? ",\n  session: SupabaseProxySession['session']"
      : '';
    const languageParam = multilingual ? ',\n  language: string' : '';
    // With a session, the forwarded request carries the refreshed cookies to the render
    const forward = hasSession ? '{ request }' : '';
    const sessionTreePath = `/${NEXT_RENDER.sessionSegment}`;

    const header = `// Generated by @donotdev/config - DO NOT EDIT
// Request gate (Next 16 proxy)${multilingual ? `: one URL per language, the default language (${this.options.defaultLanguage}) at the
// root, the others under their prefix (resolveLanguageRoute in @donotdev/core)` : ''}.${
      hasSession
        ? `
// Session: the Supabase cookie (createBrowserClient). No auth cookie: signed out, the
// page comes from the cache (src/app${this.treeDir('site')}, static). With one: verified and refreshed
// when expired (refreshSupabaseSession: Auth getUser() for documents, local getClaims()
// for RSC soft navigations and prefetches), then rendered per request with the refreshed
// cookies (src/app${this.rootDir()}${sessionTreePath}, an internal path: a direct hit is a 404); the browser
// gets the refreshed cookies on the response.`
        : ''
    }${
      hasAuth
        ? `
// Auth redirects for pages whose PageMeta sets \`auth\`, on the verified session.
// Redirect gate only: data access stays enforced by RLS, and the page's AuthGuard still
// runs on the client. Those pages have no cached copy: rendered per request for every
// visitor that is not redirected.`
        : ''
    }${
      hasSignedIn
        ? `
// Signed-in redirects for pages whose PageMeta sets \`signedInRedirect\` (verified
// session); the page's SignedInRedirect still runs on the client.`
        : ''
    }

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

${coreImports.length ? `import { ${coreImports.join(', ')} } from '@donotdev/core/server';\n` : ''}${hasSession ? `import { ${supabaseImports.join(', ')} } from '@donotdev/supabase/server';\n` : ''}`;

    const sessionBlock = hasSession
      ? `
/** Supabase project of the cookie session (same env as src/config/providers.ts) */
const SUPABASE = supabaseProject(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY
);

function supabaseProject(url: string | undefined, publicKey: string | undefined) {
  if (!url || !publicKey) {
    throw new Error(
      '[dndev] Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: the proxy refreshes the auth session on every page request.'
    );
  }
  return { url, publicKey };
}
${
  multilingual
    ? `
/** Internal tree of the per-request pages (src/app/[lang]${sessionTreePath}), after the language: never a public URL */
const SESSION_SEGMENT = ${JSON.stringify(NEXT_RENDER.sessionSegment)};

/** Internal URL path of a page rendered per request: \`/fr/compte\` → \`/fr${sessionTreePath}/compte\` */
function sessionPath(path: string): string {
  const [, language, ...rest] = path.split('/');
  return ['', language, SESSION_SEGMENT, ...rest].join('/');
}

/** A direct request for the internal tree (\`/fr${sessionTreePath}/…\`) */
function isSessionTreePath(pathname: string): boolean {
  return pathname.split('/').slice(1, 3).includes(SESSION_SEGMENT);
}
`
    : `
/** Internal tree of the per-request pages (src/app${sessionTreePath}): never a public URL */
const SESSION_TREE = ${JSON.stringify(sessionTreePath)};

/** Internal URL path of a page rendered per request */
function sessionPath(path: string): string {
  return path === '/' ? SESSION_TREE : SESSION_TREE + path;
}

/** A direct request for the internal tree */
function isSessionTreePath(pathname: string): boolean {
  return pathname === SESSION_TREE || pathname.startsWith(\`\${SESSION_TREE}/\`);
}
`
}${
  hasRedirects
    ? `
/** Session of a request without an auth cookie: signed out, nothing to verify */
const SIGNED_OUT: SupabaseProxySession['session'] = { user: null };
`
    : ''
}`
      : '';

    const authBlock = hasAuth
      ? `
/** appConfig.auth.authRoute: where a signed-out visitor goes (null: page fallback) */
const AUTH_ROUTE: string | null = ${JSON.stringify(auth.authRoute ?? null)};
/** appConfig.auth.roleRoute: where a visitor without the role goes (null: page fallback) */
const ROLE_ROUTE: string | null = ${JSON.stringify(auth.roleRoute ?? null)};

const protectedRoutes: Array<{ pattern: RegExp; role?: string }> = [
${authEntries}
];

/** Protected pages exist only in the per-request tree (no cached copy) */
function isProtectedRoute(routePath: string): boolean {
  return protectedRoutes.some((r) => r.pattern.test(routePath));
}

/** Redirect of a protected route, or null to let the page render. */
function authRedirect(
  request: NextRequest${sessionParam},
  routePath: string${languageParam}
): NextResponse | null {
  const route = protectedRoutes.find((r) => r.pattern.test(routePath));
  if (!route) return null;
  // Cannot tell (Supabase unreachable, several projects' cookies): the page's AuthGuard decides
  if (session === null) return null;

  if (!session.user) {
    if (!AUTH_ROUTE) return null;
    const url = new URL(${multilingual ? 'localizePath(AUTH_ROUTE, language, LANGUAGE_ROUTING)' : 'AUTH_ROUTE'}, request.url);
    url.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (route.role && !hasRoleAccess(session.user.role, route.role)) {
    if (!ROLE_ROUTE) return null;
    return NextResponse.redirect(new URL(${multilingual ? 'localizePath(ROLE_ROUTE, language, LANGUAGE_ROUTING)' : 'ROLE_ROUTE'}, request.url));
  }
  return null;
}
`
      : '';

    const signedInBlock = hasSignedIn
      ? `
/** PageMeta \`signedInRedirect\`: where a signed-in visitor of the page goes */
const signedInRoutes: Array<{ pattern: RegExp; to: string }> = [
${signedInEntries}
];

/** Redirect of a signed-in visitor, or null to let the page render. */
function signedInRedirect(
  request: NextRequest${sessionParam},
  routePath: string${languageParam}
): NextResponse | null {
  const route = signedInRoutes.find((r) => r.pattern.test(routePath));
  if (!route) return null;
  // A pending return-to wins: the page's AuthReturnTo takes the visitor there
  if (request.nextUrl.searchParams.has('returnTo')) return null;
  // Signed out, or cannot tell: the page renders (its SignedInRedirect decides on the client)
  if (!session?.user) return null;
  return NextResponse.redirect(new URL(${multilingual ? 'localizePath(route.to, language, LANGUAGE_ROUTING)' : 'route.to'}, request.url));
}
`
      : '';

    const languageBlock = multilingual
      ? `
const LANGUAGE_ROUTING = {
  languages: ${JSON.stringify(this.options.languages)},
  defaultLanguage: ${JSON.stringify(this.options.defaultLanguage)},
};

/** Request header of the URL's language, read by the 404 page (src/app/global-not-found) */
const LANGUAGE_HEADER = ${JSON.stringify(NEXT_RENDER.languageHeader)};

/** First URL segments of the app's hand-written routes outside src/app/[lang] (route handlers) */
const APP_ROUTE_SEGMENTS: readonly string[] = ${JSON.stringify(this.appRouteSegments)};
`
      : '';
    const pageRoutesBlock =
      multilingual || hasSession
        ? `
/** App pages (src/pages): API routes, files and hand-written app routes pass untouched */
const pageRoutes: RegExp[] = [
${pageEntries}
];
`
        : '';

    const sessionArg = hasRedirects ? 'session, ' : '';
    const refresh = `  // Verified session, refreshed when expired: the redirects and the server render
  // (refreshed cookies forwarded with \`request\`) see the same signed-in state
  const auth = await refreshSupabaseSession(request, SUPABASE.url, SUPABASE.publicKey);`;
    // route(): language routing, redirects, then the render tree of a page request
    const routeParams = `\n  request: NextRequest${sessionParam}${hasSession ? ',\n  personal: boolean' : ''}\n`;
    const redirects = (path, language) =>
      `${
        hasAuth
          ? `
  const redirect = authRedirect(request, ${sessionArg}${path}${language});
  if (redirect) return redirect;
`
          : ''
      }${
        hasSignedIn
          ? `
  const signedIn = signedInRedirect(request, ${sessionArg}${path}${language});
  if (signedIn) return signedIn;
`
          : ''
      }`;
    const personalRewrite = (page, path) =>
      hasSession
        ? `
  // Auth cookie: rendered per request with the visitor's cookies${hasAuth ? `. Protected pages
  // have no cached copy: per request for every visitor` : ''}
  if (personal${hasAuth ? ` || isProtectedRoute(${path})` : ''}) {${page === 'pathname' ? '' : `
    const page = ${page};`}
    return NextResponse.rewrite(new URL(sessionPath(${page === 'pathname' ? 'pathname' : 'page'}) + search, request.url), { request });
  }`
        : '';

    let routeFn;
    if (multilingual) {
      routeFn = `
/** Language routing, redirects and render tree of a page request. */
function route(${routeParams}): NextResponse {
  const { pathname, search } = request.nextUrl;
  const decision = resolveLanguageRoute(
    pathname,
    {
      stored: readCookieValue(request.headers.get('cookie'), LANGUAGE_COOKIE),
      preferred: parseAcceptLanguage(request.headers.get('accept-language')),
    },
    LANGUAGE_ROUTING
  );
  if (!pageRoutes.some((pattern) => pattern.test(decision.path))) {
    // Not a page (API route, hand-written route, unknown URL): an unknown URL's 404
    // renders in the URL's language
    const url = splitLanguagePath(pathname, LANGUAGE_ROUTING);
    request.headers.set(LANGUAGE_HEADER, url.language);
    // Unprefixed and not a hand-written route: the app/[lang] route would read its first
    // segment as a language. Served as an unknown URL of the default language instead.
    if (!url.prefixed && !APP_ROUTE_SEGMENTS.includes(pathname.split('/')[1] ?? '')) {
      return NextResponse.rewrite(
        new URL('/' + LANGUAGE_ROUTING.defaultLanguage + pathname + search, request.url),
        { request }
      );
    }
    return NextResponse.next({ request });
  }

  // Language redirects set no language cookie (the browser language store does)
  if (decision.type === 'redirect') {
    return NextResponse.redirect(
      new URL(decision.location + search, request.url),
      decision.permanent ? 308 : 307
    );
  }
${redirects('decision.path', ', decision.language')}${personalRewrite("decision.type === 'rewrite' ? decision.destination : pathname", 'decision.path')}
  if (decision.type === 'rewrite') {
    return NextResponse.rewrite(new URL(decision.destination + search, request.url)${hasSession ? ', { request }' : ''});
  }
  return NextResponse.next(${forward});
}
`;
    } else {
      routeFn = `
/** Redirects and render tree of a page request. */
function route(${routeParams}): NextResponse {
  const { ${hasSession ? 'pathname, search' : 'pathname'} } = request.nextUrl;
  if (!pageRoutes.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next({ request });
  }
${redirects('pathname', '')}${personalRewrite('pathname', 'pathname')}
  return NextResponse.next({ request });
}
`;
    }

    let proxyFn;
    if (hasSession) {
      proxyFn = `
export async function proxy(request: NextRequest) {
  if (isSessionTreePath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  // No auth cookie: signed out. Nothing to verify or refresh, no cookie written: the
  // page is served from the cache.
  if (!hasSupabaseSessionCookie(request)) {
    return route(request${hasRedirects ? ', SIGNED_OUT' : ''}, false);
  }

${refresh}
  // Signed in, or cannot tell (Supabase unreachable): per-request render. Signed out
  // (refresh failed, session revoked): the cached page, with the cleared cookies.
  return auth.apply(route(request, ${hasRedirects ? 'auth.session, ' : ''}auth.session?.user !== null));
}
${routeFn}`;
    } else {
      proxyFn = `
export function proxy(request: NextRequest) {
  return route(request);
}
${routeFn}`;
    }

    return `${header}${sessionBlock}${languageBlock}${pageRoutesBlock}${authBlock}${signedInBlock}${proxyFn}
export const config = {
  matcher: [
${matcherLines}
  ],
};
`;
  },

  /**
   * Whether the app keeps its auth session in cookies the server can read:
   * @donotdev/supabase with `createBrowserClient` in src/config/providers.ts.
   *
   * @returns {boolean}
   */
  usesCookieSession() {
    try {
      // readSync parses .json files
      const pkg = this.pathResolver.readSync(
        this.pathResolver.resolveAppPath('package.json')
      );
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (!deps['@donotdev/supabase']) return false;
      const providersPath = this.pathResolver.resolveAppPath(
        'src/config/providers.ts'
      );
      if (!this.pathResolver.pathExists(providersPath)) return false;
      return this.pathResolver
        .readSync(providersPath)
        .includes('createBrowserClient(');
    } catch (error) {
      this.logger.debug(`Cookie session detection failed: ${error.message}`);
      return false;
    }
  },

  /**
   * Remove the generated `middleware.ts` of earlier versions (root or src/): it never
   * parsed, read a cookie no provider sets, and Next 16 replaces it with proxy.ts.
   */
  removeLegacyMiddleware() {
    for (const rel of ['middleware.ts', 'src/middleware.ts']) {
      const file = this.pathResolver.resolveAppPath(rel);
      try {
        if (
          this.pathResolver.pathExists(file) &&
          this.pathResolver
            .readSync(file)
            .startsWith('// Auto-generated middleware by @donotdev/config')
        ) {
          this.pathResolver.removeSync(file);
          this.logger.debug(`Removed legacy generated ${rel}`);
        }
      } catch (error) {
        this.logger.debug(`Could not remove legacy ${rel}: ${error.message}`);
      }
    }
  },
};
