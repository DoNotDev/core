'use client';
// packages/core/i18n/src/hooks/useTranslation.ts

/**
 * @fileoverview useTranslation hook
 * @description React hook for accessing translation functionality
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { TFunction } from 'i18next';
import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation as useI18NextTranslation } from 'react-i18next';

import { useIsClient } from '@donotdev/hooks';

import { getI18nInstance } from '../instance.vite';
import { getEagerNamespaces } from '../utils/config';

/** Language of the current request (server render + hydration pass). */
const RequestLanguageContext = createContext<string | null>(null);

/**
 * Provides the request language to `useTranslation` for the server render and the
 * client's hydration pass. Rendered by the Next providers with the language resolved
 * from the request (language cookie, Accept-Language); the same props reach the
 * client, so both passes translate identically.
 *
 * @version 0.1.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */
export function RequestLanguageProvider({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  return createElement(
    RequestLanguageContext.Provider,
    { value: language },
    children
  );
}

/**
 * DoNotDev default namespace for core framework translations
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DNDEV_DEFAULT_NAMESPACE = 'dndev';

/**
 * Translation hook result interface
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseTranslationResult {
  /** Translation function with interpolation support */
  t: TFunction;
  /** i18next instance for advanced usage (null during the server render and hydration pass) */
  i18n: any;
  /**
   * Current language, available during the server render too: the request language
   * on the server and the hydration pass, then the live i18next language. Use it for
   * locale-aware formatting (prices, dates) so the first paint is final.
   */
  language: string;
  /** Whether translations are ready for use */
  ready: boolean;
  /** Whether language switching is in progress */
  isLoading: boolean;
  /** Whether i18n system is initializing */
  isInitializing: boolean;
}

/**
 * Primary translation hook for DoNotDev framework
 *
 * **Architecture**: Uses singleton pattern for clean instance management.
 * The singleton handles all initialization, this hook just provides the translation function.
 *
 * **SSR Safety**: The server render and the client's hydration pass translate in the
 * request language (RequestLanguageProvider), from the inline `content` both sides load
 * synchronously. Both passes produce the same text, so the first paint is translated
 * and hydration matches. After hydration the live instance takes over; it starts in the
 * same language (language cookie, see getInitialLanguage).
 *
 * **Performance**: Stable references, minimal re-renders, efficient memoization.
 *
 * @param namespace - Translation namespace (defaults to 'dndev' for framework components)
 * @returns Translation function, i18next instance, and ready state
 *
 * @example
 * ```tsx
 * // Framework components - use default 'dndev' namespace
 * const { t } = useTranslation();
 * return <button>{t('actions.save')}</button>; // → 'Save'
 * ```
 *
 * @example
 * ```tsx
 * // Application components - specify namespace
 * const { t } = useTranslation('products');
 * return <h1>{t('catalog.title')}</h1>; // → 'Product Catalog'
 * ```
 *
 * @example
 * ```tsx
 * // Interpolation and fallbacks
 * const { t } = useTranslation('user');
 * return (
 *   <span>
 *     {t('greeting', { name: 'John', defaultValue: 'Hello {{name}}' })}
 *   </span>
 * ); // → 'Hello John'
 * ```
 *
 * @example
 * ```tsx
 * // Array translations - use indexed access
 * const { t } = useTranslation('features');
 * const benefits = [0, 1, 2]
 *   .map(i => t(`benefits.${i}`))
 *   .filter(text => text && !text.startsWith('['));
 * ```
 *
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useTranslation(
  namespace: string | string[] = DNDEV_DEFAULT_NAMESPACE
): UseTranslationResult {
  // SSR-safe client detection (Next.js requires this, Vite doesn't care)
  const isClient = useIsClient();

  // Get the singleton instance directly
  const instance = getI18nInstance();

  // Use react-i18next with the singleton instance
  const [tRaw, i18n, ready] = useI18NextTranslation(namespace, {
    i18n: instance,
  });

  // Server render and hydration pass: pinned to the request language (same value on
  // both sides, from the provider's props), never the shared instance's live language.
  const requestLanguage = useContext(RequestLanguageContext);
  const tInitial = isClient
    ? null
    : instance.getFixedT(requestLanguage ?? instance.language, namespace);

  // Create SSR-safe translation function
  // Supports: t(key), t(key, options), t(key, defaultValue), t(key, defaultValue, options)
  const t = (
    key: string,
    defaultValueOrOptions?: string | Record<string, any>,
    options?: Record<string, any>
  ) => {
    // Normalize 3-arg signature to options object
    const opts =
      typeof defaultValueOrOptions === 'string'
        ? { ...options, defaultValue: defaultValueOrOptions }
        : defaultValueOrOptions;

    const result = tInitial ? tInitial(key, opts) : tRaw(key, opts);

    // Check if translation was found (i18next returns key when missing)
    if (typeof result === 'string' && result !== key) {
      return result;
    }

    // Translation missing, use fallback or key
    return opts?.defaultValue ?? key;
  };

  return {
    t: t as unknown as TFunction, // Type assertion needed: our wrapper supports more signatures than TFunction
    i18n: isClient ? i18n : null,
    language: isClient ? i18n.language : (requestLanguage ?? instance.language),
    ready: isClient ? ready : false,
    isLoading: isClient ? !ready : false,
    isInitializing: isClient ? !ready : false,
  };
}

/**
 * Convenience hook for DoNotDev framework components
 * Explicitly uses 'dndev' namespace for framework UI elements
 *
 * @returns Translation result scoped to framework namespace
 *
 * @example
 * ```tsx
 * // In framework components
 * const { t } = useDndevTranslation();
 * return <button>{t('buttons.signIn')}</button>;
 * ```
 *
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useDndevTranslation(): UseTranslationResult {
  return useTranslation(DNDEV_DEFAULT_NAMESPACE);
}

/**
 * Hook to check if i18n is ready for use
 * Useful for conditional rendering based on translation readiness
 *
 * @returns boolean indicating if translations are ready
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isReady = useI18nReady();
 *
 *   if (!isReady) {
 *     return <Skeleton />;
 *   }
 *
 *   return <TranslatedContent />;
 * }
 * ```
 *
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useI18nReady(): boolean {
  try {
    const instance = getI18nInstance();
    if (!instance.isInitialized) return false;

    // Language must be set (LanguageDetector runs during init)
    if (!instance.language) return false;

    // Check if all eager namespaces are loaded for current language
    const eagerNamespaces = getEagerNamespaces();
    return eagerNamespaces.every((ns) => instance.hasLoadedNamespace(ns));
  } catch {
    return false;
  }
}

/**
 * Type export for external usage
 * @public
 */
// REMOVED: UseTranslationResult export conflicts with react-i18next
