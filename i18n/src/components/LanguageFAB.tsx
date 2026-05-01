'use client';
// packages/core/i18n/src/components/LanguageFAB.tsx

/**
 * @fileoverview Language FAB Component
 * @description Fixed floating language pill (top-end). Dropdown for 3+ languages,
 * direct toggle for 2.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { ChevronDown } from 'lucide-react';
import { useCallback } from 'react';

import { Stack, Tag, Text } from '@donotdev/components';

import { Flag } from '../flags';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguageSelector } from '../utils/languageSelector';
import LanguageDropdown from './LanguageDropdown';

/**
 * Label format for the pill trigger
 * @public
 */
export type LanguageFABFormat = 'code' | 'name' | 'native';

/**
 * Props for LanguageFAB component
 * @public
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LanguageFABProps {
  /** Accessibility label for the pill */
  'aria-label'?: string;

  /** Additional CSS classes */
  className?: string;

  /** Show flag in the pill trigger @default true */
  showFlag?: boolean;

  /** Show flags in the language list @default true */
  showFlags?: boolean;

  /** Pill label format @default 'code' */
  format?: LanguageFABFormat;
}

/** Fixed floating position: top-end, above content */
const fabStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'var(--gap-md)',
  insetInlineEnd: 'var(--gap-md)',
  zIndex: 'var(--z-dropdown)',
};

/**
 * Fixed floating language pill (top-end) with dropdown selector.
 *
 * - **0-1 languages:** Hidden
 * - **2 languages:** Tapping toggles directly
 * - **3+ languages:** Dropdown menu
 *
 * @example
 * ```tsx
 * <LanguageFAB />
 * <LanguageFAB format="native" showFlag={false} />
 * ```
 *
 * @public
 */
const LanguageFAB = ({
  'aria-label': ariaLabel,
  className,
  showFlag = true,
  showFlags = true,
  format = 'code',
}: LanguageFABProps) => {
  const {
    languages,
    currentLanguage,
    changeLanguage,
    isLoading,
    mode,
    otherLanguage,
  } = useLanguageSelector();
  const { t } = useTranslation('dndev');

  // Nothing to switch
  if (mode === 'none') {
    return null;
  }

  const currentLang = languages.find((l) => l.id === currentLanguage);

  /** Get the pill label based on format prop */
  const getPillLabel = () => {
    if (!currentLang) return currentLanguage.toUpperCase();

    switch (format) {
      case 'code':
        return currentLang.id.toUpperCase();
      case 'name':
        return currentLang.name;
      case 'native':
        return currentLang.nativeName;
    }
  };

  /** Handle pill click — toggle for 2 langs */
  const handleToggle = useCallback(async () => {
    if (otherLanguage) {
      await changeLanguage(otherLanguage.id);
    }
  }, [otherLanguage, changeLanguage]);

  const label =
    ariaLabel || t('common.languageSelector.changeLanguage', 'Change language');

  const trigger = (
    <Tag
      interactive
      variant="default"
      onClick={mode === 'toggle' ? handleToggle : undefined}
      disabled={isLoading}
      className={className}
      style={fabStyle}
      aria-label={label}
    >
      <Stack direction="row" align="center" gap="tight">
        {showFlag && currentLang && (
          <Flag
            code={currentLang.flagCode || currentLang.id}
            title={currentLang.name}
          />
        )}
        <Text as="span" level="small">
          {getPillLabel()}
        </Text>
        {mode === 'dropdown' && (
          <ChevronDown
            style={{
              width: 'var(--icon-sm)',
              height: 'var(--icon-sm)',
              opacity: 0.6,
            }}
          />
        )}
      </Stack>
    </Tag>
  );

  // 2 languages: pill is a direct toggle, no menu
  if (mode === 'toggle') {
    return trigger;
  }

  // 3+ languages: dropdown menu
  return (
    <LanguageDropdown
      trigger={trigger}
      showFlags={showFlags}
      contentAlign="end"
    />
  );
};

export default LanguageFAB;
