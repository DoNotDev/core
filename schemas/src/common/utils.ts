// packages/core/schemas/src/common/utils.ts

/**
 * @fileoverview Schema Utilities
 * @description Common utility functions for working with schemas. Provides helper functions for schema metadata checking and manipulation.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { dndevSchema } from '@donotdev/types';
import { handleError } from '@donotdev/utils';

/**
 * Checks if an object has schema metadata (works with Valibot schemas)
 *
 * @param obj - The object to check
 * @returns Whether the object has schema metadata
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function hasMetadata(obj: unknown): obj is dndevSchema<unknown> {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    'metadata' in obj &&
    typeof (obj as { metadata?: unknown }).metadata === 'object' &&
    (obj as { metadata?: unknown }).metadata !== null
  );
}

/**
 * Gets the collection name from a schema
 *
 * @param schema - The schema to get the collection name from
 * @returns The collection name
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getCollectionName(schema: dndevSchema<unknown>): string {
  if (!hasMetadata(schema)) {
    const schemaObj = schema as Record<string, unknown>;
    const schemaType =
      schemaObj &&
      typeof schemaObj === 'object' &&
      'constructor' in schemaObj &&
      schemaObj.constructor
        ? (schemaObj.constructor as { name?: string }).name || 'unknown'
        : 'unknown';
    throw handleError(new Error('Schema does not have metadata'), {
      userMessage: 'Invalid schema: missing collection metadata',
      severity: 'error',
      context: { schemaType },
    });
  }

  return schema.metadata.collection;
}
