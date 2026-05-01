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
   * Only server-side adapters may access entities with restricted field visibility.
   * Defaults to false (direct/client-side adapters).
   */
  readonly serverSideOnly?: boolean;

  /**
   * When true, field-level and row-level security is enforced at the database layer
   * (e.g. Supabase RLS + column grants). The framework visibility gate is bypassed
   * because the DB rejects unauthorized reads before any data leaves the server.
   *
   * **Supabase:** requires RLS enabled on every table + column-level grants per role.
   * **Firestore:** Rules are row-level only — field-level filtering needs FunctionsAdapter.
   */
  readonly dbLevelSecurity?: boolean;

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
   * Execute a bulk transactional operation.
   * - All ops commit atomically. One transaction/writeBatch.
   * - One round-trip where the transport supports it.
   * - Empty ops returns a zeroed BulkResult without wire contact.
   * - Throws on partial failure; never leaves store in mixed state.
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

  /** Set/replace a document by ID (upsert semantics). */
  set<T>(
    collection: string,
    id: string,
    data: T,
    schema?: dndevSchema<T>,
    options?: CrudOperationOptions
  ): Promise<void>;

  /** Partial update a document by ID. */
  update<T>(
    collection: string,
    id: string,
    data: Partial<T>,
    options?: CrudOperationOptions
  ): Promise<void>;

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
