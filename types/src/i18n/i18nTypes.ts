// packages/core/types/src/i18n/i18nTypes.ts

/**
 * @fileoverview I18n Types
 * @description Type definitions for internationalization. Defines entity translations, i18n configuration types, and translation-related interfaces.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ReactNode } from 'react';

import type { InitOptions } from 'i18next';
import type { useTranslation } from 'react-i18next';

/**
 * Entity translation interface
 * Maps entity field names to their translated labels and hints
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EntityTranslations {
  /** Translated field labels */
  fields: Record<string, string>;

  /** Translated field hints/descriptions */
  hints: Record<string, string>;

  /** Translated validation error messages */
  validations?: Record<string, string>;

  /** Translated placeholder text */
  placeholders?: Record<string, string>;
}

/**
 * Common translation interface for shared UI elements
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CommonTranslations {
  /** Action button translations */
  actions: {
    create: string;
    update: string;
    delete: string;
    cancel: string;
    confirm: string;
  };

  /** Error message translations */
  errors: Record<string, string>;

  /** Common label translations */
  labels: Record<string, string>;
}

/**
 * Translation options interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TranslationOptions {
  /** Language code (e.g., 'en', 'fr') */
  lng: string;

  /** Optional namespace array */
  ns?: string[];

  /** Fallback language code */
  fallbackLng?: string;
}

/**
 * Supported language codes
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type SupportedLanguage = string;

/**
 * Interface for language information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LanguageInfo {
  /** ISO 639-1 language code (e.g., 'en', 'fr') */
  code: string;

  /** Native name of the language (e.g., 'English', 'Français') */
  name: string;
}

/**
 * Language data type — single source of truth for language metadata.
 * Used by i18n constants, language store, and language selector components.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LanguageData {
  /** BCP-47 language code (e.g., 'en', 'fr', 'ar-ma') */
  id: string;
  /** English display name */
  name: string;
  /** Native script display name */
  nativeName: string;
  /** Override flag code when it differs from the language id */
  flagCode?: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode?: string;
  /** International dialing code (e.g., '+33') */
  dialCode?: string;
  /** Human-readable country name for display labels */
  countryName?: string;
}

/**
 * Interface for configurations to initialize the i18n system
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface I18nConfig {
  /** Patterns for eager namespaces */
  eagerPatterns: string[];

  /** Patterns for lazy namespaces */
  lazyPatterns: string[];

  /** App namespace patterns (eagerly loaded) */
  eagerNamespaces: string[];

  /** Custom namespace patterns for arbitrary use cases (lazily loaded) */
  lazyNamespaces: string[];

  /** Performance options */
  performance: {
    /** Maximum number of translations to keep in memory cache */
    cacheSize: number;

    /** Time to live for cached errors in milliseconds */
    errorCacheTTL: number;

    /** Timeout for loading operations in milliseconds */
    loadTimeout: number;
  };

  /** Language options */
  languages: {
    /** List of supported language codes */
    supported: string[];

    /** Default language code */
    default: string;

    /** Fallback language code */
    fallback: string;
  };

  /** Debug mode flag */
  debug: boolean;

  /** Protocol name for virtual loader (default: 'virtual') */
  virtualProtocol: string;

  /** Additional i18next initialization options */
  i18nextOptions: Partial<InitOptions>;

  /** Force production mode */
  forceProduction: boolean;

  /** Force development mode */
  forceDevelopment: boolean;
}

/**
 * Interface representing the structure of a translations resource
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TranslationResource {
  /** Language code (e.g., 'en', 'fr') */
  [language: string]: {
    /** Namespace (e.g., 'common', 'auth') */
    [namespace: string]: Record<string, any>;
  };
}

/**
 * Enhanced options for useTranslation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type UseTranslationOptionsEnhanced<KPrefix> = Parameters<
  typeof useTranslation
>[1] & {
  /** Whether this namespace is an app namespace */
  appNamespace?: boolean;
};

/**
 * Props for the I18nProvider component
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface I18nProviderProps {
  /** Child components to render */
  children: ReactNode;

  /** Initial configuration */
  config?: Partial<I18nConfig>;

  /** Initial language to use */
  fallbackLng?: string;

  /** Pre-initialized i18n instance */
  i18n?: any;

  /** Optional callback when i18n initialization completes */
  onInitialized?: (i18n: any) => void;

  /** Health monitoring flag (defaults to true) */
  healthMonitoring?: boolean;

  /** Loading component to display while initializing */
  loadingComponent?: ReactNode;

  /** Error component to display if initialization fails */
  errorComponent?: ReactNode;
}

/**
 * Information about a cached error
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CachedError {
  /** The error object */
  error: Error;

  /** Timestamp when the error occurred */
  timestamp: number;
}

/**
 * Custom read callback for i18next backend
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ReadCallback = (err: any, data: any) => void;
