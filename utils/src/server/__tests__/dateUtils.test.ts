import { describe, it, expect } from 'vitest';

import {
  addMonths,
  addYears,
  calculateSubscriptionEndDate,
  parseISODate,
} from '../dateUtils';

// =============================================================================
// addMonths
// =============================================================================

describe('addMonths', () => {
  it('adds months within the same year', () => {
    const date = new Date('2025-03-15T00:00:00.000Z');
    const result = addMonths(date, 2);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(15);
  });

  it('crosses year boundary', () => {
    const date = new Date('2025-11-15T00:00:00.000Z');
    const result = addMonths(date, 3);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(15);
  });

  it('handles Jan 31 + 1 month (overflow to Feb)', () => {
    const date = new Date('2025-01-31T00:00:00.000Z');
    const result = addMonths(date, 1);
    // Should be Feb 28, not March 3
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });

  it('handles Jan 31 + 1 month in leap year', () => {
    const date = new Date('2024-01-31T00:00:00.000Z');
    const result = addMonths(date, 1);
    // Feb 29 in leap year 2024
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(29);
  });

  it('handles March 31 + 1 month (overflow to April)', () => {
    const date = new Date('2025-03-31T00:00:00.000Z');
    const result = addMonths(date, 1);
    // April has 30 days
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(30);
  });

  it('adds zero months', () => {
    const date = new Date('2025-06-15T12:30:00.000Z');
    const result = addMonths(date, 0);
    expect(result.getTime()).toBe(date.getTime());
  });

  it('does not mutate the original date', () => {
    const date = new Date('2025-01-15T00:00:00.000Z');
    const originalTime = date.getTime();
    addMonths(date, 5);
    expect(date.getTime()).toBe(originalTime);
  });
});

// =============================================================================
// addYears
// =============================================================================

describe('addYears', () => {
  it('adds years normally', () => {
    const date = new Date('2025-06-15T00:00:00.000Z');
    const result = addYears(date, 2);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it('handles leap year Feb 29 + 1 year', () => {
    const date = new Date('2024-02-29T00:00:00.000Z');
    const result = addYears(date, 1);
    // 2025 is not a leap year, should be Feb 28
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });

  it('handles leap year Feb 29 + 4 years (next leap year)', () => {
    const date = new Date('2024-02-29T00:00:00.000Z');
    const result = addYears(date, 4);
    expect(result.getFullYear()).toBe(2028);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it('adds zero years', () => {
    const date = new Date('2025-06-15T12:30:00.000Z');
    const result = addYears(date, 0);
    expect(result.getTime()).toBe(date.getTime());
  });

  it('does not mutate the original date', () => {
    const date = new Date('2025-01-15T00:00:00.000Z');
    const originalTime = date.getTime();
    addYears(date, 3);
    expect(date.getTime()).toBe(originalTime);
  });
});

// =============================================================================
// calculateSubscriptionEndDate
// =============================================================================

describe('calculateSubscriptionEndDate', () => {
  const start = new Date('2025-01-15T00:00:00.000Z');

  it('calculates 1 month subscription', () => {
    const result = calculateSubscriptionEndDate('1month', start);
    const end = new Date(result);
    expect(end.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(1); // February
    expect(end.getDate()).toBe(15);
  });

  it('calculates 3 months subscription', () => {
    const result = calculateSubscriptionEndDate('3months', start);
    const end = new Date(result);
    expect(end.getMonth()).toBe(3); // April
  });

  it('calculates 6 months subscription', () => {
    const result = calculateSubscriptionEndDate('6months', start);
    const end = new Date(result);
    expect(end.getMonth()).toBe(6); // July
  });

  it('calculates 1 year subscription', () => {
    const result = calculateSubscriptionEndDate('1year', start);
    const end = new Date(result);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(0); // January
    expect(end.getDate()).toBe(15);
  });

  it('calculates 2 years subscription', () => {
    const result = calculateSubscriptionEndDate('2years', start);
    const end = new Date(result);
    expect(end.getFullYear()).toBe(2027);
  });

  it('returns far-future date for lifetime', () => {
    const result = calculateSubscriptionEndDate('lifetime', start);
    expect(result).toBe('2099-12-31T23:59:59.000Z');
  });

  it('defaults to 1 month for unknown duration', () => {
    const result = calculateSubscriptionEndDate('unknown', start);
    const end = new Date(result);
    expect(end.getMonth()).toBe(1); // February (1 month from Jan)
  });

  it('returns valid ISO string', () => {
    const result = calculateSubscriptionEndDate('1month', start);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('handles end-of-month edge case for monthly', () => {
    const jan31 = new Date('2025-01-31T00:00:00.000Z');
    const result = calculateSubscriptionEndDate('1month', jan31);
    const end = new Date(result);
    // Should be Feb 28, not March
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(28);
  });

  it('handles Dec to Jan transition', () => {
    const dec = new Date('2025-12-15T00:00:00.000Z');
    const result = calculateSubscriptionEndDate('1month', dec);
    const end = new Date(result);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(0); // January
  });
});

// =============================================================================
// parseISODate
// =============================================================================

describe('parseISODate', () => {
  it('parses valid ISO strings', () => {
    const result = parseISODate('2025-06-15T14:30:00.000Z');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // June
    expect(result.getDate()).toBe(15);
  });

  it('parses date-only ISO strings', () => {
    const result = parseISODate('2025-01-01');
    expect(result.getFullYear()).toBe(2025);
  });

  it('throws on invalid strings', () => {
    expect(() => parseISODate('not-a-date')).toThrow('Invalid ISO date string');
    expect(() => parseISODate('')).toThrow('Invalid ISO date string');
    expect(() => parseISODate('abc123')).toThrow('Invalid ISO date string');
  });

  it('returns a Date object', () => {
    const result = parseISODate('2025-06-15T00:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});
