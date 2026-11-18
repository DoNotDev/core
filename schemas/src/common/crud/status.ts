// packages/core/schemas/src/common/crud/status.ts

/**
 * @fileoverview Status rule of writes
 * @description The one rule that picks the write schema from the resulting status.
 * Every write site (forms, client CRUD, bulk, child rows, server functions) asks it
 * instead of comparing `status === 'draft'` itself.
 *
 * Isomorphic code (client and server).
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */

import { CUSTOM_STATUS, STATUS_MATRIX } from '@donotdev/types';
import type { BuiltInStatus, StatusCapability } from '@donotdev/types';
import { hasRoleAccess } from '@donotdev/utils/server';

import type { OperationSchemas } from '../createSchema';

/** Write operation: insert a new document or patch a stored one. */
export type WriteOperation = 'create' | 'update';

/** Key of the write schema in {@link OperationSchemas}. */
export type WriteSchemaKey = Extract<
  keyof OperationSchemas,
  'create' | 'draft' | 'update'
>;

/** Input of {@link writeSchemaFor}. */
export interface WriteSchemaForInput {
  /** Write operation */
  op: WriteOperation;
  /** Status sent by the write (payload / patch); `null` or omitted = not sent */
  status?: string | null;
  /** Status of the stored document (update); `null` or omitted = unknown */
  storedStatus?: string | null;
}

/**
 * A row's status as {@link writeSchemaFor} / {@link entersVisibleStatus} read it:
 * the `status` string, `null` when the row has none (no row, no key, not a string).
 *
 * @param row - Payload, patch, form values or stored row (`null` / `undefined`: unknown)
 * @returns The status or `null`
 *
 * @example
 * ```typescript
 * writeSchemaFor({ op: 'update', status: statusOf(patch), storedStatus: statusOf(stored) });
 * ```
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export function statusOf(
  row: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  const status = row?.status;
  return typeof status === 'string' ? status : null;
}

/**
 * Picks the write schema from the resulting status of a write.
 * Resulting status = `status ?? storedStatus`:
 * - a status that saves incomplete (`statusCan(…, 'saveIncomplete')`, the matrix) → `draft`
 *   (required fields may be empty, filled values keep their format)
 * - otherwise, `create` → `create`; `update` → `update`
 *
 * A create without status gets the default status (`DEFAULT_STATUS`, the matrix), so it is
 * validated with `create`. An update of a stored draft that does not change the
 * status is a draft write.
 *
 * @param input - Operation, sent status, stored status
 * @returns Key of the schema in `createSchemas(entity)`
 *
 * @example
 * ```typescript
 * const schemas = createSchemas(entity);
 * const schema = schemas[writeSchemaFor({ op: 'update', status: patch.status, storedStatus: doc.status })];
 * ```
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export function writeSchemaFor({
  op,
  status,
  storedStatus,
}: WriteSchemaForInput): WriteSchemaKey {
  const resulting = status ?? storedStatus;
  if (statusCan(resulting, 'saveIncomplete')) return 'draft';
  return op === 'create' ? 'create' : 'update';
}

/**
 * Whether an update leaves a status that may hold an incomplete row (`holdIncomplete`:
 * a draft, a removed row) for one that may not (`STATUS_MATRIX`). Publishing a draft
 * (`{ status: 'available' }` on a stored draft) is the main case.
 *
 * Such a write is checked whole: the merged document (stored + patch) against the
 * `update` schema, so required fields left empty while the document was relaxed
 * are rejected and the non-draft row type stays exact. Moving into a hidden status
 * (`deleted`, back to `draft`) and keeping the status are not.
 *
 * @param input - Operation, sent status, stored status
 * @returns `true` for an update entering a visible status
 *
 * @example
 * ```typescript
 * if (entersVisibleStatus({ op: 'update', status: patch.status, storedStatus: doc.status })) {
 *   validateDocument({ ...doc, ...patch, id }, schemas.update);
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export function entersVisibleStatus({
  op,
  status,
  storedStatus,
}: WriteSchemaForInput): boolean {
  if (op !== 'update') return false;
  const resulting = status ?? storedStatus;
  if (resulting == null || resulting === storedStatus) return false;
  // Leaving a status that may hold an incomplete row for one that may not (a draft or a
  // removed row published): the whole record is checked.
  return statusCan(storedStatus, 'holdIncomplete') && !statusCan(resulting, 'holdIncomplete');
}

/** The matrix row of a status: built-in, else what an app-added status can do. */
function statusRow(status: string | null | undefined) {
  return status != null && Object.hasOwn(STATUS_MATRIX, status)
    ? STATUS_MATRIX[status as BuiltInStatus]
    : CUSTOM_STATUS;
}

/**
 * What a status can do (`STATUS_MATRIX`): the one question every CRUD rule asks.
 * A status an app adds can do what `available` can.
 *
 * @param status - The status (`null` / `undefined`: none, read as `available`)
 * @param capability - `saveIncomplete` | `holdIncomplete` | `isDefault` | `isRemoved`
 * @returns The matrix answer
 *
 * @example
 * ```typescript
 * statusCan('draft', 'saveIncomplete'); // true
 * statusCan('sold', 'holdIncomplete');  // false (app status, like available)
 * ```
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function statusCan(
  status: string | null | undefined,
  capability: StatusCapability
): boolean {
  return statusRow(status)[capability];
}

/**
 * Whether a role reads rows in a status (`STATUS_MATRIX` `read`; CRUD rule 4).
 *
 * @param status - The row's status (`null`: none, read as `available`)
 * @param role - Viewer role (`undefined`: unauthenticated)
 * @returns `true` when the role reaches the status's `read` role
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function statusReadableBy(
  status: string | null | undefined,
  role: string | undefined
): boolean {
  const read = statusRow(status).read;
  return read === 'guest' || hasRoleAccess(role, read);
}

/**
 * The built-in statuses with a capability (`STATUS_MATRIX`).
 *
 * @param capability - The capability
 * @returns The statuses that have it
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function statusesThat(capability: StatusCapability): BuiltInStatus[] {
  return (Object.keys(STATUS_MATRIX) as BuiltInStatus[]).filter(
    (status) => STATUS_MATRIX[status][capability]
  );
}

