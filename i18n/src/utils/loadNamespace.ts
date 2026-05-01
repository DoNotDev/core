// packages/core/i18n/src/utils/loadNamespace.ts

/**
 * @fileoverview Namespace Loading Utilities
 * @description Utilities for loading i18n namespaces. Provides function to load translation namespaces with error handling and caching support.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Load a namespace
 *
 * @param namespace - Namespace to load
 * @param language - Language to load
 * @returns Promise that resolves when the namespace is loaded
 */
import { getI18nInstance } from '../instance.vite';

export async function loadNamespace(
  namespace: string,
  language: string
): Promise<boolean> {
  try {
    const i18n = getI18nInstance();

    // Skip if already loaded
    if (i18n.hasResourceBundle(language, namespace)) {
      return true;
    }

    // Try to load from backend
    await i18n.loadNamespaces(namespace);

    return i18n.hasResourceBundle(language, namespace);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[i18n] Failed to load namespace: ${namespace}/${language}`,
        e
      );
    }
    return false;
  }
}
