import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import { enhanceSchema } from '../enhanceSchema';

describe('enhanceSchema', () => {
  it('attaches metadata to a schema', () => {
    const schema = v.object({ name: v.string() });
    const metadata = {
      entity: 'user',
      collection: 'users',
    };

    const enhanced = enhanceSchema(schema, metadata);

    expect(enhanced.metadata).toBeDefined();
    expect(enhanced.metadata?.entity).toBe('user');
    expect(enhanced.metadata?.collection).toBe('users');
  });

  it('preserves the original schema behavior', () => {
    const schema = v.object({ name: v.string() });
    const enhanced = enhanceSchema(schema, {
      entity: 'test',
      collection: 'tests',
    });

    // The enhanced schema should still work as a valibot schema
    const result = v.safeParse(enhanced, { name: 'hello' });
    expect(result.success).toBe(true);
  });

  it('overwrites previous metadata', () => {
    const schema = v.object({ id: v.string() });

    const first = enhanceSchema(schema, {
      entity: 'first',
      collection: 'firsts',
    });
    expect(first.metadata?.entity).toBe('first');

    const second = enhanceSchema(first, {
      entity: 'second',
      collection: 'seconds',
    });
    expect(second.metadata?.entity).toBe('second');
  });

  it('returns the same schema reference (mutation)', () => {
    const schema = v.object({ id: v.string() });
    const enhanced = enhanceSchema(schema, {
      entity: 'test',
      collection: 'tests',
    });
    expect(enhanced).toBe(schema);
  });
});
