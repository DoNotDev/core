// packages/core/utils/src/common/adapters/validationUtils.ts

/**
 * @fileoverview Adapter Validation Utilities
 * @description Utility functions for schema validation in adapter implementations.
 * These utilities help maintain consistent validation across all adapters without
 * requiring inheritance or base classes.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type { dndevSchema } from '@donotdev/types';

import { DoNotDevError } from '../errors';

// =============================================================================
// Schema Validation Utilities
// =============================================================================

/**
 * Validates data against a schema, throwing a DoNotDevError if validation fails.
 * Use this in adapter methods to ensure data conforms to expected schemas.
 *
 * @param schema - The Valibot schema to validate against
 * @param data - The data to validate
 * @param context - Context for error messages (e.g., "FirestoreAdapter.add")
 * @returns The validated and parsed data
 * @throws DoNotDevError if validation fails
 *
 * @example
 * ```typescript
 * async add<T>(collection: string, data: T, schema?: dndevSchema<T>): Promise<{ id: string; data: Record<string, unknown> }> {
 *   if (schema) {
 *     data = validateWithSchema(schema, data, 'MyAdapter.add');
 *   }
 *   // ... proceed with validated data
 * }
 * ```
 */
export function validateWithSchema<T>(
  schema: dndevSchema<T>,
  data: unknown,
  context: string
): T {
  try {
    return v.parse(schema, data) as T;
  } catch (error) {
    if (error instanceof v.ValiError) {
      throw new DoNotDevError(
        `Validation failed in ${context}: ${error.message}`,
        'validation-failed',
        {
          details: {
            issues: error.issues,
            input: data,
          },
          source: 'validation',
        }
      );
    }
    throw new DoNotDevError(
      `Unexpected validation error in ${context}: ${getErrorMessage(error)}`,
      'validation-failed',
      {
        originalError:
          error instanceof Error ? error : new Error(String(error)),
        source: 'validation',
      }
    );
  }
}

/**
 * Safely validates data against a schema, returning null if validation fails instead of throwing.
 * Useful when you want to handle validation errors gracefully.
 *
 * @param schema - The Valibot schema to validate against
 * @param data - The data to validate
 * @returns The validated data, or null if validation fails
 *
 * @example
 * ```typescript
 * const validated = safeValidate(schema, rawData);
 * if (!validated) {
 *   console.warn('Data validation failed, skipping...');
 *   return null;
 * }
 * ```
 */
export function safeValidate<T>(
  schema: dndevSchema<T>,
  data: unknown
): T | null {
  try {
    return v.parse(schema, data) as T;
  } catch {
    return null;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a spreadable object from validated data, ensuring it can be safely spread.
 * Use this when you need to spread validated data and add additional properties (like `id`).
 *
 * @param data - The validated data (should be an object)
 * @returns A Record that can be safely spread
 *
 * @example
 * ```typescript
 * const parsed = validateWithSchema(schema, data, 'MyAdapter.get');
 * return { ...ensureSpreadable(parsed), id } as T;
 * ```
 */
export function ensureSpreadable<T>(data: T): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  // Fallback: wrap primitive/null in object
  return { value: data } as Record<string, unknown>;
}

/**
 * Extracts a readable error message from an unknown error.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}
