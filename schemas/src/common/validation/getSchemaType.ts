// packages/core/schemas/src/common/validation/getSchemaType.ts

/**
 * @fileoverview Field schema with presence rules
 * @description Valibot schema of one entity field: its value (resolved by
 * `fieldSemantics.ts`: `validation.schema` > `validation.reference` > `BUILTIN_VALUES`,
 * custom type without value throws) wrapped with the required/optional rule.
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type { EntityField, FieldType } from '@donotdev/types';

import { resolveFieldValue } from '../fieldSemantics';

// ============================================================================
// Helper: Apply required/optional wrapper
// ============================================================================

/**
 * Wraps schema based on required flag.
 * - required: true → the value must be filled in: `null`, `undefined` and `''` are rejected
 *   (`null` is the empty value of forms and grids; `''` is empty too, from any other writer)
 * - required: false/undefined → v.nullish() (accepts null, undefined, or valid value)
 */
function applyRequired<
  T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
  schema: T,
  required?: boolean
): v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
  return required
    ? v.pipe(schema, v.check((value) => value !== '', 'Required'))
    : v.nullish(schema);
}

/**
 * Get the Valibot schema of an entity field: its value (see `resolveFieldValue`)
 * with the presence rule of `validation.required` (required: `null`, `undefined`
 * and `''` rejected; optional: nullish).
 *
 * Value order:
 * 1. `field.validation.schema` (any type)
 * 2. `field.validation.reference` (any type): non-empty id string
 * 3. `BUILTIN_VALUES[field.type]`
 * 4. Custom type with none of the above: throws (no `v.unknown()`)
 *
 * @param field - Entity field
 * @returns Field schema with presence applied
 * @throws When a custom type has no value shape
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getSchemaType(
  field: EntityField<FieldType>
): v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
  return applyRequired(
    resolveFieldValue(field).schema,
    field.validation?.required
  );
}
