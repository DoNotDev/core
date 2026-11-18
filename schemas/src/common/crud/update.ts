// packages/core/schemas/src/common/crud/update.ts

/**
 * @fileoverview CRUD update rules (logical delete included)
 * @description The one place an update is validated. Every update site (forms, `useCrud`,
 * bulk, child rows, server functions, entity store) calls it, then persists `written`.
 * - Rule 2: an update validates what changes (the patch, `update` schema); a required
 *   field it sends cannot be emptied (except on a draft).
 * - Rule 3: `remove` is the logical delete, an update to `REMOVED_STATUS` (`STATUS_MATRIX` `isRemoved`).
 * - Rule 5: the row stays or becomes a draft → the patch is checked with the `draft`
 *   schema; leaving draft for a visible status checks the whole record.
 * - Rule 6: any other status (custom included) is strict.
 * - Rule 8: keys the entity does not have are reported (`unknownKeys`), not written.
 *
 * The status only changes when the patch sends one: the row's status is then the stored
 * one, so the stored row is needed unless the patch sends a hidden non-draft status.
 *
 * Isomorphic code (client and server).
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */

import { DoNotDevError, REMOVED_STATUS } from '@donotdev/types';

import { parseWritten, unknownKeysOf, wholeRecord } from './prepared';
import type { PreparedWrite, UpdateSchemas } from './prepared';
import { entersVisibleStatus, statusOf, writeSchemaFor } from './status';

/** One update to validate. */
export interface UpdateInput {
  /** Id of the updated row */
  id: string;
  /** The patch as sent */
  patch: Readonly<Record<string, unknown>>;
  /**
   * The stored row (application field names). Required unless the patch sends a hidden
   * non-draft status (`remove`): it gives the row's status and the publish check's record.
   */
  stored?: Readonly<Record<string, unknown>> | null;
}

/**
 * Whether {@link prepareUpdate} needs the stored row for this patch: always, except a
 * patch that sends a hidden non-draft status (`remove`). A writer reads the row first
 * when it is not loaded.
 *
 * @param patch - The patch as sent
 * @returns `false` only for a logical delete
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function updateNeedsStored(patch: Readonly<Record<string, unknown>>): boolean {
  return statusOf(patch) !== REMOVED_STATUS;
}

/**
 * What an update is checked against (rules 2, 5, 6): the schema of the resulting status,
 * and whether the whole record is checked (leaving draft for a visible status) or only
 * the patch. Forms ask it to validate the same way the writers do.
 *
 * @param patch - The patch (only its `status` is read)
 * @param stored - The stored row (only its `status` is read)
 * @returns `schemaKey` (`draft` | `update`) and `whole`
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function updateCheck(
  patch: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, unknown>> | null | undefined
): { schemaKey: 'draft' | 'update'; whole: boolean } {
  const statusInput = { op: 'update', status: statusOf(patch), storedStatus: statusOf(stored) } as const;
  const schemaKey = writeSchemaFor(statusInput) === 'draft' ? 'draft' : 'update';
  return { schemaKey, whole: entersVisibleStatus(statusInput) };
}

/**
 * Validates one update (rules 2, 5, 6, 8).
 *
 * @param schemas - `createSchemas(entity)` (or the form's projection of it)
 * @param input - Id, patch, stored row
 * @returns The prepared write: `written` holds the parsed values of the sent keys (never `id`)
 * @throws {DoNotDevError} `internal` when the stored row is needed and missing (a caller bug: read it first)
 *
 * @example
 * ```typescript
 * const patch = assertWrite(prepareUpdate(schemas, { id, patch: { name }, stored }), 'update(products)');
 * ```
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function prepareUpdate(
  schemas: UpdateSchemas,
  { id, patch, stored }: UpdateInput
): PreparedWrite {
  const status = statusOf(patch);
  if (!stored && updateNeedsStored(patch)) {
    throw new DoNotDevError(
      `CRUD update rules: row "${id}" needs its stored row (the row's status${status === null ? '' : ' and the publish check'} come from it); read it before the update.`,
      'internal'
    );
  }
  const { schemaKey, whole } = updateCheck(patch, stored);
  const unknownKeys = unknownKeysOf(schemas, patch);
  // Rule 5: leaving draft for a visible status → the whole record (stored + patch).
  if (stored && whole) {
    return parseWritten(
      schemaKey,
      schemas.update,
      wholeRecord({ ...stored, ...patch, id }, schemas.update),
      patch,
      unknownKeys
    );
  }
  // Rule 5: a draft write checks the patch with the draft schema (filled values keep their format).
  // Rule 2: any other update checks the patch with the update schema.
  const value =
    schemaKey === 'draft'
      ? { ...patch, status: statusOf(patch) ?? statusOf(stored), id }
      : { ...patch, id };
  return parseWritten(
    schemaKey,
    schemaKey === 'draft' ? schemas.draft : schemas.update,
    value,
    patch,
    unknownKeys
  );
}

/**
 * Validates one logical delete (rule 3): the update `{ status: REMOVED_STATUS }`. No stored
 * row needed; required fields left empty never block it. `delete(id)` is the hard delete.
 *
 * @param schemas - `createSchemas(entity)`
 * @param id - Id of the removed row
 * @returns The prepared write (`written` = `{ status: 'deleted' }`)
 *
 * @example
 * ```typescript
 * const patch = assertWrite(prepareRemove(schemas, id), 'remove(products)');
 * ```
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function prepareRemove(schemas: UpdateSchemas, id: string): PreparedWrite {
  return prepareUpdate(schemas, { id, patch: { status: REMOVED_STATUS } });
}
