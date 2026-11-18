// packages/core/types/src/crud/types.ts

/**
 * @fileoverview CRUD Types
 * @description Type definitions for CRUD domain. Defines entity types, field types, and CRUD-related interfaces.
 * Uses unified FeatureStatus enum for feature state management.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ReactNode } from 'react';

import type { FieldValues } from 'react-hook-form';

import type { FeatureStatus } from '../common';

import type { CrudOperator, OrderDirection, ListSchemaType } from './constants';
import type { dndevSchema, EntityField } from './schemas';

// =============================================================================
// Hook API Types
// =============================================================================

/**
 * Payload for create flows (`add`, bulk `inserts`) before the document has a
 * stable `id` (server- or client-generated). Matches runtime: optimistic add
 * mints a temp id; the create schema validates this shape.
 *
 * Plain `Omit` (not a conditional type): generic code over an entity
 * (`useCrud(entity)` with `E extends AnyEntity`) can pass its rows, which a
 * conditional type would defer and reject.
 *
 * @version 0.2.0
 * @since 0.2.0
 */
export type CrudCreateInput<T> = Omit<T, 'id'>;

/**
 * CRUD API type - complete interface for useCrud hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CrudAPI<T = unknown> {
  /**
   * Unified feature status - single source of truth for CRUD state.
   * - `initializing`: CRUD is loading/initializing
   * - `ready`: CRUD fully operational
   * - `degraded`: CRUD unavailable (feature not installed/consent not given)
   * - `error`: CRUD encountered error
   */
  status: FeatureStatus;
  /** Loading state for async operations */
  loading: boolean;
  /** Last error encountered */
  error: Error | null;
  /** Fetch single document by ID */
  get: (id: string) => Promise<T | null>;
  /**
   * Set/replace document by ID.
   * @returns The stored values the backend returned (cached), `undefined` when the CRUD service is not ready
   * @since 0.3.0 returns the stored values (was `void`)
   */
  set: (
    id: string,
    data: T,
    options?: { showSuccessToast?: boolean }
  ) => Promise<Record<string, unknown> | undefined>;
  /**
   * Partial update document by ID.
   * @returns The stored values the backend returned (cached), `undefined` when the CRUD service is not ready
   * @since 0.3.0 returns the stored values (was `void`)
   */
  update: (
    id: string,
    data: Partial<T>,
    options?: { showSuccessToast?: boolean }
  ) => Promise<Record<string, unknown> | undefined>;
  /**
   * Logical delete (CRUD rule 3): the update `{ status: 'deleted' }`. Required fields left
   * empty never block it; the row leaves public reads. `delete` is the hard delete.
   * @since 0.3.0
   */
  remove: (id: string) => Promise<void>;
  /** Hard delete by ID (the row is gone); `remove` is the logical delete */
  delete: (
    id: string,
    options?: { showSuccessToast?: boolean }
  ) => Promise<void>;
  /** Add new document (auto-generated ID) */
  add: (
    data: CrudCreateInput<T>,
    options?: { showSuccessToast?: boolean }
  ) => Promise<string>;
  /** Query collection with filters */
  query: (options: QueryOptions) => Promise<T[]>;
  /** Subscribe to document changes */
  subscribe: (
    id: string,
    callback: (data: T | null, error?: Error) => void
  ) => () => void;
  /** Subscribe to collection changes */
  subscribeToCollection: (
    options: QueryOptions,
    callback: (data: T[], error?: Error) => void
  ) => () => void;
  /** Invalidate cache for this collection (TanStack Query) */
  invalidate: () => Promise<void>;
  /** Whether CRUD is available and operational */
  isAvailable: boolean;
  /**
   * Ordered cross-collection bulk write, NOT a database transaction.
   * One optimistic pass; independent batches run in parallel waves ordered by
   * `dependsOn`. A rejection or per-row failure stops subsequent waves after
   * all started writes settle. Optimistic state is reverted before refetch;
   * committed rows stay written. Rejects on failure (no partial result return).
   * This describes the default legacy path. Explicit atomic execution requires
   * adapter capability support and rejects rather than falling back.
   */
  bulkAcross?: (
    batches: BulkAcrossBatch[],
    options?: BulkAcrossOptions
  ) => Promise<BulkAcrossResult>;
}

// =============================================================================
// Template Types
// =============================================================================

/**
 * Base props for entity templates
 * @template T - The form values type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EntityTemplateProps<T extends FieldValues> {
  /** The DoNotDev schema for the entity */
  schema: dndevSchema<T>;

  /** Optional overrides for field configuration */
  fieldOverrides?: Partial<Record<keyof T, Partial<EntityField>>>;
}

/**
 * Column definition for list views
 * @template T - The item type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ColumnDef<T extends FieldValues> {
  /** Key in the data object */
  key: keyof T;

  /** Display label */
  label: string;

  /** Optional custom render function */
  render?: (value: T[keyof T], row: T) => ReactNode;
}

// =============================================================================
// Bulk CRUD Types
// =============================================================================

/**
 * Input shape for a bulk CRUD operation. All three fields are optional — callers
 * include only the buckets they need. Items are processed in input order per
 * bucket and returned in the same order in {@link BulkResult}.
 *
 * Semantics:
 * - Partial success: each row succeeds or fails on its own. Rows that worked
 *   stay written (no rollback); rows that failed are listed in
 *   {@link BulkResult.failed} with the reason.
 * - Collision rejection: an id appearing in both `updates` and `deletes`, or both
 *   `inserts` and `updates`, fails up-front with {@link BulkCollisionError}.
 * - Empty bulk (`{}`) is a no-op that returns a zeroed {@link BulkResult}
 *   without hitting the adapter.
 *
 * @template T - Entity type for the collection. Must be an object so PII
 *   encryption, cache merging and adapter mapping can treat each row as a
 *   `Record<string, unknown>`.
 *
 * @example
 * const ops: BulkOperations<Event> = {
 *   inserts: [{ title: 'A' }, { title: 'B' }],
 *   updates: [{ id: 'e1', patch: { title: 'renamed' } }],
 *   deletes: ['e2', 'e3'],
 * };
 *
 * @version 0.1.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface BulkOperations<T extends Record<string, unknown>> {
  /** New rows to insert. IDs are server-assigned and returned in {@link BulkResult.insertedIds}. */
  inserts?: CrudCreateInput<T>[];
  /** Partial updates keyed by id. `patch` is a shallow merge on top of the stored row. */
  updates?: Array<{ id: string; patch: Partial<T> }>;
  /** IDs to delete. */
  deletes?: string[];
}

/**
 * One row of a bulk operation that was not written.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export interface BulkFailure {
  /** Bucket the row came from. */
  op: 'insert' | 'update' | 'delete';
  /** Record id (updates and deletes). */
  id?: string;
  /** Position in `inserts` (inserted rows have no id yet). */
  index?: number;
  /** Why the row was not written (backend message, or access denied / not found). */
  error: string;
  /** Entity field that failed, when the backend names one (e.g. a Postgres CHECK violation). */
  field?: string;
  /** i18n key of the client message for that failure (`{{field}}` = field label). */
  i18nKey?: string;
}

/**
 * Result of a bulk CRUD operation: partial success. Rows that were written are
 * listed per bucket in input order; rows that were not are in `failed`. Nothing
 * that succeeded is rolled back.
 *
 * @example
 * const r: BulkResult = await adapter.bulk('products', {
 *   updates: [{ id: 'p1', patch: { size: '50 ml' } }, { id: 'p2', patch: { size: '50 ml' } }],
 * });
 * r.updatedIds; // ['p1']
 * r.failed;     // [{ op: 'update', id: 'p2', error: 'Update affected 0 rows: …' }]
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface BulkResult {
  /** Server-assigned IDs of the inserted rows, in input order of the inserts that succeeded. */
  insertedIds: string[];
  /** IDs that were updated, in input order. */
  updatedIds: string[];
  /** IDs that were deleted, in input order. */
  deletedIds: string[];
  /** Rows that were not written, with the reason. Empty when everything succeeded. */
  failed: BulkFailure[];
}

// =============================================================================
// Cross-Collection Bulk Types (bulkAcross)
// =============================================================================

/**
 * Cross-collection execution policy. Omitted execution preserves the ordered,
 * partial-success legacy path. Atomic execution requires an adapter capability;
 * it must reject rather than fall back when unsupported.
 *
 * @since 0.3.0
 */
export interface BulkAcrossOptions {
  /** Whether the service should display its success notification. */
  showSuccessToast?: boolean;
  /**
   * Success notification text (translated by the caller). Default:
   * `crud:messages.updateSuccess` with the entity name of the first batch's
   * collection (the primary record).
   * @since 0.2.5
   */
  successMessage?: string;
  /** One native commit (`atomic`), or independent ordered writes (`legacy`). */
  execution?: 'legacy' | 'atomic';
}

/**
 * Validated, access-checked and storage-prepared operations for one collection
 * in an atomic request. No schemas, dependencies or callbacks cross this boundary.
 * The service allocates missing insert IDs exactly once before preflight, retains
 * caller IDs and references verbatim, and supplies unique document targets across
 * every bucket. Providers revalidate request-specific support before staging.
 *
 * Inserts use provider set/upsert semantics, not guaranteed create-if-absent.
 * Updates/deletes retain native provider semantics. All collections must share
 * one database and one commit; an adapter must never split or retry this request.
 *
 * @since 0.3.0
 */
export interface PreparedAtomicBatch {
  /** Provider collection path; collection entries must be unique per request. */
  collection: string;
  /** Prepared rows with stable explicit IDs; technical `id` is not stored. */
  inserts?: Array<Record<string, unknown> & { id: string }>;
  /** Prepared partial patches. Technical identity must not change. */
  updates?: Array<{ id: string; patch: Record<string, unknown> }>;
  /** Stable explicit document IDs to delete. */
  deletes?: string[];
}

/**
 * An operation-owned snapshot returned by atomic preflight. Execution uses the
 * validated payload and metadata regardless of subsequent input mutation and
 * checks that the captured actor remains appropriate before committing. Calling
 * execute repeatedly or concurrently observes the same execution and outcome;
 * it never starts another commit, including after an unknown outcome.
 */
export interface AtomicBulkExecutionPlan {
  /** Execute the captured operation at most once; never automatically retry. */
  readonly execute: () => Promise<BulkAcrossResult>;
}

/**
 * One collection's worth of operations inside a {@link bulkAcross} call.
 *
 * Inserts may include a caller-provided `id` for cross-collection pre-minting:
 * mint the ID client-side, use it in both collections, and pass `dependsOn` to
 * ensure write order, not database atomicity. Committed writes survive failure
 * in another batch; only optimistic state is rolled back before refetch.
 * This is the default legacy execution policy; explicit atomic mode instead
 * requires a provider capability and one commit across all prepared batches.
 *
 * @template T - Entity type for this batch's collection.
 *
 * @example
 * const customerId = generateUUID();
 * await bulkAcross([
 *   {
 *     collection: 'customers',
 *     inserts: [{ id: customerId, ...customerData }],
 *     schemas: { create: customerCreateSchema },
 *   },
 *   {
 *     collection: 'inquiries',
 *     inserts: [{ customerId, ...inquiryData }],
 *     schemas: { create: inquiryCreateSchema },
 *     dependsOn: ['customers'],
 *   },
 * ]);
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export interface BulkAcrossBatch<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Target collection name. */
  collection: string;
  /** Rows to insert. May include a caller-provided `id` for pre-minting. */
  inserts?: Array<CrudCreateInput<T> & { id?: string }>;
  /**
   * Rows to update (partial patches). The CRUD update rules (`prepareUpdate`) run on the
   * stored row: `stored` (the row the patch was made against, e.g. a form's `record`),
   * else the cached row, else one read. `storedStatus` (0.2) is no longer read: the
   * stored row carries its status.
   */
  updates?: Array<{
    id: string;
    patch: Partial<T>;
    stored?: Readonly<Record<string, unknown>> | null;
    storedStatus?: string | null;
  }>;
  /** Document IDs to delete. */
  deletes?: string[];
  /**
   * Schemas of the collection (0.2 API). The CRUD rules run on the entity's own
   * schemas (`defineEntity` for `collection`), whatever is passed here.
   */
  schemas: {
    create?: dndevSchema<unknown>;
    draft?: dndevSchema<unknown>;
    update?: dndevSchema<unknown>;
  };
  /**
   * Collections that must be written first.
   * Batches with no `dependsOn` run in parallel with other dependency-free batches.
   */
  dependsOn?: string[];
}

/**
 * Result of a successful {@link bulkAcross} call, keyed by collection name.
 * Any adapter rejection or per-row failure rejects the call instead; committed
 * rows may remain written despite rejection (no database rollback).
 * Atomic capability success uses this same result shape with complete ordered
 * IDs and empty failure lists; atomic rejection never returns partial results.
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export interface BulkAcrossResult {
  /** Per-collection {@link BulkResult}, keyed by collection name. */
  results: Record<string, BulkResult>;
}

// =============================================================================
// Query Types
// =============================================================================

export type { CrudOperator, OrderDirection, ListSchemaType } from './constants';

/** Single where clause for a query. operator accepts CrudOperator or string so consumer code can use variables or literals ('in', '==', etc.) without importing CRUD_OPERATORS. */
export interface QueryWhereClause {
  field: string;
  operator: CrudOperator;
  value: unknown;
}

/** Order-by clause for a query. direction accepts 'asc' | 'desc' or string so consumer code can use variables. */
export interface QueryOrderBy {
  field: string;
  direction?: OrderDirection;
}

/**
 * Query options for collection queries.
 * Provider-agnostic — each adapter maps these to its native query API.
 *
 * Default `limit` is **1000** (server max: 1000). For collections > 1000 items,
 * use server-side pagination with `startAfter` cursor.
 *
 * @example
 * // Fetch all (up to 1000)
 * { where: [{ field: 'status', operator: '==', value: 'available' }] }
 *
 * @example
 * // Paginate server-side
 * { limit: 50, startAfter: lastCursorId }
 */
export interface QueryOptions {
  where?: QueryWhereClause[];
  orderBy?: QueryOrderBy[];
  /** Max items to fetch. Default: 1000, max: 1000. Use server pagination for larger collections. */
  limit?: number;
  /** Opaque cursor for pagination — value of the first orderBy field from the previous page's lastVisible */
  startAfter?: string | null;
}

/**
 * Paginated query result returned by adapter.query().
 * @template T - The entity type
 */
export interface PaginatedQueryResult<T> {
  items: T[];
  total?: number;
  hasMore?: boolean;
  /** Opaque cursor for the next page */
  lastVisible?: string | null;
}

/**
 * Return shape of the CRUD list-query option builder
 * (`CrudService.getListQueryOptions` / `getListQueryOptionsImpl`).
 *
 * This is the TanStack-compatible descriptor handed to `useQuery()`. Lifted
 * into `@donotdev/core` so the CRUD facade and its impl can both annotate
 * their return types against a single source — the inferred-only shape
 * caused circular type inference (TS7023) after the 1949-LOC CrudService
 * split.
 *
 * **Invariant:** `queryKey[3]` is `JSON.stringify(queryOptions)` — list and
 * listCard views share the same key, yielding one network read.
 *
 * @template T - The entity type in list items
 */
export interface CrudListQuery<T> {
  readonly queryKey: readonly ['crud', string, 'query', string];
  /**
   * Receives TanStack's query context; `client` (the request's QueryClient on the
   * server) selects a request-scoped adapter when one is bound.
   */
  readonly queryFn: (context: {
    client: object;
  }) => Promise<PaginatedQueryResult<T>>;
  readonly staleTime: number;
}

/**
 * Return shape of the CRUD single-document query option builder
 * (`CrudService.getDocQueryOptions` / `getDocQueryOptionsImpl`).
 *
 * TanStack-compatible descriptor for `useQuery()`. See `CrudListQuery` for
 * the rationale behind promoting this shape into core types.
 *
 * @template T - The document entity type
 */
export interface CrudDocQuery<T> {
  readonly queryKey: readonly ['crud', string, 'get', string];
  /**
   * Receives TanStack's query context; `client` (the request's QueryClient on the
   * server) selects a request-scoped adapter when one is bound.
   */
  readonly queryFn: (context: { client: object }) => Promise<T | null>;
  readonly staleTime: number;
}

// =============================================================================
// Subscription Types
// =============================================================================

/** Callback for single-document subscriptions */
export type DocumentSubscriptionCallback<T> = (
  data: T | null,
  error?: Error
) => void;

/** Callback for collection subscriptions */
export type CollectionSubscriptionCallback<T> = (
  data: T[],
  error?: Error
) => void;

// =============================================================================
// CRUD Operation Options
// =============================================================================

/** Options for CRUD operations */
export interface CrudOperationOptions {
  /** AbortSignal to cancel the operation */
  signal?: AbortSignal;
  /**
   * Writes (`add`, `set`, `update`): the collection's read schema (the one `get`
   * takes). The returned stored row is filtered with it for the requester's role,
   * so the cache never holds a field the requester cannot read.
   * @since 0.3.0
   */
  readSchema?: dndevSchema<unknown>;
}
