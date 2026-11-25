// packages/core/utils/src/common/schema/hasRestrictedVisibility.ts

/**
 * @fileoverview Restricted visibility detection utility
 * @description Checks if any field in a schema has visibility more restrictive than 'guest',
 * the base fields `defineEntity` adds at their default visibility excepted.
 * Used by CrudService to gate direct adapter access for non-public entities.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type * as v from 'valibot';

import { BASE_FIELD_VISIBILITY } from '@donotdev/types';
import type { dndevSchema } from '@donotdev/types';

/** Non-null object, viewed as a string-keyed record for schema introspection. */
function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extracts the entries map from a Valibot schema, traversing wrappers (pipe, nullable,
 * optional, union) to reach the underlying object schema.
 * Returns undefined for schemas that cannot be introspected (lazy, custom).
 *
 * NOTE: 'owner' visibility requires per-document ownership context. The guard
 * blocks direct adapter access for all non-guest visibilities including 'owner',
 * because client adapters cannot enforce per-document ownership server-side.
 * Use FunctionsAdapter or ensure RLS is active (SupabaseCrudAdapter).
 */
function _extractEntries(schema: unknown): Record<string, unknown> | undefined {
  if (!isObjectRecord(schema)) return undefined;
  // Direct object schema: v.object({ ... })
  if (isObjectRecord(schema.entries)) return schema.entries;
  // Piped schema: v.pipe(v.object(...), validator, ...)
  if (Array.isArray(schema.pipe)) {
    for (const s of schema.pipe) {
      const e = _extractEntries(s);
      if (e) return e;
    }
  }
  // Wrapped schema: v.nullable(v.object(...)), v.optional(v.object(...))
  if (schema.wrapped) return _extractEntries(schema.wrapped);
  // Union schema: v.union([v.object(...), ...])
  if (Array.isArray(schema.options)) {
    for (const s of schema.options) {
      const e = _extractEntries(s);
      if (e) return e;
    }
  }
  return undefined;
}

/** Base field names `defineEntity` adds to every entity, with their default visibility. */
const BASE_FIELD_DEFAULTS: Readonly<Record<string, string>> = BASE_FIELD_VISIBILITY;

/**
 * Returns true if any field in the schema declares a visibility level more
 * restrictive than 'guest' (i.e. 'user', 'owner', 'admin', 'super', 'technical', 'hidden').
 * Used by CrudService to gate direct adapter access for non-public entities.
 *
 * The base fields `defineEntity` adds to every entity (`BASE_FIELD_VISIBILITY`: id, status,
 * createdAt, updatedAt, createdById, updatedById) do not count at their default visibility:
 * on a direct adapter they are readable by whoever can read the document, like any field.
 * - `id` never counts: it is the document id, known to every reader.
 * - Another base field counts when the app declares a visibility other than its default
 *   and other than 'guest' (e.g. `status: { visibility: 'technical' }`): an app-declared
 *   restriction is honoured, never silently dropped.
 *
 * Handles wrapped schemas (pipe, nullable, optional, union) by traversing the
 * schema tree to find the underlying object entries. Returns false for schemas
 * that cannot be introspected (lazy, custom).
 *
 * @param schema - A Valibot schema or dndevSchema to inspect
 * @returns true if any field has restricted visibility
 *
 * @example
 * // Public entity — app fields guest visibility (base fields at their defaults)
 * hasRestrictedVisibility(PublicPostSchema) // false
 *
 * @example
 * // Private entity — email field is 'user' visibility
 * hasRestrictedVisibility(UserProfileSchema) // true
 *
 * @version 0.2.0
 * @since 0.0.1
 */
export function hasRestrictedVisibility(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- why: accepts schemas of any output type; v.GenericSchema would make InferOutput unknown for callers (breaking)
  schema: v.BaseSchema<unknown, any, v.BaseIssue<unknown>> | dndevSchema<any>
): boolean {
  const entries = _extractEntries(schema);
  if (!entries) return false;
  for (const [name, field] of Object.entries(entries)) {
    // The document id is known to whoever reads the document, whatever its visibility
    if (name === 'id') continue;
    // why: entries values are untyped schema objects; read `visibility` exactly as before (`?.` on any value)
    const vis =
      field == null
        ? undefined
        : (field as { visibility?: unknown }).visibility;
    if (vis === undefined || vis === 'guest') continue;
    // A base field at its default visibility is the framework's, not the app's restriction
    if (Object.hasOwn(BASE_FIELD_DEFAULTS, name) && BASE_FIELD_DEFAULTS[name] === vis) {
      continue;
    }
    return true;
  }
  return false;
}
