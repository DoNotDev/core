// packages/core/i18n/src/components/index.ts

/**
 * @fileoverview I18n Components Barrel Exports
 * @description Barrel exports for internationalization components. Provides centralized access to language selector, language FAB, language toggle group, FAQ section, and translated text components.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

export { default as LanguageSelector } from './LanguageSelector';
export type { LanguageSelectorProps } from './LanguageSelector';
export { default as LanguageFAB } from './LanguageFAB';
export type { LanguageFABProps, LanguageFABFormat } from './LanguageFAB';
export { default as LanguageToggleGroup } from './LanguageToggleGroup';
export type {
  LanguageToggleGroupProps,
  ToggleOrientation,
  ToggleSize,
} from './LanguageToggleGroup';
export { default as FAQSection } from './FAQSection';
export type { FAQSectionProps } from './FAQSection';
export * from './TranslatedText';
export {
  Trans,
  TRANS_TAGS,
  type DoNotDevTransProps,
  type TransTag,
} from './Trans';
