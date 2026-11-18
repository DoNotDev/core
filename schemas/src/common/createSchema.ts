// packages/core/schemas/src/common/createSchema.ts

/**
 * @fileoverview Unified Schema Generation
 * @description Creates Valibot schemas from entity definitions with visibility metadata.
 *
 * Entity → Schema (with visibility) → Used everywhere (frontend + backend)
 *
 * Isomorphic code (works in both client and server environments).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type {
  AnyEntity,
  EntityField,
  FieldType,
  Visibility,
  dndevSchema,
} from '@donotdev/types';
import {
  getListCardFieldNames,
  i18nFieldName,
  TRANSLATABLE_FIELD_TYPES,
} from '@donotdev/utils/server';

import { statusesThat } from './crud/status';
import { describeEntity } from './fieldSemantics';
import { getSchemaType } from './validation/getSchemaType';
import { baseFields } from './visibility';

// ============================================================================
// Types
// ============================================================================

/**
 * Valibot schema with visibility metadata attached
 */
export interface SchemaWithVisibility extends v.BaseSchema<
  unknown,
  unknown,
  v.BaseIssue<unknown>
> {
  visibility?: Visibility;
}

/**
 * Operation-specific schemas generated from entity
 */
export interface OperationSchemas {
  /** Create: excludes technical fields, enforces required */
  create: dndevSchema<unknown>;
  /** Draft: excludes technical fields, all optional except status='draft' */
  draft: dndevSchema<unknown>;
  /** Update: excludes technical fields; any field may be left out, a required one sent must be filled in (drafts: `draft`) */
  update: dndevSchema<unknown>;
  /** Get: includes all fields with visibility metadata */
  get: dndevSchema<unknown>;
  /** List: optimized for admin table (uses listFields) */
  list: dndevSchema<unknown>;
  /** ListCard: optimized for public cards (uses listCardFields, falls back to listFields) */
  listCard: dndevSchema<unknown>;
  /** Delete: just { id: string } */
  delete: dndevSchema<unknown>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Attaches visibility metadata to a Valibot schema
 */
function withVisibility<
  T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(schema: T, visibility: Visibility): T & { visibility: Visibility } {
  return Object.assign(schema, { visibility });
}

/**
 * Attaches entity metadata to a Valibot schema
 * Includes uniqueKeys (backend deduplication) and security (PII encryption) when defined on entity
 */
function withMetadata<T>(
  schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
  entity: AnyEntity
): dndevSchema<T> {
  return Object.assign(schema, {
    metadata: {
      collection: entity.collection,
      entity: entity.name,
      // Propagate uniqueKeys for backend CRUD functions
      ...(entity.uniqueKeys && { uniqueKeys: entity.uniqueKeys }),
      // Propagate security so CrudService can encrypt/decrypt piiFields
      ...(entity.security && { security: entity.security }),
    },
  });
}

/**
 * Creates a schema field with visibility attached
 */
function createFieldSchema(
  field: EntityField<FieldType>
): SchemaWithVisibility {
  const schema = getSchemaType(field);
  return withVisibility(schema, field.visibility);
}

/**
 * Companion schema of a translated field (`i18n: true`): one optional value per
 * language, each validated like the field itself (minus required).
 */
function createTranslationsSchema(
  name: string,
  field: EntityField<FieldType>
): SchemaWithVisibility {
  if (!TRANSLATABLE_FIELD_TYPES.includes(field.type)) {
    throw new Error(
      `Field '${name}' has i18n: true but type '${field.type}'. Translatable types: ${TRANSLATABLE_FIELD_TYPES.join(', ')}.`
    );
  }
  const valueSchema = getSchemaType({
    ...field,
    validation: { ...field.validation, required: false },
  });
  return withVisibility(
    v.optional(v.nullable(v.record(v.string(), valueSchema))),
    field.visibility
  );
}

/**
 * Add the companion schema of every translated field present in `shape`.
 * Mutates and returns `shape`.
 */
function withTranslations(
  shape: Record<string, SchemaWithVisibility>,
  fields: AnyEntity['fields']
): Record<string, SchemaWithVisibility> {
  for (const name of Object.keys(shape)) {
    const field = fields[name];
    if (field?.i18n !== true) continue;
    shape[i18nFieldName(name)] = createTranslationsSchema(name, field);
  }
  return shape;
}

/**
 * Creates a schema field that's always optional (draft, get, optional update fields)
 */
function createOptionalFieldSchema(
  field: EntityField<FieldType>
): SchemaWithVisibility {
  const baseSchema = getSchemaType({
    ...field,
    validation: { ...field.validation, required: false },
  });
  return withVisibility(baseSchema, field.visibility);
}

/**
 * Update schema field: a partial update may leave a field out (`undefined`); a
 * required field it sends must be filled in (no `null`, no `''`), optional ones as
 * usual. Same value rules as create.
 */
function createUpdateFieldSchema(
  field: EntityField<FieldType>
): SchemaWithVisibility {
  if (!field.validation?.required) return createOptionalFieldSchema(field);
  return withVisibility(v.optional(getSchemaType(field)), field.visibility);
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Creates all operation-specific schemas from an entity definition
 *
 * Each schema field has `.visibility` attached for backend filtering.
 * Fields come from {@link describeEntity}: create/draft/update leave out the `never`
 * write class (hidden, generated, backend names) and keep `program` (`editable: false`),
 * `derived` (`computed`) and `user` fields; reads leave out hidden fields.
 *
 * @param entity - Entity definition
 * @returns Operation-specific schemas with visibility metadata
 * @throws When a field has a custom type and no value shape (`validation.schema` / `validation.reference`)
 *
 * @example
 * ```typescript
 * const schemas = createSchemas(carEntity);
 * // schemas.create - for creating documents
 * // schemas.draft - for saving incomplete
 * // schemas.update - for partial updates
 * // schemas.get - for reading (includes technical fields)
 * // schemas.list - array of get
 * // schemas.delete - just { id }
 * ```
 */
export function createSchemas(entity: AnyEntity): OperationSchemas {
  const fields = entity.fields;
  const descriptor = describeEntity(entity).fields;
  /** Write class `never` (hidden, generated, backend names): out of create/draft/update */
  const isWriteExcluded = (name: string): boolean =>
    descriptor[name]?.write === 'never';

  // -------------------------------------------------------------------------
  // GET schema: All fields with visibility (for response filtering)
  // -------------------------------------------------------------------------
  const getShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    // Skip hidden fields entirely - they never leave the server
    if (descriptor[name]?.visibleAt === 'hidden') continue;
    // GET is lenient: DB may contain incomplete/draft data, all fields nullable on read
    getShape[name] = createOptionalFieldSchema(field);
  }

  const getSchema = withMetadata(v.object(withTranslations({ ...getShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // CREATE schema: Excludes backend-generated fields, enforces required
  // -------------------------------------------------------------------------
  const createShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (isWriteExcluded(name)) continue;
    createShape[name] = createFieldSchema(field);
  }

  const createSchema = withMetadata(v.object(withTranslations({ ...createShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // DRAFT schema: All optional except status='draft'
  // -------------------------------------------------------------------------
  const draftShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (isWriteExcluded(name)) continue;

    if (name === 'status') {
      // Status: one that saves incomplete (STATUS_MATRIX `saveIncomplete`, CRUD rule 5)
      const statusSchema = v.picklist(statusesThat('saveIncomplete'));
      draftShape[name] = withVisibility(statusSchema, field.visibility);
    } else {
      // All other fields optional
      draftShape[name] = createOptionalFieldSchema(field);
    }
  }

  const draftSchema = withMetadata(v.object(withTranslations({ ...draftShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // UPDATE schema: partial update. Any field may be left out; a required field
  // that is sent must be filled in. A draft is edited with the draft schema.
  // -------------------------------------------------------------------------
  const updateShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (isWriteExcluded(name)) continue;
    updateShape[name] = createUpdateFieldSchema(field);
  }

  // Add required id for updates
  updateShape['id'] = withVisibility(getSchemaType(baseFields.id), 'technical');

  const updateSchema = withMetadata(v.object(withTranslations({ ...updateShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // LIST schema: Uses listFields if defined, otherwise all visible fields
  // Always includes 'id' and 'status' for core functionality
  // -------------------------------------------------------------------------
  let listShape: Record<string, SchemaWithVisibility>;

  if (entity.listFields && entity.listFields.length > 0) {
    // Build shape with only specified fields + mandatory id/status
    const mandatoryFields = ['id', 'status'];
    const allListFields = [
      ...new Set([...mandatoryFields, ...entity.listFields]),
    ];

    listShape = {};
    for (const fieldName of allListFields) {
      const field = getShape[fieldName];
      if (field) {
        listShape[fieldName] = field;
      }
    }
  } else {
    // No listFields specified, use all visible fields
    listShape = getShape;
  }

  const listSchema = withMetadata(v.object(withTranslations({ ...listShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // LISTCARD schema: Uses listCardFields if defined, falls back to listFields, then all visible fields
  // Always includes 'id' and 'status' for core functionality
  // -------------------------------------------------------------------------
  let listCardShape: Record<string, SchemaWithVisibility>;
  const fieldsToUse = getListCardFieldNames(entity);

  if (fieldsToUse.length > 0) {
    // Build shape with only specified fields + mandatory id/status
    const mandatoryFields = ['id', 'status'];
    const allListCardFields = [
      ...new Set([...mandatoryFields, ...fieldsToUse]),
    ];

    listCardShape = {};
    for (const fieldName of allListCardFields) {
      const field = getShape[fieldName];
      if (field) {
        listCardShape[fieldName] = field;
      }
    }
  } else {
    // No listCardFields or listFields specified, use all visible fields
    listCardShape = getShape;
  }

  const listCardSchema = withMetadata(v.object(withTranslations({ ...listCardShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // DELETE schema: Just id
  // -------------------------------------------------------------------------
  const deleteSchema = withMetadata(
    v.object({
      id: withVisibility(getSchemaType(baseFields.id), 'technical'),
    }),
    entity
  );

  return {
    create: createSchema,
    draft: draftSchema,
    update: updateSchema,
    get: getSchema,
    list: listSchema,
    listCard: listCardSchema,
    delete: deleteSchema,
  };
}
