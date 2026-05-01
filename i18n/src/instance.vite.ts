'use client';
// packages/core/i18n/src/instance.vite.ts

/**
 * @fileoverview i18n instance management
 * @description Creates and manages the i18next instance with configuration.
 *
 * Language switch for lazy namespaces: `changeLanguage` is intercepted to pre-load
 * ALL lazy namespace translations for the target language BEFORE the actual switch.
 * This avoids the async gap where react-i18next v16 doesn't reliably re-render
 * when the backend's async load completes after `languageChanged` fires.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { createSingleton, handleError } from '@donotdev/utils';

import { I18nBackend } from './utils/i18nBackend';
import { getI18nConfig, getTranslationLoaders } from './utils/config';
import type { i18n } from 'i18next';

// Global declaration moved to global.d.ts to avoid duplicate declaration errors

/**
 * Creates the i18next instance with all configuration and initialization
 * Uses the framework's singleton pattern for clean instance management
 *
 * HMR-safe: Store instance globally to survive module reloads
 */
const getI18nInstance = createSingleton((): i18n => {
  // Check if instance already exists globally (HMR safety)
  if (typeof globalThis !== 'undefined') {
    const existing = (globalThis as any).__DNDEV_I18N_INSTANCE__;
    if (existing) {
      return existing;
    }
  }
  const instance = i18next.createInstance();

  // Get configuration
  const config = getI18nConfig();

  // Single backend — replaces PatternBackend + PatternBasedLoader + TranslationCache
  const backend = new I18nBackend();

  // Prepare resources
  const resources: Record<string, Record<string, any>> = {};
  config.languages.forEach((lang: string) => {
    resources[lang] = {};
  });

  // Add inline content (eager namespaces — all namespaces in dev mode)
  const translationContent = config.content;
  if (translationContent) {
    Object.entries(translationContent).forEach(
      ([namespace, langs]: [string, any]) => {
        Object.entries(langs).forEach(([lang, content]: [string, any]) => {
          if (!resources[lang]) resources[lang] = {};
          resources[lang][namespace] = content;
        });
      }
    );
  }

  // Configure plugins — Backend MUST be registered via .use() before init
  instance.use(backend);
  instance.use(initReactI18next);

  // Initialize with all resources synchronously
  // lng set explicitly — language store handles user override from localStorage
  instance.init({
    lng: config.fallback,
    fallbackLng: config.fallback,
    supportedLngs: config.languages,
    ns: config.eager,
    defaultNS: 'dndev',
    resources,
    partialBundledLanguages: true, // Backend loads lazy namespaces not in resources
    interpolation: { escapeValue: false },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
    debug: config.debug,
  });

  // Pre-load lazy translations before language switch
  // react-i18next v16 doesn't reliably re-render when the backend loads
  // translations async after languageChanged fires. By pre-loading all lazy
  // namespace translations BEFORE changeLanguage, they're in resources when
  // React re-renders — no async gap, instant language switch.
  const originalChangeLanguage = instance.changeLanguage.bind(instance);
  instance.changeLanguage = async (lng: string, ...args: any[]) => {
    const loaders = getTranslationLoaders();
    await Promise.all(
      Object.entries(loaders).map(([ns, langs]) => {
        const loader = (langs as Record<string, () => Promise<any>>)?.[lng];
        if (loader && typeof loader === 'function') {
          return loader()
            .then((m: any) =>
              instance.addResourceBundle(lng, ns, m.default || m, true, true)
            )
            .catch((err: unknown) => {
              handleError(err, {
                userMessage: `Failed to load namespace "${ns}" for language "${lng}"`,
                severity: 'warning',
                showNotification: false,
              });
            });
        }
        return Promise.resolve();
      })
    );
    return originalChangeLanguage(lng, ...args);
  };

  // Language preference restoration is handled by the language zustand store
  // (dndev-language-store persist + initialize sync)

  if (config.debug) {
    console.log('[i18n] Initialized:', {
      language: instance.language,
      namespaces: config.eager,
      languages: config.languages,
    });
  }

  // Store globally for HMR safety
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__DNDEV_I18N_INSTANCE__ = instance;
  }

  return instance;
});

/**
 * Get the i18next instance
 * First call initializes the instance automatically
 * Subsequent calls return the same initialized instance
 */
export { getI18nInstance };
