import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import { FIELD_TYPES, type FieldType } from '@donotdev/types';

import { createSchemas } from '../createSchema';
import { defineEntity } from '../defineEntity';
import {
  BUILTIN_VALUES,
  describeEntity,
  resolveFieldValue,
} from '../fieldSemantics';
import { fieldClassesEntity as listing } from '@dndev/test-entities';


describe('describeEntity', () => {
  const { fields } = describeEntity(listing);

  it('names the entity and memoizes per entity object', () => {
    expect(describeEntity(listing).name).toBe('Listing');
    expect(describeEntity(listing).collection).toBe('semantic_listings');
    expect(describeEntity(listing)).toBe(describeEntity(listing));
  });

  it('value kind: built-in table, schema structure, reference', () => {
    expect(fields.title?.value.kind).toBe('text');
    expect(fields.price?.value.kind).toBe('number');
    expect(fields.rooms?.value.kind).toBe('integer');
    expect(fields.paidAt?.value.kind).toBe('timestamp');
    expect(fields.when?.value.kind).toBe('time');
    expect(fields.day?.value.kind).toBe('date');
    expect(fields.mode?.value.kind).toBe('text');
    expect(fields.address?.value.kind).toBe('json');
    expect(fields.owner?.value).toMatchObject({ kind: 'ref', ref: 'owners' });
    expect(fields.companyId?.value).toMatchObject({ kind: 'ref', ref: 'companies' });
    expect(fields.status?.value.kind).toBe('text');
  });

  it('value schema is presence-free', () => {
    expect(v.safeParse(fields.title!.value.schema, null).success).toBe(false);
    expect(v.safeParse(fields.title!.value.schema, 'x').success).toBe(true);
    expect(v.safeParse(fields.owner!.value.schema, '').success).toBe(false);
  });

  it('required: always, conditional, never', () => {
    expect(fields.title?.required).toBe('always');
    expect(fields.status?.required).toBe('always');
    expect(fields.vatNumber?.required).toBe('conditional');
    expect(fields.price?.required).toBe('never');
  });

  it('write class: never, program, derived, user', () => {
    for (const name of ['id', 'createdAt', 'updatedAt', 'createdById', 'updatedById', 'revision', 'secret']) {
      expect(fields[name]?.write, name).toBe('never');
    }
    expect(fields.paidAt?.write).toBe('program');
    expect(fields.total?.write).toBe('derived');
    for (const name of ['title', 'sku', 'margin', 'status', 'companyId', 'owner']) {
      expect(fields[name]?.write, name).toBe('user');
    }
  });

  it('editableFor: user class only, create-only, role hierarchy, technical read-only', () => {
    expect(fields.title?.editableFor('guest', 'edit')).toBe(true);
    expect(fields.sku?.editableFor('admin', 'create')).toBe(true);
    expect(fields.sku?.editableFor('admin', 'edit')).toBe(false);
    expect(fields.margin?.editableFor('admin', 'edit')).toBe(false);
    expect(fields.margin?.editableFor('super', 'edit')).toBe(true);
    expect(fields.status?.editableFor('user', 'create')).toBe(false);
    expect(fields.status?.editableFor('admin', 'create')).toBe(true);
    expect(fields.companyId?.editableFor('admin', 'create')).toBe(true);
    expect(fields.companyId?.editableFor('admin', 'edit')).toBe(false);
    expect(fields.createdAt?.editableFor('super', 'edit')).toBe(false);
    expect(fields.paidAt?.editableFor('super', 'edit')).toBe(false);
    expect(fields.total?.editableFor('super', 'create')).toBe(false);
    expect(fields.margin?.editableFor(undefined, 'edit')).toBe(false);
  });

  it('visibleAt and companion', () => {
    expect(fields.title?.visibleAt).toBe('guest');
    expect(fields.secret?.visibleAt).toBe('hidden');
    expect(fields.notes?.visibleAt).toBe('owner');
    expect(fields.createdAt?.visibleAt).toBe('technical');
    expect(fields.title?.companion).toBe('titleI18n');
    expect(fields.price).not.toHaveProperty('companion');
  });
});

describe('BUILTIN_VALUES', () => {
  it('has exactly one entry per FIELD_TYPES key', () => {
    expect(Object.keys(BUILTIN_VALUES).sort()).toEqual([...FIELD_TYPES].sort());
  });
});

describe('fail loud on custom types', () => {
  it('defineEntity throws for a custom type without value shape, naming entity.field and the fixes', () => {
    expect(() =>
      defineEntity({
        name: 'Apartment',
        collection: 'apartments',
        fields: {
          district_code: { name: 'district_code', label: 'District', type: 'paris-district' as FieldType, visibility: 'admin' },
        },
      })
    ).toThrow(/Apartment\.district_code.*paris-district.*validation\.schema.*validation\.reference/);
  });

  it('a custom type whose schema kind cannot be read throws', () => {
    expect(() =>
      resolveFieldValue(
        { name: 'x', label: 'X', type: 'odd' as FieldType, visibility: 'user', validation: { schema: v.unknown() } },
        'Thing.x'
      )
    ).toThrow(/Thing\.x/);
  });

  it('a built-in type keeps its table kind when its schema does not say', () => {
    const value = resolveFieldValue({
      name: 'amount',
      label: 'Amount',
      type: 'currency',
      visibility: 'user',
      validation: { schema: v.custom<number>((input) => typeof input === 'number') },
    });
    expect(value.kind).toBe('number');
  });

  it('a kind-changing transform is not read as the input kind', () => {
    const value = resolveFieldValue({
      name: 'count',
      label: 'Count',
      type: 'number',
      visibility: 'user',
      validation: { schema: v.pipe(v.string(), v.transform(Number), v.number()) },
    });
    expect(value.kind).toBe('number');
  });
});

describe('createSchemas reads the write class', () => {
  const schemas = createSchemas(listing);
  const keys = (schema: unknown) =>
    Object.keys((schema as { entries: Record<string, unknown> }).entries);

  it('write schemas leave out never, keep program, derived and user', () => {
    for (const op of ['create', 'draft', 'update'] as const) {
      const entries = keys(schemas[op]);
      for (const name of ['revision', 'secret', 'createdAt', 'createdById']) {
        expect(entries, `${op}.${name}`).not.toContain(name);
      }
      for (const name of ['paidAt', 'total', 'title', 'titleI18n', 'owner']) {
        expect(entries, `${op}.${name}`).toContain(name);
      }
    }
  });

  it('read schemas leave out hidden fields only', () => {
    const entries = keys(schemas.get);
    expect(entries).not.toContain('secret');
    expect(entries).toContain('revision');
    expect(entries).toContain('createdAt');
  });
});
