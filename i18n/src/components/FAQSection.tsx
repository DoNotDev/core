'use client';
// packages/core/i18n/src/components/FAQSection.tsx

/**
 * @fileoverview FAQ Section Component
 * @description FAQ section component that displays frequently asked questions using accordion components. Supports translation and dynamic FAQ item loading.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { Accordion, Stack, Text } from '@donotdev/components';
import { translateObjectArray } from '@donotdev/utils';

import type { TFunction } from 'i18next';

/** Props for the FAQ accordion section with i18n support. */
export interface FAQSectionProps {
  /** Translation function from useTranslation hook */
  t: TFunction;

  /** Base key prefix for the FAQ items (e.g., 'faqs.items') */
  keyPrefix: string;

  /** Maximum number of FAQ items to check (exclusive, so 50 means indices 0-49) */
  maxIndex?: number;

  /** CSS class name for the container */
  className?: string;

  /** CSS class name for each accordion item */
  itemClassName?: string;

  /** ARIA label for the FAQ section */
  'aria-label'?: string;
}

/**
 * FAQSection component for displaying frequently asked questions
 * Handles translations internally using translateObjectArray
 *
 * @example
 * // Basic usage
 * const { t } = useTranslation(['faq']);
 * <FAQSection t={t} keyPrefix="faqs.items" maxIndex={30} />
 *
 * @example
 * // With custom styling
 * <FAQSection
 *   t={t}
 *   keyPrefix="faqs.items"
 *   maxIndex={30}
 *   className="mx-auto" style={{ maxWidth: '56rem' }}
 *   aria-label="Frequently Asked Questions"
 * />
 */
function FAQSection({
  t,
  keyPrefix,
  maxIndex = 50,
  className = '',
  'aria-label': ariaLabel = 'Frequently Asked Questions',
}: FAQSectionProps) {
  const faqs = translateObjectArray(t, keyPrefix, maxIndex, [
    'q',
    'a',
  ] as const);

  if (faqs.length === 0) {
    return null;
  }

  const accordionItems = faqs.map((faq, index) => ({
    value: `item-${index}`,
    trigger: (
      <Text as="span" level="h4">
        {faq.q}
      </Text>
    ),
    content: <Text variant="muted">{faq.a}</Text>,
  }));

  return (
    <Stack aria-label={ariaLabel} className={className}>
      <Accordion type="single" collapsible items={accordionItems} />
    </Stack>
  );
}

export default FAQSection;
