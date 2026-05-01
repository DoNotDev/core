'use client';
// packages/core/i18n/src/components/LanguageSelector.tsx

/**
 * @fileoverview LanguageSelector component
 * @description Header/nav language selector with dropdown presentation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { Languages } from 'lucide-react';

import { Button, BUTTON_VARIANT, DISPLAY } from '@donotdev/components';

import { Flag } from '../flags';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguageSelector } from '../utils/languageSelector';
import LanguageDropdown from './LanguageDropdown';

/**
 * Props for LanguageSelector component
 *
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LanguageSelectorProps {
  /**
   * Display - controls language selector presentation in preset layouts
   * - 'compact': Icon-only button (dropdown trigger)
   * - 'full': Flag + language name + ">" (labeled button)
   * - 'auto': Responsive (default)
   * @default 'auto'
   */
  display?: (typeof DISPLAY)[keyof typeof DISPLAY];

  /**
   * Button variant for the language selector trigger.
   * @default 'outline'
   */
  variant?: (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

  /** Whether to show flag icons in the selector */
  showFlags?: boolean;

  /** Whether to show language names or just language codes */
  showNames?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Header/nav language selector with dropdown presentation.
 *
 * Adapts to the number of available languages:
 * - **0-1 languages:** Hidden
 * - **2 languages:** Toggle button (swap on click)
 * - **3+ languages:** Dropdown menu
 *
 * For mobile-first bottom sheet selection, use `LanguageFAB` instead.
 *
 * @example
 * ```tsx
 * // Basic dropdown (compact)
 * <LanguageSelector />
 *
 * // Dropdown with flags and names
 * <LanguageSelector
 *   showFlags={true}
 *   showNames={true}
 *   className="custom-class"
 * />
 * ```
 *
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
const LanguageSelector = ({
  display = DISPLAY.AUTO,
  variant = BUTTON_VARIANT.OUTLINE,
  showFlags = true,
  showNames = true,
  className = '',
}: LanguageSelectorProps) => {
  const { t } = useTranslation('dndev');
  const {
    languages,
    currentLanguage,
    changeLanguage,
    isLoading,
    mode,
    otherLanguage,
  } = useLanguageSelector();

  // 0-1 language: don't show selector
  if (mode === 'none') {
    return null;
  }

  const currentLang = languages.find((lang) => lang.id === currentLanguage);
  const currentLabel = currentLang
    ? showNames
      ? currentLang.nativeName
      : currentLang.id.toUpperCase()
    : '';

  const buttonProps = {
    variant,
    'aria-label': t('common.languageSelector.changeLanguage', {
      defaultValue: 'Change Language',
    }),
    icon: Languages,
    display,
    className,
  };

  // Toggle mode (2 languages): Simple swap button with flag icon
  if (mode === 'toggle' && otherLanguage) {
    const otherLabel = showNames
      ? otherLanguage.nativeName
      : otherLanguage.id.toUpperCase();

    return (
      <Button
        variant={variant}
        onClick={() => changeLanguage(otherLanguage.id)}
        disabled={isLoading}
        display={display}
        className={className}
        aria-label={t('common.languageSelector.changeLanguage', {
          defaultValue: 'Change Language',
        })}
        tooltip={t('common.languageSelector.changeLanguage', {
          defaultValue: 'Change Language',
        })}
        icon={
          showFlags ? (
            <Flag
              code={otherLanguage.flagCode || otherLanguage.id}
              title={`Switch to ${otherLanguage.name}`}
            />
          ) : (
            Languages
          )
        }
      >
        {otherLabel}
      </Button>
    );
  }

  // Dropdown mode — LanguageDropdown owns the menu
  return (
    <LanguageDropdown
      trigger={<Button {...buttonProps}>{currentLabel}</Button>}
      showFlags={showFlags}
      showNames={showNames}
      contentWidth="12rem"
    />
  );
};

export default LanguageSelector;
