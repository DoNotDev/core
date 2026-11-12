// packages/core/schemas/src/common/__tests__/entityRegistry.test.ts

import { describe, it, expect } from 'vitest';

import { defineEntity } from '../defineEntity';
import { getEntityByCollection } from '../entityRegistry';

const brand = (label: string) =>
  defineEntity({
    name: 'Brand',
    collection: 'registry-test-brands',
    fields: {
      name: { name: 'name', label, type: 'text', visibility: 'guest' },
    },
  });

describe('entity registry', () => {
  it('defineEntity registers the entity under its collection', () => {
    const defined = brand('Name');
    expect(getEntityByCollection('registry-test-brands')).toBe(defined);
  });

  it('a redefinition (HMR) replaces the previous entity', () => {
    brand('Old');
    const latest = brand('New');
    expect(getEntityByCollection('registry-test-brands')).toBe(latest);
  });

  it('returns undefined for a collection no entity defines', () => {
    expect(getEntityByCollection('registry-test-unknown')).toBeUndefined();
  });
});
