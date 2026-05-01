'use client';
// packages/core/i18n/src/components/Trans.tsx

/**
 * @fileoverview Rich Text Translation Component
 * @description Wrapper around i18next Trans with predefined styling components.
 * Allows inline styling in translation strings using predefined tags.
 *
 * @example
 * ```json
 * { "hero.title": "<accent>2 weeks</accent> to ship" }
 * ```
 *
 * ```tsx
 * <Trans ns="kickstart" i18nKey="hero.title" />
 * ```
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */

import { Trans as I18nTrans } from 'react-i18next';

import type { ReactElement } from 'react';
import type { TransProps } from 'react-i18next';

// CSS for Trans components (to override gradient text)
const transStyles = `
  .dndev-trans-accent { color: var(--accent) !important; -webkit-text-fill-color: var(--accent) !important; }
  .dndev-trans-primary { color: var(--primary) !important; -webkit-text-fill-color: var(--primary) !important; }
  .dndev-trans-muted { color: var(--muted-foreground) !important; -webkit-text-fill-color: var(--muted-foreground) !important; }
  .dndev-trans-success { color: var(--success) !important; -webkit-text-fill-color: var(--success) !important; }
  .dndev-trans-warning { color: var(--warning) !important; -webkit-text-fill-color: var(--warning) !important; }
  .dndev-trans-error { color: var(--destructive) !important; -webkit-text-fill-color: var(--destructive) !important; }
`;

// Inject styles if not already present
if (
  typeof document !== 'undefined' &&
  !document.querySelector('#dndev-trans-styles')
) {
  const style = document.createElement('style');
  style.id = 'dndev-trans-styles';
  style.textContent = transStyles;
  document.head.appendChild(style);
}

/**
 * Predefined styling components for use in translation strings.
 *
 * Available tags:
 * - `<accent>` - Accent color emphasis
 * - `<primary>` - Primary brand color
 * - `<muted>` - De-emphasized text
 * - `<success>` - Positive/success color
 * - `<warning>` - Warning/caution color
 * - `<error>` - Error/destructive color
 * - `<bold>` - Bold text (font-weight: 700)
 * - `<code>` - Inline code styling
 */
const TRANS_COMPONENTS: Record<string, ReactElement> = {
  accent: <span className="dndev-trans-accent" />,
  primary: <span className="dndev-trans-primary" />,
  muted: <span className="dndev-trans-muted" />,
  success: <span className="dndev-trans-success" />,
  warning: <span className="dndev-trans-warning" />,
  error: <span className="dndev-trans-error" />,
  bold: <strong />,
  code: <code className="dndev-text-base" data-variant="code" />,
};

/**
 * Trans component props - extends i18next TransProps
 */
export type DoNotDevTransProps = Omit<
  TransProps<string>,
  'components' | 'ns'
> & {
  /** Namespace - accepts any string */
  ns?: string;
  /** Additional custom components (merged with predefined ones) */
  components?: Record<string, ReactElement>;
};

/**
 * Rich text translation component with predefined styling tags.
 *
 * Use this instead of `t()` when you need inline styling in translations.
 * Plain `t()` returns raw string with tags visible as text.
 *
 * @example
 * ```tsx
 * // Translation: "<accent>MVP</accent> in 2 weeks"
 * <Trans ns={NAMESPACE} i18nKey="hero.title" />
 *
 * // With custom components
 * <Trans
 *   ns={NAMESPACE}
 *   i18nKey="hero.title"
 *   components={{ highlight: <mark /> }}
 * />
 * ```
 */
export function Trans({ components, ...props }: DoNotDevTransProps) {
  return (
    <I18nTrans {...props} components={{ ...TRANS_COMPONENTS, ...components }} />
  );
}

/**
 * List of available predefined tags for documentation/AI reference
 */
export const TRANS_TAGS = [
  'accent',
  'primary',
  'muted',
  'success',
  'warning',
  'error',
  'bold',
  'code',
] as const;

/** Allowed tag names for the Trans component's rich text interpolation. */
export type TransTag = (typeof TRANS_TAGS)[number];
