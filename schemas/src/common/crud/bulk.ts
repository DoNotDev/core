// packages/core/schemas/src/common/crud/bulk.ts

/**
 * @fileoverview Bulk CRUD wire schemas
 * @description Valibot schemas for the transactional bulk endpoint
 *   `POST /api/crud/:collection/bulk`. These are on-the-wire validators only —
 *   row shapes are kept opaque (`record<string, unknown>`) because per-entity
 *   validation is performed upstream by the CRUD service against the entity's
 *   generated `create` / `update` schemas. Isomorphic (client + server).
 *
 * @version 0.1.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

// ============================================================================
// Row shapes (opaque — per-entity validation happens in the CRUD service)
// ============================================================================

/**
 * Opaque insert row schema.
 *
 * The bulk endpoint does not know the entity at parse time; per-field
 * validation is delegated to the CRUD service using the entity's `create`
 * schema. We only enforce the structural invariant: each insert is an object.
 *
 * @example
 * import * as v from 'valibot';
 * import { BulkInsertSchema } from '@donotdev/schemas';
 *
 * v.parse(BulkInsertSchema, { name: 'Alice', age: 30 });
 */
export const BulkInsertSchema = v.record(v.string(), v.unknown());

/**
 * Opaque update row schema: `{ id, patch }`.
 *
 * `patch` keeps field-level validation deferred to the entity's `update`
 * schema, mirroring how single-row `update()` accepts a partial payload.
 *
 * @example
 * import * as v from 'valibot';
 * import { BulkUpdateSchema } from '@donotdev/schemas';
 *
 * v.parse(BulkUpdateSchema, { id: 'abc', patch: { name: 'Bob' } });
 */
export const BulkUpdateSchema = v.object({
  id: v.string(),
  patch: v.record(v.string(), v.unknown()),
});

/**
 * Opaque delete-id schema — a single document id.
 *
 * @example
 * import * as v from 'valibot';
 * import { BulkDeleteIdSchema } from '@donotdev/schemas';
 *
 * v.parse(BulkDeleteIdSchema, 'doc-123');
 */
export const BulkDeleteIdSchema = v.string();

// ============================================================================
// Request / Response
// ============================================================================

/**
 * Wire schema for `POST /:collection/bulk` request body.
 *
 * All three op arrays are optional so clients can submit any subset.
 * An empty object `{}` is a valid no-op payload — the service short-circuits
 * and returns empty arrays without hitting the database.
 *
 * Per the bulk contract (see `BULK_CRUD_TODO.md`):
 *   1. Atomic — all ops succeed or none do.
 *   2. One round-trip.
 *   3. Validation up-front (per-entity schemas in CRUD service).
 *   4. Collision rejection (see `detectBulkCollisions`).
 *
 * @example
 * import * as v from 'valibot';
 * import { BulkRequestSchema } from '@donotdev/schemas';
 *
 * const body = v.parse(BulkRequestSchema, {
 *   inserts: [{ name: 'Alice' }],
 *   updates: [{ id: 'a', patch: { name: 'Bob' } }],
 *   deletes: ['c'],
 * });
 */
export const BulkRequestSchema = v.object({
  inserts: v.optional(v.array(BulkInsertSchema)),
  updates: v.optional(v.array(BulkUpdateSchema)),
  deletes: v.optional(v.array(BulkDeleteIdSchema)),
});

/**
 * Wire schema for `POST /:collection/bulk` response body.
 *
 * Arrays preserve input order so consumers can zip the echoed ids back onto
 * the client-side op list (e.g. to reconcile optimistic cache entries).
 *
 * @example
 * import * as v from 'valibot';
 * import { BulkResponseSchema } from '@donotdev/schemas';
 *
 * const result = v.parse(BulkResponseSchema, {
 *   insertedIds: ['new-1'],
 *   updatedIds: ['a'],
 *   deletedIds: ['c'],
 * });
 */
export const BulkResponseSchema = v.object({
  insertedIds: v.array(v.string()),
  updatedIds: v.array(v.string()),
  deletedIds: v.array(v.string()),
});

// ============================================================================
// Inferred types
// ============================================================================

/**
 * Inferred request type for the bulk endpoint.
 *
 * @example
 * import type { BulkRequest } from '@donotdev/schemas';
 *
 * const req: BulkRequest = { deletes: ['a'] };
 */
export type BulkRequest = v.InferOutput<typeof BulkRequestSchema>;

/**
 * Inferred response type for the bulk endpoint.
 *
 * @example
 * import type { BulkResponse } from '@donotdev/schemas';
 *
 * const res: BulkResponse = { insertedIds: [], updatedIds: [], deletedIds: [] };
 */
export type BulkResponse = v.InferOutput<typeof BulkResponseSchema>;

// ============================================================================
// Validated service outcomes (additive; the atomic wire schema stays unchanged)
// ============================================================================

/** Operation-appropriate failure identity for validated bulk acknowledgements. */
export const BulkOutcomeFailureSchema = v.variant('op', [
  v.object({
    op: v.literal('insert'),
    index: v.pipe(v.number(), v.integer(), v.minValue(0)),
    id: v.optional(v.string()),
    error: v.string(),
  }),
  v.object({
    op: v.literal('update'),
    id: v.string(),
    index: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    error: v.string(),
  }),
  v.object({
    op: v.literal('delete'),
    id: v.string(),
    index: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    error: v.string(),
  }),
]);

/** Service result schema preserving per-row failures, unlike the atomic wire schema. */
export const BulkOutcomeSchema = v.object({
  ...BulkResponseSchema.entries,
  // Legacy atomic replies omit failures; request-aware validation still proves completeness.
  failed: v.optional(v.array(BulkOutcomeFailureSchema), () => []),
});

/**
 * Validate a legacy service result against the exact submitted operations.
 *
 * Throws before reconciliation unless each operation has exactly one outcome.
 * Insert successes correspond, in order, to input indexes not listed as failed;
 * server-generated ID ordering cannot be independently proven without an echo
 * protocol. Explicit insert IDs are not assumed to be honored by legacy adapters.
 * Repeated update/delete IDs remain valid when every occurrence has the same
 * outcome and the response preserves multiplicity. Mixed outcomes for a repeated
 * ID are ambiguous and rejected. Allowed insert/delete overlap is unchanged.
 *
 * Transport callers must preserve `failed` using {@link BulkOutcomeSchema};
 * {@link BulkResponseSchema} intentionally strips it for legacy atomic consumers.
 * A rejection means unknown commit outcome: reconcile authoritative state, never
 * replay writes on the strength of this validation error.
 *
 * @param ops - The operations actually sent to the adapter.
 * @param response - Untrusted adapter acknowledgement, including `failed`.
 * @returns A structurally and request-validated result compatible with BulkResult.
 */
export function validateBulkOutcome(ops: BulkRequest, response: unknown) {
  const result = v.parse(BulkOutcomeSchema, response);
  const invalid = (reason: string): never => {
    throw new Error(`Invalid bulk acknowledgement: ${reason}`);
  };
  const inserts = ops.inserts ?? [];
  const failedInserts = new Set<number>();
  for (const failure of result.failed) {
    if (failure.op !== 'insert') continue;
    if (failure.index >= inserts.length || failedInserts.has(failure.index)) {
      invalid('unknown or duplicate insert index');
    }
    const row = inserts[failure.index]!;
    if (failure.id !== undefined && failure.id !== row.id) {
      invalid('contradictory insert identity');
    }
    failedInserts.add(failure.index);
  }
  if (result.insertedIds.length + failedInserts.size !== inserts.length) {
    invalid('missing or extra insert outcomes');
  }
  if (new Set(result.insertedIds).size !== result.insertedIds.length) {
    invalid('duplicate inserted ID');
  }
  const failedExplicitIds = new Set(
    [...failedInserts]
      .map((index) => inserts[index]!.id)
      .filter((id): id is string => typeof id === 'string')
  );
  if (result.insertedIds.some((id) => failedExplicitIds.has(id))) {
    invalid('insert ID both successful and failed');
  }

  for (const op of ['update', 'delete'] as const) {
    const inputIds =
      op === 'update'
        ? (ops.updates ?? []).map(({ id }) => id)
        : (ops.deletes ?? []);
    const successes = op === 'update' ? result.updatedIds : result.deletedIds;
    const expected = new Map<string, number>();
    for (const id of inputIds) expected.set(id, (expected.get(id) ?? 0) + 1);
    const failures = new Map<string, number>();
    const failedIndexes = new Set<number>();
    for (const failure of result.failed) {
      if (failure.op !== op) continue;
      if (
        !expected.has(failure.id) ||
        (failure.index !== undefined && inputIds[failure.index] !== failure.id)
      ) {
        invalid(`unknown or contradictory ${op} identity`);
      }
      if (failure.index !== undefined) {
        if (failedIndexes.has(failure.index)) invalid(`duplicate ${op} failure index`);
        failedIndexes.add(failure.index);
      }
      failures.set(failure.id, (failures.get(failure.id) ?? 0) + 1);
    }
    const remaining = inputIds.filter((id) => !failures.has(id));
    for (const [id, count] of failures) {
      if (count !== expected.get(id)) invalid(`duplicate or ambiguous ${op} failures`);
    }
    if (
      remaining.length !== successes.length ||
      remaining.some((id, index) => successes[index] !== id)
    ) {
      invalid(`missing, duplicate, unknown or contradictory ${op} outcomes`);
    }
  }
  return result;
}

// ============================================================================
// Collision detection
// ============================================================================

/**
 * Report returned by {@link detectBulkCollisions}.
 *
 * `where` identifies the first category of collision encountered. `collisions`
 * lists the offending ids for that category. Callers decide how to surface
 * this (the CRUD service throws; server handlers return 400).
 *
 * @since 0.2.0
 */
export interface BulkCollisionReport {
  /** Ids that appear in both collided sets. Empty iff `where === null`. */
  collisions: string[];
  /** Which pair collided, or `null` when no collision was found. */
  where: 'updates-deletes' | 'inserts-updates' | null;
}

/**
 * Detects id collisions that must reject a bulk op before any write.
 *
 * Separated from the Valibot parse so the wire schema stays purely structural
 * and callers can surface a precise error (which ids, which pair). Pure, no
 * side effects — the caller throws.
 *
 * Collision rules (see `BULK_CRUD_TODO.md` §7):
 *   - Same id in `updates` and `deletes` → ambiguous intent, reject.
 *   - Same id in `inserts` (if the client supplies an explicit `id`) and
 *     `updates` → ambiguous intent, reject.
 *   - Inserts without an explicit id never collide (server mints the id).
 *
 * Checks run in order: `updates-deletes` first, then `inserts-updates`. The
 * first collision found short-circuits — one clear error per request.
 *
 * @param ops - The bulk ops to inspect. All three arrays are optional.
 * @returns A report; `where === null` means no collision.
 *
 * @example
 * import { detectBulkCollisions } from '@donotdev/schemas';
 *
 * detectBulkCollisions({ updates: [{ id: 'a', patch: {} }], deletes: ['a'] });
 * // => { collisions: ['a'], where: 'updates-deletes' }
 */
export function detectBulkCollisions(ops: {
  inserts?: Array<{ id?: string; [k: string]: unknown }>;
  updates?: Array<{ id: string; patch: unknown }>;
  deletes?: string[];
}): BulkCollisionReport {
  const updateIds = new Set((ops.updates ?? []).map((u) => u.id));

  // 1. updates vs deletes
  const deleteIds = ops.deletes ?? [];
  const updatesDeletes: string[] = [];
  for (const id of deleteIds) {
    if (updateIds.has(id)) updatesDeletes.push(id);
  }
  if (updatesDeletes.length > 0) {
    return { collisions: updatesDeletes, where: 'updates-deletes' };
  }

  // 2. inserts vs updates (only inserts that carry an explicit id can collide)
  const inserts = ops.inserts ?? [];
  const insertsUpdates: string[] = [];
  for (const row of inserts) {
    if (typeof row.id === 'string' && updateIds.has(row.id)) {
      insertsUpdates.push(row.id);
    }
  }
  if (insertsUpdates.length > 0) {
    return { collisions: insertsUpdates, where: 'inserts-updates' };
  }

  return { collisions: [], where: null };
}
