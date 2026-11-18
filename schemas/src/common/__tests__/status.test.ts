import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import { createSchemas } from '../createSchema';
import { noteEntity } from '@dndev/test-entities';

import { entersVisibleStatus, statusOf, writeSchemaFor } from '../crud/status';

describe('statusOf', () => {
  it('the status string, else null', () => {
    expect(statusOf({ status: 'draft' })).toBe('draft');
    expect(statusOf({ status: 'available', title: 'x' })).toBe('available');
    expect(statusOf({})).toBeNull();
    expect(statusOf({ status: null })).toBeNull();
    expect(statusOf({ status: 1 })).toBeNull();
    expect(statusOf(null)).toBeNull();
    expect(statusOf(undefined)).toBeNull();
  });
});

describe('writeSchemaFor', () => {
  it('create: draft status → draft, any other or none → create', () => {
    expect(writeSchemaFor({ op: 'create', status: 'draft' })).toBe('draft');
    expect(writeSchemaFor({ op: 'create', status: 'available' })).toBe('create');
    expect(writeSchemaFor({ op: 'create', status: 'sold' })).toBe('create');
    expect(writeSchemaFor({ op: 'create' })).toBe('create');
    expect(writeSchemaFor({ op: 'create', status: null })).toBe('create');
  });

  it('update: resulting status = sent status ?? stored status', () => {
    expect(writeSchemaFor({ op: 'update', status: 'draft' })).toBe('draft');
    expect(writeSchemaFor({ op: 'update', storedStatus: 'draft' })).toBe('draft');
    expect(writeSchemaFor({ op: 'update', status: null, storedStatus: 'draft' })).toBe('draft');
    expect(writeSchemaFor({ op: 'update', status: 'available', storedStatus: 'draft' })).toBe('update');
    expect(writeSchemaFor({ op: 'update', status: 'draft', storedStatus: 'available' })).toBe('draft');
    expect(writeSchemaFor({ op: 'update', storedStatus: 'available' })).toBe('update');
    expect(writeSchemaFor({ op: 'update' })).toBe('update');
  });

  it('picks the schema that validates the write (draft edit stays relaxed)', () => {
    const note = noteEntity;
    const schemas = createSchemas(note);
    const patch = { id: 'n1', title: null };
    const draftEdit = schemas[writeSchemaFor({ op: 'update', storedStatus: 'draft' })];
    const publishedEdit = schemas[writeSchemaFor({ op: 'update', storedStatus: 'available' })];
    expect(v.safeParse(draftEdit, { ...patch, status: 'draft' }).success).toBe(true);
    expect(v.safeParse(publishedEdit, patch).success).toBe(false);
  });
});

describe('entersVisibleStatus', () => {
  it('true when an update leaves a status that may hold an incomplete row (STATUS_MATRIX)', () => {
    expect(entersVisibleStatus({ op: 'update', status: 'available', storedStatus: 'draft' })).toBe(true);
    expect(entersVisibleStatus({ op: 'update', status: 'available', storedStatus: 'deleted' })).toBe(true);
    expect(entersVisibleStatus({ op: 'update', status: 'sold', storedStatus: 'draft' })).toBe(true);
    // An available row is already complete: moving it to an app status checks the patch only.
    expect(entersVisibleStatus({ op: 'update', status: 'sold', storedStatus: 'available' })).toBe(false);
  });

  it('false when the status is kept, unsent, hidden, or the write is a create', () => {
    expect(entersVisibleStatus({ op: 'update', status: 'available', storedStatus: 'available' })).toBe(false);
    expect(entersVisibleStatus({ op: 'update', storedStatus: 'draft' })).toBe(false);
    expect(entersVisibleStatus({ op: 'update', status: 'deleted', storedStatus: 'draft' })).toBe(false);
    expect(entersVisibleStatus({ op: 'update', status: 'draft', storedStatus: 'available' })).toBe(false);
    expect(entersVisibleStatus({ op: 'create', status: 'available' })).toBe(false);
  });
});
