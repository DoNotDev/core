import { describe, it, expect } from 'vitest';

import { filterVisibleFields } from '../filterVisibleFields';

describe('filterVisibleFields', () => {
  const schema = {
    entries: {
      name: { visibility: 'guest' },
      email: { visibility: 'user' },
      secret: { visibility: 'admin' },
      internal: { visibility: 'hidden' },
    },
  };

  it('returns empty object for null data', () => {
    expect(filterVisibleFields(null, schema as any, 'admin')).toEqual({});
  });

  it('returns empty object for undefined data', () => {
    expect(filterVisibleFields(undefined, schema as any, 'admin')).toEqual({});
  });

  it('filters fields based on guest role', () => {
    const data = {
      name: 'John',
      email: 'j@e.com',
      secret: 'abc',
      internal: 'x',
    };
    const result = filterVisibleFields(data, schema as any, 'guest');
    expect(result).toEqual({ name: 'John' });
  });

  it('filters fields based on user role', () => {
    const data = {
      name: 'John',
      email: 'j@e.com',
      secret: 'abc',
      internal: 'x',
    };
    const result = filterVisibleFields(data, schema as any, 'user');
    expect(result).toEqual({ name: 'John', email: 'j@e.com' });
  });

  it('filters fields based on admin role', () => {
    const data = {
      name: 'John',
      email: 'j@e.com',
      secret: 'abc',
      internal: 'x',
    };
    const result = filterVisibleFields(data, schema as any, 'admin');
    expect(result).toEqual({ name: 'John', email: 'j@e.com', secret: 'abc' });
  });

  it('never includes hidden fields even for super', () => {
    const data = { name: 'John', internal: 'x' };
    const result = filterVisibleFields(data, schema as any, 'super');
    expect(result).not.toHaveProperty('internal');
  });

  it('only includes fields that exist in data', () => {
    const data = { name: 'John' };
    const result = filterVisibleFields(data, schema as any, 'admin');
    expect(result).toEqual({ name: 'John' });
    expect(Object.keys(result)).toEqual(['name']);
  });

  it('includes owner fields when ownership matches', () => {
    const ownerSchema = {
      entries: {
        name: { visibility: 'guest' },
        private: { visibility: 'owner' },
      },
    };
    const data = { name: 'John', private: 'secret', userId: 'user-1' };
    const result = filterVisibleFields(data, ownerSchema as any, 'user', {
      uid: 'user-1',
      ownership: { ownerFields: ['userId'] },
    });
    expect(result).toHaveProperty('private', 'secret');
  });
});
