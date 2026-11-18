// packages/core/schemas/src/common/crud/create.ts

/**
 * @fileoverview CRUD create rules
 * @description The one place a create is validated. Every create site (forms, `useCrud`,
 * bulk, child rows, server functions, entity store) calls it, then persists `written`.
 * - Rule 1: a create validates everything (`create` schema).
 * - Rule 5: a `draft` create may leave required fields empty (`draft` schema).
 * - Rule 6: any other status (custom included, `deleted` included) is strict.
 * - Rule 7: no status sent → `DEFAULT_STATUS` (`STATUS_MATRIX` `isDefault`); the caller overrides
 *   it with `defaultValues.status` or the payload's `status`.
 * - Rule 8: keys the entity does not have are reported (`unknownKeys`), not written.
 *
 * Isomorphic code (client and server).
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */

import { DEFAULT_STATUS } from '@donotdev/types';

import { parseWritten, unknownKeysOf } from './prepared';
import type { CreateSchemas, PreparedWrite } from './prepared';
import { statusOf, writeSchemaFor } from './status';

/**
 * CRUD rule 7: the status a create is written with.
 *
 * @param values - Create payload or form defaults (`null` / `undefined`: none)
 * @returns `values.status`, else `DEFAULT_STATUS`
 *
 * @example
 * ```typescript
 * createStatus({ status: 'draft' }); // 'draft'
 * createStatus({ name: 'X' });       // 'available'
 * ```
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function createStatus(
  values: Readonly<Record<string, unknown>> | null | undefined
): string {
  return statusOf(values) ?? DEFAULT_STATUS;
}

/**
 * Validates one create (rules 1, 5, 6, 7, 8).
 *
 * @param schemas - `createSchemas(entity)` (or the form's projection of it): `create`, `draft`
 * @param values - The create payload as sent; a client `id` is not validated nor written (the site keeps it)
 * @returns The prepared write: `written` holds the parse output with the resulting status
 *
 * @example
 * ```typescript
 * const row = assertWrite(prepareCreate(createSchemas(product), payload), 'add(products)');
 * ```
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function prepareCreate(
  schemas: CreateSchemas,
  values: Readonly<Record<string, unknown>>
): PreparedWrite {
  const status = createStatus(values);
  const schemaKey = writeSchemaFor({ op: 'create', status });
  const value = { ...values, status };
  const result = parseWritten(
    schemaKey,
    schemaKey === 'draft' ? schemas.draft : schemas.create,
    value,
    value,
    unknownKeysOf(schemas, values)
  );
  // Rule 7: a created row always stores its status, also under a schema that does not
  // declare it (a target without entity schemas).
  return result.ok ? { ...result, written: { ...result.written, status } } : result;
}
