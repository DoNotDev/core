import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import type { dndevSchema } from '@donotdev/types';

import { DoNotDevError } from '../../errors';
import {
  validateWithSchema,
  safeValidate,
  ensureSpreadable,
} from '../validationUtils';

// =============================================================================
// Helpers — create dndevSchema-compatible schemas with required metadata
// =============================================================================

function withMetadata<
  T extends v.BaseSchema<unknown, any, v.BaseIssue<unknown>>,
>(schema: T): T & { metadata: { collection: string } } {
  return Object.assign(schema, {
    metadata: { collection: 'test' },
  });
}

const stringSchema = withMetadata(v.string());
const numberSchema = withMetadata(v.number());
const objectSchema = withMetadata(
  v.object({ name: v.string(), age: v.number() })
);

// =============================================================================
// validateWithSchema
// =============================================================================

describe('validateWithSchema', () => {
  it('returns parsed data for valid input', () => {
    expect(
      validateWithSchema(stringSchema as dndevSchema<string>, 'hello', 'test')
    ).toBe('hello');
  });

  it('validates objects', () => {
    const data = { name: 'Alice', age: 30 };
    const result = validateWithSchema(
      objectSchema as dndevSchema<{ name: string; age: number }>,
      data,
      'test'
    );
    expect(result).toEqual(data);
  });

  it('throws DoNotDevError for invalid data', () => {
    expect(() =>
      validateWithSchema(
        numberSchema as dndevSchema<number>,
        'not-a-number',
        'TestContext'
      )
    ).toThrow(DoNotDevError);
  });

  it('includes context in error message', () => {
    try {
      validateWithSchema(
        numberSchema as dndevSchema<number>,
        'bad',
        'MyAdapter.add'
      );
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DoNotDevError);
      expect((error as DoNotDevError).message).toContain('MyAdapter.add');
    }
  });

  it('sets error code to validation-failed', () => {
    try {
      validateWithSchema(stringSchema as dndevSchema<string>, 123, 'test');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as DoNotDevError).code).toBe('validation-failed');
    }
  });

  it('includes issues in error details for valibot errors', () => {
    try {
      validateWithSchema(
        objectSchema as dndevSchema<{ name: string; age: number }>,
        { name: 123, age: 'bad' },
        'test'
      );
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as DoNotDevError;
      expect(e.details?.issues).toBeDefined();
      expect(Array.isArray(e.details.issues)).toBe(true);
    }
  });
});

// =============================================================================
// safeValidate
// =============================================================================

describe('safeValidate', () => {
  it('returns parsed data for valid input', () => {
    expect(safeValidate(stringSchema as dndevSchema<string>, 'hello')).toBe(
      'hello'
    );
  });

  it('returns null for invalid input', () => {
    expect(safeValidate(numberSchema as dndevSchema<number>, 'bad')).toBeNull();
  });

  it('returns null instead of throwing', () => {
    const result = safeValidate(
      objectSchema as dndevSchema<{ name: string; age: number }>,
      'not-an-object'
    );
    expect(result).toBeNull();
  });

  it('validates complex objects', () => {
    const result = safeValidate(
      objectSchema as dndevSchema<{ name: string; age: number }>,
      { name: 'Bob', age: 25 }
    );
    expect(result).toEqual({ name: 'Bob', age: 25 });
  });
});

// =============================================================================
// ensureSpreadable
// =============================================================================

describe('ensureSpreadable', () => {
  it('returns object as-is for plain objects', () => {
    const data = { foo: 'bar', num: 42 };
    const result = ensureSpreadable(data);
    expect(result).toBe(data);
    expect({ ...result }).toEqual(data);
  });

  it('wraps primitive string in { value }', () => {
    const result = ensureSpreadable('hello');
    expect(result).toEqual({ value: 'hello' });
  });

  it('wraps primitive number in { value }', () => {
    const result = ensureSpreadable(42);
    expect(result).toEqual({ value: 42 });
  });

  it('wraps null in { value }', () => {
    const result = ensureSpreadable(null);
    expect(result).toEqual({ value: null });
  });

  it('wraps arrays in { value }', () => {
    const arr = [1, 2, 3];
    const result = ensureSpreadable(arr);
    expect(result).toEqual({ value: arr });
  });

  it('wraps undefined in { value }', () => {
    const result = ensureSpreadable(undefined);
    expect(result).toEqual({ value: undefined });
  });
});
