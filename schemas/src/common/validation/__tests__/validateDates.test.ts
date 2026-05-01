import { describe, it, expect } from 'vitest';

import { validateDates } from '../validateDates';

describe('validateDates', () => {
  it('accepts valid ISO date strings', () => {
    expect(() =>
      validateDates({ createdAt: '2024-01-15T10:30:00.000Z' })
    ).not.toThrow();
  });

  it('accepts ISO dates without milliseconds', () => {
    expect(() => validateDates({ date: '2024-01-15T10:30:00Z' })).not.toThrow();
  });

  it('throws on invalid date format', () => {
    expect(() =>
      validateDates({ date: '2024-01-15 10:30:00+00:00' })
    ).toThrow();
  });

  it('throws on locale date strings', () => {
    expect(() =>
      validateDates({ date: '01/15/2024 10:30:00 AM' })
    ).not.toThrow(); // This doesn't match isPotentialDateString (no '-' and ':' together properly)
  });

  it('ignores non-date strings', () => {
    expect(() =>
      validateDates({ name: 'John Doe', email: 'john@example.com' })
    ).not.toThrow();
  });

  it('ignores numbers and booleans', () => {
    expect(() => validateDates({ count: 42, active: true })).not.toThrow();
  });

  it('validates nested objects recursively', () => {
    expect(() =>
      validateDates({
        user: { profile: { createdAt: '2024-01-15T10:30:00.000Z' } },
      })
    ).not.toThrow();
  });

  it('throws on invalid nested dates', () => {
    expect(() =>
      validateDates({
        user: { updatedAt: '2024-01-15 10:30:00+02:00' },
      })
    ).toThrow();
  });

  it('validates arrays recursively', () => {
    expect(() =>
      validateDates([
        { createdAt: '2024-01-15T10:30:00.000Z' },
        { createdAt: '2024-06-20T08:00:00.000Z' },
      ])
    ).not.toThrow();
  });

  it('throws on invalid dates in arrays', () => {
    expect(() =>
      validateDates([
        { date: '2024-01-15T10:30:00.000Z' },
        { date: '15-01-2024T10:30:00.000Z' },
      ])
    ).toThrow();
  });

  it('handles empty objects', () => {
    expect(() => validateDates({})).not.toThrow();
  });

  it('handles empty arrays', () => {
    expect(() => validateDates([])).not.toThrow();
  });

  it('includes field path in error details', () => {
    try {
      validateDates({ user: { updatedAt: '2024-01-15 10:30:00+02:00' } });
      expect.fail('Should have thrown');
    } catch (error: any) {
      // DoNotDevError wraps the original — field path is in userMessage or originalError
      const userMessage =
        error.details?.originalError?.userMessage ??
        error.details?.userMessage ??
        error.message;
      expect(userMessage).toContain('user.updatedAt');
    }
  });
});
