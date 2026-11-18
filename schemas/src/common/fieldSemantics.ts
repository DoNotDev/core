// packages/core/schemas/src/common/fieldSemantics.ts

/**
 * @fileoverview Field semantics: what an entity field means
 * @description The one layer that interprets raw `EntityField` configuration. Every
 * deriver (schemas, forms, writers, server functions, generators) reads the
 * descriptor built here instead of re-reading `type`, `editable`, `visibility` or
 * `validation` with its own rules.
 *
 * Value resolution (same order everywhere):
 * 1. `validation.schema` (any type)
 * 2. `validation.reference` (any type, custom ones included): a non-empty id string
 * 3. {@link BUILTIN_VALUES}`[type]` (built-in types)
 * 4. custom type with none of the above: throws, naming `entity.field`
 *
 * Isomorphic code (client and server).
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import {
  EDITABLE,
  FIELD_TYPES,
  type AnyEntity,
  type BuiltInFieldType,
  type EditableForCheck,
  type EntityField,
  type FieldOperation,
  type FieldRequirement,
  type FieldType,
  type FieldWriteClass,
  type ValueKind,
  type Visibility,
} from '@donotdev/types';
import { hasRoleAccess, i18nFieldName } from '@donotdev/utils/server';

import { isBackendGeneratedField } from './visibility';

// ============================================================================
// Types
// ============================================================================

/** Any Valibot schema (input and output unknown). */
export type AnyValueSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

// Vocabulary shared with the type twin (`DescribeEntity`, `@donotdev/types`): one
// definition, re-exported here for `@donotdev/schemas` imports.
export type {
  EditableForCheck,
  FieldOperation,
  FieldRequirement,
  FieldWriteClass,
  ValueKind,
};

/** Value of a field, without presence (null / required) rules. */
export interface FieldValue {
  /** Presence-free Valibot schema of the stored value (required / nullish is applied by the caller) */
  schema: AnyValueSchema;
  /** Storage kind */
  kind: ValueKind;
  /** Referenced collection (`validation.reference`), any field type */
  ref?: string;
}

/** Everything the framework derives from one entity field. */
export interface FieldDescriptor {
  /** Stored value (schema presence-free, kind, referenced collection) */
  value: FieldValue;
  /** Presence rule */
  required: FieldRequirement;
  /** Write class */
  write: FieldWriteClass;
  /**
   * Whether `role` edits the field as an input for `op`. Only the `user` write class
   * can be edited; technical fields are read-only unless `editable` says otherwise.
   */
  editableFor: EditableForCheck;
  /** Lowest visibility level that sees the field (`field.visibility`) */
  visibleAt: Visibility;
  /** Companion field holding the other languages (`<name>I18n`) when `i18n: true` */
  companion?: string;
}

/** Descriptor of a whole entity, field by field (merged fields of `defineEntity`). */
export interface EntityDescriptor {
  /** Entity name */
  name: string;
  /** Collection name */
  collection: string;
  /** Descriptor of every field, keyed by field name */
  fields: Readonly<Record<string, FieldDescriptor>>;
}

/** Built-in value: presence-free schema generator and storage kind. */
export interface BuiltinValue {
  /** Presence-free Valibot schema of the value, from the field's validation and options */
  schema: (field: EntityField<FieldType>) => AnyValueSchema;
  /** Storage kind (a function when the field's options decide it, e.g. a string switch) */
  kind: ValueKind | ((field: EntityField<FieldType>) => ValueKind);
}

// ============================================================================
// Built-in value schemas (presence-free)
// ============================================================================

const textValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const validations: v.BaseValidation<string, string, v.BaseIssue<unknown>>[] =
    [];
  if (field.validation?.minLength !== undefined) {
    validations.push(
      v.minLength(
        field.validation.minLength,
        `Must be at least ${field.validation.minLength} characters`
      )
    );
  }
  if (field.validation?.maxLength !== undefined) {
    validations.push(
      v.maxLength(
        field.validation.maxLength,
        `Must be at most ${field.validation.maxLength} characters`
      )
    );
  }
  if (field.validation?.pattern) {
    validations.push(
      v.regex(new RegExp(field.validation.pattern), 'Invalid format')
    );
  }
  return validations.length > 0 ? v.pipe(v.string(), ...validations) : v.string();
};

const emailValue = (): AnyValueSchema =>
  v.pipe(v.string(), v.email('Invalid email address'));

const passwordValue = (field: EntityField<FieldType>): AnyValueSchema =>
  field.validation?.minLength !== undefined
    ? v.pipe(
        v.string(),
        v.minLength(
          field.validation.minLength,
          `Must be at least ${field.validation.minLength} characters`
        )
      )
    : v.string();

const urlValue = (): AnyValueSchema => v.pipe(v.string(), v.url('Invalid URL'));

const numberValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const validations: v.BaseValidation<number, number, v.BaseIssue<unknown>>[] =
    [];
  if (field.validation?.min !== undefined) {
    validations.push(
      v.minValue(field.validation.min, `Must be at least ${field.validation.min}`)
    );
  }
  if (field.validation?.max !== undefined) {
    validations.push(
      v.maxValue(field.validation.max, `Must be at most ${field.validation.max}`)
    );
  }
  return validations.length > 0 ? v.pipe(v.number(), ...validations) : v.number();
};

const booleanValue = (): AnyValueSchema => v.boolean();

/**
 * Dates: ISO dates (`2024-03-15`), ISO date-times and timestamps
 * (`2024-03-15T00:00:00`, `2024-03-15T00:00:00.000Z`): DB may store any of them,
 * DateFieldComponent outputs full ISO timestamps on user input.
 */
const dateValue = (): AnyValueSchema =>
  v.pipe(
    v.string(),
    v.check((val) => !isNaN(new Date(val).getTime()), 'Invalid date format')
  );

/** `HH:mm` or `HH:mm:ss`, 24 h (`<input type="time">`). */
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
/** `YYYY-Www`, weeks 01 to 53 (`<input type="week">`). */
const WEEK_PATTERN = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/;
/** `YYYY-MM` (`<input type="month">`). */
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

const timeValue = (): AnyValueSchema =>
  v.pipe(v.string(), v.regex(TIME_PATTERN, 'Invalid time format'));
const weekValue = (): AnyValueSchema =>
  v.pipe(v.string(), v.regex(WEEK_PATTERN, 'Invalid week format'));
const monthValue = (): AnyValueSchema =>
  v.pipe(v.string(), v.regex(MONTH_PATTERN, 'Invalid month format'));

/** FileAsset object (single and array file/document values) */
const fileAssetObjectSchema = v.object({
  url: v.string(),
  filename: v.string(),
  size: v.number(),
  mimeType: v.nullish(v.string()),
  uploadedAt: v.nullish(v.string()),
});

const fileValue = (): AnyValueSchema => fileAssetObjectSchema;
const filesValue = (): AnyValueSchema => v.array(fileAssetObjectSchema);

/** Picture object (single and array image values) */
const pictureObjectSchema = v.object({
  fullUrl: v.string(),
  thumbUrl: v.string(),
});

/**
 * Images may come pre-filled as plain URL strings (seed data, stock assets wired
 * into entity defaults) or as uploaded Picture objects. Both are accepted at the
 * schema boundary; adapters normalize before persistence when a canonical shape is
 * required.
 */
const pictureValue = (): AnyValueSchema =>
  v.union([v.string(), pictureObjectSchema]);
const picturesValue = (): AnyValueSchema =>
  v.array(v.union([v.string(), pictureObjectSchema]));

const geopointValue = (): AnyValueSchema =>
  v.object({ lat: v.number(), lng: v.number() });

const addressValue = (): AnyValueSchema =>
  v.object({
    formatted_address: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    street_number: v.nullish(v.string()),
    route: v.nullish(v.string()),
    locality: v.nullish(v.string()),
    administrative_area_level_1: v.nullish(v.string()),
    administrative_area_level_2: v.nullish(v.string()),
    country: v.nullish(v.string()),
    postal_code: v.nullish(v.string()),
  });

const mapValue = (): AnyValueSchema => v.record(v.string(), v.unknown());
const arrayValue = (): AnyValueSchema => v.array(v.unknown());
/** field-array without `validation.schema`: an array of row objects */
const fieldArrayValue = (): AnyValueSchema =>
  v.array(v.record(v.string(), v.unknown()));

/** Static options → picklist; dynamic options (functions) → string or number. */
const selectValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const options = field.validation?.options;
  if (Array.isArray(options) && options.length > 0) {
    return v.picklist(options.map((opt: { value: string }) => opt.value));
  }
  return v.union([v.string(), v.number()]);
};

/** Static options → array of picklist; function/range options or none → string array. */
const multiselectValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const options = field.validation?.options;
  if (Array.isArray(options) && options.length > 0) {
    return v.array(v.picklist(options.map((opt: { value: string }) => opt.value)));
  }
  return v.array(v.string());
};

/** Id: format is provider-specific (Firestore alphanumeric, Supabase UUID), the adapter owns it. */
const referenceValue = (): AnyValueSchema =>
  v.pipe(v.string(), v.minLength(1, 'Invalid ID format'));

const stringValue = (): AnyValueSchema => v.string();

/**
 * Phone number: international (`+` country code, 8 to 15 digits in all, as E.164) or
 * French national (`0` + 9 digits), digits optionally separated by spaces, dots or dashes.
 * `+33 6 12 34 56 78` (PhoneNumberComponent's value), `+33612345678`, `06 12 34 56 78`,
 * `06.12.34.56.78`. `field.validation.pattern` replaces the rule.
 */
const PHONE_PATTERN = /^(?:\+[1-9](?:[ .-]?\d){7,14}|0[1-9](?:[ .-]?\d{2}){4})$/;

const telValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const pattern = field.validation?.pattern
    ? new RegExp(field.validation.pattern)
    : PHONE_PATTERN;
  return v.pipe(v.string(), v.regex(pattern, 'Invalid phone number'));
};

const ibanValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const minLength = field.validation?.minLength ?? 15;
  const maxLength = field.validation?.maxLength ?? 34;
  const pattern =
    field.validation?.pattern ?? '^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,34}$';
  return v.pipe(
    v.string(),
    v.minLength(minLength, `IBAN must be at least ${minLength} characters`),
    v.maxLength(maxLength, `IBAN must not exceed ${maxLength} characters`),
    v.regex(new RegExp(pattern), 'Invalid IBAN format')
  );
};

const neverValue = (): AnyValueSchema => v.never();

/** `options.fieldSpecific` of a string switch (e.g. 'Automatic' / 'Manual'). */
function stringSwitchValues(
  field: EntityField<FieldType>
): [string, string] | undefined {
  const fieldSpecific = field.options?.fieldSpecific as
    | { checkedValue?: string; uncheckedValue?: string }
    | undefined;
  if (fieldSpecific?.checkedValue && fieldSpecific?.uncheckedValue) {
    return [fieldSpecific.checkedValue, fieldSpecific.uncheckedValue];
  }
  return undefined;
}

/** Switch: boolean, or one of two strings when `options.fieldSpecific` names them. */
const switchValue = (field: EntityField<FieldType>): AnyValueSchema => {
  const values = stringSwitchValues(field);
  return values ? v.picklist(values) : v.boolean();
};

/** Given GDPR consent, as GdprConsentField stores it (extra keys kept). */
const gdprConsentObjectSchema = v.looseObject(
  {
    gdprConsent: v.literal(true),
    gdprConsentDate: v.optional(v.string()),
    gdprConsentVersion: v.optional(v.string()),
  },
  'GDPR consent must be given'
);

/**
 * GDPR consent: `{ gdprConsent: true, gdprConsentDate, gdprConsentVersion }` when
 * checked, `false` when unchecked. A required consent must be given, so `false` is
 * not a value of a required field (the only presence-dependent value of the table).
 */
const gdprConsentValue = (field: EntityField<FieldType>): AnyValueSchema =>
  field.validation?.required
    ? gdprConsentObjectSchema
    : v.union([v.literal(false), gdprConsentObjectSchema]);

/** Price: amount, optional currency, vatIncluded, discountPercent (0-100). */
const priceValue = (): AnyValueSchema =>
  v.object({
    amount: v.number(),
    currency: v.optional(v.string()),
    vatIncluded: v.optional(v.boolean()),
    discountPercent: v.optional(
      v.pipe(v.number(), v.minValue(0), v.maxValue(100))
    ),
  });

// ============================================================================
// BUILTIN_VALUES
// ============================================================================

/**
 * Value of every built-in field type: presence-free schema generator and storage
 * kind. Keys = `FIELD_TYPES` (typed `Record<BuiltInFieldType, …>`: a built-in type
 * missing here fails the typecheck). Adding a built-in type: `FIELD_TYPES`, this
 * table, `FieldTypeToValue`, `registerBuiltinFieldTypes.tsx`.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export const BUILTIN_VALUES: Readonly<Record<BuiltInFieldType, BuiltinValue>> = {
  // Text-based
  text: { schema: textValue, kind: 'text' },
  textarea: { schema: textValue, kind: 'text' },
  richtext: { schema: textValue, kind: 'text' },
  color: { schema: textValue, kind: 'text' },
  email: { schema: emailValue, kind: 'text' },
  password: { schema: passwordValue, kind: 'text' },
  url: { schema: urlValue, kind: 'text' },
  tel: { schema: telValue, kind: 'text' },
  iban: { schema: ibanValue, kind: 'text' },

  // Numeric
  number: { schema: numberValue, kind: 'number' },
  currency: { schema: numberValue, kind: 'number' },
  range: { schema: numberValue, kind: 'number' },
  year: { schema: numberValue, kind: 'number' },
  rating: { schema: numberValue, kind: 'number' },
  duration: { schema: numberValue, kind: 'number' },
  price: { schema: priceValue, kind: 'json' },

  // Boolean
  boolean: { schema: booleanValue, kind: 'boolean' },
  checkbox: { schema: booleanValue, kind: 'boolean' },
  switch: {
    schema: switchValue,
    kind: (field) => (stringSwitchValues(field) ? 'text' : 'boolean'),
  },
  gdprConsent: { schema: gdprConsentValue, kind: 'json' },

  // Date/time
  date: { schema: dateValue, kind: 'date' },
  'datetime-local': { schema: dateValue, kind: 'timestamp' },
  timestamp: { schema: dateValue, kind: 'timestamp' },
  time: { schema: timeValue, kind: 'time' },
  week: { schema: weekValue, kind: 'text' },
  month: { schema: monthValue, kind: 'text' },

  // File & document
  file: { schema: fileValue, kind: 'json' },
  files: { schema: filesValue, kind: 'json' },
  document: { schema: fileValue, kind: 'json' },
  documents: { schema: filesValue, kind: 'json' },
  image: { schema: pictureValue, kind: 'json' },
  images: { schema: picturesValue, kind: 'json' },

  // Complex
  geopoint: { schema: geopointValue, kind: 'json' },
  address: { schema: addressValue, kind: 'json' },
  map: { schema: mapValue, kind: 'json' },
  array: { schema: arrayValue, kind: 'json' },
  'field-array': { schema: fieldArrayValue, kind: 'json' },

  // Selection
  select: { schema: selectValue, kind: 'text' },
  radio: { schema: selectValue, kind: 'text' },
  combobox: { schema: selectValue, kind: 'text' },
  multiselect: { schema: multiselectValue, kind: 'json' },

  // Reference
  reference: { schema: referenceValue, kind: 'ref' },

  // Special
  hidden: { schema: stringValue, kind: 'text' },
  avatar: { schema: stringValue, kind: 'text' },
  badge: { schema: stringValue, kind: 'text' },

  // Buttons (no value)
  submit: { schema: neverValue, kind: 'text' },
  reset: { schema: neverValue, kind: 'text' },
};

const BUILTIN_TYPES: ReadonlySet<string> = new Set(FIELD_TYPES);

/** Narrows a field type to a built-in one. */
function isBuiltInFieldType(type: string): type is BuiltInFieldType {
  return BUILTIN_TYPES.has(type);
}

// ============================================================================
// Kind of a Valibot schema (validation.schema)
// ============================================================================

/** Wrappers whose stored kind is the wrapped schema's */
const WRAPPER_TYPES = new Set([
  'optional',
  'exact_optional',
  'nullable',
  'nullish',
  'undefinedable',
  'non_nullable',
  'non_nullish',
  'non_optional',
]);
/** Structured values */
const JSON_TYPES = new Set([
  'object',
  'loose_object',
  'strict_object',
  'object_with_rest',
  'record',
  'array',
  'tuple',
  'loose_tuple',
  'strict_tuple',
  'tuple_with_rest',
  'intersect',
]);
/** Transformations that keep the value's kind */
const KIND_PRESERVING_TRANSFORMS = new Set([
  'trim',
  'trim_start',
  'trim_end',
  'to_lower_case',
  'to_upper_case',
  'to_min_value',
  'to_max_value',
  'normalize',
  'brand',
  'flavor',
  'readonly',
]);
/** Pipe validations that refine a kind */
const REFINING_VALIDATIONS: Readonly<Record<string, ValueKind>> = {
  iso_date: 'date',
  iso_time: 'time',
  iso_time_second: 'time',
  iso_date_time: 'timestamp',
  iso_timestamp: 'timestamp',
};

/** Reads a property of a schema node without asserting its shape. */
function prop(node: object, key: string): unknown {
  return key in node ? Reflect.get(node, key) : undefined;
}

function kindOfScalar(value: unknown): ValueKind | undefined {
  if (typeof value === 'string') return 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return undefined;
}

/** One kind for every member, or `json` when structured members mix; unknown otherwise. */
function commonKind(kinds: (ValueKind | undefined)[]): ValueKind | undefined {
  if (kinds.length === 0 || kinds.some((k) => k === undefined)) return undefined;
  const distinct = new Set(kinds);
  if (distinct.size === 1) return kinds[0];
  return distinct.has('json') ? 'json' : undefined;
}

/**
 * Storage kind of a Valibot schema's output, read from its structure. `undefined`
 * when the structure does not say (custom, unknown, kind-changing transform, ...).
 */
function kindOfSchema(node: unknown): ValueKind | undefined {
  if (typeof node !== 'object' || node === null) return undefined;
  const type = prop(node, 'type');
  if (typeof type !== 'string') return undefined;

  let kind = kindOfRoot(node, type);

  const pipe = prop(node, 'pipe');
  if (Array.isArray(pipe)) {
    for (const item of pipe.slice(1)) {
      if (typeof item !== 'object' || item === null) continue;
      const itemKind = prop(item, 'kind');
      const itemType = prop(item, 'type');
      if (typeof itemType !== 'string') continue;
      if (itemKind === 'schema') {
        kind = kindOfSchema(item);
      } else if (itemKind === 'transformation') {
        if (!KIND_PRESERVING_TRANSFORMS.has(itemType)) kind = undefined;
      } else if (itemKind === 'validation') {
        if (itemType === 'integer' && kind === 'number') kind = 'integer';
        const refined = REFINING_VALIDATIONS[itemType];
        if (refined && kind === 'text') kind = refined;
      }
    }
  }
  return kind;
}

function kindOfRoot(node: object, type: string): ValueKind | undefined {
  if (WRAPPER_TYPES.has(type)) return kindOfSchema(prop(node, 'wrapped'));
  if (JSON_TYPES.has(type)) return 'json';
  switch (type) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'bigint':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'timestamp';
    case 'literal':
      return kindOfScalar(prop(node, 'literal'));
    case 'picklist':
    case 'enum': {
      const options = prop(node, 'options');
      return Array.isArray(options)
        ? commonKind(options.map(kindOfScalar))
        : undefined;
    }
    case 'union':
    case 'variant': {
      const options = prop(node, 'options');
      if (!Array.isArray(options)) return undefined;
      const members = options.filter((option) => {
        const t = typeof option === 'object' && option !== null ? prop(option, 'type') : undefined;
        return t !== 'null' && t !== 'undefined';
      });
      return commonKind(members.map(kindOfSchema));
    }
    default:
      return undefined;
  }
}

// ============================================================================
// Value resolution
// ============================================================================

function builtinKind(type: BuiltInFieldType, field: EntityField<FieldType>): ValueKind {
  const { kind } = BUILTIN_VALUES[type];
  return typeof kind === 'function' ? kind(field) : kind;
}

/**
 * Resolves the value of one field: `validation.schema` > `validation.reference` >
 * {@link BUILTIN_VALUES} > throw. The kind of a `validation.schema` value is read
 * from the schema; when the schema does not say, a reference field is `ref` and a
 * built-in type keeps its table kind; a custom type throws.
 *
 * @param field - Entity field
 * @param path - `entity.field`, named in errors
 * @returns Presence-free value of the field
 * @throws When a custom type has no value shape, or a `validation.schema` whose kind
 *   cannot be read on a custom type
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export function resolveFieldValue(
  field: EntityField<FieldType>,
  path: string = field.name
): FieldValue {
  const reference = field.validation?.reference;
  const ref = reference ? { ref: reference } : {};
  const type: string = field.type;
  const builtin = isBuiltInFieldType(type) ? type : undefined;

  const schema = field.validation?.schema;
  if (schema) {
    const kind =
      (reference ? 'ref' : undefined) ??
      kindOfSchema(schema) ??
      (builtin ? builtinKind(builtin, field) : undefined);
    if (!kind) {
      throw new Error(
        `Field '${path}' (custom type '${type}'): the storage kind of its validation.schema cannot be read. Root the schema on a Valibot string, number, boolean, picklist, object or array schema, or set validation.reference.`
      );
    }
    return { schema, kind, ...ref };
  }

  if (reference) {
    return { schema: referenceValue(), kind: 'ref', ...ref };
  }

  if (builtin) {
    return {
      schema: BUILTIN_VALUES[builtin].schema(field),
      kind: builtinKind(builtin, field),
    };
  }

  throw new Error(
    `Field '${path}' has custom type '${type}' and no value shape. Add validation.schema (a Valibot schema of the stored value) or validation.reference (the referenced collection) to the field, or use a built-in type.`
  );
}

// ============================================================================
// Descriptor
// ============================================================================

function requirementOf(field: EntityField<FieldType>): FieldRequirement {
  if (field.validation?.required === true) return 'always';
  if (field.conditions?.required !== undefined) return 'conditional';
  return 'never';
}

function writeClassOf(
  name: string,
  field: EntityField<FieldType>
): FieldWriteClass {
  if (
    field.visibility === 'hidden' ||
    field.editable === EDITABLE.GENERATED ||
    isBackendGeneratedField(name)
  ) {
    return 'never';
  }
  if (field.editable === EDITABLE.FALSE) return 'program';
  if (field.editable === EDITABLE.COMPUTED) return 'derived';
  return 'user';
}

function editableForOf(
  field: EntityField<FieldType>,
  write: FieldWriteClass
): FieldDescriptor['editableFor'] {
  return (role, op) => {
    if (write !== 'user') return false;
    const editable = field.editable;
    if (editable === undefined || editable === EDITABLE.TRUE) {
      // Technical fields are read-only unless `editable` says otherwise
      return field.visibility !== 'technical';
    }
    if (editable === EDITABLE.CREATE_ONLY) return op === 'create';
    if (typeof editable === 'string') return hasRoleAccess(role, editable);
    return false;
  };
}

/**
 * Describes one field of an entity.
 *
 * @param name - Field name (key in `entity.fields`)
 * @param field - Field definition
 * @param entityName - Entity name, named in errors
 * @returns Field descriptor
 * @throws When the field has no value shape (see {@link resolveFieldValue})
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export function describeField(
  name: string,
  field: EntityField<FieldType>,
  entityName: string
): FieldDescriptor {
  const write = writeClassOf(name, field);
  return {
    value: resolveFieldValue(field, `${entityName}.${name}`),
    required: requirementOf(field),
    write,
    editableFor: editableForOf(field, write),
    visibleAt: field.visibility,
    ...(field.i18n === true && { companion: i18nFieldName(name) }),
  };
}

const descriptorCache = new WeakMap<AnyEntity, EntityDescriptor>();

/**
 * Describes every field of an entity: value, presence, write class, editability,
 * visibility, i18n companion. Memoized per entity object (WeakMap): describe the
 * entity returned by `defineEntity`, never mutate it afterwards.
 *
 * @param entity - Entity definition (merged fields of `defineEntity`)
 * @returns Entity descriptor
 * @throws When a field has a custom type and no value shape (`validation.schema` or
 *   `validation.reference`), naming `entity.field`
 *
 * @example
 * ```typescript
 * const { fields } = describeEntity(productEntity);
 * fields.price.value.kind;                 // 'number'
 * fields.createdAt.write;                  // 'never'
 * fields.name.editableFor('user', 'edit'); // true
 * ```
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export function describeEntity(entity: AnyEntity): EntityDescriptor {
  const cached = descriptorCache.get(entity);
  if (cached) return cached;

  const fields: Record<string, FieldDescriptor> = {};
  for (const [name, field] of Object.entries(entity.fields)) {
    fields[name] = describeField(name, field, entity.name);
  }
  const descriptor: EntityDescriptor = {
    name: entity.name,
    collection: entity.collection,
    fields,
  };
  descriptorCache.set(entity, descriptor);
  return descriptor;
}
