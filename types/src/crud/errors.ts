// packages/core/types/src/crud/errors.ts

/**
 * @fileoverview CRUD Error Classes
 * @description Error classes raised by the CRUD service and adapters.
 * Each error is a plain {@link Error} subclass so consumers can `instanceof` them.
 *
 * @version 0.1.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */

/**
 * Thrown when a {@link BulkOperations} payload contains the same id in two
 * mutually-exclusive buckets. The service rejects these up-front, before any
 * write is attempted, so partial state is impossible.
 *
 * @example
 * try {
 *   await crud.bulk({
 *     updates: [{ id: 'a', patch: {} }],
 *     deletes: ['a'],
 *   });
 * } catch (err) {
 *   if (err instanceof BulkCollisionError) {
 *     // err.collidingIds === ['a']
 *     // err.where === 'updates-deletes'
 *   }
 * }
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export class BulkCollisionError extends Error {
  /** IDs that appear in both buckets. Preserves the order they were detected. */
  readonly collidingIds: string[];

  /** Which two buckets collided. */
  readonly where: 'updates-deletes' | 'inserts-updates';

  /**
   * @param collidingIds - IDs present in both buckets.
   * @param where - The pair of buckets that produced the collision.
   */
  constructor(
    collidingIds: string[],
    where: 'updates-deletes' | 'inserts-updates'
  ) {
    super(
      `BulkCollisionError: ${collidingIds.length} id(s) appear in both "${where.replace('-', '" and "')}" — ${collidingIds.join(', ')}`
    );
    this.name = 'BulkCollisionError';
    this.collidingIds = collidingIds;
    this.where = where;
  }
}

/**
 * Thrown by {@link bulkAcross} before any side effect when `dependsOn`
 * relationships form a cycle. The `cycle` array lists the collection names
 * that form the circular dependency chain.
 *
 * @example
 * try {
 *   await crud.bulkAcross([
 *     { collection: 'a', dependsOn: ['b'], ... },
 *     { collection: 'b', dependsOn: ['a'], ... },
 *   ]);
 * } catch (err) {
 *   if (err instanceof BulkAcrossCycleError) {
 *     console.error(err.cycle); // ['a', 'b']
 *   }
 * }
 *
 * @version 0.1.0
 * @since 0.3.0
 */
export class BulkAcrossCycleError extends Error {
  /** Collection names that form the cycle. */
  readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`[dndev] bulkAcross: circular dependency: ${cycle.join(' → ')}`);
    this.name = 'BulkAcrossCycleError';
    this.cycle = cycle;
  }
}

/**
 * Thrown by an adapter whose `bulk()` method has not yet been implemented.
 * Lets the interface stay required across all providers while individual
 * adapters can land their implementation incrementally.
 *
 * @example
 * // Inside an adapter stub:
 * async bulk() {
 *   throw new BulkNotImplementedError('restcrud');
 * }
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export class BulkNotImplementedError extends Error {
  /** Adapter identifier (e.g. `'firebase-firestore'`, `'supabase'`). */
  readonly adapterName: string;

  /**
   * @param adapterName - Name of the adapter that has not implemented `bulk()`.
   */
  constructor(adapterName: string) {
    super(
      `BulkNotImplementedError: adapter "${adapterName}" has not implemented bulk() yet`
    );
    this.name = 'BulkNotImplementedError';
    this.adapterName = adapterName;
  }
}
