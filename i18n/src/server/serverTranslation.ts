// packages/core/i18n/src/server/serverTranslation.ts

/**
 * @fileoverview Server-component translation (React Server Components only)
 * @description `useTranslation` for server components, published as
 * `@donotdev/core/rsc` (resolves only under the `react-server` condition).
 *
 * - Own i18next instance, never the shared client instance
 *   (`globalThis.__DNDEV_I18N_INSTANCE__`): it is created here, holds no live
 *   language and is never switched, so concurrent requests cannot affect each other.
 * - Reads the existing translation resources as they are: the inline `content` that
 *   the generated `dndev-config-i18n.js` puts on `globalThis._DNDEV_CONFIG_.i18n`
 *   (the same object the client instance reads).
 * - Language: passed explicitly, or set once per request with
 *   {@link setRequestLanguage} (request-scoped through `React.cache`).
 * - Same `t` semantics as the client hook (3-argument form, missing key →
 *   `defaultValue`, else the key), so server and client produce the same strings.
 *
 * No React hook, context or client module is imported: the module loads in the RSC
 * graph. It reads `globalThis` directly because `getDndevConfig` lives in the client
 * utils barrel, which the RSC graph cannot load.
 *
 * @version 0.1.0
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */

import i18next from 'i18next';
import type { i18n, Resource, TFunction, TOptions } from 'i18next';
import { cache } from 'react';

import type { I18nPluginConfig } from '@donotdev/types';

import type { UseTranslationResult } from '../hooks/useTranslation';

/**
 * Default namespace, same value as the client hook's `DNDEV_DEFAULT_NAMESPACE`. Not
 * imported from it: that module is `'use client'`, so in the RSC graph its values
 * are client references.
 */
const DEFAULT_NAMESPACE = 'dndev';

/** Options of the server {@link useTranslation}. */
export interface ServerTranslationOptions {
  /** Language to translate in. Default: the one set by {@link setRequestLanguage}. */
  language?: string;
}

/** One server instance per i18n config object (the generated config is one object). */
const instances = new WeakMap<I18nPluginConfig, i18n>();

/** Request-scoped language holder (one per server request through `React.cache`). */
const requestLanguage = cache((): { current: string | null } => ({
  current: null,
}));

/**
 * The i18n config the generated `dndev-config-i18n.js` registered.
 *
 * @throws When no i18n config is loaded in this server graph
 */
function readI18nConfig(): I18nPluginConfig {
  const config = globalThis._DNDEV_CONFIG_?.i18n;
  if (!config) {
    throw new Error(
      '[i18n] Server useTranslation: no i18n config is loaded in this server graph. Import the generated src/config/dndev-config-i18n.js before rendering server components.'
    );
  }
  return config;
}

/**
 * Server i18next instance for `config`: created once, initialised synchronously from
 * the inline `content` (same resources and options as the client instance, without
 * the lazy backend and the React binding).
 *
 * @param config - i18n config registered by the generated config module
 */
function getServerI18n(config: I18nPluginConfig): i18n {
  const existing = instances.get(config);
  if (existing) return existing;

  const resources: Resource = {};
  for (const lang of config.languages) resources[lang] = {};
  for (const [namespace, langs] of Object.entries(config.content ?? {})) {
    for (const [lang, content] of Object.entries(langs)) {
      if (!resources[lang]) resources[lang] = {};
      resources[lang][namespace] = content;
    }
  }

  const instance = i18next.createInstance();
  instance.init({
    lng: config.fallback,
    fallbackLng: config.fallback,
    supportedLngs: config.languages,
    ns: config.eager,
    defaultNS: DEFAULT_NAMESPACE,
    resources,
    interpolation: { escapeValue: false },
    initAsync: false,
    debug: false,
  });
  instances.set(config, instance);
  return instance;
}

/**
 * Sets the language of the current server request, read by every later
 * {@link useTranslation} call of the same request that passes no `language`.
 * Call it at the top of the server page or layout, before rendering children.
 * Outside a server request (`React.cache` has no request scope) it has no effect.
 *
 * @param language - Supported language code (the URL's language)
 * @throws When `language` is not a configured language
 *
 * @example
 * ```tsx
 * export default async function Page({ params }) {
 *   const { lang } = await params;
 *   setRequestLanguage(lang);
 *   return <Content />;
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */
export function setRequestLanguage(language: string): void {
  assertSupported(readI18nConfig(), language);
  requestLanguage().current = language;
}

/**
 * @param config - i18n config
 * @param language - Language to check
 * @throws When `language` is not in `config.languages`
 */
function assertSupported(config: I18nPluginConfig, language: string): void {
  if (!config.languages.includes(language)) {
    throw new Error(
      `[i18n] Server useTranslation: "${language}" is not a configured language (${config.languages.join(', ')}).`
    );
  }
}

/**
 * Translation for React Server Components: same call and result shape as the client
 * `useTranslation` from `@donotdev/core`, rendered once on the server.
 *
 * Not a React hook (no state, no context): callable in any server component, sync
 * or async. `ready` is `true` (resources are inline), `i18n` is `null` (the instance
 * is internal), `language` is the language translated in.
 *
 * @param namespace - Namespace(s), default `'dndev'`
 * @param options - `language` overrides the request language
 * @returns `{ t, i18n: null, language, ready: true, isLoading: false, isInitializing: false }`
 * @throws When no i18n config is loaded, no language is known (none passed, none set
 *   for the request) or the language is not configured
 *
 * @example
 * ```tsx
 * import { useTranslation } from '@donotdev/core/rsc';
 *
 * export function Title() {
 *   const { t } = useTranslation('home');
 *   return <h1>{t('hero.title')}</h1>;
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */
export function useTranslation(
  namespace: string | string[] = DEFAULT_NAMESPACE,
  options: ServerTranslationOptions = {}
): UseTranslationResult {
  const config = readI18nConfig();
  const language = options.language ?? requestLanguage().current;
  if (!language) {
    throw new Error(
      '[i18n] Server useTranslation: no language. Pass { language } or call setRequestLanguage(lang) earlier in the same request.'
    );
  }
  assertSupported(config, language);

  const fixedT = getServerI18n(config).getFixedT(language, namespace);

  // Same contract as the client hook: t(key), t(key, options), t(key, defaultValue),
  // t(key, defaultValue, options); a missing key gives defaultValue, else the key
  const t = (
    key: string,
    defaultValueOrOptions?: string | TOptions,
    tOptions?: TOptions
  ) => {
    const opts =
      typeof defaultValueOrOptions === 'string'
        ? { ...tOptions, defaultValue: defaultValueOrOptions }
        : defaultValueOrOptions;
    const result = fixedT(key, opts);
    if (typeof result === 'string' && result !== key) return result;
    return opts?.defaultValue ?? key;
  };

  return {
    t: t as unknown as TFunction, // Same cast as the client hook: the wrapper accepts more signatures than TFunction
    i18n: null,
    language,
    ready: true,
    isLoading: false,
    isInitializing: false,
  };
}
