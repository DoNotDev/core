// packages/core/utils/src/common/languagePath.ts

/**
 * @fileoverview Language in the URL
 * @description One URL per language: the default language at the root (`/produits`),
 * every other language under its prefix (`/en/produits`). An app with one language has
 * no prefix at all. Shared by the Next proxy (generated `src/proxy.next.ts`), the Next and
 * Vite routing hooks (Link, navigate, useLocation), the SEO head (canonical, hreflang)
 * and the sitemap, so every place reads and writes the same URL. Public URLs (canonical,
 * hreflang, sitemap, llms.txt, JSON-LD) also follow the app's trailing-slash form
 * ({@link formatTrailingSlash}).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import { resolveLanguage } from './requestLanguage';

/**
 * Languages of an app and the one served at the root.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export interface LanguageRouting {
  /** Language codes the app ships */
  languages: readonly string[];
  /** Language served without prefix (the i18n fallback language) */
  defaultLanguage: string;
}

/**
 * A pathname split into its language and the route path behind the prefix.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export interface LanguagePath {
  /** Language of the URL (the default language when unprefixed) */
  language: string;
  /** Route path without the language prefix, always starting with `/` */
  path: string;
  /** Whether the pathname carried a language prefix */
  prefixed: boolean;
}

/**
 * Whether the app has a URL per language (2+ languages). One language ⇒ no prefix.
 *
 * @param languages - Language codes the app ships
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function isMultilingual(languages: readonly string[]): boolean {
  return languages.length > 1;
}

/**
 * URL segment of the internal Next tree that renders pages per request with the
 * visitor's cookies (personalized SSR): first segment with one language, after the
 * language with 2+ (`/fr/${SESSION_RENDER_SEGMENT}/…`). The generated proxy rewrites
 * requests carrying an auth cookie to it and answers 404 on a direct hit; the server
 * render of those pages reads that internal pathname, the browser the public one.
 * Reserved: no app path may use it as its first or second segment. Same value as
 * NEXT_RENDER.sessionSegment in @donotdev/core/config.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export const SESSION_RENDER_SEGMENT = 'dndev-session';

/** Pathname Next gives the root page's prerender output (`next/dist/server/route-modules/route-module.js`). */
const ROOT_PRERENDER_PATH = '/index';

/**
 * Public pathname of a pathname read during a Next server render: drops the internal
 * per-request tree segment, first or after the language (`/dndev-session/produits` →
 * `/produits`, `/en/dndev-session/produits` → `/en/produits`), so the server HTML and
 * the browser's hydration pass compute the same paths, links, canonical and hreflang
 * URLs. Also maps exactly `/index` (`/dndev-session/index` included) to `/`: Next
 * names the root page's prerender output `index` and normalizes only that exact path
 * itself; when Vercel re-renders the cached root, `usePathname()` returns `/index`,
 * which would leak into canonical, hreflang and links (and a hydration mismatch).
 * Deeper paths ending in `index` (`/en/index`, `/apartments/index`) are real routes
 * or slugs and stay unchanged. Any other pathname is returned unchanged.
 *
 * @param pathname - URL pathname
 * @returns The pathname as the browser shows it
 *
 * @version 0.1.1
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function publicPathname(pathname: string): string {
  const segments = pathname.split('/');
  const at = segments.indexOf(SESSION_RENDER_SEGMENT);
  if (at === 1 || at === 2) segments.splice(at, 1);
  const path = segments.join('/') || '/';
  return path === ROOT_PRERENDER_PATH ? '/' : path;
}

/**
 * Route path of a URL pathname: without its trailing slash (`/produits/` → `/produits`,
 * the form of the routes), the root unchanged. Under Next `trailingSlash: true` every page
 * URL ends with `/`, which no route path does.
 *
 * @param pathname - URL pathname
 * @returns The pathname without a trailing slash, `/` for the root
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function stripTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * A page path in the app's public URL form. With `trailingSlash` (Next
 * `trailingSlash: true`) a page path ends with `/` (`/produits` → `/produits/`,
 * `/en` → `/en/`), the URL Next serves: it answers the bare form with a permanent
 * redirect. As Next does, a path whose last segment holds a dot (a file: `/rss.xml`)
 * and the root keep their form. Query and hash are kept (`/search?q=x` →
 * `/search/?q=x`). Without `trailingSlash` the path is returned unchanged.
 * The one place that applies the setting: canonical, hreflang, sitemap, llms.txt and
 * JSON-LD URLs go through it.
 *
 * @param path - App path starting with `/`, optionally with query and hash
 * @param trailingSlash - The app's Next `trailingSlash` setting (false on Vite)
 * @returns The path as the app serves it
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function formatTrailingSlash(path: string, trailingSlash: boolean): string {
  if (!trailingSlash) return path;
  const queryStart = path.search(/[?#]/);
  const pathname = queryStart === -1 ? path : path.slice(0, queryStart);
  const suffix = queryStart === -1 ? '' : path.slice(queryStart);
  if (pathname.endsWith('/')) return path;
  if (pathname.slice(pathname.lastIndexOf('/') + 1).includes('.')) return path;
  return `${pathname}/${suffix}`;
}

/**
 * Split a pathname into its language and route path.
 *
 * @param pathname - URL pathname (`/en/produits`, `/produits`)
 * @param routing - App languages
 * @returns `/en/produits` → `{ language: 'en', path: '/produits', prefixed: true }`;
 * `/produits` → the default language, unprefixed
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function splitLanguagePath(
  pathname: string,
  routing: LanguageRouting
): LanguagePath {
  const unprefixed: LanguagePath = {
    language: routing.defaultLanguage,
    path: pathname,
    prefixed: false,
  };
  if (!isMultilingual(routing.languages)) return unprefixed;

  const end = pathname.indexOf('/', 1);
  const segment = end === -1 ? pathname.slice(1) : pathname.slice(1, end);
  if (!routing.languages.includes(segment)) return unprefixed;

  return {
    language: segment,
    path: end === -1 ? '/' : pathname.slice(end),
    prefixed: true,
  };
}

/**
 * The URL of an app path in a language. Absolute paths only (`/…`): relative paths,
 * hashes, queries and external URLs are returned unchanged. A path that already
 * carries a language prefix keeps that language (an explicit link to another
 * language); `/<default>/x` becomes `/x`.
 *
 * @param path - App path, optionally with query and hash (`/produits?page=2`)
 * @param language - Language to link in
 * @param routing - App languages
 * @returns `/produits` in `en` → `/en/produits`; in the default language → `/produits`
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function localizePath(
  path: string,
  language: string,
  routing: LanguageRouting
): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (!isMultilingual(routing.languages)) return path;

  const queryStart = path.search(/[?#]/);
  const pathname = queryStart === -1 ? path : path.slice(0, queryStart);
  const suffix = queryStart === -1 ? '' : path.slice(queryStart);
  const split = splitLanguagePath(pathname, routing);
  const target = split.prefixed ? split.language : language;

  if (target === routing.defaultLanguage) return `${split.path}${suffix}`;
  return `/${target}${split.path === '/' ? '' : split.path}${suffix}`;
}

/**
 * Absolute public URL of an app path in a language (canonical, `og:url`, JSON-LD):
 * {@link localizePath}, in the app's trailing-slash form ({@link formatTrailingSlash}).
 *
 * @param path - App path (`/produits`)
 * @param language - Language of the URL
 * @param baseUrl - Absolute site URL, no trailing slash
 * @param routing - App languages
 * @param trailingSlash - The app's Next `trailingSlash` setting (false on Vite)
 * @returns `/` in `en` → `https://x/en` (`https://x/en/` with `trailingSlash`)
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function languageUrl(
  path: string,
  language: string,
  baseUrl: string,
  routing: LanguageRouting,
  trailingSlash: boolean
): string {
  return `${baseUrl}${formatTrailingSlash(localizePath(path, language, routing), trailingSlash)}`;
}

/**
 * Absolute public URL of an app path in every language (hreflang alternates, sitemap),
 * each from {@link languageUrl}.
 *
 * @param path - App path without language prefix (`/produits`)
 * @param baseUrl - Absolute site URL, no trailing slash
 * @param routing - App languages
 * @param trailingSlash - The app's Next `trailingSlash` setting (false on Vite)
 * @returns `{ fr: 'https://x/produits', en: 'https://x/en/produits' }`
 *   (`https://x/produits/`… with `trailingSlash`)
 *
 * @version 0.2.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function languageUrls(
  path: string,
  baseUrl: string,
  routing: LanguageRouting,
  trailingSlash: boolean
): Record<string, string> {
  return Object.fromEntries(
    routing.languages.map((language) => [
      language,
      languageUrl(path, language, baseUrl, routing, trailingSlash),
    ])
  );
}

/**
 * How to serve a request for a pathname (Next proxy; Vite on the first load).
 *
 * - `pass`: a prefixed URL of another language, served as is
 * - `rewrite`: an unprefixed URL served internally as `destination` (`/<default>/…`,
 *   the app/[lang] route of the default language); the browser keeps the URL
 * - `redirect`: `/<default>/…` → the unprefixed URL (`permanent`), or a first visit
 *   to an unprefixed URL → the visitor's language
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export type LanguageRouteDecision =
  | { type: 'pass'; language: string; path: string }
  | { type: 'rewrite'; language: string; path: string; destination: string }
  | {
      type: 'redirect';
      language: string;
      path: string;
      location: string;
      permanent: boolean;
    };

/**
 * Decide how to serve a pathname. An unprefixed URL is the default language unless
 * the visitor prefers another one: their language cookie first, then their browser
 * languages (`Accept-Language` / `navigator.languages`). Crawlers send neither, so
 * they always get the default language at the root.
 *
 * Single-language apps always `pass`.
 *
 * @param pathname - Request pathname (no query)
 * @param visitor - Stored language (language cookie) and browser languages
 * @param routing - App languages
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function resolveLanguageRoute(
  pathname: string,
  visitor: { stored?: string | null; preferred?: readonly string[] },
  routing: LanguageRouting
): LanguageRouteDecision {
  const split = splitLanguagePath(pathname, routing);
  if (!isMultilingual(routing.languages)) {
    return { type: 'pass', language: split.language, path: split.path };
  }

  if (split.prefixed) {
    if (split.language === routing.defaultLanguage) {
      return {
        type: 'redirect',
        language: split.language,
        path: split.path,
        location: split.path,
        permanent: true,
      };
    }
    return { type: 'pass', language: split.language, path: split.path };
  }

  const visitorLanguage = resolveLanguage({
    supported: routing.languages,
    fallback: routing.defaultLanguage,
    stored: visitor.stored,
    preferred: visitor.preferred,
  });
  if (visitorLanguage !== routing.defaultLanguage) {
    return {
      type: 'redirect',
      language: visitorLanguage,
      path: split.path,
      location: localizePath(split.path, visitorLanguage, routing),
      permanent: false,
    };
  }

  return {
    type: 'rewrite',
    language: routing.defaultLanguage,
    path: split.path,
    destination: `/${routing.defaultLanguage}${split.path === '/' ? '' : split.path}`,
  };
}
