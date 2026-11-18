// packages/core/schemas/src/common/crud/read.ts

/**
 * @fileoverview CRUD read rules
 * @description The one place the hidden-status read rule lives. Every read site (server
 * get / list) asks it instead of comparing roles and statuses itself.
 * - Rule 4: a row is read only by roles that reach its status's `read` role (`STATUS_MATRIX`).
 * Field visibility by role (rule 9) stays `filterVisibleFields` (entity `visibility`).
 *
 * Isomorphic code (client and server).
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */

import { BUILT_IN_STATUSES } from '@donotdev/types';

import { statusOf, statusReadableBy } from './status';

/**
 * CRUD rule 4: the statuses a role does not read (`STATUS_MATRIX` `read`). A list query
 * excludes them (`status not in …`, nothing to exclude when empty).
 *
 * @param role - Viewer role (`undefined`: unauthenticated)
 * @returns The built-in statuses whose `read` role the viewer does not reach
 *
 * @example
 * ```typescript
 * const hidden = hiddenStatusesFor(userRole);
 * if (hidden.length > 0) query = query.not('status', 'in', [...hidden]);
 * ```
 *
 * @version 0.2.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function hiddenStatusesFor(role: string | undefined): readonly string[] {
  return BUILT_IN_STATUSES.filter((status) => !statusReadableBy(status, role));
}

/**
 * CRUD rule 4 for one row: whether the role reads it (`STATUS_MATRIX` `read`).
 *
 * @param row - Stored row (`status` read with `statusOf`)
 * @param role - Viewer role (`undefined`: unauthenticated)
 * @returns `false` when the viewer does not reach the row status's `read` role
 *
 * @version 0.2.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function isReadableBy(
  row: Readonly<Record<string, unknown>> | null | undefined,
  role: string | undefined
): boolean {
  return statusReadableBy(statusOf(row), role);
}
