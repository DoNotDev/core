// packages/core/utils/src/common/arrayTranslations.ts

import type { TFunction } from 'i18next';

/**
 * @fileoverview Array translation utilities
 * @description Provides utilities for handling array translations with indexed keys
 *
 * This module provides utilities to simplify the common pattern of accessing
 * array translations using indexed keys instead of returnObjects.
 *
 * **Why This Pattern?**
 * - Performance: Indexed access is faster than object parsing
 * - Consistency: Matches the framework's established patterns
 * - Reliability: Works across all i18n modes (standalone, UI, EDA)
 * - Filtering: Easy to filter out missing translations (returns key when missing)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Usage Pattern:**
 * ```typescript
 * import { translateArray } from '@donotdev/utils';
 *
 * const benefits = translateArray(t, 'benefits', 6); // Gets benefits.0 through benefits.5
 * const features = translateArray(t, 'features.list', 3); // Gets features.list.0 through features.list.2
 * ```
 */

/**
 * Translates an array using indexed keys and filters out missing translations
 *
 * **IMPORTANT:** This works with JSON arrays directly. i18next automatically treats
 * array indices as object keys, so `t('items.0')` works when JSON has `"items": ["value1", ...]`
 *
 * @param t - Translation function from useTranslation hook
 * @param keyPrefix - Base key prefix for the array (e.g., 'benefits', 'features.list')
 * @param maxIndex - Maximum index to check (exclusive, so 6 means indices 0-5)
 * @param options - Additional options for filtering
 * @returns Array of translated strings with missing translations filtered out
 *
 * @example
 * // JSON: { "benefits": ["value1", "value2", "value3"] }
 * const benefits = translateArray(t, 'benefits', 6);
 * // Result: ["value1", "value2", "value3"]
 * // Works because i18next treats arrays as objects with numeric keys
 *
 * @example
 * // JSON: { "features": { "list": ["feature1", "feature2"] } }
 * const features = translateArray(t, 'features.list', 5);
 * // Result: ["feature1", "feature2"]
 *
 * @example
 * // JSON: { "items": ["a", "b", "c", "d"] }
 * // Usage with List component:
 * <List items={translateArray(t, 'items', 10)} />
 * // i18next accesses items.0, items.1, etc. automatically
 *
 * @example
 * // With custom filtering
 * const items = translateArray(t, 'items', 10, {
 *   minLength: 2, // Only include items with at least 2 characters
 *   excludeEmpty: true // Exclude empty strings
 * });
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function translateArray(
  t: TFunction,
  keyPrefix: string,
  maxIndex: number,
  options: {
    minLength?: number;
    excludeEmpty?: boolean;
    customFilter?: (item: string, index: number) => boolean;
  } = {}
): string[] {
  const { minLength = 0, excludeEmpty = true, customFilter } = options;

  return Array.from({ length: maxIndex }, (_, index) => {
    const key = `${keyPrefix}.${index}`;
    return t(key);
  }).filter((item, index) => {
    // Filter out missing translations (returns key when missing)
    const key = `${keyPrefix}.${index}`;
    if (item === key) {
      return false;
    }

    // Filter out empty strings if requested
    if (excludeEmpty && item.trim() === '') {
      return false;
    }

    // Filter by minimum length
    if (item.length < minLength) {
      return false;
    }

    // Apply custom filter if provided
    if (customFilter && !customFilter(item, index)) {
      return false;
    }

    return true;
  });
}

/**
 * Translates an array of objects using indexed keys
 *
 * @param t - Translation function from useTranslation hook
 * @param keyPrefix - Base key prefix for the array (e.g., 'cases', 'items')
 * @param maxIndex - Maximum index to check (exclusive, so 4 means indices 0-3)
 * @param keys - Array of property keys to extract from each object (e.g., ['useCase', 'bestFit', 'dndev', 'reason'])
 * @returns Array of translated objects with missing translations filtered out
 *
 * @example
 * // JSON: { "cases": { "0": { "useCase": "...", "bestFit": "..." }, "1": {...} } }
 * const cases = translateObjectArray(t, 'cases', 4, ['useCase', 'bestFit', 'dndev', 'reason']);
 * // Result: [{ useCase: "...", bestFit: "...", dndev: "...", reason: "..." }, ...]
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function translateObjectArray<
  K extends string,
  T extends Record<K, string> = Record<K, string>,
>(t: TFunction, keyPrefix: string, maxIndex: number, keys: readonly K[]): T[] {
  return Array.from({ length: maxIndex }, (_, index) => {
    const firstKey = `${keyPrefix}.${index}.${String(keys[0])}`;
    const firstValue = t(firstKey);

    // Filter out missing translations (when key equals value)
    if (firstValue === firstKey) {
      return null;
    }

    const obj = {} as T;
    for (const key of keys) {
      const translationKey = `${keyPrefix}.${index}.${String(key)}`;
      obj[key as keyof T] = t(translationKey) as T[keyof T];
    }
    return obj;
  }).filter((item): item is T => item !== null);
}

/**
 * Translates an array with a specific range of indices
 *
 * @param t - Translation function from useTranslation hook
 * @param keyPrefix - Base key prefix for the array
 * @param startIndex - Starting index (inclusive)
 * @param endIndex - Ending index (exclusive)
 * @param options - Additional options for filtering
 * @returns Array of translated strings with missing translations filtered out
 *
 * @example
 * // Get items 2-5 (indices 2, 3, 4)
 * const items = translateArrayRange(t, 'items', 2, 5);
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function translateArrayRange(
  t: TFunction,
  keyPrefix: string,
  startIndex: number,
  endIndex: number,
  options: {
    minLength?: number;
    excludeEmpty?: boolean;
    customFilter?: (item: string, index: number) => boolean;
  } = {}
): string[] {
  const { minLength = 0, excludeEmpty = true, customFilter } = options;

  return Array.from({ length: endIndex - startIndex }, (_, i) => {
    const index = startIndex + i;
    const key = `${keyPrefix}.${index}`;
    return t(key);
  }).filter((item, i) => {
    const index = startIndex + i;
    const key = `${keyPrefix}.${index}`;

    // Filter out missing translations (returns key when missing)
    if (item === key) {
      return false;
    }

    // Filter out empty strings if requested
    if (excludeEmpty && item.trim() === '') {
      return false;
    }

    // Filter by minimum length
    if (item.length < minLength) {
      return false;
    }

    // Apply custom filter if provided
    if (customFilter && !customFilter(item, index)) {
      return false;
    }

    return true;
  });
}

/**
 * Translates an array and returns both the items and their original indices
 * Useful when you need to maintain the original index information
 *
 * @param t - Translation function from useTranslation hook
 * @param keyPrefix - Base key prefix for the array
 * @param maxIndex - Maximum index to check (exclusive)
 * @param options - Additional options for filtering
 * @returns Array of objects with item and originalIndex properties
 *
 * @example
 * // Get benefits with their original indices
 * const benefitsWithIndices = translateArrayWithIndices(t, 'benefits', 6);
 * // Result: [
 * //   { item: "value1", originalIndex: 0 },
 * //   { item: "value2", originalIndex: 1 },
 * //   { item: "value3", originalIndex: 2 }
 * // ]
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function translateArrayWithIndices(
  t: TFunction,
  keyPrefix: string,
  maxIndex: number,
  options: {
    minLength?: number;
    excludeEmpty?: boolean;
    customFilter?: (item: string, index: number) => boolean;
  } = {}
): Array<{ item: string; originalIndex: number }> {
  const { minLength = 0, excludeEmpty = true, customFilter } = options;

  return Array.from({ length: maxIndex }, (_, index) => {
    const key = `${keyPrefix}.${index}`;
    const item = t(key);
    return { item, originalIndex: index };
  }).filter(({ item, originalIndex }) => {
    // Filter out missing translations (returns key when missing)
    const key = `${keyPrefix}.${originalIndex}`;
    if (item === key) {
      return false;
    }

    // Filter out empty strings if requested
    if (excludeEmpty && item.trim() === '') {
      return false;
    }

    // Filter by minimum length
    if (item.length < minLength) {
      return false;
    }

    // Apply custom filter if provided
    if (customFilter && !customFilter(item, originalIndex)) {
      return false;
    }

    return true;
  });
}
