// packages/core/i18n/src/utils/initialLanguage.ts

/**
 * @fileoverview Initial language of the i18n instance
 * @description The browser starts in the visitor's language from the first frame:
 * language cookie > language persisted by an earlier version (localStorage, before the
 * cookie existed) > browser languages > fallback. The server instance stays on the
 * fallback: server renders use the request language (RequestLanguageProvider), never
 * the shared instance's language.
 *
 * @version 0.1.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */

import {
  getCookie,
  LANGUAGE_COOKIE,
  parseAcceptLanguage,
  readCookieValue,
  resolveLanguage,
} from '@donotdev/utils';

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
 * Language the i18n instance is initialised with.
 *
 * @param languages - Supported language codes
 * @param fallback - App fallback language
 */
export function getInitialLanguage(
  languages: readonly string[],
  fallback: string
): string {
  if (typeof window === 'undefined') return fallback;
  return resolveLanguage({
    supported: languages,
    fallback,
    stored: getCookie(LANGUAGE_COOKIE) ?? persistedLanguage(),
    preferred: navigator.languages ?? [navigator.language],
  });
}

/**
 * Language of a request, from its `Cookie` and `Accept-Language` headers: language
 * cookie > Accept-Language > fallback. Pure on its inputs, so the server render and
 * the client's hydration pass (given the same header values as props) agree.
 *
 * @param cookieHeader - The request's `Cookie` header
 * @param acceptLanguage - The request's `Accept-Language` header
 *
 * @version 0.1.0
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
