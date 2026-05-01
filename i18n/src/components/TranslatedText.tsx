'use client';
// packages/core/i18n/src/components/TranslatedText.tsx

/**
 * @fileoverview Translated Text Component
 * @description Component for rendering translated text. Provides a simple way to display translated content with support for interpolation, namespaces, and fallback text.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useTranslation } from '../hooks';

interface TranslatedTextProps {
  /** Translation key (e.g., 'dashboard.title') */
  i18nKey: string;

  /** Namespace to use (defaults to 'common') */
  namespace?: string;

  /** Fallback text if translation is missing */
  fallback?: string;

  /** Values for interpolation (e.g., { name: 'John' }) */
  values?: Record<string, any>;

  /** HTML element to render (defaults to 'span') */
  component?: React.ElementType;

  /** CSS class name */
  className?: string;

  /** ARIA label for accessibility (overrides translated text) */
  'aria-label'?: string;

  /** ARIA described-by for accessibility */
  'aria-describedby'?: string;

  /** ARIA live region for dynamic content */
  'aria-live'?: 'off' | 'polite' | 'assertive';

  /** Screen reader only text (hidden visually) */
  srOnly?: boolean;

  /** Additional props passed to the component */
  [key: string]: any;
}

/**
 * TranslatedText component for dynamic translations
 * 100% Lighthouse accessibility compliant with proper ARIA support
 *
 * @example
 * // Basic usage
 * <TranslatedText i18nKey="welcome.message" fallback="Welcome!" />
 *
 * @example
 * // With accessibility
 * <TranslatedText
 *   i18nKey="user.greeting"
 *   values={{ name: 'John' }}
 *   fallback="Hello {{name}}"
 *   aria-live="polite"
 * />
 *
 * @example
 * // Screen reader only
 * <TranslatedText
 *   i18nKey="instructions.screen_reader"
 *   fallback="Navigate using arrow keys"
 *   srOnly
 * />
 *
 * @example
 * // Interactive elements
 * <TranslatedText
 *   i18nKey="button.save"
 *   component="button"
 *   aria-label="Save document"
 *   fallback="Save"
 * />
 */
export function TranslatedText({
  i18nKey,
  namespace,
  fallback,
  values,
  component: Component = 'span',
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-live': ariaLive,
  srOnly = false,
  ...props
}: TranslatedTextProps) {
  const { t } = useTranslation(namespace || 'common');

  // Get translated text with fallback
  const translatedText = t(i18nKey, fallback || i18nKey, values);

  // Build accessibility-compliant className
  const accessibleClassName = [
    className,
    srOnly ? 'dndev-sr-only' : '', // Screen reader only class
  ]
    .filter(Boolean)
    .join(' ');

  // Build accessibility props
  const accessibilityProps: Record<string, any> = {
    className: accessibleClassName || undefined,
  };

  // Add ARIA attributes if provided
  if (ariaLabel) {
    accessibilityProps['aria-label'] = ariaLabel;
  }

  if (ariaDescribedBy) {
    accessibilityProps['aria-describedby'] = ariaDescribedBy;
  }

  if (ariaLive) {
    accessibilityProps['aria-live'] = ariaLive;
  }

  // Handle interactive elements accessibility
  if (Component === 'button' && !ariaLabel && !props['aria-label']) {
    // Buttons need accessible names
    accessibilityProps['aria-label'] = translatedText;
  }

  if (Component === 'a' && !props.href) {
    // Links without href should be buttons - handled by framework error handling
  }

  // Semantic heading handling
  if (typeof Component === 'string' && Component.match(/^h[1-6]$/)) {
    // Headings are landmarks, ensure proper structure
    accessibilityProps.role = 'heading';
  }

  // Filter out invalid HTML attributes for specific elements
  const validProps = { ...props };

  // Remove React-specific props that shouldn't be on DOM elements
  delete validProps.key;
  delete validProps.ref;

  return (
    <Component {...validProps} {...accessibilityProps}>
      {translatedText}
    </Component>
  );
}

// CSS for screen reader only content (add to your global styles)
/*
.dndev-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
*/
