// packages/core/types/src/crud/fieldSemantics.ts

/**
 * @fileoverview Field semantics: type twin
 * @description Type-level twin of `describeEntity` (`@donotdev/schemas`,
 * `core/schemas/src/common/fieldSemantics.ts`). `DescribeEntity<E>` reads the same
 * facts of the same entity with the same rules and produces the same shape, literal.
 * Parity is proven by shared fixtures (`core/schemas/src/common/__tests__/fieldSemantics.parity.test.ts`): one literal
 * `EXPECTED` per fixture equals both `describeEntity(E)` and `DescribeEntity<typeof E>`.
 *
 * Every entity-derived type (row, create input, draft input, update patch, form
 * values) is built here from the descriptor, never from raw `EntityField` reads.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */

import type * as v from 'valibot';

import type {
  BACKEND_GENERATED_FIELD_NAMES,
  StatusesThat,
} from './constants';
import type {
  AnyEntity,
  BuiltInFieldType,
  FieldTypeToValue,
} from './schemas';

// ============================================================================
// Descriptor vocabulary (shared with the runtime descriptor)
// ============================================================================

/**
 * Storage kind of a field value: what a column, a seed or a search index holds.
 * - `text`, `number`, `integer`, `boolean`: scalars
 * - `date` (`YYYY-MM-DD`), `time` (`HH:mm[:ss]`), `timestamp` (ISO date-time)
 * - `json`: objects and arrays (files, images, price, address, multiselect, ...)
 * - `ref`: id of a document of another collection (`FieldValue.ref`)
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type ValueKind =
  | 'text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'json'
  | 'ref';

/**
 * Presence rule of a field.
 * - `always`: `validation.required: true`
 * - `conditional`: `conditions.required` only (the form resolver decides)
 * - `never`: optional
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldRequirement = 'always' | 'conditional' | 'never';

/**
 * Who writes a field.
 * - `never`: `visibility: 'hidden'`, `editable: 'generated'`, backend names
 *   (`id`, `createdAt`, `updatedAt`, `createdById`, `updatedById`): excluded from write schemas
 * - `program`: `editable: false`: in write schemas, written by app code, never a form input
 * - `derived`: `editable: 'computed'`: in write schemas, computed from other fields
 * - `user`: `true` / omitted / role / `'create-only'`: a form input when `editableFor` says so
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldWriteClass = 'never' | 'program' | 'derived' | 'user';

/**
 * Form operation an editability check is made for.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldOperation = 'create' | 'edit';

/**
 * Editability check of a descriptor: whether `role` edits the field as an input for `op`.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type EditableForCheck = (
  role: string | undefined,
  op: FieldOperation
) => boolean;

/**
 * Presence-free Valibot schema of a value `V` (type of `FieldValue.schema` for
 * built-in and reference values; a `validation.schema` keeps its own type).
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type ValueSchemaOf<V> = v.BaseSchema<V, V, v.BaseIssue<unknown>>;

/**
 * Storage kind of every built-in field type, type twin of the `kind` column of
 * `BUILTIN_VALUES`. One key per `FIELD_TYPES` entry. `switch` is `boolean` here and
 * `text` when `options.fieldSpecific` names a checked and an unchecked string.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldTypeToKind = {
  address: 'json';
  array: 'json';
  avatar: 'text';
  badge: 'text';
  boolean: 'boolean';
  checkbox: 'boolean';
  color: 'text';
  combobox: 'text';
  currency: 'number';
  date: 'date';
  'datetime-local': 'timestamp';
  document: 'json';
  documents: 'json';
  duration: 'number';
  email: 'text';
  'field-array': 'json';
  file: 'json';
  files: 'json';
  gdprConsent: 'json';
  geopoint: 'json';
  hidden: 'text';
  iban: 'text';
  image: 'json';
  images: 'json';
  map: 'json';
  month: 'text';
  multiselect: 'json';
  number: 'number';
  password: 'text';
  price: 'json';
  radio: 'text';
  range: 'number';
  rating: 'number';
  reference: 'ref';
  reset: 'text';
  richtext: 'text';
  select: 'text';
  submit: 'text';
  switch: 'boolean';
  tel: 'text';
  text: 'text';
  textarea: 'text';
  time: 'time';
  timestamp: 'timestamp';
  url: 'text';
  week: 'text';
  year: 'number';
};

// ============================================================================
// Helpers
// ============================================================================

/** Flattens an intersection into one object type (keeps readonly / optional). */
type Simplify<T> = { [K in keyof T]: T[K] } & unknown;

/** Any Valibot schema (as `ValidationRules.schema`). */
type AnySchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

/** Statuses whose stored rows may hold empty required fields (`STATUS_MATRIX` `holdIncomplete`). */
type HoldIncomplete = StatusesThat<'holdIncomplete'>;

/** Statuses a write may leave incomplete (`STATUS_MATRIX` `saveIncomplete`, CRUD rule 5). */
type SaveIncomplete = StatusesThat<'saveIncomplete'>;

/** Backend-generated field names (`BACKEND_GENERATED_FIELD_NAMES`). */
type BackendGeneratedName = (typeof BACKEND_GENERATED_FIELD_NAMES)[number];

/** `field.type` */
type TypeOf<F> = F extends { type: infer T extends string } ? T : never;

/** `field.type` when it is a built-in type, else `undefined` */
type BuiltinTypeOf<F> = [TypeOf<F>] extends [never]
  ? undefined
  : [TypeOf<F>] extends [BuiltInFieldType]
    ? TypeOf<F>
    : undefined;

/**
 * Whether `field.type` is not one literal (a widened `FieldType`, a union cast):
 * the type layer cannot tell the value, the runtime decides.
 */
type IsWideType<F> = string extends TypeOf<F>
  ? true
  : IsUnion<TypeOf<F>>;

/** `validation.schema`, else `undefined` */
type SchemaOf<F> = F extends { validation: { schema: infer S extends AnySchema } }
  ? S
  : undefined;

/** `validation.reference`, else `undefined` */
type ReferenceOf<F> = F extends { validation: { reference: infer R extends string } }
  ? R
  : undefined;

/** `field.visibility` */
type VisibilityOf<F> = F extends { visibility: infer Vis } ? Vis : never;

/** `field.editable`, `undefined` when not set */
type EditableOf<F> = F extends { editable: infer Ed } ? Ed : undefined;

/** Values of a static options array (`[{ value: 'a' }, ...]`), `never` otherwise */
type OptionValues<O> = O extends readonly (infer E)[]
  ? E extends { value: infer V }
    ? V
    : never
  : never;

/** Values of the static `validation.options`, `never` for dynamic / empty / no options */
type StaticOptionValues<F> = F extends { validation: { options: infer O } }
  ? OptionValues<O>
  : never;

/** Checked / unchecked values of a string switch (`options.fieldSpecific`) */
type SwitchStrings<F> = F extends {
  options: {
    fieldSpecific: {
      checkedValue: infer C extends string;
      uncheckedValue: infer U extends string;
    };
  };
}
  ? C | U
  : never;

// ============================================================================
// Value (V) — same order as `resolveFieldValue`
// ============================================================================

/**
 * Value of a built-in type for one field: {@link FieldTypeToValue} refined by the
 * field's static facts, as `BUILTIN_VALUES[type].schema(field)` does at runtime:
 * - `select` / `radio` / `combobox`: union of static option values, else `string | number`
 * - `multiselect`: array of static option values, else `string[]`
 * - `switch`: the two `fieldSpecific` strings, else `boolean`
 * - `gdprConsent`: the consent object when required, `false` also when optional
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type BuiltinValueOf<T extends BuiltInFieldType, F> = T extends
  | 'select'
  | 'radio'
  | 'combobox'
  ? [StaticOptionValues<F>] extends [never]
    ? FieldTypeToValue[T]
    : StaticOptionValues<F>
  : T extends 'multiselect'
    ? [StaticOptionValues<F>] extends [never]
      ? FieldTypeToValue[T]
      : StaticOptionValues<F>[]
    : T extends 'switch'
      ? [SwitchStrings<F>] extends [never]
        ? FieldTypeToValue[T]
        : SwitchStrings<F>
      : T extends 'gdprConsent'
        ? F extends { validation: { required: true } }
          ? Exclude<FieldTypeToValue[T], false>
          : FieldTypeToValue[T]
        : FieldTypeToValue[T];

/**
 * Stored value `V` of a field, presence-free (null / required are applied per
 * operation): `validation.schema` output > `validation.reference` (id string) >
 * built-in type ({@link BuiltinValueOf}) > `never` (custom type without value shape:
 * `defineEntity` rejects it, see {@link RequireValueShapes}). A field whose `type` is
 * not one literal (widened `FieldType`, union cast) mixing custom types is `unknown`.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldValueOf<F> = F extends {
  validation: { schema: infer S extends AnySchema };
}
  ? v.InferOutput<S>
  : ReferenceOf<F> extends string
    ? string
    : BuiltinTypeOf<F> extends BuiltInFieldType
      ? BuiltinValueOf<BuiltinTypeOf<F>, F>
      : IsWideType<F> extends true
        ? unknown
        : never;

/**
 * Form input value of a field: `validation.schema` input (differs from the output with
 * `v.transform`), else the stored value {@link FieldValueOf}.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldInputOf<F> = F extends {
  validation: { schema: infer S extends AnySchema };
}
  ? v.InferInput<S>
  : FieldValueOf<F>;

/** Type of `FieldValue.schema`: the field's own schema, else a schema of `V` */
type ValueSchemaFor<F> = F extends {
  validation: { schema: infer S extends AnySchema };
}
  ? S
  : ValueSchemaOf<FieldValueOf<F>>;

// ============================================================================
// Kind — same structural reading as the runtime `kindOfSchema`
// ============================================================================

/** Wrappers whose stored kind is the wrapped schema's */
type WrapperType =
  | 'optional'
  | 'exact_optional'
  | 'nullable'
  | 'nullish'
  | 'undefinedable'
  | 'non_nullable'
  | 'non_nullish'
  | 'non_optional';

/** Structured values */
type JsonType =
  | 'object'
  | 'loose_object'
  | 'strict_object'
  | 'object_with_rest'
  | 'record'
  | 'array'
  | 'tuple'
  | 'loose_tuple'
  | 'strict_tuple'
  | 'tuple_with_rest'
  | 'intersect';

/** Transformations that keep the value's kind */
type KindPreservingTransform =
  | 'trim'
  | 'trim_start'
  | 'trim_end'
  | 'to_lower_case'
  | 'to_upper_case'
  | 'to_min_value'
  | 'to_max_value'
  | 'normalize'
  | 'brand'
  | 'flavor'
  | 'readonly';

/** Pipe validations that refine a `text` kind */
type RefiningValidation = {
  iso_date: 'date';
  iso_time: 'time';
  iso_time_second: 'time';
  iso_date_time: 'timestamp';
  iso_timestamp: 'timestamp';
};

/** Kind of a scalar literal */
type ScalarKind<L> = L extends string
  ? 'text'
  : L extends number
    ? 'number'
    : L extends boolean
      ? 'boolean'
      : undefined;

/** One kind for every member, `json` when structured members mix, `undefined` otherwise */
type CommonKind<K> = [K] extends [never]
  ? undefined
  : undefined extends K
    ? undefined
    : IsUnion<K> extends true
      ? 'json' extends K
        ? 'json'
        : undefined
      : K;

type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

/** Members of a union schema without `null` / `undefined` */
type NonNullMembers<O> = O extends readonly (infer M)[] ? DropNullish<M> : never;

type DropNullish<M> = M extends { type: 'null' | 'undefined' } ? never : M;

/** Kind of each member of a union of schemas, as a union */
type MemberKinds<M> = M extends unknown ? SchemaKind<M> : never;

type RootKind<S, T extends string> = T extends WrapperType
  ? S extends { wrapped: infer W }
    ? SchemaKind<W>
    : undefined
  : T extends JsonType
    ? 'json'
    : T extends 'string'
      ? 'text'
      : T extends 'number'
        ? 'number'
        : T extends 'bigint'
          ? 'integer'
          : T extends 'boolean'
            ? 'boolean'
            : T extends 'date'
              ? 'timestamp'
              : T extends 'literal'
                ? S extends { literal: infer L }
                  ? ScalarKind<L>
                  : undefined
                : T extends 'picklist' | 'enum'
                  ? S extends { options: readonly (infer O)[] }
                    ? CommonKind<ScalarKind<O>>
                    : undefined
                  : T extends 'union' | 'variant'
                    ? S extends { options: infer O }
                      ? CommonKind<MemberKinds<NonNullMembers<O>>>
                      : undefined
                    : undefined;

/** One pipe item applied to the kind read so far */
type PipeStep<I, K> = I extends { kind: 'schema' }
  ? SchemaKind<I>
  : I extends { kind: 'transformation'; type: infer T }
    ? T extends KindPreservingTransform
      ? K
      : undefined
    : I extends { kind: 'validation'; type: infer T }
      ? T extends 'integer'
        ? K extends 'number'
          ? 'integer'
          : K
        : T extends keyof RefiningValidation
          ? K extends 'text'
            ? RefiningValidation[T]
            : K
          : K
      : K;

type PipeKind<Items, K> = Items extends readonly [infer I, ...infer Rest]
  ? PipeKind<Rest, PipeStep<I, K>>
  : K;

/**
 * Storage kind of a Valibot schema's output, read from its structure (`type`,
 * `wrapped`, `options`, `literal`, `pipe`): `undefined` when the structure does not
 * say (custom, unknown, kind-changing transform, ...).
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type SchemaKind<S> = S extends { type: infer T extends string }
  ? S extends { pipe: readonly [unknown, ...infer Items] }
    ? PipeKind<Items, RootKind<S, T>>
    : RootKind<S, T>
  : undefined;

/** Kind of a built-in type for one field (`switch` with strings → `text`) */
type BuiltinKindOf<T extends BuiltInFieldType, F> = T extends 'switch'
  ? [SwitchStrings<F>] extends [never]
    ? FieldTypeToKind[T]
    : 'text'
  : FieldTypeToKind[T];

/**
 * Storage kind of a field, as `resolveFieldValue`: `ref` with `validation.reference`;
 * with `validation.schema`, the schema's kind, else the built-in table kind; without,
 * the built-in table kind. `never` for a custom type whose kind cannot be read,
 * `ValueKind` when `type` is not one literal.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldKindOf<F> = ReferenceOf<F> extends string
  ? 'ref'
  : [SchemaKind<SchemaOf<F>>] extends [ValueKind]
    ? SchemaKind<SchemaOf<F>>
    : BuiltinTypeOf<F> extends BuiltInFieldType
      ? BuiltinKindOf<BuiltinTypeOf<F>, F>
      : IsWideType<F> extends true
        ? ValueKind
        : never;

// ============================================================================
// Presence, write class, visibility
// ============================================================================

/**
 * Presence rule of a field ({@link FieldRequirement}).
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldRequirementOf<F> = F extends { validation: { required: true } }
  ? 'always'
  : F extends { conditions: { required: infer R } }
    ? [R] extends [undefined]
      ? 'never'
      : 'conditional'
    : 'never';

/**
 * Write class of field `K` ({@link FieldWriteClass}).
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FieldWriteClassOf<K, F> = F extends { visibility: 'hidden' }
  ? 'never'
  : F extends { editable: 'generated' }
    ? 'never'
    : K extends BackendGeneratedName
      ? 'never'
      : F extends { editable: false }
        ? 'program'
        : F extends { editable: 'computed' }
          ? 'derived'
          : 'user';

/** Roles each role requirement admits (`hasRoleAccess`: guest < user < admin < super) */
type RolesAdmittedBy = {
  guest: 'guest' | 'user' | 'admin' | 'super';
  user: 'user' | 'admin' | 'super';
  admin: 'admin' | 'super';
  super: 'super';
};

/** `hasRoleAccess(Role, Required)` at type level; an unknown requirement admits no role */
type HasRoleAccessOf<Role, Required> = Required extends keyof RolesAdmittedBy
  ? Role extends RolesAdmittedBy[Required]
    ? true
    : false
  : false;

/**
 * Type twin of a descriptor's `editableFor(role, op)`: whether `Role` edits field
 * `K` as an input for `Op`. Only the `user` write class is editable: `editable`
 * omitted / `true` → yes unless `visibility: 'technical'`; `'create-only'` → on
 * create; a role → `hasRoleAccess(Role, editable)`. Proven equal to the runtime per
 * role and operation by the parity fixtures.
 *
 * @template K - Field name
 * @template F - Field definition (literal)
 * @template Role - Viewer role (`guest` | `user` | `admin` | `super`)
 * @template Op - Form operation
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type EditableForOf<
  K,
  F,
  Role extends string,
  Op extends FieldOperation,
> = FieldWriteClassOf<K, F> extends 'user'
  ? EditableOf<F> extends undefined | true
    ? VisibilityOf<F> extends 'technical'
      ? false
      : true
    : EditableOf<F> extends 'create-only'
      ? Op extends 'create'
        ? true
        : false
      : EditableOf<F> extends string
        ? HasRoleAccessOf<Role, EditableOf<F>>
        : false
  : false;

/** `{ ref }` when the field references a collection */
type RefPart<F> = ReferenceOf<F> extends string
  ? { readonly ref: ReferenceOf<F> }
  : unknown;

/** `{ companion }` when the field is translated */
type CompanionPart<K extends string, F> = F extends { i18n: true }
  ? { readonly companion: `${K}I18n` }
  : unknown;

// ============================================================================
// DescribeEntity
// ============================================================================

/**
 * Type twin of `describeField(name, field)`: same keys, literal values.
 *
 * @template K - Field name
 * @template F - Field definition (literal, as `defineEntity` returns it)
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type DescribeField<K extends string, F> = Simplify<
  {
    readonly value: Simplify<
      {
        readonly schema: ValueSchemaFor<F>;
        readonly kind: FieldKindOf<F>;
      } & RefPart<F>
    >;
    readonly required: FieldRequirementOf<F>;
    readonly write: FieldWriteClassOf<K, F>;
    readonly editableFor: EditableForCheck;
    readonly visibleAt: VisibilityOf<F>;
  } & CompanionPart<K, F>
>;

/**
 * Descriptor of every field of a field map, keyed by field name.
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type DescribeFields<F> = {
  readonly [K in keyof F & string]: DescribeField<K, F[K]>;
};

/**
 * Type twin of `describeEntity(entity)` (`@donotdev/schemas`): same shape, literal.
 * Proven equal to the runtime by the parity fixtures.
 *
 * @template E - Entity from `defineEntity()`
 *
 * @example
 * ```typescript
 * type D = DescribeEntity<typeof productEntity>;
 * type PriceKind = D['fields']['price']['value']['kind']; // 'number'
 * ```
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type DescribeEntity<E extends AnyEntity> = {
  readonly name: E['name'];
  readonly collection: E['collection'];
  readonly fields: DescribeFields<E['fields']>;
};

// ============================================================================
// Fail loud: custom type without value shape
// ============================================================================

/**
 * Whether a field's value is resolved, as `resolveFieldValue` decides it: its storage
 * kind ({@link FieldKindOf}) is not `never`. A custom type fails both without
 * `validation.schema` / `validation.reference` and with a `validation.schema` whose
 * kind cannot be read (runtime throws for both). A `type` that is not one literal is
 * left to the runtime check (`describeEntity` throws).
 */
type HasValueShape<F> = [FieldKindOf<F>] extends [never] ? false : true;

/** Error key of a field without a resolved value: what is missing */
type ValueShapeError<F, Path extends string> = SchemaOf<F> extends undefined
  ? `${Path}: custom type '${TypeOf<F>}' has no value shape, add validation.schema or validation.reference`
  : `${Path}: custom type '${TypeOf<F>}' has a validation.schema whose storage kind cannot be read, root it on a Valibot string, number, boolean, picklist, object or array schema, or set validation.reference`;

/**
 * Compile-time twin of the `defineEntity` throw: every field with a custom type and no
 * `validation.schema` / `validation.reference`, or with a `validation.schema` whose
 * storage kind cannot be read (and no `validation.reference`), must carry a property
 * whose name is the error message (`Apartment.district_code: custom type
 * 'paris-district' has no value shape, ...`), so the call fails typecheck naming
 * `entity.field`.
 *
 * @template F - Consumer field map
 * @template N - Entity name
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type RequireValueShapes<F, N extends string> = string extends keyof F
  ? unknown
  : RequireValueShapesOf<F, N>;

type RequireValueShapesOf<F, N extends string> = {
  [K in keyof F]: HasValueShape<F[K]> extends true
    ? unknown
    : {
        readonly [P in ValueShapeError<F[K], `${string extends N ? '<entity>' : N}.${K & string}`>]: true;
      };
};

// ============================================================================
// Per-operation types (§3.3 / §3.5 of the design)
// ============================================================================

/** Visibilities a read role sees (core visibility: technical = admin) */
type SeenByRole = {
  guest: 'guest';
  user: 'guest' | 'user';
  admin: 'guest' | 'user' | 'admin' | 'technical';
  super: 'guest' | 'user' | 'admin' | 'technical' | 'super';
};

/** Visibilities `access.read` sees; an unknown role is read as `guest` */
type SeenBy<R> = R extends keyof SeenByRole ? SeenByRole[R] : SeenByRole['guest'];

/** Status values of a field map (`status` options) */
type StatusOf<F> = F extends { status: infer S } ? FieldValueOf<S> : never;

/** Field `K` of `F` as a descriptor */
type Desc<F, K> = DescribeField<K & string, F[K & keyof F]>;

/** Whether a field is in the write schemas (write class not `never`) */
type IsWritten<F, K> = Desc<F, K>['write'] extends 'never' ? false : true;

/** Whether a field is statically required */
type IsRequired<F, K> = Desc<F, K>['required'] extends 'always' ? true : false;

/** Companion value of a translated field: one value per language */
type CompanionValue<V> = Partial<Record<string, V>> | null;

/**
 * One branch of the stored row: statuses `St`, relaxed (`holdIncomplete`) or not.
 * Hidden fields are left out; a key is optional when its visibility is above `R`.
 */
type RowBranch<F, R, St, Relaxed extends boolean> = Simplify<
  {
    [K in keyof F & string as Desc<F, K>['visibleAt'] extends 'hidden'
      ? never
      : Desc<F, K>['visibleAt'] extends SeenBy<R>
        ? K
        : never]: RowValue<F, K, St, Relaxed>;
  } & {
    [K in keyof F & string as Desc<F, K>['visibleAt'] extends 'hidden'
      ? never
      : Desc<F, K>['visibleAt'] extends SeenBy<R>
        ? never
        : K]?: RowValue<F, K, St, Relaxed>;
  } & {
    [K in keyof F & string as Desc<F, K>['visibleAt'] extends 'hidden'
      ? never
      : F[K] extends { i18n: true }
        ? `${K}I18n`
        : never]?: CompanionValue<FieldValueOf<F[K]>>;
  }
>;

type RowValue<F, K extends keyof F, St, Relaxed extends boolean> = K extends 'status'
  ? St
  : Relaxed extends true
    ? FieldValueOf<F[K]> | null
    : IsRequired<F, K> extends true
      ? FieldValueOf<F[K]>
      : FieldValueOf<F[K]> | null;

/** Hidden statuses of a field map (all of them when the status values are not literal) */
type HoldIncompleteOf<F> = string extends StatusOf<F>
  ? HoldIncomplete
  : Extract<StatusOf<F>, HoldIncomplete>;

/** Statuses of a field map whose rows have their required fields (the other matrix group). */
type CompleteOf<F> = Exclude<StatusOf<F>, HoldIncomplete>;

/** Stored row of a literal field map: union on `status` */
type RowUnion<F, R> =
  | ([HoldIncompleteOf<F>] extends [never]
      ? never
      : RowBranch<F, R, HoldIncompleteOf<F>, true>)
  | ([CompleteOf<F>] extends [never] ? never : RowBranch<F, R, CompleteOf<F>, false>);

/**
 * Stored row of a field map, from its descriptor (`DescribeFields`). Discriminated
 * union on `status`:
 * - status that may hold an incomplete row (`STATUS_MATRIX` `holdIncomplete`): every field `V | null`
 * - other statuses: required → `V`, optional / conditional → `V | null`
 *
 * Hidden fields are left out. A key is optional when its visibility is above the
 * read role `R` (the column is absent for lower roles); `owner` fields always.
 * Companions `<name>I18n` are optional. A widened field map (string keys) gives
 * `Record<string, unknown>`. Intersects `Record<string, unknown>` so rows satisfy
 * `T extends Record<string, unknown>` (bulk, PII, adapters).
 *
 * @template F - Merged field map (`entity.fields`)
 * @template R - `access.read` of the entity
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export type EntityRowFromFields<F, R = 'guest'> = (string extends keyof F
  ? unknown
  : RowUnion<F, R>) &
  Record<string, unknown>;

/** Companions `<name>I18n` of the written translated fields */
type WriteCompanions<F> = {
  [K in keyof F & string as IsWritten<F, K> extends true
    ? F[K] extends { i18n: true }
      ? `${K}I18n`
      : never
    : never]?: CompanionValue<FieldValueOf<F[K]>>;
};

// `status` is optional on create (CRUD rule 7: none sent → `DEFAULT_STATUS_VALUE`).
type CreateShape<F> = Simplify<
  {
    [K in keyof F & string as K extends 'status'
      ? never
      : IsWritten<F, K> extends true
        ? IsRequired<F, K> extends true
          ? K
          : never
        : never]: FieldValueOf<F[K]>;
  } & {
    [K in keyof F & string as IsWritten<F, K> extends true
      ? K extends 'status'
        ? K
        : IsRequired<F, K> extends true
          ? never
          : K
      : never]?: FieldValueOf<F[K]> | null;
  } & WriteCompanions<F>
>;

type DraftShape<F> = Simplify<
  ('status' extends keyof F
    ? IsWritten<F, 'status'> extends true
      ? { status: SaveIncomplete }
      : unknown
    : unknown) & {
    [K in keyof F & string as K extends 'status'
      ? never
      : IsWritten<F, K> extends true
        ? K
        : never]?: FieldValueOf<F[K]> | null;
  } & WriteCompanions<F>
>;

type UpdateShape<F> = Simplify<
  {
    [K in keyof F & string as IsWritten<F, K> extends true
      ? IsRequired<F, K> extends true
        ? K
        : never
      : never]?: FieldValueOf<F[K]>;
  } & {
    [K in keyof F & string as IsWritten<F, K> extends true
      ? IsRequired<F, K> extends true
        ? never
        : K
      : never]?: FieldValueOf<F[K]> | null;
  } & WriteCompanions<F>
>;

/**
 * Create payload (`createSchemas(e).create`): write classes `user`, `derived`,
 * `program`. Required → key required, `V`; optional / conditional → key optional,
 * `V | null`. Companions optional. `status` is optional (CRUD rule 7: none sent →
 * `available`).
 *
 * @template E - Entity from `defineEntity()`
 *
 * @version 0.2.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type CreateInput<E extends AnyEntity> = string extends keyof E['fields']
  ? Record<string, unknown>
  : CreateShape<E['fields']>;

/**
 * Draft payload (`createSchemas(e).draft`): `status: 'draft'`, every other written
 * field key optional, `V | null` (filled values keep their format at runtime).
 *
 * @template E - Entity from `defineEntity()`
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type DraftInput<E extends AnyEntity> = string extends keyof E['fields']
  ? Record<string, unknown>
  : DraftShape<E['fields']>;

/**
 * Update patch (`createSchemas(e).update`, without the `id` the service adds): every
 * written field key optional; a required one sent is `V` (no `null`), optional ones
 * `V | null`. A stored draft is patched with {@link DraftInput} (the CRUD rules).
 *
 * @template E - Entity from `defineEntity()`
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type UpdatePatch<E extends AnyEntity> = string extends keyof E['fields']
  ? Record<string, unknown>
  : UpdateShape<E['fields']>;

/**
 * How the form writes field `K` for `Op`: always, role-gated, or not at all. On
 * create, technical fields are not written (`getFieldsForOperation` skips them): the
 * scope field (`entity.scope`, technical) is injected by `injectScope`, not by the form.
 */
type FormMode<F, K, Op> = [Op, VisibilityOf<F[K & keyof F]>] extends [
  'create',
  'technical',
]
  ? 'none'
  : Desc<F, K>['write'] extends 'derived'
    ? 'written'
    : Desc<F, K>['write'] extends 'user'
      ? EditableOf<F[K & keyof F]> extends undefined | true
        ? VisibilityOf<F[K & keyof F]> extends 'technical'
          ? 'none'
          : 'written'
        : EditableOf<F[K & keyof F]> extends 'create-only'
          ? Op extends 'create'
            ? 'written'
            : 'none'
          : EditableOf<F[K & keyof F]> extends string
            ? 'gated'
            : 'none'
      : 'none';

/** Form-written field: required and always written → key required */
type IsFormKeyRequired<F, K, Op> = FormMode<F, K, Op> extends 'written'
  ? IsRequired<F, K>
  : false;

type FormBranch<F, Op, St, Draft extends boolean> = Simplify<
  ('status' extends keyof F
    ? FormMode<F, 'status', Op> extends 'written'
      ? { status: St }
      : FormMode<F, 'status', Op> extends 'gated'
        ? { status?: St }
        : unknown
    : unknown) & {
    [K in keyof F & string as K extends 'status'
      ? never
      : FormMode<F, K, Op> extends 'none'
        ? never
        : Draft extends true
          ? never
          : IsFormKeyRequired<F, K, Op> extends true
            ? K
            : never]: FieldInputOf<F[K]>;
  } & {
    [K in keyof F & string as K extends 'status'
      ? never
      : FormMode<F, K, Op> extends 'none'
        ? never
        : Draft extends true
          ? K
          : IsFormKeyRequired<F, K, Op> extends true
            ? never
            : K]?: Draft extends true
      ? FieldInputOf<F[K]> | null
      : IsRequired<F, K> extends true
        ? FieldInputOf<F[K]>
        : FieldInputOf<F[K]> | null;
  } & {
    [K in keyof F & string as FormMode<F, K, Op> extends 'none'
      ? never
      : F[K] extends { i18n: true }
        ? `${K}I18n`
        : never]?: CompanionValue<FieldInputOf<F[K]>>;
  } & (Op extends 'edit' ? { id: string } : unknown)
>;

/** `Omit` on each member of a union */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * Values of one 1:1 extension in its key (`values.offer`): the fields the form
 * writes for the extension entity, without its link field and `status` (the
 * framework sets them). The extension row is updated when it exists (`edit`, with
 * its `id`), else inserted (`create`); its values are validated as a non-draft.
 */
type ExtensionValues<X> = X extends {
  entity: infer XE extends AnyEntity;
  field: infer L extends string;
}
  ? string extends keyof XE['fields']
    ? Record<string, unknown>
    : DistributiveOmit<
        | FormBranch<XE['fields'], 'create', CompleteOf<XE['fields']>, false>
        | FormBranch<XE['fields'], 'edit', CompleteOf<XE['fields']>, false>,
        L | 'status'
      >
  : never;

/**
 * Extension keys of an entity form's values (`useEntityForm` `extend`): each
 * extension's values under its key, key optional (a viewer without read access to
 * the extension entity gets none of it). `{}` without extensions; a widened
 * extension map (string keys) gives `unknown` (keys not known statically).
 *
 * @template X - The `extend` map (`{ offer: { entity: productOfferEntity, field: 'productId' } }`)
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type ExtensionFormValues<X> = string extends keyof X
  ? unknown
  : { [K in keyof X & string]?: ExtensionValues<X[K]> };

/**
 * Values an entity form submits for `Op` (what the resolver outputs): fields the form
 * writes (`user` fields editable for `Op` and `derived` fields; technical fields are
 * never written on create, read-only on edit unless `editable` says otherwise, so the
 * scope field is left out: `injectScope` adds it; `create-only` only on create), their
 * companions, `id` on edit, and the 1:1 extensions' values under their keys
 * ({@link ExtensionFormValues}). Value = form input type ({@link FieldInputOf}).
 * Role-gated fields (`editable: '<role>'`) have optional keys. Split on status exactly
 * like the row ({@link EntityRowFromFields}): statuses that may hold an incomplete row
 * (`STATUS_MATRIX` `holdIncomplete`) are nullable, the others have required fields →
 * value. So form values fit the row's types as they are.
 *
 * @template E - Entity from `defineEntity()`
 * @template Op - Form operation
 * @template X - 1:1 extensions (`extend`), none by default
 *
 * @version 0.3.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type FormValues<
  E extends AnyEntity,
  Op extends FieldOperation,
  X = Record<never, never>,
> = (string extends keyof E['fields']
  ? Record<string, unknown>
  :
      | ([HoldIncompleteOf<E['fields']>] extends [never]
          ? never
          : FormBranch<E['fields'], Op, HoldIncompleteOf<E['fields']>, true>)
      | ([CompleteOf<E['fields']>] extends [never]
          ? never
          : FormBranch<E['fields'], Op, CompleteOf<E['fields']>, false>)) &
  ExtensionFormValues<X>;
