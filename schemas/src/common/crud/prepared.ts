// packages/core/schemas/src/common/crud/prepared.ts

/**
 * @fileoverview Result of a CRUD write rule
 * @description What `prepareCreate` / `prepareUpdate` / `prepareRemove` return, the
 * throwing form writers use (`assertWrite`), and the helpers they share: parse, the
 * whole-record value of a publish, unknown keys (CRUD rule 8). Private to the CRUD rule
 * modules except the types and `assertWrite`.
 *
 * Isomorphic code (client and server).
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import { BACKEND_GENERATED_FIELD_NAMES, DoNotDevError } from '@donotdev/types';

import type { WriteSchemaKey } from './status';

/** One write schema: an object schema (`createSchemas(entity)` create / draft / update). */
export type WriteSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

/** The write schemas the rules read, keyed like `createSchemas(entity)`. */
export interface WriteSchemas {
  create: WriteSchema;
  draft: WriteSchema;
  update: WriteSchema;
}

/** The write schemas a create reads (`create`, `draft`). */
export type CreateSchemas = Pick<WriteSchemas, 'create' | 'draft'>;

/** The write schemas an update reads (`draft`, `update`). */
export type UpdateSchemas = Pick<WriteSchemas, 'draft' | 'update'>;

/** One validation issue of a write (Valibot issue: `path`, `message`). */
export type WriteIssue = v.BaseIssue<unknown>;

/**
 * Result of a CRUD write rule.
 * - `ok: true`: `written` is what the write stores (parse output, sent keys only, never `id`).
 * - `ok: false`: `issues` say why; nothing may be written.
 * `unknownKeys` (both cases): sent keys the entity does not have (CRUD rule 8), not written.
 */
export type PreparedWrite =
  | {
      ok: true;
      schemaKey: WriteSchemaKey;
      written: Record<string, unknown>;
      unknownKeys: string[];
    }
  | {
      ok: false;
      schemaKey: WriteSchemaKey;
      issues: WriteIssue[];
      unknownKeys: string[];
    };

/**
 * The stored values of a valid write, or a throw. Writers (client and server) call it;
 * forms read `issues` from the {@link PreparedWrite} instead.
 *
 * @param result - Result of `prepareCreate` / `prepareUpdate` / `prepareRemove`
 * @param context - Write site, named in the error (e.g. `useCrud.update(products)`)
 * @returns `result.written`
 * @throws {DoNotDevError} `validation-failed` with `details.issues` when the write is invalid
 *
 * @example
 * ```typescript
 * const written = assertWrite(prepareUpdate(schemas, { id, patch, stored }), 'bulk(products)');
 * ```
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export function assertWrite(
  result: PreparedWrite,
  context: string
): Record<string, unknown> {
  if (result.ok) return result.written;
  const messages = result.issues
    .map(
      (issue) =>
        `${issue.path?.map((p) => String(p.key)).join('.') || 'root'}: ${issue.message}`
    )
    .join('; ');
  throw new DoNotDevError(
    `Validation failed in ${context}: ${messages}`,
    'validation-failed',
    { details: { issues: result.issues }, source: 'validation' }
  );
}

/** Keys an object schema declares (`createSchemas` schemas are object schemas). */
export function schemaKeys(schema: WriteSchema): string[] {
  const entries = (schema as { entries?: unknown }).entries;
  if (!entries || typeof entries !== 'object') {
    throw new DoNotDevError(
      'CRUD write rules: a write schema must be an object schema (createSchemas(entity))',
      'internal'
    );
  }
  return Object.keys(entries);
}

/**
 * CRUD rule 8: sent keys the entity does not have. Known = every key a write schema
 * declares plus the backend-generated names (`id`, timestamps, authors): a stored row
 * spread into a patch is not reported. Loose schemas (`v.looseObject`: a target without
 * entity schemas) declare no entity, so nothing is reported.
 */
export function unknownKeysOf(
  schemas: Readonly<Partial<WriteSchemas>>,
  sent: Readonly<Record<string, unknown>>
): string[] {
  const declared = [schemas.create, schemas.draft, schemas.update].filter(
    (schema): schema is WriteSchema => schema !== undefined
  );
  if (declared.some((schema) => (schema as { type?: unknown }).type === 'loose_object')) {
    return [];
  }
  const known = new Set<string>([
    ...declared.flatMap(schemaKeys),
    ...BACKEND_GENERATED_FIELD_NAMES,
  ]);
  return Object.keys(sent).filter((key) => !known.has(key));
}

/**
 * The whole record a publish is checked as (CRUD rule 5, leaving draft): every key the
 * `update` schema declares, `null` when the record lacks it, then the record's values.
 * A required field never written (absent key) is rejected like an empty one.
 */
export function wholeRecord(
  record: Readonly<Record<string, unknown>>,
  updateSchema: WriteSchema
): Record<string, unknown> {
  const whole: Record<string, unknown> = {};
  for (const key of schemaKeys(updateSchema)) whole[key] = null;
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) whole[key] = value;
  }
  return whole;
}

/**
 * Parses `value` with `schema` and keeps the parsed values of the `sent` keys (never `id`).
 */
export function parseWritten(
  schemaKey: WriteSchemaKey,
  schema: WriteSchema,
  value: Record<string, unknown>,
  sent: Readonly<Record<string, unknown>>,
  unknownKeys: string[]
): PreparedWrite {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success) {
    return { ok: false, schemaKey, issues: [...parsed.issues], unknownKeys };
  }
  const output = parsed.output as Record<string, unknown>;
  const written: Record<string, unknown> = {};
  for (const key of Object.keys(sent)) {
    if (key !== 'id' && Object.hasOwn(output, key)) written[key] = output[key];
  }
  return { ok: true, schemaKey, written, unknownKeys };
}
