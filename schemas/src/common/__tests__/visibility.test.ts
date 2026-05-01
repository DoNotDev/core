import { describe, it, expect } from 'vitest';

import {
  isFrameworkField,
  isBackendGeneratedField,
  baseFields,
  DEFAULT_STATUS_OPTIONS,
  DEFAULT_STATUS_VALUE,
  HIDDEN_STATUSES,
  TECHNICAL_FIELD_NAMES,
  BACKEND_GENERATED_FIELD_NAMES,
} from '../visibility';

describe('isFrameworkField', () => {
  it('returns true for technical fields', () => {
    expect(isFrameworkField('id')).toBe(true);
    expect(isFrameworkField('createdAt')).toBe(true);
    expect(isFrameworkField('updatedAt')).toBe(true);
    expect(isFrameworkField('createdById')).toBe(true);
    expect(isFrameworkField('updatedById')).toBe(true);
    expect(isFrameworkField('status')).toBe(true);
  });

  it('returns false for user fields', () => {
    expect(isFrameworkField('title')).toBe(false);
    expect(isFrameworkField('price')).toBe(false);
    expect(isFrameworkField('description')).toBe(false);
  });
});

describe('isBackendGeneratedField', () => {
  it('returns true for backend-generated fields', () => {
    expect(isBackendGeneratedField('id')).toBe(true);
    expect(isBackendGeneratedField('createdAt')).toBe(true);
    expect(isBackendGeneratedField('updatedAt')).toBe(true);
    expect(isBackendGeneratedField('createdById')).toBe(true);
    expect(isBackendGeneratedField('updatedById')).toBe(true);
  });

  it('returns false for status (user-settable)', () => {
    expect(isBackendGeneratedField('status')).toBe(false);
  });

  it('returns false for user fields', () => {
    expect(isBackendGeneratedField('name')).toBe(false);
  });
});

describe('constants', () => {
  it('DEFAULT_STATUS_OPTIONS has 3 options', () => {
    expect(DEFAULT_STATUS_OPTIONS).toHaveLength(3);
    const values = DEFAULT_STATUS_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['draft', 'available', 'deleted']);
  });

  it('DEFAULT_STATUS_VALUE is available', () => {
    expect(DEFAULT_STATUS_VALUE).toBe('available');
  });

  it('HIDDEN_STATUSES are draft and deleted', () => {
    expect([...HIDDEN_STATUSES]).toEqual(['draft', 'deleted']);
  });

  it('TECHNICAL_FIELD_NAMES includes all backend + status', () => {
    expect(TECHNICAL_FIELD_NAMES).toContain('status');
    for (const field of BACKEND_GENERATED_FIELD_NAMES) {
      expect(TECHNICAL_FIELD_NAMES).toContain(field);
    }
  });
});

describe('baseFields', () => {
  it('has all 6 base fields', () => {
    expect(Object.keys(baseFields)).toEqual(
      expect.arrayContaining([
        'id',
        'createdAt',
        'updatedAt',
        'createdById',
        'updatedById',
        'status',
      ])
    );
  });

  it('status field is select type with admin visibility', () => {
    expect(baseFields.status.type).toBe('select');
    expect(baseFields.status.visibility).toBe('admin');
    expect(baseFields.status.validation?.required).toBe(true);
  });

  it('id field is hidden', () => {
    expect(baseFields.id.visibility).toBe('hidden');
  });

  it('timestamp fields are technical', () => {
    expect(baseFields.createdAt.visibility).toBe('technical');
    expect(baseFields.updatedAt.visibility).toBe('technical');
  });
});
