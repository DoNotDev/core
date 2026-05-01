import { describe, it, expect } from 'vitest';

import { generateFirestoreRuleCondition } from '../generateFirestoreRuleCondition';

describe('generateFirestoreRuleCondition', () => {
  it('returns false when no ownerFields and no publicCondition', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
    });
    expect(result).toBe('false');
  });

  it('generates owner field conditions', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: ['userId'],
    });
    expect(result).toBe('request.auth.uid == resource.data.userId');
  });

  it('generates multiple owner field conditions joined with OR', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: ['userId', 'createdBy'],
    });
    expect(result).toBe(
      'request.auth.uid == resource.data.userId || request.auth.uid == resource.data.createdBy'
    );
  });

  it('generates public condition with string value', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
      publicCondition: [{ field: 'status', op: '==', value: 'published' }],
    });
    expect(result).toBe("(resource.data.status == 'published')");
  });

  it('generates public condition with boolean value', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
      publicCondition: [{ field: 'isPublic', op: '==', value: true }],
    });
    expect(result).toBe('(resource.data.isPublic == true)');
  });

  it('generates public condition with number value', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
      publicCondition: [{ field: 'level', op: '>=', value: 5 }],
    });
    expect(result).toBe('(resource.data.level >= 5)');
  });

  it('combines multiple public conditions with AND', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
      publicCondition: [
        { field: 'status', op: '==', value: 'published' },
        { field: 'isPublic', op: '==', value: true },
      ],
    });
    expect(result).toBe(
      "(resource.data.status == 'published' && resource.data.isPublic == true)"
    );
  });

  it('combines public conditions OR owner fields', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: ['userId'],
      publicCondition: [{ field: 'status', op: '==', value: 'published' }],
    });
    expect(result).toBe(
      "(resource.data.status == 'published') || request.auth.uid == resource.data.userId"
    );
  });

  it('escapes single quotes in string values', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
      publicCondition: [{ field: 'name', op: '==', value: "it's" }],
    });
    expect(result).toBe("(resource.data.name == 'it\\'s')");
  });

  it('handles false boolean value', () => {
    const result = generateFirestoreRuleCondition({
      ownerFields: [],
      publicCondition: [{ field: 'isDeleted', op: '==', value: false }],
    });
    expect(result).toBe('(resource.data.isDeleted == false)');
  });
});
