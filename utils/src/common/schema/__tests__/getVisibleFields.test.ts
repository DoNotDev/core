import { describe, it, expect } from 'vitest';

import { isFieldVisible, getVisibleFields } from '../getVisibleFields';

describe('isFieldVisible', () => {
  it('hidden fields are never visible', () => {
    expect(isFieldVisible('hidden', 'super')).toBe(false);
  });

  it('undefined visibility defaults to guest (visible to all)', () => {
    expect(isFieldVisible(undefined, 'guest')).toBe(true);
    expect(isFieldVisible(undefined, 'user')).toBe(true);
    expect(isFieldVisible(undefined, 'admin')).toBe(true);
    expect(isFieldVisible(undefined, 'super')).toBe(true);
  });

  it('guest visibility is visible to all roles', () => {
    expect(isFieldVisible('guest', 'guest')).toBe(true);
    expect(isFieldVisible('guest', 'user')).toBe(true);
    expect(isFieldVisible('guest', 'admin')).toBe(true);
    expect(isFieldVisible('guest', 'super')).toBe(true);
  });

  it('user visibility hides from guest', () => {
    expect(isFieldVisible('user', 'guest')).toBe(false);
    expect(isFieldVisible('user', 'user')).toBe(true);
    expect(isFieldVisible('user', 'admin')).toBe(true);
  });

  it('admin visibility hides from guest and user', () => {
    expect(isFieldVisible('admin', 'guest')).toBe(false);
    expect(isFieldVisible('admin', 'user')).toBe(false);
    expect(isFieldVisible('admin', 'admin')).toBe(true);
    expect(isFieldVisible('admin', 'super')).toBe(true);
  });

  it('super visibility only visible to super', () => {
    expect(isFieldVisible('super', 'admin')).toBe(false);
    expect(isFieldVisible('super', 'super')).toBe(true);
  });

  it('technical visibility is visible to admin and super only', () => {
    expect(isFieldVisible('technical', 'guest')).toBe(false);
    expect(isFieldVisible('technical', 'user')).toBe(false);
    expect(isFieldVisible('technical', 'admin')).toBe(true);
    expect(isFieldVisible('technical', 'super')).toBe(true);
  });

  it('owner visibility returns false without options', () => {
    expect(isFieldVisible('owner', 'super')).toBe(false);
  });
});

describe('getVisibleFields', () => {
  it('returns empty array for non-object schema', () => {
    expect(getVisibleFields({} as any, 'admin')).toEqual([]);
  });

  it('returns all fields when all have guest visibility', () => {
    const schema = {
      entries: {
        name: { visibility: 'guest' },
        email: { visibility: 'guest' },
      },
    };
    expect(getVisibleFields(schema as any, 'guest')).toEqual(['name', 'email']);
  });

  it('filters by role visibility', () => {
    const schema = {
      entries: {
        name: { visibility: 'guest' },
        email: { visibility: 'user' },
        secret: { visibility: 'admin' },
      },
    };
    expect(getVisibleFields(schema as any, 'guest')).toEqual(['name']);
    expect(getVisibleFields(schema as any, 'user')).toEqual(['name', 'email']);
    expect(getVisibleFields(schema as any, 'admin')).toEqual([
      'name',
      'email',
      'secret',
    ]);
  });

  it('excludes hidden fields from all roles', () => {
    const schema = {
      entries: {
        name: { visibility: 'guest' },
        internal: { visibility: 'hidden' },
      },
    };
    expect(getVisibleFields(schema as any, 'super')).toEqual(['name']);
  });

  it('includes owner fields when ownership matches', () => {
    const schema = {
      entries: {
        name: { visibility: 'guest' },
        private: { visibility: 'owner' },
      },
    };
    const result = getVisibleFields(schema as any, 'user', {
      documentData: { userId: 'user-123' },
      uid: 'user-123',
      ownership: { ownerFields: ['userId'] },
    });
    expect(result).toContain('name');
    expect(result).toContain('private');
  });

  it('excludes owner fields when ownership does not match', () => {
    const schema = {
      entries: {
        name: { visibility: 'guest' },
        private: { visibility: 'owner' },
      },
    };
    const result = getVisibleFields(schema as any, 'user', {
      documentData: { userId: 'other-user' },
      uid: 'user-123',
      ownership: { ownerFields: ['userId'] },
    });
    expect(result).toContain('name');
    expect(result).not.toContain('private');
  });

  it('treats fields without visibility as guest', () => {
    const schema = {
      entries: {
        name: {},
        email: {},
      },
    };
    expect(getVisibleFields(schema as any, 'guest')).toEqual(['name', 'email']);
  });
});
