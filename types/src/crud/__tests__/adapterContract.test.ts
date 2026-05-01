// packages/core/types/src/crud/__tests__/adapterContract.test.ts

/**
 * @fileoverview ICrudAdapter Contract Tests
 * @description Verifies that any implementation of ICrudAdapter satisfies the
 * structural and behavioral contract. Uses an in-memory mock adapter.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect } from 'vitest';

import type {
  ICrudAdapter,
  QueryOptions,
  PaginatedQueryResult,
  DocumentSubscriptionCallback,
  CollectionSubscriptionCallback,
} from '../adapter';
import type { dndevSchema } from '../schemas';

import { runAdapterContract } from './runAdapterContract';

// =============================================================================
// In-memory mock adapter — satisfies ICrudAdapter contract
// =============================================================================

type Store = Record<string, Record<string, unknown>>;

/**
 * Minimal in-memory ICrudAdapter implementation for contract testing.
 * No external dependencies. ID generation uses a simple counter.
 */
class InMemoryAdapter implements ICrudAdapter {
  private store: Record<string, Store> = {};
  private _idCounter = 0;

  private _collection(collection: string): Store {
    if (!this.store[collection]) {
      this.store[collection] = {};
    }
    return this.store[collection];
  }

  private _nextId(): string {
    return String(++this._idCounter);
  }

  async get<T>(
    collection: string,
    id: string,
    _schema?: dndevSchema<unknown>
  ): Promise<T | null> {
    const col = this._collection(collection);
    const doc = col[id];
    return doc !== undefined ? (doc as T) : null;
  }

  async add<T>(
    collection: string,
    data: T
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    const col = this._collection(collection);
    const id = this._nextId();
    const record = data as Record<string, unknown>;
    col[id] = record;
    return { id, data: record };
  }

  async set<T>(collection: string, id: string, data: T): Promise<void> {
    const col = this._collection(collection);
    col[id] = data as Record<string, unknown>;
  }

  async update<T>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    const col = this._collection(collection);
    if (!col[id]) {
      throw new Error(`Document ${id} not found in ${collection}`);
    }
    col[id] = { ...col[id], ...(data as Record<string, unknown>) };
  }

  async delete(collection: string, id: string): Promise<void> {
    const col = this._collection(collection);
    delete col[id];
  }

  async query<T>(
    collection: string,
    options: QueryOptions,
    _schema?: dndevSchema<unknown>,
    _schemaType?: 'list' | 'listCard'
  ): Promise<PaginatedQueryResult<T>> {
    const col = this._collection(collection);
    let items = Object.values(col) as T[];

    if (options.where) {
      for (const clause of options.where) {
        items = items.filter((item) => {
          const record = item as Record<string, unknown>;
          const fieldVal = record[clause.field];
          switch (clause.operator) {
            case '==':
              return fieldVal === clause.value;
            case '!=':
              return fieldVal !== clause.value;
            case '<':
              return (fieldVal as number) < (clause.value as number);
            case '<=':
              return (fieldVal as number) <= (clause.value as number);
            case '>':
              return (fieldVal as number) > (clause.value as number);
            case '>=':
              return (fieldVal as number) >= (clause.value as number);
            case 'in':
              return (clause.value as unknown[]).includes(fieldVal);
            case 'not-in':
              return !(clause.value as unknown[]).includes(fieldVal);
            case 'array-contains':
              return Array.isArray(fieldVal) && fieldVal.includes(clause.value);
            case 'array-contains-any':
              return (
                Array.isArray(fieldVal) &&
                (clause.value as unknown[]).some((v) => fieldVal.includes(v))
              );
            default:
              return true;
          }
        });
      }
    }

    if (options.orderBy) {
      for (const order of [...options.orderBy].reverse()) {
        items = items.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[order.field];
          const bVal = (b as Record<string, unknown>)[order.field];
          const dir = order.direction === 'asc' ? 1 : -1;
          if (aVal === bVal) return 0;
          return aVal! > bVal! ? dir : -dir;
        });
      }
    }

    const startIndex = options.startAfter
      ? parseInt(options.startAfter, 10)
      : 0;
    items = items.slice(startIndex);

    const limit = options.limit ?? items.length;
    const paged = items.slice(0, limit);
    const hasMore = items.length > limit;

    return {
      items: paged,
      total: items.length,
      hasMore,
      lastVisible: hasMore ? String(startIndex + limit) : null,
    };
  }

  subscribe<T>(
    collection: string,
    id: string,
    callback: DocumentSubscriptionCallback<T>,
    _schema?: dndevSchema<unknown>
  ): () => void {
    const col = this._collection(collection);
    const doc = col[id];
    callback(doc !== undefined ? (doc as T) : null);
    return () => {};
  }

  subscribeToCollection<T>(
    collection: string,
    _options: QueryOptions,
    callback: CollectionSubscriptionCallback<T>,
    _schema?: dndevSchema<unknown>
  ): () => void {
    const col = this._collection(collection);
    callback(Object.values(col) as T[]);
    return () => {};
  }
}

/**
 * Minimal adapter that intentionally omits optional subscribe methods.
 * Must still satisfy ICrudAdapter.
 */
class MinimalAdapter implements ICrudAdapter {
  async get<T>(
    _collection: string,
    _id: string,
    _schema?: dndevSchema<unknown>
  ): Promise<T | null> {
    return null;
  }

  async add<T>(
    _collection: string,
    data: T
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    return {
      id: 'mock-id',
      data: data as Record<string, unknown>,
    };
  }

  async set(_collection: string, _id: string, _data: unknown): Promise<void> {}

  async update<T>(
    _collection: string,
    _id: string,
    _data: Partial<T>
  ): Promise<void> {}

  async delete(_collection: string, _id: string): Promise<void> {}

  async query<T>(
    _collection: string,
    _options: QueryOptions,
    _schema?: dndevSchema<unknown>,
    _schemaType?: 'list' | 'listCard'
  ): Promise<PaginatedQueryResult<T>> {
    return {
      items: [],
      hasMore: false,
      total: 0,
      lastVisible: null,
    };
  }
}

// =============================================================================
// Run the reusable contract against InMemoryAdapter
// =============================================================================

runAdapterContract('InMemoryAdapter', () => new InMemoryAdapter());

// =============================================================================
// Additional structural tests specific to this file
// =============================================================================

describe('ICrudAdapter structural checks', () => {
  it('MinimalAdapter (no subscribe) satisfies ICrudAdapter', () => {
    const minimal: ICrudAdapter = new MinimalAdapter();
    expect(minimal).toBeDefined();
    expect(minimal.subscribe).toBeUndefined();
    expect(minimal.subscribeToCollection).toBeUndefined();
  });
});
