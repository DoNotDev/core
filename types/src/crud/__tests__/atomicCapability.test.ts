import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ICrudAdapter } from '../adapter';
import { AtomicBulkError } from '../errors';
import type { AtomicBulkExecutionPlan, BulkAcrossOptions, BulkAcrossResult, PreparedAtomicBatch } from '../types';

// Declaration fixtures: this remains a complete legacy adapter with no atomic
// member. Optional additions cannot require changes in existing implementations.
const legacy: ICrudAdapter = {
  get: async () => null,
  add: async () => ({ id: 'legacy', data: {} }),
  bulk: async () => ({ insertedIds: [], updatedIds: [], deletedIds: [], failed: [] }),
  set: async () => {}, update: async () => {}, delete: async () => {},
  query: async () => ({ items: [] }),
};

const atomic: ICrudAdapter = {
  ...legacy,
  atomicBulkAcross: {
    preflight: async (_batches: PreparedAtomicBatch[]) => {},
    execute: async (_batches: PreparedAtomicBatch[]): Promise<BulkAcrossResult> => ({ results: {} }),
  },
};

const planned: ICrudAdapter = {
  ...legacy,
  atomicBulkAcross: {
    preflight: async (): Promise<AtomicBulkExecutionPlan> => ({ execute: async () => ({ results: {} }) }),
    execute: async () => ({ results: {} }),
  },
};

describe('optional atomic adapter declarations', () => {
  it('leaves legacy adapters and calls structurally unchanged', async () => {
    expectTypeOf(legacy).toMatchTypeOf<ICrudAdapter>();
    expectTypeOf(atomic).toMatchTypeOf<ICrudAdapter>();
    expectTypeOf(planned).toMatchTypeOf<ICrudAdapter>();
    expect(legacy.atomicBulkAcross).toBeUndefined();
    await expect(legacy.bulk('products', {})).resolves.toEqual({ insertedIds: [], updatedIds: [], deletedIds: [], failed: [] });
    const legacyOptions: BulkAcrossOptions = { showSuccessToast: false };
    const atomicOptions: BulkAcrossOptions = { execution: 'atomic' };
    expect(legacyOptions.execution).toBeUndefined();
    expect(atomicOptions.execution).toBe('atomic');
  });

  it('shares prepared inputs/result shape and preserves original error cause', async () => {
    const batches: PreparedAtomicBatch[] = [{ collection: 'products', inserts: [{ id: 'p1' }] }];
    expect(await atomic.atomicBulkAcross!.preflight(batches)).toBeUndefined();
    const plan = await planned.atomicBulkAcross!.preflight(batches);
    expect(plan).toBeDefined();
    if (plan) await expect(plan.execute()).resolves.toEqual({ results: {} });
    await expect(atomic.atomicBulkAcross!.execute(batches)).resolves.toEqual({ results: {} });
    const cause = new Error('lost reply');
    const error = new AtomicBulkError('commit acknowledgment failed', 'unknown', cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AtomicBulkError');
    expect(error.outcome).toBe('unknown');
    expect(error.cause).toBe(cause);
    expect(new AtomicBulkError('unsupported', 'not-committed').outcome).toBe('not-committed');
  });
});
