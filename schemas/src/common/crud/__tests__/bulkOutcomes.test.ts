import { describe, expect, it } from 'vitest';
import * as v from 'valibot';

import { BulkOutcomeSchema, BulkResponseSchema, validateBulkOutcome } from '../bulk';
import type { BulkRequest } from '../bulk';

const empty = { insertedIds: [], updatedIds: [], deletedIds: [], failed: [] };
const ops: BulkRequest = {
  inserts: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
  updates: [{ id: 'u1', patch: {} }, { id: 'u2', patch: {} }],
  deletes: ['d1', 'd2'],
};
const partial = {
  insertedIds: ['new-a', 'new-c'],
  updatedIds: ['u2'],
  deletedIds: ['d1'],
  failed: [
    { op: 'insert', index: 1, error: 'denied' },
    { op: 'update', id: 'u1', error: 'denied' },
    { op: 'delete', id: 'd2', error: 'denied' },
  ],
};

describe('request-aware bulk outcomes', () => {
  it('accepts omitted failed only when the legacy reply completely matches the request', () => {
    const legacy = { insertedIds: ['new'], updatedIds: ['u'], deletedIds: ['d'] };
    expect(validateBulkOutcome({ inserts: [{}], updates: [{ id: 'u', patch: {} }], deletes: ['d'] }, legacy))
      .toEqual({ ...legacy, failed: [] });
    expect(() => validateBulkOutcome({ inserts: [{}, {}] }, legacy)).toThrow();
    expect(() => validateBulkOutcome({ deletes: ['other'] }, { ...legacy, insertedIds: [], updatedIds: [] })).toThrow();
    expect(() => validateBulkOutcome({}, { ...empty, failed: null })).toThrow();
  });
  it('preserves valid legacy partial results and all-failed/no-op results', () => {
    expect(validateBulkOutcome(ops, partial)).toEqual(partial);
    expect(validateBulkOutcome({}, empty)).toEqual(empty);
    const failed = {
      ...empty,
      failed: [{ op: 'insert', index: 0, error: 'denied' }],
    };
    expect(validateBulkOutcome({ inserts: [{}] }, failed)).toEqual(failed);
  });

  it.each([
    ['missing insert index', { op: 'insert', error: 'x' }],
    ['missing update ID', { op: 'update', index: 0, error: 'x' }],
    ['missing delete ID', { op: 'delete', error: 'x' }],
    ['negative index', { op: 'insert', index: -1, error: 'x' }],
    ['fractional index', { op: 'insert', index: 0.5, error: 'x' }],
    ['unknown operation', { op: 'other', id: 'd', error: 'x' }],
  ])('rejects %s', (_label, failure) => {
    expect(() => validateBulkOutcome(ops, { ...partial, failed: [failure] })).toThrow();
  });

  it.each([
    ['missing insert', { ...partial, insertedIds: ['new-a'] }],
    ['extra insert', { ...partial, insertedIds: ['a', 'b', 'c'] }],
    ['duplicate insert ID', { ...partial, insertedIds: ['a', 'a'] }],
    ['missing update', { ...partial, updatedIds: [] }],
    ['missing delete', { ...partial, deletedIds: [] }],
    ['unknown update', { ...partial, updatedIds: ['unknown'] }],
    ['unknown delete', { ...partial, deletedIds: ['unknown'] }],
    ['duplicate update', { ...partial, updatedIds: ['u2', 'u2'] }],
    ['duplicate delete', { ...partial, deletedIds: ['d1', 'd1'] }],
    ['contradictory update', { ...partial, updatedIds: ['u1'] }],
    ['contradictory delete', { ...partial, deletedIds: ['d2'] }],
    ['duplicate failure', { ...partial, failed: [...partial.failed, partial.failed[0]] }],
    ['unknown insert index', { ...partial, failed: [{ op: 'insert', index: 9, error: 'x' }] }],
    ['unknown failure ID', { ...partial, failed: [...partial.failed, { op: 'delete', id: 'unknown', error: 'x' }] }],
    ['contradictory secondary index', { ...partial, failed: partial.failed.map((f) => f.op === 'update' ? { ...f, index: 1 } : f) }],
    ['contradictory secondary insert ID', { ...partial, failed: partial.failed.map((f) => f.op === 'insert' ? { ...f, id: 'unknown' } : f) }],
  ])('rejects %s', (_label, result) => {
    expect(() => validateBulkOutcome(ops, result)).toThrow();
  });

  it('requires success IDs to follow submitted update/delete order', () => {
    expect(() => validateBulkOutcome({ updates: ops.updates }, {
      ...empty, updatedIds: ['u2', 'u1'],
    })).toThrow();
    expect(() => validateBulkOutcome({ deletes: ops.deletes }, {
      ...empty, deletedIds: ['d2', 'd1'],
    })).toThrow();
  });

  it('preserves allowed duplicate request IDs with exact uniform outcome multiplicity', () => {
    const repeated = { updates: [{ id: 'u', patch: {} }, { id: 'u', patch: {} }], deletes: ['d', 'd'] };
    const success = { ...empty, updatedIds: ['u', 'u'], deletedIds: ['d', 'd'] };
    expect(validateBulkOutcome(repeated, success)).toEqual(success);
    const failed = { ...empty, failed: [
      { op: 'update', id: 'u', error: 'x' }, { op: 'update', id: 'u', error: 'x' },
      { op: 'delete', id: 'd', error: 'x' }, { op: 'delete', id: 'd', error: 'x' },
    ] };
    expect(validateBulkOutcome(repeated, failed)).toEqual(failed);
    expect(() => validateBulkOutcome(repeated, { ...success, updatedIds: ['u'] })).toThrow();
    expect(() => validateBulkOutcome(repeated, {
      ...success, updatedIds: ['u'], failed: [{ op: 'update', id: 'u', error: 'x' }],
    })).toThrow();
    expect(() => validateBulkOutcome(repeated, {
      ...failed, failed: failed.failed.map((f) => ({ ...f, index: 0 })),
    })).toThrow();
  });

  it('does not invent an insert-ID preservation or insert/delete collision contract', () => {
    expect(validateBulkOutcome({ inserts: [{ id: 'provided' }], deletes: ['provided'] }, {
      ...empty, insertedIds: ['server-assigned'], deletedIds: ['provided'],
    })).toEqual({ ...empty, insertedIds: ['server-assigned'], deletedIds: ['provided'] });
  });

  it('rejects an explicitly failed insert ID also reported as successful', () => {
    expect(() => validateBulkOutcome({ inserts: [{ id: 'a' }, {}] }, {
      ...empty, insertedIds: ['a'], failed: [{ op: 'insert', index: 0, id: 'a', error: 'x' }],
    })).toThrow();
  });

  it('keeps the old atomic wire parser unchanged and provides additive failure preservation', () => {
    expect(v.parse(BulkResponseSchema, partial)).toEqual({
      insertedIds: partial.insertedIds, updatedIds: partial.updatedIds, deletedIds: partial.deletedIds,
    });
    expect(v.parse(BulkOutcomeSchema, partial)).toEqual(partial);
    expect(() => validateBulkOutcome(ops, v.parse(BulkResponseSchema, partial))).toThrow();
  });
});
