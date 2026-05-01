import { describe, it, expect } from 'vitest';

import {
  compactToISOString,
  isoToCompactString,
  isCompactDateString,
  normalizeToISOString,
  getCurrentTimestamp,
  toISOString,
  timestampToISOString,
  getWeekFromISOString,
  formatDate,
  parseDate,
  parseDateToNoonUTC,
  toDateOnly,
} from '../dateUtils';

describe('compactToISOString', () => {
  it('converts compact format to ISO string', () => {
    const result = compactToISOString('20251225:0000');

    expect(result).toContain('2025');
    expect(result).toContain('12');
    expect(result).toContain('25');
  });

  it('throws on invalid format', () => {
    expect(() => compactToISOString('invalid')).toThrow('Invalid compact date');
    expect(() => compactToISOString('2025-12-25')).toThrow();
  });
});

describe('isoToCompactString', () => {
  it('converts ISO string to compact format', () => {
    const result = isoToCompactString('2025-12-25T00:00:00.000Z');

    expect(result).toBe('20251225:0000');
  });

  it('preserves hours and minutes', () => {
    const result = isoToCompactString('2025-06-15T14:30:00.000Z');

    expect(result).toBe('20250615:1430');
  });

  it('throws on invalid ISO string', () => {
    expect(() => isoToCompactString('not-a-date')).toThrow();
  });
});

describe('isCompactDateString', () => {
  it('returns true for valid compact format', () => {
    expect(isCompactDateString('20251225:0000')).toBe(true);
    expect(isCompactDateString('20250615:1430')).toBe(true);
  });

  it('returns false for non-compact strings', () => {
    expect(isCompactDateString('2025-12-25')).toBe(false);
    expect(isCompactDateString('hello')).toBe(false);
    expect(isCompactDateString('')).toBe(false);
  });
});

describe('normalizeToISOString', () => {
  it('handles Date objects', () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    expect(normalizeToISOString(date)).toBe('2025-01-01T00:00:00.000Z');
  });

  it('handles ISO strings', () => {
    const result = normalizeToISOString('2025-06-15T14:30:00.000Z');
    expect(result).toBe('2025-06-15T14:30:00.000Z');
  });

  it('handles compact date strings', () => {
    const result = normalizeToISOString('20251225:0000');
    expect(result).toContain('2025');
  });

  it('handles timestamps (numbers)', () => {
    const ts = new Date('2025-01-01T00:00:00.000Z').getTime();
    expect(normalizeToISOString(ts)).toBe('2025-01-01T00:00:00.000Z');
  });

  it('returns current time for null/undefined', () => {
    const result = normalizeToISOString(null);
    expect(result).toBeTruthy();
    expect(new Date(result).getTime()).toBeGreaterThan(0);
  });

  it('handles Firestore-like timestamps', () => {
    const firestoreTs = { toDate: () => new Date('2025-01-01T00:00:00.000Z') };
    expect(normalizeToISOString(firestoreTs as any)).toBe(
      '2025-01-01T00:00:00.000Z'
    );
  });

  it('throws on invalid Date object', () => {
    expect(() => normalizeToISOString(new Date('invalid'))).toThrow();
  });
});

describe('getCurrentTimestamp', () => {
  it('returns a valid ISO string', () => {
    const result = getCurrentTimestamp();
    expect(new Date(result).getTime()).toBeGreaterThan(0);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('toISOString', () => {
  it('converts Date to ISO string', () => {
    const date = new Date('2025-06-15T00:00:00.000Z');
    expect(toISOString(date)).toBe('2025-06-15T00:00:00.000Z');
  });
});

describe('timestampToISOString', () => {
  it('converts timestamp to ISO string', () => {
    const ts = Date.UTC(2025, 0, 1);
    expect(timestampToISOString(ts)).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('getWeekFromISOString', () => {
  it('returns week number and year', () => {
    const result = getWeekFromISOString('2025-01-15T00:00:00.000Z');
    expect(result).toMatch(/^Week \d+, 2025$/);
  });

  it('throws on invalid ISO string', () => {
    expect(() => getWeekFromISOString('invalid')).toThrow();
  });
});

describe('formatDate', () => {
  it('formats with default long preset', () => {
    const result = formatDate('2025-05-05T00:00:00.000Z', 'en');
    expect(result).toContain('2025');
    expect(result).toContain('May');
  });

  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('handles Date objects', () => {
    const result = formatDate(new Date('2025-06-15T00:00:00.000Z'), 'en');
    expect(result).toBeTruthy();
  });

  it('handles timestamp numbers', () => {
    const ts = Date.UTC(2025, 5, 15);
    const result = formatDate(ts, 'en');
    expect(result).toBeTruthy();
  });
});

describe('parseDate', () => {
  it('parses ISO string', () => {
    expect(parseDate('2025-01-01T00:00:00.000Z')).toBe(
      '2025-01-01T00:00:00.000Z'
    );
  });

  it('parses Date objects', () => {
    const date = new Date('2025-06-15T00:00:00.000Z');
    expect(parseDate(date)).toBe('2025-06-15T00:00:00.000Z');
  });

  it('parses compact date format', () => {
    const result = parseDate('20251225:0000');
    expect(result).toBeTruthy();
    expect(result).toContain('2025');
  });

  it('parses timestamps', () => {
    const ts = Date.UTC(2025, 0, 1);
    expect(parseDate(ts)).toBe('2025-01-01T00:00:00.000Z');
  });

  it('returns undefined for null', () => {
    expect(parseDate(null)).toBeUndefined();
  });

  it('returns undefined for invalid strings', () => {
    expect(parseDate('not-a-date')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseDate('')).toBeUndefined();
  });

  it('handles Firestore Timestamp-like objects', () => {
    const ts = { toDate: () => new Date('2025-01-01T00:00:00.000Z') };
    expect(parseDate(ts)).toBe('2025-01-01T00:00:00.000Z');
  });

  it('handles raw seconds/nanoseconds objects', () => {
    const ts = { seconds: 1735689600, nanoseconds: 0 };
    const result = parseDate(ts);
    expect(result).toBeTruthy();
  });
});

describe('parseDateToNoonUTC', () => {
  it('sets time to noon UTC', () => {
    const result = parseDateToNoonUTC('2025-12-28');
    expect(result).toBe('2025-12-28T12:00:00.000Z');
  });

  it('returns undefined for invalid input', () => {
    expect(parseDateToNoonUTC('not-a-date')).toBeUndefined();
  });
});

describe('toDateOnly', () => {
  it('extracts date-only part', () => {
    expect(toDateOnly('2025-12-28T14:30:00.000Z')).toBe('2025-12-28');
  });

  it('handles Date objects', () => {
    const date = new Date('2025-06-15T10:00:00.000Z');
    expect(toDateOnly(date)).toBe('2025-06-15');
  });

  it('returns empty string for null', () => {
    expect(toDateOnly(null)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(toDateOnly('invalid')).toBe('');
  });
});
