// packages/core/i18n/src/components/__tests__/FAQSection.test.tsx

import type { TFunction } from 'i18next';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Text } from '@donotdev/components';

import FAQSection from '../FAQSection';

const messages: Record<string, string> = {
  'faq.0.q': 'Question A',
  'faq.0.a': 'Answer A',
  'faq.1.q': 'Question B',
  'faq.1.a': 'Answer B',
};
// Missing keys echo the key, as i18next does.
const t = ((key: string) => messages[key] ?? key) as unknown as TFunction;

describe('FAQSection gridCols', () => {
  it('absent: the Accordion stays a single column', () => {
    const html = renderToString(<FAQSection t={t} keyPrefix="faq" maxIndex={4} />);
    expect(html).toContain('Question A');
    expect(html).not.toContain('dndev-grid-component');
  });

  it('present: passed to the Accordion, questions keep their order', () => {
    const html = renderToString(
      <FAQSection t={t} keyPrefix="faq" maxIndex={4} gridCols={[1, 1, 2, 2]} />
    );
    expect(html).toContain('dndev-grid-component');
    expect(html).toContain('--grid-cols-laptop:2');
    expect(html.indexOf('Question A')).toBeLessThan(html.indexOf('Question B'));
  });
});

describe('FAQSection items mode', () => {
  const items = [
    { question: <b>Item Q1</b>, answer: <i>Item A1</i> },
    { question: 'Item Q2', answer: 'Item A2' },
  ];

  it('renders questions and answers in order', () => {
    const html = renderToString(<FAQSection items={items} />);
    expect(html).toContain('<b>Item Q1</b>');
    expect(html).toContain('<i>Item A1</i>');
    expect(html.indexOf('Item Q1')).toBeLessThan(html.indexOf('Item A1'));
    expect(html.indexOf('Item A1')).toBeLessThan(html.indexOf('Item Q2'));
    expect(html.indexOf('Item Q2')).toBeLessThan(html.indexOf('Item A2'));
  });

  it('gridCols passes through', () => {
    const html = renderToString(<FAQSection items={items} gridCols={[1, 1, 2, 2]} />);
    expect(html).toContain('--grid-cols-laptop:2');
  });

  it('empty items render nothing', () => {
    expect(renderToString(<FAQSection items={[]} />)).toBe('');
  });
});

describe('FAQSection keys mode', () => {
  it('keeps wrapping questions and answers in Text, with item-N values', () => {
    const keys = renderToString(<FAQSection t={t} keyPrefix="faq" maxIndex={4} />);
    const items = renderToString(
      <FAQSection
        items={[
          { question: <Text as="span" level="h4">Question A</Text>, answer: <Text variant="muted">Answer A</Text> },
          { question: <Text as="span" level="h4">Question B</Text>, answer: <Text variant="muted">Answer B</Text> },
        ]}
      />
    );
    expect(keys).toBe(items);
    expect(keys).toContain('Answer B');
  });
});
