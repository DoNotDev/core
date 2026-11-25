import { describe, it, expect } from 'vitest';

import {
  effectivePrice,
  FIELD_TEXT_FORMATTERS,
  priceDiscountPercent,
} from '../fieldText';

const t = (key: string, options?: Record<string, unknown>) =>
  options?.percent !== undefined ? `-${options.percent}%` : key;

describe('effectivePrice', () => {
  it('applies a finite discountPercent above 0', () => {
    expect(effectivePrice({ amount: 14.34, discountPercent: 15 })).toBeCloseTo(12.189, 3);
  });

  it('is the amount without a discount (absent, 0, non-finite)', () => {
    expect(effectivePrice({ amount: 12.5 })).toBe(12.5);
    expect(effectivePrice({ amount: 12.5, discountPercent: 0 })).toBe(12.5);
    expect(effectivePrice({ amount: 12.5, discountPercent: Number.NaN })).toBe(12.5);
  });

  it('reads a legacy bare number and a numeric string amount', () => {
    expect(effectivePrice(9.99)).toBe(9.99);
    expect(effectivePrice({ amount: '20', discountPercent: 50 })).toBe(10);
  });

  it('is null without a numeric amount', () => {
    expect(effectivePrice(null)).toBeNull();
    expect(effectivePrice({ amount: '' })).toBeNull();
    expect(effectivePrice({ amount: 'abc' })).toBeNull();
    expect(effectivePrice({ currency: 'EUR' })).toBeNull();
  });

  it('clamps the discount to 0-100 (never a negative price) and reads a numeric text', () => {
    expect(effectivePrice({ amount: 10, discountPercent: 150 })).toBe(0);
    expect(effectivePrice({ amount: 10, discountPercent: -20 })).toBe(10);
    expect(effectivePrice({ amount: 10, discountPercent: '50' })).toBe(5);
    expect(effectivePrice({ amount: 10, discountPercent: Infinity })).toBe(10);
  });

  it('is the number the price text shows', () => {
    const text = FIELD_TEXT_FORMATTERS.price!(
      { amount: 14.34, currency: 'USD', discountPercent: 15 },
      { name: 'price', type: 'price' } as never,
      t,
      {}
    );
    expect(text).toContain('$12.19');
    expect(text).toContain('-15%');
  });
});

describe('priceDiscountPercent', () => {
  it('is the discount effectivePrice applies (clamped, 0 for none)', () => {
    expect(priceDiscountPercent({ amount: 10, discountPercent: 15 })).toBe(15);
    expect(priceDiscountPercent({ amount: 10, discountPercent: 150 })).toBe(100);
    expect(priceDiscountPercent({ amount: 10, discountPercent: '' })).toBe(0);
    expect(priceDiscountPercent({ amount: 10, discountPercent: Infinity })).toBe(0);
    expect(priceDiscountPercent({ amount: 10 })).toBe(0);
    expect(priceDiscountPercent(9.99)).toBe(0);
  });

  it('shows no discount clue for a discount effectivePrice does not apply', () => {
    const text = FIELD_TEXT_FORMATTERS.price!(
      { amount: 10, currency: 'USD', discountPercent: Infinity },
      { name: 'price', type: 'price' } as never,
      t,
      {}
    );
    expect(text).toContain('$10');
    expect(text).not.toContain('%');
  });
});
