// packages/core/schemas/src/common/validation/validateUniqueFields.ts

/**
 * @fileoverview Unique field validation utility
 * @description Validates uniqueness constraints for schema fields
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { dndevSchema, UniqueConstraintValidator } from '@donotdev/types';
import { handleError } from '@donotdev/utils';

/**
 * Registry for database adapters
 */
const validatorRegistry: {
  uniqueConstraintValidator?: UniqueConstraintValidator;
} = {};

/**
 * Registers a validator for uniqueness constraints
 *
 * @param validator - The validator implementation
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function registerUniqueConstraintValidator(
  validator: UniqueConstraintValidator
): void {
  validatorRegistry.uniqueConstraintValidator = validator;
}

/**
 * Validates unique fields for a document across environments.
 *
 * @param schema - The Valibot schema with metadata.
 * @param data - The document data.
 * @param currentDocId - Optional ID of the current document (for updates).
 * @throws Error if a unique constraint is violated.
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function validateUniqueFields<T>(
  schema: dndevSchema<T>,
  data: Record<string, unknown>,
  currentDocId?: string
): Promise<void> {
  const { uniqueFields = [], collection } = schema.metadata;
  if (uniqueFields.length === 0) return;

  // Skip uniqueness check if no validator is registered
  if (!validatorRegistry.uniqueConstraintValidator) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'No uniqueness validator registered. Skipping uniqueness check.'
      );
    }
    return;
  }

  await Promise.all(
    uniqueFields.map(async ({ field, errorMessage }) => {
      const value = data[field];
      if (value === undefined || value === null) return;

      const isDuplicate =
        await validatorRegistry.uniqueConstraintValidator!.checkDuplicate(
          collection,
          field,
          value,
          currentDocId
        );

      if (isDuplicate) {
        throw handleError(
          new Error(errorMessage || `${field} must be unique`),
          {
            userMessage: errorMessage || `${field} must be unique`,
            context: { field },
          }
        );
      }
    })
  );
}
