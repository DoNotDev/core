/**
 * @fileoverview Translation Reader Utility
 * @description Reads translation JSON files at build/runtime for metadata generation
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from '../../utils/PathResolver.js';

/**
 * Read translation file for given namespace and locale
 *
 * @param {string} namespace - Translation namespace (e.g., 'home', 'transformation')
 * @param {string} locale - Locale code (e.g., 'en', 'fr')
 * @param {Object} i18nConfig - I18n config with mapping and content
 * @param {PathResolver} pathResolver - Path resolver instance
 * @returns {Object|null} Translation object or null if not found
 */
export function readTranslation(namespace, locale, i18nConfig, pathResolver) {
  try {
    // First try inline content (available at build time)
    if (i18nConfig?.content?.[namespace]?.[locale]) {
      return i18nConfig.content[namespace][locale];
    }

    // Fallback to reading from file mapping
    const mapping = i18nConfig?.mapping?.[namespace]?.[locale];
    if (!mapping) {
      return null;
    }

    // Resolve file path relative to app root
    const filePath = pathResolver.resolveAppPath(mapping);

    // Read and parse JSON file
    const fileContent = pathResolver.readSync(filePath, { format: 'text' });
    if (!fileContent) return null;
    return JSON.parse(fileContent);
  } catch (error) {
    // Gracefully handle missing translations
    return null;
  }
}

/**
 * Get translation value by key path
 *
 * @param {Object} translation - Translation object
 * @param {string} keyPath - Dot-separated key path (e.g., 'hero.title', 'meta.author')
 * @returns {string|Object|undefined} Translation value or undefined
 */
export function getTranslationValue(translation, keyPath) {
  if (!translation || !keyPath) return undefined;

  const keys = keyPath.split('.');
  let value = translation;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Get all supported locales from i18n config
 *
 * @param {Object} i18nConfig - I18n config
 * @returns {string[]} Array of locale codes
 */
export function getSupportedLocales(i18nConfig) {
  return i18nConfig?.languages || i18nConfig?.supportedLanguages || ['en'];
}

/**
 * Get fallback locale from i18n config
 *
 * @param {Object} i18nConfig - I18n config
 * @returns {string} Fallback locale code (default: 'en')
 */
export function getFallbackLocale(i18nConfig) {
  return i18nConfig?.fallback || i18nConfig?.fallbackLanguage || 'en';
}
