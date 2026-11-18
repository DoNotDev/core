import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import type { EntityField, FieldType } from '@donotdev/types';

import { getSchemaType } from '../getSchemaType';

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

  it('throws for a custom type without value shape (no v.unknown() fallback)', () => {
    expect(() =>
      getSchemaType(makeField('nonexistent-type' as FieldType, { name: 'district' }))
    ).toThrow(/district.*nonexistent-type.*validation\.schema.*validation\.reference/);
  });

  it('custom type with validation.reference: a non-empty id', () => {
    const schema = getSchemaType(
      makeField('owner-select' as FieldType, {
        validation: { required: true, reference: 'owners' },
      })
    );
    expect(v.safeParse(schema, 'abc').success).toBe(true);
    expect(v.safeParse(schema, '').success).toBe(false);
    expect(v.safeParse(schema, null).success).toBe(false);
  });

  it('custom type with validation.schema uses it, presence applied', () => {
    const schema = getSchemaType(
      makeField('paris-district' as FieldType, {
        validation: { schema: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)) },
      })
    );
    expect(v.safeParse(schema, 12).success).toBe(true);
    expect(v.safeParse(schema, null).success).toBe(true);
    expect(v.safeParse(schema, 21).success).toBe(false);
  });
});

describe('tel schema', () => {
  const tel = getSchemaType(makeField('tel', { validation: { required: true } }));
  const valid = (value: unknown) => v.safeParse(tel, value).success;

  it('accepts international and French national numbers', () => {
    for (const value of ['+33 6 12 34 56 78', '+33612345678', '+1 415 555 2671', '06 12 34 56 78', '0612345678', '06.12.34.56.78', '01-23-45-67-89']) {
      expect(valid(value), value).toBe(true);
    }
  });

  it('rejects anything else, a bare dial code included', () => {
    for (const value of ['TOTO', '+33', '+33 TOTO', '6 12 34 56 78', '00 12 34 56 78', '06 12 34 56', '+0 612345678', '+33 6 12 34 56 78 90 12 34', '']) {
      expect(valid(value), value).toBe(false);
    }
  });

  it('lets validation.pattern replace the rule', () => {
    const custom = getSchemaType(makeField('tel', { validation: { required: true, pattern: '^\\d{4}$' } }));
    expect(v.safeParse(custom, '1234').success).toBe(true);
    expect(v.safeParse(custom, '+33612345678').success).toBe(false);
  });
});

describe('value fixes', () => {
  const ok = (field: EntityField<FieldType>, value: unknown) =>
    v.safeParse(getSchemaType(field), value).success;
  const asset = { url: 'https://x/a.pdf', filename: 'a.pdf', size: 1 };

  it('required file and document reject null; optional ones accept it', () => {
    for (const type of ['file', 'document'] as const) {
      expect(ok(makeField(type, { validation: { required: true } }), null), type).toBe(false);
      expect(ok(makeField(type, { validation: { required: true } }), asset), type).toBe(true);
      expect(ok(makeField(type), null), type).toBe(true);
    }
  });

  it('gdprConsent goes through the presence rule', () => {
    const given = { gdprConsent: true, gdprConsentDate: '2026-11-17T10:00:00.000Z', gdprConsentVersion: '2026-01-01' };
    const required = makeField('gdprConsent', { validation: { required: true } });
    expect(ok(required, given)).toBe(true);
    expect(ok(required, false)).toBe(false);
    expect(ok(required, null)).toBe(false);
    expect(ok(required, undefined)).toBe(false);
    expect(ok(required, '')).toBe(false);
    expect(ok(required, { gdprConsent: false })).toBe(false);
    const optional = makeField('gdprConsent');
    expect(ok(optional, false)).toBe(true);
    expect(ok(optional, null)).toBe(true);
    expect(ok(optional, given)).toBe(true);
    expect(ok(optional, 'yes')).toBe(false);
  });

  it('time is HH:mm or HH:mm:ss', () => {
    const time = makeField('time', { validation: { required: true } });
    for (const value of ['10:30', '00:00', '23:59:59']) expect(ok(time, value), value).toBe(true);
    for (const value of ['24:00', '10:60', '1030', '2026-11-17T10:30:00Z', '10:30:5']) expect(ok(time, value), value).toBe(false);
  });

  it('week is YYYY-Www', () => {
    const week = makeField('week', { validation: { required: true } });
    for (const value of ['2026-W47', '2026-W01', '2026-W53']) expect(ok(week, value), value).toBe(true);
    for (const value of ['2026-W00', '2026-W54', '2026-47', '2026-11-17']) expect(ok(week, value), value).toBe(false);
  });

  it('month is YYYY-MM', () => {
    const month = makeField('month', { validation: { required: true } });
    for (const value of ['2026-11', '2026-01']) expect(ok(month, value), value).toBe(true);
    for (const value of ['2026-13', '2026-00', '2026-1', '2026-11-17']) expect(ok(month, value), value).toBe(false);
  });

  it('field-array without schema is an array of objects', () => {
    const rows = makeField('field-array', { validation: { required: true } });
    expect(ok(rows, [{ a: 1 }, { b: 'x' }])).toBe(true);
    expect(ok(rows, [])).toBe(true);
    expect(ok(rows, ['a'])).toBe(false);
    expect(ok(rows, { a: 1 })).toBe(false);
  });

  it('currency, duration and rating are numbers; richtext is text', () => {
    for (const type of ['currency', 'duration', 'rating'] as const) {
      expect(ok(makeField(type, { validation: { required: true } }), 12.5), type).toBe(true);
      expect(ok(makeField(type, { validation: { required: true } }), '12'), type).toBe(false);
    }
    expect(ok(makeField('richtext', { validation: { required: true } }), '<p>x</p>')).toBe(true);
    expect(ok(makeField('richtext', { validation: { required: true } }), '')).toBe(false);
  });
});
