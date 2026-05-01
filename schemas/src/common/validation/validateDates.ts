// packages/core/schemas/src/common/validation/validateDates.ts

/**
 * @fileoverview Date validation utility
 * @description Validates that all date strings in the data are in ISO format
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { handleError } from '@donotdev/utils';

// ISO 8601 format regex (YYYY-MM-DDTHH:mm:ss.sssZ)
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * Checks if a string potentially looks like a date
 * @param value The string to check
 * @returns Whether the string might be a date
 */
function isPotentialDateString(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length >= 19 &&
    value.includes('-') &&
    value.includes(':')
  );
}

/**
 * Recursively validates that all string values that look like potential dates
 * within an object adhere to the ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
 *
 * @param data - The object or data structure to validate
 * @param {string} [currentPath=''] - Internal tracking of the object path for error messages
 * @throws Error if any string resembling a date is not in the correct ISO format
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateDates(
  data: Record<string, unknown> | unknown[],
  currentPath: string = ''
): void {
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      const path = `${currentPath}[${index}]`;
      if (typeof item === 'string' && isPotentialDateString(item)) {
        if (!ISO_DATE_REGEX.test(item)) {
          throw handleError(
            new Error(
              `Invalid date format for ${path}. Expected ISO string (YYYY-MM-DDTHH:mm:ss.sssZ). Received: "${item}"`
            ),
            {
              userMessage: `Invalid date format for ${path}. Expected ISO string (YYYY-MM-DDTHH:mm:ss.sssZ). Received: "${item}"`,
              context: { field: path, value: item },
              severity: 'error',
            }
          );
        }
      } else if (typeof item === 'object' && item !== null) {
        validateDates(item as Record<string, unknown> | unknown[], path); // Recurse into nested objects/arrays
      }
    });
  } else if (typeof data === 'object' && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      const path = currentPath ? `${currentPath}.${key}` : key;

      if (typeof value === 'string' && isPotentialDateString(value)) {
        if (!ISO_DATE_REGEX.test(value)) {
          throw handleError(
            new Error(
              `Invalid date format for field "${path}". Expected ISO string (YYYY-MM-DDTHH:mm:ss.sssZ). Received: "${value}"`
            ),
            {
              userMessage: `Invalid date format for field "${path}". Expected ISO string (YYYY-MM-DDTHH:mm:ss.sssZ). Received: "${value}"`,
              context: { field: path, value },
              severity: 'error',
            }
          );
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recurse into nested objects or arrays
        validateDates(value as Record<string, unknown> | unknown[], path);
      }
      // Ignore other types (numbers, booleans, etc.)
    }
  }
}
