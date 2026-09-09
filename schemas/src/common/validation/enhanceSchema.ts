// packages/core/schemas/src/common/validation/enhanceSchema.ts

/**
 * @fileoverview Schema enhancement utility
 * @description Enhances a Valibot schema with additional metadata
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type * as v from 'valibot';

import type { dndevSchema, SchemaMetadata } from '@donotdev/types';

/**
 * Enhances a Valibot schema with additional metadata.
 *
 * @param schema - The base Valibot schema
 * @param metadata - The metadata to attach
 * @returns The enhanced schema
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function enhanceSchema<T>(
  schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
  metadata: SchemaMetadata
): dndevSchema<T> {
  const enhanced = schema as dndevSchema<T>;
  enhanced.metadata = metadata;
  return enhanced;
}
