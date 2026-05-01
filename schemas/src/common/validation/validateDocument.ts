// packages/core/schemas/src/common/validation/validateDocument.ts

/**
 * @fileoverview Document validation utility
 * @description Validates a document against a schema with enhanced validation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type { dndevSchema } from '@donotdev/types';

import { validateDates } from './validateDates';
import { validateUniqueFields } from './validateUniqueFields';

/**
 * Validates a document against the schema, including uniqueness and custom validations.
 * @param schema - The enhanced schema.
 * @param data - The document data.
 * @param operation - 'create' or 'update'.
 * @param currentDocId - Optional current document ID for update operations.
 * @throws DoNotDevError if validation fails.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function validateDocument<T>(
  schema: dndevSchema<T>,
  data: Record<string, unknown>,
  operation: 'create' | 'update',
  currentDocId?: string
): Promise<void> {
  // Validate against schema
  v.parse(schema, data);

  // Validate dates have correct ISO format
  validateDates(data);

  // Validate unique fields if the schema has uniqueness constraints
  await validateUniqueFields(schema, data, currentDocId);

  // Execute custom validations if provided in schema metadata
  if (schema.metadata.customValidate) {
    await schema.metadata.customValidate(data, operation);
  }
}
