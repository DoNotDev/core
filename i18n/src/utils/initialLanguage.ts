// packages/core/i18n/src/utils/initialLanguage.ts

/**
 * @fileoverview Language of a render
 * @description The URL carries the language: the default language at the root, every
 * other language under its prefix (`/en/…`, see languagePath in @donotdev/utils). The
 * browser instance starts in the URL's language; with 2+ languages server renders take
 * it from the URL too (RequestLanguageProvider in NextJsAppProviders). The language
 * cookie and the browser languages pick the visitor's language on a first visit to an
 * unprefixed URL (Next: generated proxy.ts; Vite:
 * applyFirstVisitLanguage before the router starts).
 *
 * @version 0.2.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */

import {
  getCookie,
  LANGUAGE_COOKIE,
  parseAcceptLanguage,
  readCookieValue,
  resolveLanguage,
  resolveLanguageRoute,
  splitLanguagePath,
} from '@donotdev/utils';
import type { LanguageRouting } from '@donotdev/utils';

import { getI18nConfig } from './config';

/** zustand persist key of the language store (stores/templates/languageStore). */
const PERSISTED_LANGUAGE_KEY = 'dndev-language-store';

function persistedLanguage(): string | null {
  try {
    const raw = localStorage.getItem(PERSISTED_LANGUAGE_KEY);
    if (!raw) return null;
    const lng = JSON.parse(raw)?.state?.currentLanguage;
    return typeof lng === 'string' ? lng : null;
  } catch {
    return null;
  }
}

/**
 * The app's languages and the one served at the root (the i18n fallback language).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function getLanguageRouting(): LanguageRouting {
  const config = getI18nConfig();
  return { languages: config.languages, defaultLanguage: config.fallback };
}

/**
 * Language of a URL pathname: its prefix, else the default language.
 *
 * @param pathname - URL pathname (`/en/produits` → `en`)
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function getUrlLanguage(pathname: string): string {
  return splitLanguagePath(pathname, getLanguageRouting()).language;
}

/**
 * Language the i18n instance is initialised with: the URL's language in the browser,
 * the fallback on the server (server renders use RequestLanguageProvider).
 *
 * @param languages - Supported language codes
 * @param fallback - App fallback language (served at the root)
 *
 * @version 0.2.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */
export function getInitialLanguage(
  languages: readonly string[],
  fallback: string
): string {
  if (typeof window === 'undefined') return fallback;
  return splitLanguagePath(window.location.pathname, {
    languages,
    defaultLanguage: fallback,
  }).language;
}

/**
 * Vite (no server): on a first visit to an unprefixed URL, move to the visitor's
 * language before the router and the i18n instance read the URL. Same rule as the
 * Next proxy (language cookie, then browser languages); `/<default>/…` drops its
 * prefix. Replaces the history entry, no reload. No-op on the server and in
 * one-language apps.
 *
 * @param languages - Supported language codes
 * @param fallback - App fallback language (served at the root)
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function applyFirstVisitLanguage(
  languages: readonly string[],
  fallback: string
): void {
  if (typeof window === 'undefined') return;
  const decision = resolveLanguageRoute(
    window.location.pathname,
    {
      stored: getCookie(LANGUAGE_COOKIE) ?? persistedLanguage(),
      preferred: navigator.languages ?? [navigator.language],
    },
    { languages, defaultLanguage: fallback }
  );
  if (decision.type !== 'redirect') return;
  window.history.replaceState(
    window.history.state,
    '',
    `${decision.location}${window.location.search}${window.location.hash}`
  );
}

/**
 * Visitor language of a request, from its `Cookie` and `Accept-Language` headers:
 * language cookie > Accept-Language > fallback. Picks the language of a first visit
 * only (where to redirect an unprefixed URL); renders take the language from the URL.
 *
 * @param cookieHeader - The request's `Cookie` header
 * @param acceptLanguage - The request's `Accept-Language` header
 *
 * @version 0.2.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */
export function getRequestLanguage(
  cookieHeader: string | null | undefined,
  acceptLanguage: string | null | undefined
): string {
  const config = getI18nConfig();
  return resolveLanguage({
    supported: config.languages,
    fallback: config.fallback,
    stored: readCookieValue(cookieHeader, LANGUAGE_COOKIE),
    preferred: parseAcceptLanguage(acceptLanguage),
  });
}
