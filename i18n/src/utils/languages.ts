// packages/core/i18n/src/utils/languages.ts

/**
 * @fileoverview Language Utilities
 * @description Utilities for working with languages. Provides functions to get supported languages with flags and native names, check language support, and get language information.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import {
  getSupportedLanguageCodes as getConfigLanguages,
  getFallbackLanguage,
} from './config';
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageData } from './constants';

/**
 * Language information type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type LanguageInfo = LanguageData;

/**
 * Get supported languages with flags and native names
 *
 * Returns an array of language objects with id, name, flag emoji,
 * and native name. Only includes languages that are enabled in config.
 *
 * @returns Array of language information objects
 *
 * @example
 * ```tsx
 * const languages = getSupportedLanguages();
 * // Returns: [{ id: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' }, ...]
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getSupportedLanguages(): LanguageInfo[] {
  const discovered = getConfigLanguages();

  if (discovered.length === 0) {
    // Return default language from the main array
    const defaultLang = LANGUAGES.find((lang) => lang.id === DEFAULT_LANGUAGE);
    return defaultLang ? [defaultLang] : LANGUAGES.slice(0, 1);
  }

  // Filter the main array to only include enabled languages
  // Preserve the original order from LANGUAGES array
  return LANGUAGES.filter((lang) => discovered.includes(lang.id));
}

/**
 * Check if a language is supported
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isLanguageSupported(code: string): boolean {
  const languages = getConfigLanguages();
  return languages.includes(code);
}

/**
 * Get browser language preference
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getBrowserLanguage(): string {
  if (typeof navigator === 'undefined') {
    return getFallbackLanguage();
  }

  const supportedLanguages = getConfigLanguages();
  const browserLanguages = navigator.languages || [navigator.language];

  for (const browserLang of browserLanguages) {
    if (supportedLanguages.includes(browserLang)) {
      return browserLang;
    }

    const langPart = browserLang.split('-')[0];
    if (langPart && supportedLanguages.includes(langPart)) {
      return langPart;
    }
  }

  return getFallbackLanguage();
}

/**
 * Get language name by code
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getLanguageName(code: string): string {
  const language = LANGUAGES.find((lang) => lang.id === code);
  return language?.name || code;
}
