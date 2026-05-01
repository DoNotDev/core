// packages/core/i18n/src/index.ts

/**
 * @fileoverview i18n package
 * @description Internationalization utilities and components
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// External API - what framework consumers import
export { useTranslation, useI18nReady } from './hooks/useTranslation';
export { getI18nInstance } from './instance.vite';

// Components (language selectors, translation components, etc.)
export * from './components';

// Utils
export { useLanguageSelector } from './utils/languageSelector';
export { getSupportedLanguages } from './utils/languages';

// Flag component and utilities (bundled from assets)
export { Flag, getFlagCodes, hasFlag } from './flags';

// Country data (derived from languages with country codes)
export { COUNTRIES, getCountries, type CountryData } from './utils/constants';

// Language constants (for testing/debugging)
export { LANGUAGES, type LanguageData } from './utils/constants';
