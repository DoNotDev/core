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
 * @version 0.1.0
 * @since 0.2.0
 */
export type CrudCreateInput<T> =
  T extends Record<string, unknown> ? Omit<T, 'id'> : Record<string, unknown>;

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
  /** Current data (from get/subscribe) */
  data: T | null;
  /** Loading state for async operations */
  loading: boolean;
  /** Last error encountered */
  error: Error | null;
  /** Fetch single document by ID */
  get: (id: string) => Promise<T | null>;
  /** Set/replace document by ID */
  set: (
    id: string,
    data: T,
    options?: { showSuccessToast?: boolean }
  ) => Promise<void>;
  /** Partial update document by ID */
  update: (
    id: string,
    data: Partial<T>,
    options?: { showSuccessToast?: boolean }
  ) => Promise<void>;
  /** Delete document by ID */
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
   * Cross-collection atomic bulk write. One optimistic pass, one toast,
   * coordinated rollback. Batches with `dependsOn` run after their
   * dependencies; independent batches run in parallel.
   */
  bulkAcross?: (
    batches: BulkAcrossBatch[],
    options?: { showSuccessToast?: boolean }
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
 * Semantics (enforced by the service, not the adapter):
 * - Atomic: all ops succeed or none do.
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
 * Result of a bulk CRUD operation. Each id list preserves the input order of the
 * corresponding bucket in {@link BulkOperations}.
 *
 * @example
 * const r: BulkResult = await adapter.bulk('events', {
 *   inserts: [{ title: 'A' }],
 *   deletes: ['x'],
 * });
 * r.insertedIds; // ['evt_123']
 * r.deletedIds;  // ['x']
 *
 * @version 0.1.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface BulkResult {
  /** Server-assigned IDs for `inserts`, in input order. */
  insertedIds: string[];
  /** IDs that were updated, in input order. */
  updatedIds: string[];
  /** IDs that were deleted, in input order. */
  deletedIds: string[];
}

// =============================================================================
// Cross-Collection Bulk Types (bulkAcross)
// =============================================================================

/**
 * One collection's worth of operations inside a {@link bulkAcross} call.
 *
 * Inserts may include a caller-provided `id` for cross-collection pre-minting:
 * mint the ID client-side, use it in both collections, and pass `dependsOn` to
 * ensure write order.
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
  /** Rows to update (partial patches). */
  updates?: Array<{ id: string; patch: Partial<T> }>;
  /** Document IDs to delete. */
  deletes?: string[];
  /** Schemas for insert validation + PII resolution. */
  schemas: {
    create?: dndevSchema<T>;
    draft?: dndevSchema<T>;
    update?: dndevSchema<T>;
  };
  /**
   * Collections that must be written first.
   * Batches with no `dependsOn` run in parallel with other dependency-free batches.
   */
  dependsOn?: string[];
}

/**
 * Result of a {@link bulkAcross} call. Per-collection results keyed by collection name.
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
  readonly queryFn: () => Promise<PaginatedQueryResult<T>>;
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
  readonly queryFn: () => Promise<T | null>;
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
}
