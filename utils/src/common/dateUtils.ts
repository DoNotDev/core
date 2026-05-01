// packages/core/utils/src/common/dateUtils.ts

/**
 * @fileoverview Date utilities for consistent timestamp handling
 * @description Provides standardized date utilities for ISO string timestamps.
 * All date values in the framework should be ISO strings. Use these utilities to normalize any date input.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { DateValue, FirestoreTimestamp } from '@donotdev/types';

/**
 * Convert compact date format (YYYYMMDD:HHMM) to ISO string
 * Format: 20251225:0000 → 2025-12-25T00:00:00.000Z
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param compactDate - Date in YYYYMMDD:HHMM format
 * @returns ISO string representation
 * @throws Error if format is invalid
 */
export function compactToISOString(compactDate: string): string {
  const match = compactDate.match(/^(\d{4})(\d{2})(\d{2}):(\d{2})(\d{2})$/);
  if (!match || match.length < 6) {
    throw new Error(
      `Invalid compact date format. Expected YYYYMMDD:HHMM, got: ${compactDate}`
    );
  }

  const year = match[1]!;
  const month = match[2]!;
  const day = match[3]!;
  const hour = match[4]!;
  const minute = match[5]!;

  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10)
  );

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date values in compact format: ${compactDate}`);
  }

  return date.toISOString();
}

/**
 * Convert ISO string to compact date format (YYYYMMDD:HHMM)
 * Format: 2025-12-25T00:00:00.000Z → 20251225:0000
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param isoString - ISO date string
 * @returns Compact date string in YYYYMMDD:HHMM format
 * @throws Error if ISO string is invalid
 */
export function isoToCompactString(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}${month}${day}:${hour}${minute}`;
}

/**
 * Check if a string is in compact date format (YYYYMMDD:HHMM)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param value - String to check
 * @returns True if string matches YYYYMMDD:HHMM format
 */
export function isCompactDateString(value: string): boolean {
  return /^\d{4}\d{2}\d{2}:\d{2}\d{2}$/.test(value);
}

/**
 * Normalize any date value to ISO string
 * Handles Date objects, ISO strings, compact format (YYYYMMDD:HHMM), timestamps (numbers), and Firestore Timestamps
 * This is the single source of truth for date normalization across the entire framework
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param date - Date value in any format (Date, string, number, FirestoreTimestamp)
 * @returns ISO string representation
 * @throws Error if date is invalid
 */
export function normalizeToISOString(
  date: DateValue | number | null | undefined
): string {
  if (!date) {
    return new Date().toISOString();
  }

  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new Error('Invalid Date object');
    }
    return date.toISOString();
  }

  if (typeof date === 'string') {
    if (isCompactDateString(date)) {
      return compactToISOString(date);
    }
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date string: ${date}`);
    }
    return parsed.toISOString();
  }

  if (typeof date === 'number') {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid timestamp: ${date}`);
    }
    return parsed.toISOString();
  }

  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const timestamp = date as FirestoreTimestamp;
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
  }

  throw new Error(`Unsupported date type: ${typeof date}`);
}

/**
 * Get current timestamp as ISO string
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns Current timestamp in ISO string format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Convert Date object to ISO string
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param date - Date object to convert
 * @returns ISO string representation
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Convert timestamp (number) to ISO string
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param timestamp - Timestamp in milliseconds
 * @returns ISO string representation
 */
export function timestampToISOString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate week number from ISO date string
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param isoString - ISO date string
 * @returns Week number and year as string (e.g., "Week 15, 2024")
 */
export function getWeekFromISOString(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }

  // Calculate week number using ISO 8601 standard (Monday as first day of week)
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  return `Week ${weekNumber}, ${date.getFullYear()}`;
}

/**
 * Time constants in seconds for relative time calculations
 */
const TIME_CONSTANTS = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000, // 30 days
  YEAR: 31536000, // 365 days
} as const;

/**
 * Format a date as relative time (e.g., "5 minutes ago", "in 2 hours")
 * Uses native Intl.RelativeTimeFormat for locale-aware formatting.
 * Falls back to formatDate for dates older than threshold.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param date - Date value (ISO string, Date object, timestamp, or null/undefined)
 * @param locale - Locale string (e.g., "en", "fr", "de"). Defaults to "en"
 * @param options - Configuration options
 * @param options.style - "long" | "short" | "narrow". Defaults to "long"
 * @param options.numeric - "always" | "auto". Defaults to "auto" (allows "yesterday" instead of "1 day ago")
 * @param options.fallbackThreshold - Seconds after which to fall back to formatDate. Defaults to 1 week
 * @returns Localized relative time string or formatted date for old dates
 */
export function formatRelativeTime(
  date: DateValue | number | null | undefined,
  locale: string = 'en',
  options: {
    style?: 'long' | 'short' | 'narrow';
    numeric?: 'always' | 'auto';
    fallbackThreshold?: number;
  } = {}
): string {
  if (!date) return '';

  const {
    style = 'long',
    numeric = 'auto',
    fallbackThreshold = TIME_CONSTANTS.WEEK,
  } = options;

  let dateObj: Date;

  // Handle different input types
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'object' && 'toDate' in date) {
    dateObj = (date as FirestoreTimestamp).toDate();
  } else {
    return '';
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffInMs = dateObj.getTime() - now.getTime();
  const diffInSec = Math.round(diffInMs / 1000);
  const absDiffInSec = Math.abs(diffInSec);

  // Fall back to formatDate for dates beyond threshold
  if (absDiffInSec > fallbackThreshold) {
    return formatDate(dateObj.toISOString(), locale);
  }

  const formatter = new Intl.RelativeTimeFormat(locale, { style, numeric });

  // Determine the best unit to use
  if (absDiffInSec < TIME_CONSTANTS.MINUTE) {
    return formatter.format(diffInSec, 'second');
  }
  if (absDiffInSec < TIME_CONSTANTS.HOUR) {
    return formatter.format(
      Math.round(diffInSec / TIME_CONSTANTS.MINUTE),
      'minute'
    );
  }
  if (absDiffInSec < TIME_CONSTANTS.DAY) {
    return formatter.format(
      Math.round(diffInSec / TIME_CONSTANTS.HOUR),
      'hour'
    );
  }
  if (absDiffInSec < TIME_CONSTANTS.WEEK) {
    return formatter.format(Math.round(diffInSec / TIME_CONSTANTS.DAY), 'day');
  }
  if (absDiffInSec < TIME_CONSTANTS.MONTH) {
    return formatter.format(
      Math.round(diffInSec / TIME_CONSTANTS.WEEK),
      'week'
    );
  }
  if (absDiffInSec < TIME_CONSTANTS.YEAR) {
    return formatter.format(
      Math.round(diffInSec / TIME_CONSTANTS.MONTH),
      'month'
    );
  }

  return formatter.format(Math.round(diffInSec / TIME_CONSTANTS.YEAR), 'year');
}

/** Date format presets for common use cases */
export type DateFormatPreset =
  | 'full'
  | 'long'
  | 'medium'
  | 'short'
  | 'date-only'
  | 'time-only'
  | 'datetime';

/** Custom format options for fine-grained control */
export interface DateFormatOptions {
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
  day?: 'numeric' | '2-digit';
  weekday?: 'long' | 'short' | 'narrow';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
  hour12?: boolean;
  timeZone?: string;
  timeZoneName?: 'long' | 'short';
}

/**
 * Get Intl.DateTimeFormatOptions from a preset name
 */
function getPresetOptions(
  preset: DateFormatPreset
): Intl.DateTimeFormatOptions {
  switch (preset) {
    case 'full':
      return {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
    case 'long':
      return { year: 'numeric', month: 'long', day: 'numeric' };
    case 'medium':
      return { year: 'numeric', month: 'short', day: 'numeric' };
    case 'short':
      return { year: '2-digit', month: 'numeric', day: 'numeric' };
    case 'date-only':
      return { year: 'numeric', month: '2-digit', day: '2-digit' };
    case 'time-only':
      return { hour: '2-digit', minute: '2-digit' };
    case 'datetime':
      return {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
    default:
      return { year: 'numeric', month: 'long', day: 'numeric' };
  }
}

/**
 * Format date to localized string with preset or custom options
 * Uses native Intl.DateTimeFormat for proper locale-aware formatting.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param date - Date value (ISO string, Date object, timestamp, FirestoreTimestamp, or null/undefined)
 * @param locale - Locale string (e.g., "en", "fr", "de"). Defaults to "en"
 * @param format - Preset name or custom options. Defaults to "long"
 * @returns Localized formatted date string, or empty string if date is invalid
 *
 * @example
 * formatDate('2025-05-05T00:00:00.000Z', 'en', 'full')    // "Monday, May 5, 2025"
 * formatDate('2025-05-05T00:00:00.000Z', 'fr', 'long')    // "5 mai 2025"
 * formatDate('2025-05-05T14:30:00.000Z', 'en', 'datetime') // "May 5, 2025, 02:30 PM"
 * formatDate(new Date(), 'de', { month: 'short', day: 'numeric' }) // "5. Mai"
 */
export function formatDate(
  date: DateValue | number | string | null | undefined,
  locale: string = 'en',
  format: DateFormatPreset | DateFormatOptions = 'long'
): string {
  if (!date) return '';

  let dateObj: Date;

  // Handle different input types (lenient input)
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'object' && 'toDate' in date) {
    dateObj = (date as FirestoreTimestamp).toDate();
  } else {
    return '';
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const options =
    typeof format === 'string' ? getPresetOptions(format) : format;

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Leniently parse any date value to ISO string.
 * Accepts Date objects, ISO strings, timestamps, Firestore Timestamps, and common date formats.
 * Returns undefined for invalid/unparseable dates (never throws).
 *
 * Use this for form inputs, API responses, or any external data where format is uncertain.
 * For strict validation, use normalizeToISOString() which throws on invalid input.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param value - Any value that might be a date
 * @returns ISO string if parseable, undefined otherwise
 *
 * @example
 * parseDate(new Date())                    // "2025-12-28T10:30:00.000Z"
 * parseDate('2025-12-28')                  // "2025-12-28T00:00:00.000Z"
 * parseDate('Dec 28, 2025')                // "2025-12-28T00:00:00.000Z"
 * parseDate(1735384200000)                 // "2025-12-28T10:30:00.000Z"
 * parseDate({ toDate: () => new Date() }) // "2025-12-28T10:30:00.000Z" (Firestore)
 * parseDate('not a date')                  // undefined
 * parseDate(null)                          // undefined
 */
export function parseDate(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  // Already a valid Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  // String - try to parse
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Compact format (YYYYMMDD:HHMM)
    if (isCompactDateString(trimmed)) {
      try {
        return compactToISOString(trimmed);
      } catch {
        return undefined;
      }
    }

    // Standard parsing
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  // Timestamp (number)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  // Firestore Timestamp or similar object with toDate()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const obj = value as { toDate: unknown };
    if (typeof obj.toDate === 'function') {
      try {
        const date = obj.toDate() as Date;
        return isNaN(date.getTime()) ? undefined : date.toISOString();
      } catch {
        return undefined;
      }
    }
  }

  // Object with seconds/nanoseconds (raw Firestore timestamp structure)
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    const timestamp = value as { seconds: number; nanoseconds?: number };
    const ms =
      timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
    const parsed = new Date(ms);
    return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  return undefined;
}

/**
 * Convert date-only string to ISO with time set to noon UTC.
 * Useful for date inputs where you want to avoid timezone edge cases.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param dateString - Date string (e.g., "2025-12-28")
 * @returns ISO string with time set to 12:00:00.000Z, or undefined if invalid
 *
 * @example
 * parseDateToNoonUTC('2025-12-28') // "2025-12-28T12:00:00.000Z"
 */
export function parseDateToNoonUTC(dateString: string): string | undefined {
  const parsed = parseDate(dateString);
  if (!parsed) return undefined;

  const date = new Date(parsed);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

/**
 * Extract date-only part from any date value (YYYY-MM-DD format).
 * Strips time component for date comparisons or display.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param date - Date value (ISO string, Date object, timestamp, or null/undefined)
 * @returns Date string in YYYY-MM-DD format, or empty string if invalid
 *
 * @example
 * toDateOnly('2025-12-28T14:30:00.000Z') // "2025-12-28"
 * toDateOnly(new Date())                  // "2025-12-28"
 */
export function toDateOnly(
  date: DateValue | number | string | null | undefined
): string {
  const iso = parseDate(date);
  if (!iso) return '';
  return iso.split('T')[0] || '';
}
