import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import { createSchemas } from '../createSchema';
import { carEntity, contactEntity, piiSecretEntity, translatedNameEntity, untranslatableNumberEntity } from '@dndev/test-entities';

describe('createSchemas metadata', () => {
  // Regression: CrudService reads schema.metadata.security.piiFields; before this,
  // entity.security never reached the schema, so PII was never encrypted.
  it('copies entity.security into every operation schema', () => {
    const schemas = createSchemas(piiSecretEntity);
    for (const schema of Object.values(schemas)) {
      expect(schema.metadata.security?.piiFields).toEqual(['secret']);
    }
  });

  it('omits security when the entity has none', () => {
    const schemas = createSchemas(carEntity);
    expect(schemas.create.metadata).not.toHaveProperty('security');
  });
});

describe('createSchemas translated fields', () => {
  const product = translatedNameEntity;

  it('adds the companion to read and write schemas, with the field visibility', () => {
    const schemas = createSchemas(product);
    for (const op of ['get', 'create', 'draft', 'update', 'list'] as const) {
      expect(Object.keys(schemas[op].entries)).toContain('nameI18n');
    }
    expect(Object.keys(schemas.get.entries)).not.toContain('skuI18n');
    expect((schemas.get.entries as Record<string, { visibility?: string }>).nameI18n?.visibility).toBe('guest');
  });

  it('validates each language like the field, without required', async () => {
    const { safeParse } = await import('valibot');
    const { create } = createSchemas(product);
    expect(safeParse(create, { status: 'available', name: 'Abc', nameI18n: { en: 'Abcd' } }).success).toBe(true);
    expect(safeParse(create, { status: 'available', name: 'Abc' }).success).toBe(true);
    expect(safeParse(create, { status: 'available', name: 'Abc', nameI18n: { en: 'Too long' } }).success).toBe(false);
  });

  it('rejects i18n on a type that cannot be translated', () => {
    const bad = untranslatableNumberEntity;
    expect(() => createSchemas(bad)).toThrow(/i18n: true but type 'number'/);
  });
});

describe('createSchemas required, update and draft rules', () => {
  const contact = contactEntity;
  const schemas = createSchemas(contact);
  const ok = (op: 'create' | 'draft' | 'update', data: Record<string, unknown>) =>
    v.safeParse(schemas[op], { id: 'contact-1', ...data }).success;
  const filled = { status: 'available', name: 'Ana', phone: '+33 6 12 34 56 78' };

  it('rejects an empty required field on create: null, undefined and empty string', () => {
    expect(ok('create', filled)).toBe(true);
    for (const empty of [null, undefined, '']) {
      expect(ok('create', { ...filled, name: empty })).toBe(false);
    }
  });

  it('update: a field may be left out, a required one sent must be filled in', () => {
    expect(ok('update', { note: 'x' })).toBe(true);
    expect(ok('update', { note: null })).toBe(true);
    expect(ok('update', { name: 'Bo' })).toBe(true);
    expect(ok('update', { name: null })).toBe(false);
    expect(ok('update', { name: '' })).toBe(false);
  });

  it('draft: required fields may be empty, filled ones keep their format', () => {
    expect(ok('draft', { status: 'draft', name: null, phone: null })).toBe(true);
    expect(ok('draft', { status: 'draft', phone: 'TOTO' })).toBe(false);
  });
});
