// packages/core/schemas/src/common/optionHelpers.ts

/**
 * @fileoverview Option generation helpers for select fields
 * @description Simple utilities to generate options arrays for select/dropdown fields.
 * These are isomorphic and can be used in entity definitions (shared by client and server).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/** Standard option format for select fields */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Generates numeric range options for a select field.
 *
 * @param start - First number in the range
 * @param end - Last number in the range
 * @param step - Increment between numbers (default: 1)
 * @param descending - Whether to sort descending (default: false)
 * @returns Array of options with value and label
 *
 * @example
 * ```ts
 * // Quantities 1-10
 * options: rangeOptions(1, 10)
 *
 * // Percentages 0-100 by 10
 * options: rangeOptions(0, 100, 10)
 * ```
 */
export function rangeOptions(
  start: number,
  end: number,
  step: number = 1,
  descending: boolean = false
): SelectOption[] {
  const options: SelectOption[] = [];

  if (descending) {
    for (let n = end; n >= start; n -= step) {
      options.push({ value: String(n), label: String(n) });
    }
  } else {
    for (let n = start; n <= end; n += step) {
      options.push({ value: String(n), label: String(n) });
    }
  }

  return options;
}
