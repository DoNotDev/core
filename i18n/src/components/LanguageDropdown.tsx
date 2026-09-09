'use client';
// packages/core/i18n/src/components/LanguageDropdown.tsx

/**
 * @fileoverview Internal Language Dropdown Component
 * @description Owns the DropdownMenu rendering for language selection.
 * Used by LanguageFAB and LanguageSelector — not exported publicly.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { DropdownMenu, Stack } from '@donotdev/components';
import type { DropdownMenuItemData } from '@donotdev/components';

import { Flag } from '../flags';
import { useLanguageSelector } from '../utils/languageSelector';

/** @internal */
interface LanguageDropdownProps {
  /** The element that opens the menu */
  trigger: ReactNode;
  /** Show flag icons in items @default true */
  showFlags?: boolean;
  /** Show language names (vs codes) @default true */
  showNames?: boolean;
  /** Menu alignment @default 'start' */
  contentAlign?: 'start' | 'center' | 'end';
  /** Menu width */
  contentWidth?: string;
}

/**
 * Internal dropdown that renders the language menu items.
 * Shared by LanguageFAB (fixed pill) and LanguageSelector (nav button).
 *
 * @internal — not exported from the package
 */
const LanguageDropdown = ({
  trigger,
  showFlags = true,
  showNames = true,
  contentAlign,
  contentWidth,
}: LanguageDropdownProps) => {
  const { languages, currentLanguage, changeLanguage, isLoading } =
    useLanguageSelector();

  const items: DropdownMenuItemData[] = languages.map((language) => {
    const isActive = language.id === currentLanguage;
    const label = showNames ? language.name : language.id.toUpperCase();

    return {
      label,
      onClick: () => changeLanguage(language.id),
      disabled: isLoading,
      checked: isActive,
      iconEnd: isActive && showFlags ? Check : undefined,
      ...(showFlags && {
        children: (
          <Stack direction="row" align="center" gap="tight">
            <Flag
              code={language.flagCode || language.id}
              title={`${language.name} flag`}
            />
            <span>{label}</span>
          </Stack>
        ),
      }),
    };
  });

  return (
    <DropdownMenu
      trigger={trigger}
      items={items}
      contentAlign={contentAlign}
      contentWidth={contentWidth}
    />
  );
};

export default LanguageDropdown;
