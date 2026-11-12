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

import {
  EDITABLE,
  type AnyEntity,
  type EntityField,
  type FieldType,
  type Visibility,
  type dndevSchema,
} from '@donotdev/types';
import {
  getListCardFieldNames,
  i18nFieldName,
  TRANSLATABLE_FIELD_TYPES,
} from '@donotdev/utils/server';

import { getSchemaType } from './validation/getSchemaType';
import { baseFields, isBackendGeneratedField } from './visibility';

/** Fields excluded from all write schemas (create/draft/update) */
function isWriteExcluded(name: string, field: EntityField<FieldType>): boolean {
  if (field.visibility === 'hidden') return true;
  if (field.editable === EDITABLE.GENERATED) return true;
  if (isBackendGeneratedField(name)) return true;
  return false;
}

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
  /** Update: excludes technical fields, all optional */
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
 * Creates a schema field that's always optional (for draft/update)
 */
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

function createOptionalFieldSchema(
  field: EntityField<FieldType>
): SchemaWithVisibility {
  const baseSchema = getSchemaType({
    ...field,
    validation: { ...field.validation, required: false },
  });
  return withVisibility(baseSchema, field.visibility);
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Creates all operation-specific schemas from an entity definition
 *
 * Each schema field has `.visibility` attached for backend filtering.
 *
 * @param entity - Entity definition
 * @returns Operation-specific schemas with visibility metadata
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

  // -------------------------------------------------------------------------
  // GET schema: All fields with visibility (for response filtering)
  // -------------------------------------------------------------------------
  const getShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    // Skip hidden fields entirely - they never leave the server
    if (field.visibility === 'hidden') continue;
    // GET is lenient: DB may contain incomplete/draft data, all fields nullable on read
    getShape[name] = createOptionalFieldSchema(field);
  }

  const getSchema = withMetadata(v.object(withTranslations({ ...getShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // CREATE schema: Excludes backend-generated fields, enforces required
  // -------------------------------------------------------------------------
  const createShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (isWriteExcluded(name, field)) continue;
    createShape[name] = createFieldSchema(field);
  }

  const createSchema = withMetadata(v.object(withTranslations({ ...createShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // DRAFT schema: All optional except status='draft'
  // -------------------------------------------------------------------------
  const draftShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (isWriteExcluded(name, field)) continue;

    if (name === 'status') {
      // Status must be literal 'draft'
      const statusSchema = v.literal('draft');
      draftShape[name] = withVisibility(statusSchema, field.visibility);
    } else {
      // All other fields optional
      draftShape[name] = createOptionalFieldSchema(field);
    }
  }

  const draftSchema = withMetadata(v.object(withTranslations({ ...draftShape }, fields)), entity);

  // -------------------------------------------------------------------------
  // UPDATE schema: All optional (partial update)
  // -------------------------------------------------------------------------
  const updateShape: Record<string, SchemaWithVisibility> = {};

  for (const [name, field] of Object.entries(fields)) {
    if (isWriteExcluded(name, field)) continue;
    updateShape[name] = createOptionalFieldSchema(field);
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
