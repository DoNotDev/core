// packages/core/utils/src/common/__tests__/fieldTextFormatting.test.ts

/**
 * @fileoverview Admin value formatting (audit 2026-11-25 #5): timestamps without seconds,
 * translated Yes / No, money in the UI language, option badge colours, price column title.
 */

import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import type { EntityField } from '@donotdev/types';

import {
  FIELD_TEXT_FORMATTERS,
  STATUS_OPTION_VARIANTS,
  fieldColumnTitle,
  fieldOptionVariant,
  formatFieldText,
} from '../fieldText';

const CRUD_EN: Record<string, string> = {
  'crud:boolean.yes': 'Yes',
  'crud:boolean.no': 'No',
  'crud:price.vatIncluded': 'VAT incl.',
  'crud:price.columnTitle': '{{label}} (VAT incl.)',
};
const t = (key: string, options?: Record<string, unknown>) => {
  const text = CRUD_EN[key] ?? key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(options?.[name] ?? '')
  );
};
const plain = (text: string | null) => text?.replace(/[  ]/g, ' ');

const field = (type: string, extra: Partial<EntityField> = {}) =>
  ({ name: 'f', label: 'f', type, visibility: 'guest', ...extra }) as EntityField;
/** A price field declaring VAT-inclusive prices (`options.fieldSpecific.vatIncluded`). */
const vatInclusivePrice = field('price', {
  options: { fieldSpecific: { vatIncluded: true } },
} as Partial<EntityField>);

// The app's time zone (i18n.timeZone, default Europe/Paris): the date formatters read it
const previousConfig = globalThis._DNDEV_CONFIG_;
beforeAll(() => {
  // why: only the i18n key getAppTimeZone reads
  globalThis._DNDEV_CONFIG_ = { i18n: { timeZone: 'Europe/Paris' } } as unknown as typeof globalThis._DNDEV_CONFIG_;
});
afterAll(() => {
  globalThis._DNDEV_CONFIG_ = previousConfig;
});

describe('timestamp text', () => {
  it('is a medium date and a short time, no seconds', () => {
    const iso = '2026-11-19T11:46:37.000Z';
    const text = formatFieldText(iso, field('timestamp'), t, { locale: 'en' });
    const expected = new Date(iso).toLocaleString('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Paris',
    });
    expect(text).toBe(expected);
    expect(text).not.toMatch(/:\d{2}:\d{2}/);
  });
});

// Owner decision 2026-11-25 T1: a wall-clock time is shown as written, never zone-shifted
describe('time text', () => {
  it('shows a stored HH:mm as written, in the reader language', () => {
    expect(plain(formatFieldText('14:30', field('time'), t, { locale: 'fr' }))).toBe('14:30');
    expect(plain(formatFieldText('14:30', field('time'), t, { locale: 'en' }))).toBe('2:30 PM');
    expect(plain(formatFieldText('00:05', field('time'), t, { locale: 'fr' }))).toBe('00:05');
  });

  it('keeps stored seconds', () => {
    expect(plain(formatFieldText('09:15:42', field('time'), t, { locale: 'fr' }))).toBe('09:15:42');
  });

  it('is never "Invalid Date" for a wall time', () => {
    expect(formatFieldText('23:59', field('time'), t, { locale: 'en' })).not.toContain('Invalid');
  });

  it('reads an instant in the app zone', () => {
    // 13:30 UTC = 14:30 in Paris (winter)
    expect(
      plain(formatFieldText('2026-11-25T13:30:00.000Z', field('time'), t, { locale: 'fr' }))
    ).toBe('14:30:00');
  });
});

describe('boolean text', () => {
  it('translates Yes / No through crud:boolean.*', () => {
    expect(formatFieldText(true, field('boolean'), t)).toBe('Yes');
    expect(formatFieldText(false, field('checkbox'), t)).toBe('No');
    expect(formatFieldText(true, field('switch'), t)).toBe('Yes');
  });

  it('keeps a switch\'s own labels', () => {
    const toggle = field('switch', {
      options: { fieldSpecific: { checkedLabel: 'On', uncheckedLabel: 'Off' } },
    } as Partial<EntityField>);
    expect(formatFieldText(true, toggle, t)).toBe('On');
  });
});

describe('money text in the UI language', () => {
  it('formats a currency field in the given locale with 2 fraction digits', () => {
    expect(plain(formatFieldText(15.5, field('currency'), t, { locale: 'en' }))).toBe(
      '€15.50'
    );
    expect(plain(formatFieldText(15.5, field('currency'), t, { locale: 'fr' }))).toBe(
      '15,50 €'
    );
  });

  it('keeps the VAT note and discount clue in the price text', () => {
    const text = FIELD_TEXT_FORMATTERS.price!(
      { amount: 20, currency: 'EUR', discountPercent: 15 },
      vatInclusivePrice,
      (key, options) =>
        key === 'crud:price.discountPercent' ? `-${options?.percent}%` : t(key),
      { locale: 'en' }
    );
    expect(text).toBe('€17.00 VAT incl. -15%');
  });

  // Owner decision 2026-11-25 V2: the VAT note follows the value, else the field
  it('shows the VAT note only for VAT-inclusive prices (value, else field)', () => {
    const price = FIELD_TEXT_FORMATTERS.price!;
    const opts = { locale: 'en' };
    expect(price({ amount: 20, currency: 'EUR' }, field('price'), t, opts)).toBe('€20.00');
    expect(price(20, field('price'), t, opts)).toBe('€20.00');
    expect(price(20, vatInclusivePrice, t, opts)).toBe('€20.00 VAT incl.');
    expect(
      price({ amount: 20, currency: 'EUR', vatIncluded: false }, vatInclusivePrice, t, opts)
    ).toBe('€20.00');
    expect(
      price({ amount: 20, currency: 'EUR', vatIncluded: true }, field('price'), t, opts)
    ).toBe('€20.00 VAT incl.');
  });
});

describe('fieldOptionVariant', () => {
  const status = field('select', {
    validation: {
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'shipped', label: 'Shipped', variant: 'success' },
        { value: 'deleted', label: 'Deleted', variant: 'warning' },
      ],
    },
  } as Partial<EntityField>);

  it('gives built-in statuses their colour', () => {
    expect(fieldOptionVariant('draft', status)).toBe('muted');
    expect(fieldOptionVariant('published', status)).toBe('success');
    expect(fieldOptionVariant('available', status)).toBe('success');
    expect(fieldOptionVariant('active', status)).toBe('success');
    expect(fieldOptionVariant('archived', status)).toBe('destructive');
    expect(STATUS_OPTION_VARIANTS.deleted).toBe('destructive');
  });

  it('prefers the option\'s own variant', () => {
    expect(fieldOptionVariant('shipped', status)).toBe('success');
    expect(fieldOptionVariant('deleted', status)).toBe('warning');
  });

  it('gives unknown values none (plain text)', () => {
    expect(fieldOptionVariant('reserved', status)).toBeUndefined();
    expect(fieldOptionVariant('toString', status)).toBeUndefined();
  });
});

describe('fieldColumnTitle', () => {
  // Owner decision 2026-11-25 V2: only a field declaring VAT-inclusive prices
  it('adds the VAT note to VAT-inclusive price columns only', () => {
    expect(fieldColumnTitle('Price', vatInclusivePrice, t)).toBe('Price (VAT incl.)');
    expect(fieldColumnTitle('Price', field('price'), t)).toBe('Price');
    expect(
      fieldColumnTitle(
        'Price',
        field('price', {
          options: { fieldSpecific: { vatIncluded: false } },
        } as Partial<EntityField>),
        t
      )
    ).toBe('Price');
    expect(fieldColumnTitle('Name', field('text'), t)).toBe('Name');
  });
});
