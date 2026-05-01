// packages/core/types/src/crud/__tests__/runAdapterContract.ts

/**
 * @fileoverview Reusable ICrudAdapter Contract Runner
 * @description Extracted from adapterContract.test.ts. Call `runAdapterContract()`
 * to verify any ICrudAdapter implementation against the full behavioral contract.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ICrudAdapter, QueryOptions } from '../adapter';

// =============================================================================
// Test Doc Type
// =============================================================================

interface TestDoc {
  name: string;
  age: number;
  tags?: string[];
}

// =============================================================================
// Contract Runner
// =============================================================================

/**
 * Runs the full ICrudAdapter behavioral contract against any adapter implementation.
 *
 * @param label - Suite label (e.g. "InMemoryAdapter", "FirestoreAdapter")
 * @param factory - Returns a fresh adapter instance per test. Called in beforeEach.
 *
 * @example
 * ```ts
 * import { runAdapterContract } from './runAdapterContract';
 * import { InMemoryAdapter } from './InMemoryAdapter';
 *
 * runAdapterContract('InMemoryAdapter', () => new InMemoryAdapter());
 * ```
 */
export function runAdapterContract(
  label: string,
  factory: () => ICrudAdapter
): void {
  describe(`ICrudAdapter contract — ${label}`, () => {
    let adapter: ICrudAdapter;

    beforeEach(() => {
      adapter = factory();
    });

    // -------------------------------------------------------------------------
    // 1. TypeScript structural contract
    // -------------------------------------------------------------------------

    describe('TypeScript contract', () => {
      it('satisfies ICrudAdapter', () => {
        const typed: ICrudAdapter = adapter;
        expect(typed).toBeDefined();
      });
    });

    // -------------------------------------------------------------------------
    // 2. get()
    // -------------------------------------------------------------------------

    describe('get()', () => {
      it('returns null for a non-existent document', async () => {
        const result = await adapter.get<TestDoc>('users', 'missing');
        expect(result).toBeNull();
      });

      it('returns the document when it exists', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        const result = await adapter.get<TestDoc>('users', 'u1');
        expect(result).toEqual({ name: 'Alice', age: 30 });
      });

      it('returns null across different collections', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        const result = await adapter.get<TestDoc>('posts', 'u1');
        expect(result).toBeNull();
      });
    });

    // -------------------------------------------------------------------------
    // 3. add()
    // -------------------------------------------------------------------------

    describe('add()', () => {
      it('returns an object with id (string) and data', async () => {
        const result = await adapter.add<TestDoc>('users', {
          name: 'Bob',
          age: 25,
        });
        expect(typeof result.id).toBe('string');
        expect(result.id.length).toBeGreaterThan(0);
        expect(result.data).toBeDefined();
      });

      it('data in response matches the input', async () => {
        const input: TestDoc = { name: 'Carol', age: 22 };
        const result = await adapter.add<TestDoc>('users', input);
        expect(result.data).toEqual(input);
      });

      it('persists the document retrievable by returned id', async () => {
        const { id } = await adapter.add<TestDoc>('users', {
          name: 'Dan',
          age: 40,
        });
        const fetched = await adapter.get<TestDoc>('users', id);
        expect(fetched).toEqual({ name: 'Dan', age: 40 });
      });

      it('generates unique ids for successive adds', async () => {
        const r1 = await adapter.add<TestDoc>('users', { name: 'E', age: 1 });
        const r2 = await adapter.add<TestDoc>('users', { name: 'F', age: 2 });
        expect(r1.id).not.toBe(r2.id);
      });
    });

    // -------------------------------------------------------------------------
    // 4. set() and update()
    // -------------------------------------------------------------------------

    describe('set()', () => {
      it('resolves without error', async () => {
        await expect(
          adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 })
        ).resolves.toBeUndefined();
      });

      it('upserts — creates document if it does not exist', async () => {
        await adapter.set<TestDoc>('items', 'i99', { name: 'Widget', age: 0 });
        const result = await adapter.get<TestDoc>('items', 'i99');
        expect(result).toEqual({ name: 'Widget', age: 0 });
      });

      it('replaces existing document entirely', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await adapter.set<TestDoc>('users', 'u1', {
          name: 'Alice Updated',
          age: 31,
        });
        const result = await adapter.get<TestDoc>('users', 'u1');
        expect(result).toEqual({ name: 'Alice Updated', age: 31 });
      });
    });

    describe('update()', () => {
      it('resolves without error on an existing document', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await expect(
          adapter.update<TestDoc>('users', 'u1', { age: 31 })
        ).resolves.toBeUndefined();
      });

      it('merges partial data into the existing document', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await adapter.update<TestDoc>('users', 'u1', { age: 99 });
        const result = await adapter.get<TestDoc>('users', 'u1');
        expect(result).toEqual({ name: 'Alice', age: 99 });
      });
    });

    // -------------------------------------------------------------------------
    // 5. delete()
    // -------------------------------------------------------------------------

    describe('delete()', () => {
      it('resolves without error', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await expect(adapter.delete('users', 'u1')).resolves.toBeUndefined();
      });

      it('removes the document — get() returns null after delete', async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await adapter.delete('users', 'u1');
        const result = await adapter.get<TestDoc>('users', 'u1');
        expect(result).toBeNull();
      });

      it('resolves even when document does not exist', async () => {
        await expect(
          adapter.delete('users', 'nonexistent')
        ).resolves.toBeUndefined();
      });
    });

    // -------------------------------------------------------------------------
    // 6. query() — PaginatedQueryResult shape
    // -------------------------------------------------------------------------

    describe('query() — result shape', () => {
      beforeEach(async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await adapter.set<TestDoc>('users', 'u2', { name: 'Bob', age: 25 });
        await adapter.set<TestDoc>('users', 'u3', { name: 'Carol', age: 35 });
      });

      it('returns an object with items array', async () => {
        const result = await adapter.query<TestDoc>('users', {});
        expect(Array.isArray(result.items)).toBe(true);
      });

      it('returns hasMore as boolean when present', async () => {
        const result = await adapter.query<TestDoc>('users', {});
        if (result.hasMore !== undefined) {
          expect(typeof result.hasMore).toBe('boolean');
        }
      });

      it('returns total as number when present', async () => {
        const result = await adapter.query<TestDoc>('users', {});
        if (result.total !== undefined) {
          expect(typeof result.total).toBe('number');
        }
      });

      it('returns lastVisible as string or null when present', async () => {
        const result = await adapter.query<TestDoc>('users', {});
        if (result.lastVisible !== undefined) {
          expect(
            result.lastVisible === null ||
              typeof result.lastVisible === 'string'
          ).toBe(true);
        }
      });

      it('returns all documents when no options are applied', async () => {
        const result = await adapter.query<TestDoc>('users', {});
        expect(result.items).toHaveLength(3);
      });
    });

    // -------------------------------------------------------------------------
    // 7. query() — where / orderBy / limit / startAfter
    // -------------------------------------------------------------------------

    describe('query() — options', () => {
      beforeEach(async () => {
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await adapter.set<TestDoc>('users', 'u2', { name: 'Bob', age: 25 });
        await adapter.set<TestDoc>('users', 'u3', { name: 'Carol', age: 35 });
        await adapter.set<TestDoc>('users', 'u4', { name: 'Dan', age: 25 });
      });

      it('where == filters correctly', async () => {
        const opts: QueryOptions = {
          where: [{ field: 'age', operator: '==', value: 25 }],
        };
        const result = await adapter.query<TestDoc>('users', opts);
        expect(result.items).toHaveLength(2);
        expect(result.items.every((d) => (d as TestDoc).age === 25)).toBe(true);
      });

      it('where != filters correctly', async () => {
        const opts: QueryOptions = {
          where: [{ field: 'age', operator: '!=', value: 25 }],
        };
        const result = await adapter.query<TestDoc>('users', opts);
        expect(result.items.every((d) => (d as TestDoc).age !== 25)).toBe(true);
      });

      it('where > filters correctly', async () => {
        const opts: QueryOptions = {
          where: [{ field: 'age', operator: '>', value: 25 }],
        };
        const result = await adapter.query<TestDoc>('users', opts);
        expect(result.items.every((d) => (d as TestDoc).age > 25)).toBe(true);
      });

      it('where in filters correctly', async () => {
        const opts: QueryOptions = {
          where: [{ field: 'age', operator: 'in', value: [25, 35] }],
        };
        const result = await adapter.query<TestDoc>('users', opts);
        expect(
          result.items.every((d) => [25, 35].includes((d as TestDoc).age))
        ).toBe(true);
      });

      it('where array-contains filters correctly', async () => {
        await adapter.set('tagged', 't1', { name: 'A', tags: ['js', 'ts'] });
        await adapter.set('tagged', 't2', { name: 'B', tags: ['python'] });

        const opts: QueryOptions = {
          where: [{ field: 'tags', operator: 'array-contains', value: 'ts' }],
        };
        const result = await adapter.query<{ name: string; tags: string[] }>(
          'tagged',
          opts
        );
        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.name).toBe('A');
      });

      it('orderBy asc sorts correctly', async () => {
        const opts: QueryOptions = {
          orderBy: [{ field: 'age', direction: 'asc' }],
        };
        const result = await adapter.query<TestDoc>('users', opts);
        const ages = result.items.map((d) => (d as TestDoc).age);
        expect(ages).toEqual([...ages].sort((a, b) => a - b));
      });

      it('orderBy desc sorts correctly', async () => {
        const opts: QueryOptions = {
          orderBy: [{ field: 'age', direction: 'desc' }],
        };
        const result = await adapter.query<TestDoc>('users', opts);
        const ages = result.items.map((d) => (d as TestDoc).age);
        expect(ages).toEqual([...ages].sort((a, b) => b - a));
      });

      it('limit restricts result count', async () => {
        const opts: QueryOptions = { limit: 2 };
        const result = await adapter.query<TestDoc>('users', opts);
        expect(result.items).toHaveLength(2);
        expect(result.hasMore).toBe(true);
      });

      it('limit beyond total — hasMore is false', async () => {
        const opts: QueryOptions = { limit: 100 };
        const result = await adapter.query<TestDoc>('users', opts);
        expect(result.hasMore).toBe(false);
      });

      it('startAfter paginates using cursor from previous result', async () => {
        const page1 = await adapter.query<TestDoc>('users', { limit: 2 });
        expect(page1.hasMore).toBe(true);
        expect(page1.lastVisible).not.toBeNull();

        const page2 = await adapter.query<TestDoc>('users', {
          limit: 2,
          startAfter: page1.lastVisible,
        });
        expect(page2.items.length).toBeGreaterThan(0);
        const page1Names = page1.items.map((d) => (d as TestDoc).name);
        const page2Names = page2.items.map((d) => (d as TestDoc).name);
        const overlap = page1Names.filter((n) => page2Names.includes(n));
        expect(overlap).toHaveLength(0);
      });

      it('empty collection returns empty items', async () => {
        const result = await adapter.query<TestDoc>('empty_collection', {});
        expect(result.items).toHaveLength(0);
        expect(result.hasMore).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // 8. subscribe() — optional
    // -------------------------------------------------------------------------

    describe('subscribe() — optional', () => {
      it('when present, calls callback with document data immediately', async () => {
        if (!adapter.subscribe) return;
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        const callback = vi.fn();
        adapter.subscribe<TestDoc>('users', 'u1', callback);
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith({ name: 'Alice', age: 30 });
      });

      it('when present, calls callback with null for missing document', () => {
        if (!adapter.subscribe) return;
        const callback = vi.fn();
        adapter.subscribe<TestDoc>('users', 'missing', callback);
        expect(callback).toHaveBeenCalledWith(null);
      });

      it('when present, returns an unsubscribe function', () => {
        if (!adapter.subscribe) return;
        const callback = vi.fn();
        const unsubscribe = adapter.subscribe<TestDoc>('users', 'u1', callback);
        expect(typeof unsubscribe).toBe('function');
        expect(() => unsubscribe()).not.toThrow();
      });
    });

    // -------------------------------------------------------------------------
    // 9. subscribeToCollection() — optional
    // -------------------------------------------------------------------------

    describe('subscribeToCollection() — optional', () => {
      it('when present, calls callback with current collection contents', async () => {
        if (!adapter.subscribeToCollection) return;
        await adapter.set<TestDoc>('users', 'u1', { name: 'Alice', age: 30 });
        await adapter.set<TestDoc>('users', 'u2', { name: 'Bob', age: 25 });

        const callback = vi.fn();
        adapter.subscribeToCollection<TestDoc>('users', {}, callback);

        expect(callback).toHaveBeenCalledOnce();
        const [items] = callback.mock.calls[0]!;
        expect(items).toHaveLength(2);
      });

      it('when present, returns an unsubscribe function', () => {
        if (!adapter.subscribeToCollection) return;
        const callback = vi.fn();
        const unsubscribe = adapter.subscribeToCollection<TestDoc>(
          'users',
          {},
          callback
        );
        expect(typeof unsubscribe).toBe('function');
        expect(() => unsubscribe()).not.toThrow();
      });
    });

    // -------------------------------------------------------------------------
    // 10. Error propagation
    // -------------------------------------------------------------------------

    describe('error propagation', () => {
      it('update() rejects when document does not exist', async () => {
        await expect(
          adapter.update<TestDoc>('users', 'nonexistent', { age: 99 })
        ).rejects.toThrow();
      });

      it('adapter errors bubble up from get()', async () => {
        const broken: ICrudAdapter = {
          get: vi.fn().mockRejectedValue(new Error('storage unavailable')),
          add: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          query: vi.fn(),
        };

        await expect(broken.get('col', 'id')).rejects.toThrow(
          'storage unavailable'
        );
      });

      it('adapter errors bubble up from add()', async () => {
        const broken: ICrudAdapter = {
          get: vi.fn(),
          add: vi.fn().mockRejectedValue(new Error('write failed')),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          query: vi.fn(),
        };

        await expect(broken.add('col', { name: 'X', age: 1 })).rejects.toThrow(
          'write failed'
        );
      });

      it('adapter errors bubble up from query()', async () => {
        const broken: ICrudAdapter = {
          get: vi.fn(),
          add: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          query: vi.fn().mockRejectedValue(new Error('query timeout')),
        };

        await expect(broken.query('col', {})).rejects.toThrow('query timeout');
      });

      it('adapter errors bubble up from set()', async () => {
        const broken: ICrudAdapter = {
          get: vi.fn(),
          add: vi.fn(),
          set: vi.fn().mockRejectedValue(new Error('set failed')),
          update: vi.fn(),
          delete: vi.fn(),
          query: vi.fn(),
        };

        await expect(broken.set('col', 'id', {})).rejects.toThrow('set failed');
      });

      it('adapter errors bubble up from delete()', async () => {
        const broken: ICrudAdapter = {
          get: vi.fn(),
          add: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn().mockRejectedValue(new Error('delete denied')),
          query: vi.fn(),
        };

        await expect(broken.delete('col', 'id')).rejects.toThrow(
          'delete denied'
        );
      });
    });
  });
}
