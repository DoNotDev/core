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

import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

import { Accordion, Stack, Text, type GridCols } from '@donotdev/components';
import { translateObjectArray } from '@donotdev/utils';

/** One FAQ entry, already translated and rendered by the caller. */
export interface FAQItem {
  /** Accordion trigger content, rendered as given */
  question: ReactNode;

  /** Accordion panel content, rendered as given */
  answer: ReactNode;
}

interface FAQSectionBaseProps {
  /** CSS class name for the container */
  className?: string;

  /** CSS class name for each accordion item */
  itemClassName?: string;

  /**
   * Lay the questions out in a responsive grid; passed to the Accordion.
   * Same type as `Section`'s `gridCols`. Absent = one column.
   * @example [1, 1, 2, 2] - 1 column on mobile/tablet, 2 on laptop/desktop
   */
  gridCols?: GridCols;

  /** ARIA label for the FAQ section */
  'aria-label'?: string;
}

/** Data-driven FAQ: a ready list built by the app. */
interface FAQSectionItemsProps extends FAQSectionBaseProps {
  /** Ready list of translated questions and answers, rendered in order */
  items: FAQItem[];
  t?: never;
  keyPrefix?: never;
  maxIndex?: never;
}

/** Static FAQ: items read from translation keys `${keyPrefix}.N.q` / `.a`. */
interface FAQSectionKeysProps extends FAQSectionBaseProps {
  /** Translation function from useTranslation hook */
  t: TFunction;

  /** Base key prefix for the FAQ items (e.g., 'faqs.items') */
  keyPrefix: string;

  /** Maximum number of FAQ items to check (exclusive, so 50 means indices 0-49) */
  maxIndex?: number;
  items?: never;
}

/** Props for the FAQ accordion section: either `items`, or `t` + `keyPrefix`. */
export type FAQSectionProps = FAQSectionItemsProps | FAQSectionKeysProps;

/**
 * FAQSection component for displaying frequently asked questions.
 * Keys mode builds its items with translateObjectArray; both modes share one render path.
 *
 * @example
 * // Static FAQ from translation keys
 * const { t } = useTranslation(['faq']);
 * <FAQSection t={t} keyPrefix="faqs.items" maxIndex={30} />
 *
 * @example
 * // Data-driven FAQ: items built by the app
 * <FAQSection
 *   gridCols={[1, 1, 2, 2]}
 *   items={faq.map(({ question, answer }) => ({
 *     question: <Text as="span" weight="semibold">{question}</Text>,
 *     answer: <Text variant="muted">{answer}</Text>,
 *   }))}
 * />
 */
function FAQSection(props: FAQSectionProps) {
  const { gridCols, className = '', itemClassName, 'aria-label': ariaLabel = 'Frequently Asked Questions' } = props;

  const items: FAQItem[] =
    props.items ??
    translateObjectArray(props.t, props.keyPrefix, props.maxIndex ?? 50, [
      'q',
      'a',
    ] as const).map((faq) => ({
      question: (
        <Text as="span" level="h4">
          {faq.q}
        </Text>
      ),
      answer: <Text variant="muted">{faq.a}</Text>,
    }));

  if (items.length === 0) {
    return null;
  }

  const accordionItems = items.map(({ question, answer }, index) => ({
    value: `item-${index}`,
    trigger: question,
    content: answer,
  }));

  return (
    <Stack aria-label={ariaLabel} className={className}>
      <Accordion
        type="single"
        collapsible
        items={accordionItems}
        gridCols={gridCols}
        itemClassName={itemClassName}
      />
    </Stack>
  );
}

export default FAQSection;
