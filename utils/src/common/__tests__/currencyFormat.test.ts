import { describe, it, expect } from 'vitest';

import {
  CURRENCY_MAP,
  getCurrencyLocale,
  getCurrencySymbol,
  formatCurrency,
} from '../currencyFormat';

describe('CURRENCY_MAP', () => {
  it('contains major currencies', () => {
    expect(CURRENCY_MAP.USD).toBeDefined();
    expect(CURRENCY_MAP.EUR).toBeDefined();
    expect(CURRENCY_MAP.GBP).toBeDefined();
    expect(CURRENCY_MAP.JPY).toBeDefined();
  });

  it('has locale and symbol for each entry', () => {
    for (const [code, entry] of Object.entries(CURRENCY_MAP)) {
      expect(entry.locale).toBeTruthy();
      expect(entry.symbol).toBeTruthy();
    }
  });
});

describe('getCurrencyLocale', () => {
  it('returns locale for known currency', () => {
    expect(getCurrencyLocale('USD')).toBe('en-US');
    expect(getCurrencyLocale('EUR')).toBe('fr-FR');
    expect(getCurrencyLocale('JPY')).toBe('ja-JP');
  });

  it('returns en-US for unknown currency', () => {
    expect(getCurrencyLocale('XYZ')).toBe('en-US');
  });
});

describe('getCurrencySymbol', () => {
  it('returns symbol for known currency', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
  });

  it('returns code as-is for unknown currency', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });

  it('returns empty string for empty input', () => {
    expect(getCurrencySymbol('')).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats USD amount', () => {
    const result = formatCurrency(12345, 'USD');
    expect(result).toContain('12');
    expect(result).toContain('345');
  });

  it('formats EUR amount', () => {
    const result = formatCurrency(12345, 'EUR');
    expect(result).toBeTruthy();
  });

  it('returns empty string for null value', () => {
    expect(formatCurrency(null, 'USD')).toBe('');
  });

  it('returns empty string for undefined value', () => {
    expect(formatCurrency(undefined, 'USD')).toBe('');
  });

  it('returns empty string for NaN value', () => {
    expect(formatCurrency(NaN, 'USD')).toBe('');
  });

  it('formats zero correctly', () => {
    const result = formatCurrency(0, 'USD');
    expect(result).toContain('0');
  });

  it('accepts custom Intl options', () => {
    const result = formatCurrency(99.99, 'USD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(result).toContain('99');
  });
});

// Money reads in the UI language with the currency's standard fraction digits
// (Intl spacing: U+00A0 / U+202F, normalized to plain spaces here)
describe('formatCurrency in the UI locale', () => {
  const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

  it('formats EUR with 2 fraction digits in the reader\'s language', () => {
    expect(plain(formatCurrency(15.5, 'EUR', {}, 'fr'))).toBe('15,50 €');
    expect(plain(formatCurrency(15.5, 'EUR', {}, 'en'))).toBe('€15.50');
    expect(plain(formatCurrency(15.5, 'EUR', {}, 'de'))).toBe('15,50 €');
  });

  it('formats KRW with no fraction digits', () => {
    expect(plain(formatCurrency(15000, 'KRW', {}, 'en'))).toBe('₩15,000');
    expect(plain(formatCurrency(15000, 'KRW', {}, 'fr'))).toBe('15 000 ₩');
    expect(plain(formatCurrency(15000.4, 'KRW', {}, 'de'))).toBe('15.000 ₩');
  });

  it('keeps the currency locale without a UI locale, with standard digits', () => {
    expect(plain(formatCurrency(15.5, 'EUR'))).toBe('15,50 €');
    expect(formatCurrency(12345, 'USD')).toBe('$12,345.00');
  });

  it('lets options override the fraction digits', () => {
    expect(
      plain(formatCurrency(15.5, 'EUR', { maximumFractionDigits: 0 }, 'fr'))
    ).toBe('16 €');
  });
});
