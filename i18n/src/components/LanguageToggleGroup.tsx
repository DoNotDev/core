'use client';
// packages/core/i18n/src/components/LanguageToggleGroup.tsx

/**
 * @fileoverview Language Toggle Group Component
 * @description Inline segmented toggle buttons for language selection with flag icons.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { Button, Spinner, Stack } from '@donotdev/components';

import { Flag } from '../flags';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguageSelector } from '../utils/languageSelector';

/**
 * Orientation for the toggle group
 * @public
 */
export type ToggleOrientation = 'horizontal' | 'vertical';

/**
 * Size variants for the toggle group
 * @public
 */
export type ToggleSize = 'sm' | 'md' | 'lg';

/**
 * Props for LanguageToggleGroup component
 *
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LanguageToggleGroupProps {
  /** Array of language codes to display */
  languages?: string[];

  /** Orientation of the toggle group */
  orientation?: ToggleOrientation;

  /** Size variant */
  size?: ToggleSize;

  /** Whether to show flag icons */
  showFlags?: boolean;

  /** Whether to show language names or just codes */
  showNames?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Whether to show loading state */
  showLoading?: boolean;

  /** Custom variant for the toggle buttons */
  variant?: 'primary' | 'outline' | 'ghost';
}

/**
 * Inline segmented toggle buttons for language selection.
 *
 * Compact button group — each language gets a button, active one is highlighted.
 * For mobile-first bottom sheet selection, use `LanguageFAB` instead.
 *
 * @example
 * ```tsx
 * // Basic horizontal toggle
 * <LanguageToggleGroup
 *   languages={['en', 'es', 'fr']}
 *   orientation="horizontal"
 * />
 *
 * // Vertical with flags and names
 * <LanguageToggleGroup
 *   languages={['en', 'es', 'fr', 'de']}
 *   orientation="vertical"
 *   showFlags={true}
 *   showNames={true}
 * />
 *
 * // Compact header style
 * <LanguageToggleGroup
 *   languages={['en', 'es']}
 *   variant="ghost"
 * />
 * ```
 *
 * @public
 */
const LanguageToggleGroup = ({
  languages,
  orientation = 'horizontal',
  size = 'md',
  showFlags = false,
  showNames = true,
  className = '',
  showLoading = true,
  variant = 'ghost',
}: LanguageToggleGroupProps) => {
  const { t } = useTranslation('dndev');
  const {
    languages: allLanguages,
    currentLanguage,
    changeLanguage,
    isLoading,
  } = useLanguageSelector();

  // 0-1 language: don't show toggle
  if (allLanguages.length <= 1) {
    return null;
  }

  // Filter languages if specific ones are provided
  const displayLanguages = languages
    ? allLanguages.filter((lang) => languages.includes(lang.id))
    : allLanguages;

  const getFontSizeStyle = () => {
    if (size === 'sm') return { fontSize: 'var(--font-size-xs)' };
    if (size === 'lg') return { fontSize: 'var(--font-size-base)' };
    return { fontSize: 'var(--font-size-sm)' };
  };

  const handleLanguageSelect = async (languageCode: string) => {
    if (languageCode === currentLanguage || isLoading) {
      return;
    }

    await changeLanguage(languageCode);
  };

  return (
    <Stack
      direction={orientation === 'vertical' ? 'column' : 'row'}
      gap="tight"
      className={className}
      style={{
        padding: 'var(--gap-xs)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--muted)',
      }}
      role="group"
      aria-label={t('common.languageSelector.changeLanguage', {
        defaultValue: 'Language selection',
      })}
    >
      {displayLanguages.map((language) => {
        const isActive = language.id === currentLanguage;

        return (
          <Button
            key={language.id}
            variant={variant}
            onClick={() => handleLanguageSelect(language.id)}
            disabled={isLoading}
            className={
              orientation === 'vertical'
                ? 'dndev-justify-start'
                : 'dndev-justify-center'
            }
            data-active={isActive}
            style={{
              ...(isActive && {
                backgroundColor: 'var(--background)',
                boxShadow: 'var(--shadow-sm)',
              }),
              ...(isLoading && { opacity: 'var(--opacity-muted)' }),
            }}
            aria-pressed={isActive}
            aria-label={`Select ${language.name}`}
          >
            <Stack direction="row" align="center" gap="tight">
              {showFlags && (
                <Flag
                  code={language.flagCode || language.id}
                  title={`${language.name} flag`}
                />
              )}

              {showNames ? (
                <span style={getFontSizeStyle()}>{language.name}</span>
              ) : (
                <span
                  style={{
                    ...getFontSizeStyle(),
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {language.id.toUpperCase()}
                </span>
              )}

              {showLoading && isLoading && isActive && (
                <div style={{ marginInlineStart: 'var(--gap-xs)' }}>
                  <Spinner />
                </div>
              )}
            </Stack>
          </Button>
        );
      })}
    </Stack>
  );
};

export default LanguageToggleGroup;
