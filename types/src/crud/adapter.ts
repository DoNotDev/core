// packages/core/types/src/crud/adapter.ts

/**
 * @fileoverview CRUD Adapter Interface
 * @description Provider-agnostic interface for CRUD data access.
 * Any backend (Firestore, Supabase, REST, Postgres) must implement this contract.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

import type { ListSchemaType } from './constants';
import type { dndevSchema } from './schemas';
import type {
  BulkOperations,
  BulkResult,
  BulkAcrossResult,
  PreparedAtomicBatch,
  AtomicBulkExecutionPlan,
  CollectionSubscriptionCallback,
  CrudOperationOptions,
  DocumentSubscriptionCallback,
  PaginatedQueryResult,
  QueryOptions,
} from './types';

// =============================================================================
// ICrudAdapter Interface
// =============================================================================

/**
 * Provider-agnostic CRUD adapter interface.
 *
 * Implementations:
 * - `FirestoreAdapter` (Firestore direct)
 * - `FunctionsAdapter` (Firebase callable functions)
 * - Future: Supabase, REST, Postgres adapters
 *
 * @template All methods accept `dndevSchema` for validation/transformation.
 * Adapters that don't need schema can ignore it.
 *
 * @version 0.1.0
 * @since 0.5.0
 */
export interface ICrudAdapter {
  /**
   * When true, this adapter enforces field-level security server-side.
   * Only server-side adapters (or `dbLevelSecurity` ones) may access entities with
   * restricted field visibility: an app field with a visibility other than 'guest'.
   * The base fields `defineEntity` adds (`BASE_FIELD_VISIBILITY`: id, status, createdAt,
   * updatedAt, createdById, updatedById) do not count at their default visibility: on a
   * direct adapter they are readable by whoever can read the document.
   * Defaults to false (direct/client-side adapters).
   */
  readonly serverSideOnly?: boolean;

  /**
   * Optional single-database atomic cross-collection capability. Its presence
   * advertises support; absence must never trigger a legacy fallback.
   *
   * Preflight validates the entire prepared request without writes, native batch
   * creation or optimistic effects. It may return an operation-owned execution
   * plan; legacy implementations may return void. Direct execute validates its
   * input, stages all collections in one native batch, and commits without retries
   * or chunking.
   * Empty supported requests resolve with zeroed results without storage contact.
   * Success contains ordered IDs and empty `failed` arrays for every collection.
   * Failure rejects with AtomicBulkError: `not-committed` only when known,
   * otherwise `unknown` (reconcile; never claim rollback or automatically replay).
   * When preflight returns void, callers must not mutate prepared input between
   * preflight and direct execution.
   */
  readonly atomicBulkAcross?: {
    /** Reject invalid requests or return a snapshot-bound execution plan without storage contact. */
    preflight(batches: PreparedAtomicBatch[]): Promise<void | AtomicBulkExecutionPlan>;
    /** Commit all collections atomically, or reject without partial-success results. */
    execute(batches: PreparedAtomicBatch[]): Promise<BulkAcrossResult>;
  };

  /**
   * When true, field-level and row-level security is enforced at the database layer
   * (e.g. Supabase RLS + column grants). The framework visibility gate is bypassed
   * because the DB rejects unauthorized reads before any data leaves the server.
   * Without it (and without `serverSideOnly`), the adapter is direct: entities whose own
   * fields are all 'guest' are served, and their base system fields (id, status,
   * createdAt, updatedAt, createdById, updatedById) are readable by whoever can read
   * the document, whatever their `technical` / `hidden` / `admin` visibility.
   *
   * **Supabase:** requires RLS enabled on every table + column-level grants per role.
   * **Firestore:** Rules are row-level only — field-level filtering needs FunctionsAdapter.
   */
  readonly dbLevelSecurity?: boolean;

  /**
   * A view of this adapter whose reads run as the holder of `accessToken` (the
   * visitor's session during the server render). Only for adapters whose backend
   * verifies the token itself (`dbLevelSecurity`), so a forged token reads nothing.
   * Absent: the server render does not prefetch signed-in visitors' data.
   */
  forAccessToken?(accessToken: string): ICrudAdapter;

  /** Fetch a single document by ID. Returns null if not found. */
  get<T>(
    collection: string,
    id: string,
    schema?: dndevSchema<unknown>,
    options?: CrudOperationOptions
  ): Promise<T | null>;

  /** Create a new document with auto-generated ID. Returns the ID + parsed data. */
  add<T>(
    collection: string,
    data: T,
    schema?: dndevSchema<T>,
    options?: CrudOperationOptions
  ): Promise<{ id: string; data: Record<string, unknown> }>;

  /**
   * Execute a bulk operation: many rows in as few round-trips as the backend allows.
   * - Partial success: rows that are written stay written; rows that fail are
   *   returned in `BulkResult.failed` with the reason (no rollback).
   * - Empty ops returns a zeroed BulkResult without wire contact.
   * - Throws only when the batch cannot be attempted at all (invalid input,
   *   id collision, no session).
   *
   * @example
   * const r = await adapter.bulk('events', { inserts: [{ title: 'A' }], deletes: ['x'] });
   * r.insertedIds; r.deletedIds;
   */
  bulk<T extends Record<string, unknown>>(
    collection: string,
    ops: BulkOperations<T>,
    schema?: dndevSchema<T>,
    options?: CrudOperationOptions
  ): Promise<BulkResult>;

  /**
   * Set/replace a document by ID (upsert semantics).
   *
   * @returns The written row's stored values: the full row as stored (filtered with
   * `options.readSchema` like `get`) when the backend returns it, otherwise the payload as stored. The
   * cache keeps it, so values the backend sets (timestamps, revisions, triggers)
   * need no refetch.
   * @since 0.3.0 returns the stored values (was `void`)
   */
  set<T>(
    collection: string,
    id: string,
    data: T,
    schema?: dndevSchema<T>,
    options?: CrudOperationOptions
  ): Promise<Record<string, unknown>>;

  /**
   * Partial update a document by ID.
   *
   * @returns The written row's stored values: the full row as stored (filtered with
   * `options.readSchema` like `get`) when the backend returns it, otherwise the patch as stored. The
   * cache merges it onto the cached row, so values the backend sets (timestamps,
   * revisions, triggers) need no refetch.
   * @since 0.3.0 returns the stored values (was `void`)
   */
  update<T>(
    collection: string,
    id: string,
    data: Partial<T>,
    options?: CrudOperationOptions
  ): Promise<Record<string, unknown>>;

  /** Delete a document by ID. */
  delete(
    collection: string,
    id: string,
    options?: CrudOperationOptions
  ): Promise<void>;

  /** Query a collection with filters, ordering, and pagination. schemaType accepts 'list' | 'listCard' or string. */
  query<T>(
    collection: string,
    options: QueryOptions,
    schema?: dndevSchema<unknown>,
    schemaType?: ListSchemaType | string,
    operationOptions?: CrudOperationOptions
  ): Promise<PaginatedQueryResult<T>>;

  /**
   * Subscribe to real-time changes on a single document.
   * Optional — adapters that don't support real-time can throw or return a no-op unsubscribe.
   */
  subscribe?<T>(
    collection: string,
    id: string,
    callback: DocumentSubscriptionCallback<T>,
    schema?: dndevSchema<unknown>
  ): () => void;

  /**
   * Subscribe to real-time changes on a collection query.
   * Optional — adapters that don't support real-time can throw or return a no-op unsubscribe.
   */
  subscribeToCollection?<T>(
    collection: string,
    options: QueryOptions,
    callback: CollectionSubscriptionCallback<T>,
    schema?: dndevSchema<unknown>
  ): () => void;
}
