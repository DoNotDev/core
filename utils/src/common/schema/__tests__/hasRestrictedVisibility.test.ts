import * as v from 'valibot';
import { describe, it, expect } from 'vitest';

import { BASE_FIELD_VISIBILITY } from '@donotdev/types';

import { hasRestrictedVisibility } from '../hasRestrictedVisibility';

/** A schema entry carrying `visibility`, as createSchemas attaches it. */
const field = (visibility?: string) =>
  Object.assign(v.optional(v.string()), visibility ? { visibility } : {});

/** The base fields defineEntity adds, at their default visibility. */
const baseEntries = () =>
  Object.fromEntries(
    Object.entries(BASE_FIELD_VISIBILITY).map(([name, vis]) => [name, field(vis)])
  );

describe('hasRestrictedVisibility', () => {
  it('base fields only (default visibility) -> false', () => {
    expect(hasRestrictedVisibility(v.object(baseEntries()))).toBe(false);
  });

  it('base fields + guest / unset app fields -> false', () => {
    const schema = v.object({
      ...baseEntries(),
      name: field('guest'),
      price: field(),
    });
    expect(hasRestrictedVisibility(schema)).toBe(false);
  });

  it.each(['user', 'owner', 'admin', 'super', 'technical', 'hidden'])(
    "an app field with '%s' visibility -> true",
    (vis) => {
      const schema = v.object({ ...baseEntries(), secret: field(vis) });
      expect(hasRestrictedVisibility(schema)).toBe(true);
    }
  );

  it('a base field the app gives another non-guest visibility counts', () => {
    const schema = v.object({ ...baseEntries(), status: field('technical') });
    expect(hasRestrictedVisibility(schema)).toBe(true);
    const created = v.object({ ...baseEntries(), createdAt: field('admin') });
    expect(hasRestrictedVisibility(created)).toBe(true);
  });

  it("a base field the app makes 'guest' does not count", () => {
    const schema = v.object({ ...baseEntries(), status: field('guest') });
    expect(hasRestrictedVisibility(schema)).toBe(false);
  });

  it('id never counts (the document id), whatever its visibility', () => {
    // The update schema attaches 'technical' to id (default 'hidden')
    expect(hasRestrictedVisibility(v.object({ id: field('technical') }))).toBe(false);
  });

  it('traverses wrappers (pipe, nullable)', () => {
    const restricted = v.object({ ...baseEntries(), email: field('user') });
    expect(hasRestrictedVisibility(v.pipe(restricted, v.check(() => true)))).toBe(true);
    expect(hasRestrictedVisibility(v.nullable(v.object(baseEntries())))).toBe(false);
  });
});
