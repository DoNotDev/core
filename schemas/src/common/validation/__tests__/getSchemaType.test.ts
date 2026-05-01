import * as v from 'valibot';
import { describe, it, expect, beforeEach } from 'vitest';

import type { EntityField, FieldType } from '@donotdev/types';

import {
  getSchemaType,
  registerSchemaGenerator,
  hasCustomSchemaGenerator,
  getRegisteredSchemaTypes,
  clearSchemaGenerators,
} from '../getSchemaType';

function makeField(
  type: FieldType,
  overrides: Partial<EntityField<FieldType>> = {}
): EntityField<FieldType> {
  return {
    type,
    label: 'Test',
    ...overrides,
  } as EntityField<FieldType>;
}

describe('schema registry', () => {
  it('has built-in types registered', () => {
    expect(hasCustomSchemaGenerator('text')).toBe(true);
    expect(hasCustomSchemaGenerator('email')).toBe(true);
    expect(hasCustomSchemaGenerator('number')).toBe(true);
    expect(hasCustomSchemaGenerator('boolean')).toBe(true);
    expect(hasCustomSchemaGenerator('date')).toBe(true);
    expect(hasCustomSchemaGenerator('select')).toBe(true);
    expect(hasCustomSchemaGenerator('reference')).toBe(true);
  });

  it('getRegisteredSchemaTypes returns all registered types', () => {
    const types = getRegisteredSchemaTypes();

    expect(types).toContain('text');
    expect(types).toContain('email');
    expect(types).toContain('number');
    expect(types).toContain('file');
    expect(types).toContain('geopoint');
    expect(types.length).toBeGreaterThan(20);
  });

  it('registers custom schema generator', () => {
    registerSchemaGenerator('custom-type', () => v.string());

    expect(hasCustomSchemaGenerator('custom-type')).toBe(true);
  });
});

describe('getSchemaType', () => {
  it('generates text schema', () => {
    const schema = getSchemaType(makeField('text'));

    // Should accept string (nullish because not required)
    expect(() => v.parse(schema, 'hello')).not.toThrow();
    expect(() => v.parse(schema, null)).not.toThrow();
    expect(() => v.parse(schema, undefined)).not.toThrow();
  });

  it('generates required text schema', () => {
    const schema = getSchemaType(
      makeField('text', { validation: { required: true } } as any)
    );

    expect(() => v.parse(schema, 'hello')).not.toThrow();
    expect(() => v.parse(schema, null)).toThrow();
  });

  it('generates text schema with minLength', () => {
    const schema = getSchemaType(
      makeField('text', { validation: { required: true, minLength: 3 } } as any)
    );

    expect(() => v.parse(schema, 'ab')).toThrow();
    expect(() => v.parse(schema, 'abc')).not.toThrow();
  });

  it('generates email schema', () => {
    const schema = getSchemaType(
      makeField('email', { validation: { required: true } } as any)
    );

    expect(() => v.parse(schema, 'test@example.com')).not.toThrow();
    expect(() => v.parse(schema, 'invalid')).toThrow();
  });

  it('generates number schema', () => {
    const schema = getSchemaType(makeField('number'));

    expect(() => v.parse(schema, 42)).not.toThrow();
    expect(() => v.parse(schema, null)).not.toThrow();
  });

  it('generates number schema with min/max', () => {
    const schema = getSchemaType(
      makeField('number', {
        validation: { required: true, min: 0, max: 100 },
      } as any)
    );

    expect(() => v.parse(schema, 50)).not.toThrow();
    expect(() => v.parse(schema, -1)).toThrow();
    expect(() => v.parse(schema, 101)).toThrow();
  });

  it('generates boolean schema', () => {
    const schema = getSchemaType(makeField('boolean'));

    expect(() => v.parse(schema, true)).not.toThrow();
    expect(() => v.parse(schema, false)).not.toThrow();
  });

  it('generates date schema (ISO timestamp)', () => {
    const schema = getSchemaType(
      makeField('date', { validation: { required: true } } as any)
    );

    expect(() => v.parse(schema, '2024-01-15T10:30:00.000Z')).not.toThrow();
    expect(() => v.parse(schema, 'not-a-date')).toThrow();
  });

  it('generates select schema with static options', () => {
    const schema = getSchemaType(
      makeField('select', {
        validation: {
          required: true,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      } as any)
    );

    expect(() => v.parse(schema, 'a')).not.toThrow();
    expect(() => v.parse(schema, 'c')).toThrow();
  });

  it('generates geopoint schema', () => {
    const schema = getSchemaType(
      makeField(
        'geopoint' as FieldType,
        {
          validation: { required: true },
        } as any
      )
    );

    expect(() => v.parse(schema, { lat: 48.8566, lng: 2.3522 })).not.toThrow();
    expect(() => v.parse(schema, { lat: 48.8566 })).toThrow();
  });

  it('uses custom schema from field.validation.schema', () => {
    const customSchema = v.pipe(v.string(), v.minLength(5));
    const schema = getSchemaType(
      makeField('text', {
        validation: { required: true, schema: customSchema },
      } as any)
    );

    expect(() => v.parse(schema, 'abcde')).not.toThrow();
    expect(() => v.parse(schema, 'abcd')).toThrow();
  });

  it('falls back to unknown for unregistered types', () => {
    const schema = getSchemaType(makeField('nonexistent-type' as FieldType));

    // unknown accepts anything
    expect(() => v.parse(schema, 'anything')).not.toThrow();
    expect(() => v.parse(schema, 42)).not.toThrow();
    expect(() => v.parse(schema, null)).not.toThrow();
  });
});
