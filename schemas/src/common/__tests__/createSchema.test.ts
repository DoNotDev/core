import { describe, it, expect } from 'vitest';

import { createSchemas } from '../createSchema';
import { defineEntity } from '../defineEntity';

function entity(security?: { piiFields: string[] }) {
  return defineEntity({
    name: 'Customer',
    collection: 'customers',
    fields: {
      email: {
        name: 'email',
        label: 'Email',
        type: 'email',
        visibility: 'user',
      },
    },
    ...(security && { security }),
  });
}

describe('createSchemas metadata', () => {
  // Regression: CrudService reads schema.metadata.security.piiFields; before this,
  // entity.security never reached the schema, so PII was never encrypted.
  it('copies entity.security into every operation schema', () => {
    const schemas = createSchemas(entity({ piiFields: ['email'] }));
    for (const schema of Object.values(schemas)) {
      expect(schema.metadata.security?.piiFields).toEqual(['email']);
    }
  });

  it('omits security when the entity has none', () => {
    const schemas = createSchemas(entity());
    expect(schemas.create.metadata).not.toHaveProperty('security');
  });
});

describe('createSchemas translated fields', () => {
  const product = defineEntity({
    name: 'Product',
    collection: 'products',
    listFields: ['name'],
    fields: {
      name: { name: 'name', label: 'Name', type: 'text', visibility: 'guest', i18n: true, validation: { required: true, maxLength: 5 } },
      sku: { name: 'sku', label: 'SKU', type: 'text', visibility: 'guest' },
    },
  });

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
    const bad = defineEntity({
      name: 'Bad',
      collection: 'bads',
      fields: { n: { name: 'n', label: 'N', type: 'number', visibility: 'guest', i18n: true } },
    });
    expect(() => createSchemas(bad)).toThrow(/i18n: true but type 'number'/);
  });
});
