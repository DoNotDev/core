// packages/core/utils/src/server/dateUtils.ts

/**
 * @fileoverview Server-side date utilities
 * @description Robust date calculation utilities for server environments
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Add months to a date with proper edge case handling
 * Fixes issues like Jan 31 + 1 month = March 3 (should be Feb 28/29)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDate = result.getDate();

  result.setMonth(result.getMonth() + months);

  if (result.getDate() !== originalDate) {
    // Date overflowed, set to last day of previous month
    result.setDate(0);
  }

  return result;
}

/**
 * Add years to a date with proper edge case handling
 * Fixes issues like Feb 29 + 1 year in non-leap year
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  const originalDate = result.getDate();

  result.setFullYear(result.getFullYear() + years);

  if (result.getDate() !== originalDate) {
    // Date overflowed (leap year issue), set to last day of previous month
    result.setDate(0);
  }

  return result;
}

/**
 * Calculate subscription end date with proper edge case handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param duration - Duration string (e.g., '1month', '3months', '1year', 'lifetime')
 * @param startDate - Start date (defaults to now)
 * @returns ISO string of end date (required for Firestore compatibility)
 */
export function calculateSubscriptionEndDate(
  duration: string,
  startDate: Date = new Date()
): string {
  if (duration === 'lifetime') {
    return '2099-12-31T23:59:59.000Z';
  }

  let endDate: Date;

  if (duration === '1month') {
    endDate = addMonths(startDate, 1);
  } else if (duration === '3months') {
    endDate = addMonths(startDate, 3);
  } else if (duration === '6months') {
    endDate = addMonths(startDate, 6);
  } else if (duration === '1year') {
    endDate = addYears(startDate, 1);
  } else if (duration === '2years') {
    endDate = addYears(startDate, 2);
  } else {
    // Default to 1 month for unknown durations
    endDate = addMonths(startDate, 1);
  }

  // Always return ISO string for Firestore compatibility
  return endDate.toISOString();
}

/**
 * Get current date as ISO string (Firestore compatible)
 * @returns Current date as ISO string
 */
// Use getCurrentTimestamp from common/dateUtils instead

/**
 * Parse ISO string to Date object
 * @param isoString - ISO string to parse
 * @returns Date object
 */
export function parseISODate(isoString: string): Date {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }
  return date;
}
