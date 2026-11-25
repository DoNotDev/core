import { describe, it, expect } from 'vitest';

import { hasRestrictedVisibility } from '@donotdev/utils';

import { createSchemas } from '../createSchema';
import { defineEntity } from '../defineEntity';

// defineEntity adds id, status, createdAt, updatedAt, createdById, updatedById with
// non-guest visibility: at their defaults they must not make every entity restricted
// (a direct adapter refused every defineEntity entity).
const publicEntity = defineEntity({
  name: 'PublicThing',
  collection: 'public_things',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'guest', validation: {} },
    createdAt: { label: 'Created' },
  },
});

const privateEntity = defineEntity({
  name: 'PrivateThing',
  collection: 'private_things',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'guest', validation: {} },
    note: { name: 'note', label: 'note', type: 'text', visibility: 'admin', validation: {} },
  },
});

const hiddenStatusEntity = defineEntity({
  name: 'HiddenStatusThing',
  collection: 'hidden_status_things',
  fields: {
    name: { name: 'name', label: 'name', type: 'text', visibility: 'guest', validation: {} },
    status: { visibility: 'technical' },
  },
});

describe('defineEntity schemas and hasRestrictedVisibility', () => {
  it('base fields at their defaults: no operation schema is restricted', () => {
    for (const schema of Object.values(createSchemas(publicEntity))) {
      expect(hasRestrictedVisibility(schema)).toBe(false);
    }
  });

  it('an own non-guest field: every operation schema carrying it is restricted', () => {
    const schemas = createSchemas(privateEntity);
    for (const op of ['get', 'create', 'draft', 'update'] as const) {
      expect(hasRestrictedVisibility(schemas[op])).toBe(true);
    }
  });

  it('an app-declared status visibility (not the default) counts', () => {
    expect(hasRestrictedVisibility(createSchemas(hiddenStatusEntity).get)).toBe(true);
  });
});
