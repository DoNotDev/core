import { describe, it, expect } from 'vitest';

import { hasMetadata, getCollectionName } from '../utils';

describe('hasMetadata', () => {
  it('returns true for objects with metadata', () => {
    const schema = { metadata: { collection: 'users', entity: 'User' } };

    expect(hasMetadata(schema)).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasMetadata(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasMetadata(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(hasMetadata('string')).toBe(false);
    expect(hasMetadata(42)).toBe(false);
    expect(hasMetadata(true)).toBe(false);
  });

  it('returns false for objects without metadata', () => {
    expect(hasMetadata({})).toBe(false);
    expect(hasMetadata({ name: 'test' })).toBe(false);
  });

  it('returns false when metadata is null', () => {
    expect(hasMetadata({ metadata: null })).toBe(false);
  });

  it('returns false when metadata is not an object', () => {
    expect(hasMetadata({ metadata: 'string' })).toBe(false);
    expect(hasMetadata({ metadata: 42 })).toBe(false);
  });
});

describe('getCollectionName', () => {
  it('returns collection name from schema metadata', () => {
    const schema = {
      metadata: { collection: 'users', entity: 'User' },
    } as any;

    expect(getCollectionName(schema)).toBe('users');
  });

  it('throws for schema without metadata', () => {
    expect(() => getCollectionName({} as any)).toThrow();
  });
});
