'use client';
// packages/core/i18n/src/instance.next.ts

/**
 * @fileoverview i18n instance management - Next.js SSR-safe version
 * @description Creates and manages the i18next instance without browser-only LanguageDetector.
 *
 * This version avoids top-level imports of browser-only modules that break SSR.
 * Language detection is done manually on client-side only.
 *
 * Language switch for lazy namespaces: same pre-load interceptor as Vite version.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import i18next from 'i18next';
// NO LanguageDetector import - causes SSR issues
import type { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { createSingleton, handleError } from '@donotdev/utils';

import { getI18nConfig, getTranslationLoaders } from './utils/config';
import { I18nBackend } from './utils/i18nBackend';

// Global declaration moved to global.d.ts to avoid duplicate declaration errors

/**
 * Detect language manually - SSR-safe
 * Only runs browser detection on client, returns fallback on server
 */
function detectLanguage(
  supportedLanguages: string[],
  fallback: string
): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  // Check localStorage first (user preference)
  try {
    const stored = localStorage.getItem('i18nextLng');
    if (stored && supportedLanguages.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available
  }

  // Check browser language
  try {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && supportedLanguages.includes(browserLang)) {
      return browserLang;
    }
  } catch {
    // navigator not available
  }

  return fallback;
}

/**
 * Creates the i18next instance with all configuration and initialization
 * Uses the framework's singleton pattern for clean instance management
 *
 * SSR-safe: No browser-only module imports at top level
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

  // Add inline content
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

  // Detect initial language - SSR-safe
  const detectedLanguage = detectLanguage(config.languages, config.fallback);

  // Configure - NO LanguageDetector plugin (SSR-unsafe)
  instance.use(backend);
  instance.use(initReactI18next);

  // Initialize with detected/fallback language
  instance.init({
    lng: detectedLanguage, // Set explicitly instead of relying on LanguageDetector
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

  // Pre-load lazy translations before language switch (same as Vite version)
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

  if (config.debug) {
    console.log('[i18n] Initialized (Next.js SSR-safe):', {
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
