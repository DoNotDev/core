'use client';
// packages/core/i18n/src/utils/languageSelector.ts

/**
 * @fileoverview Language selector utility
 * @description Language selector utility hook for managing language selection.
 * Reads from the zustand language store when ready, falls back to i18next direct access otherwise.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { isRTLLanguage } from '@donotdev/components';
import { useLanguageStore } from '@donotdev/stores';
import type { LanguageData } from '@donotdev/types';
import {
  isMultilingual,
  LANGUAGE_COOKIE,
  localizePath,
  setCookie,
  splitLanguagePath,
} from '@donotdev/utils';

import { useTranslation } from '../hooks/useTranslation';
import { getI18nInstance } from '../instance.vite';
import { getLanguageRouting } from './initialLanguage';
import { useLanguageNavigate } from './languageNavigation';
import type { LanguageNavigate } from './languageNavigation';
import { getSupportedLanguages } from './languages';

/**
 * Open the current page in another language: its URL (`/en/…`, the root for the
 * default language). Records the choice in the language cookie first, so the proxy
 * (Next) or the first-visit step (Vite) does not send the visitor back. Client-side
 * through the platform router (LanguageNavigationProvider): the page re-renders in
 * that language, no document reload.
 */
function openInLanguage(lng: string, navigate: LanguageNavigate): void {
  const routing = getLanguageRouting();
  const { path } = splitLanguagePath(window.location.pathname, routing);
  setCookie(LANGUAGE_COOKIE, lng, { sameSite: 'lax' });
  navigate(
    `${localizePath(path, lng, routing)}${window.location.search}${window.location.hash}`,
    lng
  );
}

/**
 * Language selector utility hook
 *
 * Provides shared logic for all language selector components including
 * language list, current language detection, language switching, and
 * loading state management.
 *
 * Uses the zustand language store when initialized, with transparent
 * fallback to direct i18next access for resilience.
 *
 * @returns Language selector state and actions
 *
 * @example
 * ```tsx
 * const { languages, currentLanguage, changeLanguage, isLoading } = useLanguageSelector();
 *
 * return (
 *   <select onChange={(e) => changeLanguage(e.target.value)}>
 *     {languages.map(lang => (
 *       <option key={lang.code} value={lang.code}>
 *         {lang.name}
 *       </option>
 *     ))}
 *   </select>
 * );
 * ```
 *
 * @public
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useLanguageSelector() {
  const storeReady = useLanguageStore((s) => s.isReady);
  const storeLanguage = useLanguageStore((s) => s.currentLanguage);
  const storeLanguages = useLanguageStore((s) => s.availableLanguages);
  const storeLoading = useLanguageStore((s) => s.isLoading);

  // Fallback: direct i18next access (always called — hooks can't be conditional)
  const { i18n, ready: i18nReady } = useTranslation('dndev');

  // Resolve current language: store when ready, i18next otherwise
  const currentLanguage = storeReady
    ? storeLanguage
    : i18nReady
      ? i18n?.language || 'en'
      : 'en';

  // Use store languages if populated, otherwise fall back to config
  const languages: LanguageData[] =
    storeLanguages.length > 0 ? storeLanguages : getSupportedLanguages();

  const isLoading = storeReady ? storeLoading : false;
  const navigateToLanguage = useLanguageNavigate();

  /**
   * Change the current language
   *
   * With 2+ languages every language has its own URL: navigates (client-side) to the
   * current page's URL in `lng`. One language: changes it in place through the language
   * store (i18next sync, DOM attributes, persistence), or i18next directly while
   * the store is not ready.
   *
   * @param lng - Language code to switch to
   * @returns Promise that resolves when language change is complete
   */
  const changeLanguage = async (lng: string): Promise<void> => {
    if (
      typeof window !== 'undefined' &&
      isMultilingual(getLanguageRouting().languages)
    ) {
      openInLanguage(lng, navigateToLanguage);
      return;
    }

    const store = useLanguageStore.getState();

    if (store.isReady) {
      // Store is initialized — delegates to i18next + DOM + persist
      await store.setLanguage(lng);
    } else {
      // Fallback: direct i18next access (before store initializes)
      const instance = getI18nInstance();
      await instance.changeLanguage(lng);

      if (typeof document !== 'undefined') {
        document.documentElement.lang = lng;
        document.documentElement.dir = isRTLLanguage(lng) ? 'rtl' : 'ltr';
      }
    }
  };

  // Determine selector mode based on language count
  const mode =
    languages.length <= 1
      ? 'none'
      : languages.length === 2
        ? 'toggle'
        : 'dropdown';

  // For toggle mode: the language to switch to
  const otherLanguage =
    mode === 'toggle'
      ? (languages.find((l) => l.id !== currentLanguage) ?? null)
      : null;

  return {
    /** Array of supported languages with code, name, flag, and native name */
    languages,
    /** Current active language code */
    currentLanguage,
    /** Function to change the current language */
    changeLanguage,
    /** Whether a language change is in progress */
    isLoading,
    /** Selector mode: 'none' (0-1 langs), 'toggle' (2 langs), 'dropdown' (3+ langs) */
    mode,
    /** For toggle mode: the inactive language to switch to */
    otherLanguage,
  };
}
