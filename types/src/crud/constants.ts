// packages/core/types/src/crud/constants.ts

/**
 * @fileoverview CRUD Constants
 * @description Constants for CRUD domain. Defines visibility levels for entity fields and supported field types for entities.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Visibility levels for entity fields (runtime constants)
 * Controls who can SEE this field in responses
 * Matches USER_ROLES hierarchy + technical + hidden + owner
 *
 * - guest: Everyone (even unauthenticated)
 * - user: Authenticated users (users see guest + user fields)
 * - admin: Admins only (admins see guest + user + admin fields)
 * - super: Super admins only (see all non-technical fields)
 * - technical: System fields (shown as read-only in edit forms, admins+ only)
 * - hidden: Never exposed to client (passwords, tokens, API keys)
 * - owner: Visible only when request.auth.uid matches one of entity.ownership.ownerFields on the document
 */
export const VISIBILITY = {
  GUEST: 'guest',
  USER: 'user',
  ADMIN: 'admin',
  SUPER: 'super',
  TECHNICAL: 'technical',
  HIDDEN: 'hidden',
  OWNER: 'owner',
} as const;

/**
 * Editable levels for entity fields (runtime constants)
 * Controls who can MODIFY this field
 * - true: Anyone who can see the field (technical fields stay read-only)
 * - false: Nobody in forms (read-only, shown from the stored record); written by app code (write class `program`)
 * - 'user': Authenticated users+ (role hierarchy)
 * - 'admin': Admins+ (role hierarchy)
 * - 'super': Super admins only
 * - 'create-only': Editable on create, read-only after
 * - 'generated': DB-generated (excluded from forms and write schemas; write class `never`)
 * - 'computed': UI-computed by the app (another field's component sets it): shown
 *   read-only in forms, in form state and the write schemas, written by the form's
 *   default writer (write class `derived`)
 *
 * Write classes: `describeEntity` (core/schemas/src/common/fieldSemantics.ts).
 */
export const EDITABLE = {
  /** Anyone who can see the field (follows visibility; technical fields stay read-only) */
  TRUE: true,
  /** Read-only display in forms */
  FALSE: false,
  /** Authenticated users+ */
  USER: 'user',
  /** Admin+ */
  ADMIN: 'admin',
  /** Super only */
  SUPER: 'super',
  /** Editable on create, read-only after */
  CREATE_ONLY: 'create-only',
  /** DB-generated column (PostgreSQL GENERATED ALWAYS) — excluded from forms and write schemas */
  GENERATED: 'generated',
  /** UI-computed field (derived from other fields) — shown read-only in forms, in form state and write schemas, written by the form */
  COMPUTED: 'computed',
} as const;

/**
 * Default access levels for entity operations
 * Opinionated framework defaults:
 * - Read is public by default (Level 0)
 * - Write operations require Admin by default (Level 2)
 */
export const DEFAULT_ENTITY_ACCESS = {
  create: 'admin',
  read: 'guest',
  update: 'admin',
  delete: 'admin',
} as const;

/**
 * The status matrix: the single source of what a row can do in each built-in status.
 * Every CRUD rule (reads, writes, defaults) and every entity-derived type asks it
 * (`statusCan`, `statusesThat` in `@donotdev/core`; the `Status*` types below); no code
 * names a status otherwise. A status an app adds (`status.validation.options`) behaves
 * like `available` (`CUSTOM_STATUS`).
 *
 * - `read`: lowest role that reads rows in this status (`available`: the entity's
 *   `access.read` still applies on top)
 * - `saveIncomplete`: a write may leave required fields empty
 * - `holdIncomplete`: a stored row may have required fields empty (a removed draft)
 * - `isDefault`: the status of a create that sends none
 * - `isRemoved`: the status `remove(id)` writes (logical delete)
 *
 * @version 0.1.0
 * @since 0.3.0
 * @author AMBROISE PARK Consulting
 */
export const STATUS_MATRIX = {
  draft: { read: 'admin', saveIncomplete: true, holdIncomplete: true, isDefault: false, isRemoved: false },
  available: { read: 'guest', saveIncomplete: false, holdIncomplete: false, isDefault: true, isRemoved: false },
  deleted: { read: 'admin', saveIncomplete: false, holdIncomplete: true, isDefault: false, isRemoved: true },
} as const;

/** What a status an app adds can do: the same as `available`. */
export const CUSTOM_STATUS = STATUS_MATRIX.available;

/** A built-in status (a key of {@link STATUS_MATRIX}). */
export type BuiltInStatus = keyof typeof STATUS_MATRIX;

/** One capability of the matrix. */
export type StatusCapability = 'saveIncomplete' | 'holdIncomplete' | 'isDefault' | 'isRemoved';

/** Built-in statuses with capability `C` (type side of `statusesThat`). */
export type StatusesThat<C extends StatusCapability> = {
  [S in BuiltInStatus]: (typeof STATUS_MATRIX)[S][C] extends true ? S : never;
}[BuiltInStatus];

/** Built-in statuses not read below admin (`read` above `guest`). */
export type HiddenStatus = {
  [S in BuiltInStatus]: (typeof STATUS_MATRIX)[S]['read'] extends 'guest' ? never : S;
}[BuiltInStatus];

/** The built-in statuses, in {@link STATUS_MATRIX} order. */
// why: Object.keys of a const object literal returns exactly its keys
export const BUILT_IN_STATUSES = Object.keys(STATUS_MATRIX) as BuiltInStatus[];

/** The one built-in status with a capability only one status may have. */
function onlyStatusThat<C extends 'isDefault' | 'isRemoved'>(capability: C): StatusesThat<C> {
  const found = BUILT_IN_STATUSES.filter((status) => STATUS_MATRIX[status][capability]);
  if (found.length !== 1) {
    throw new Error(`[dndev] STATUS_MATRIX: exactly one status must have ${capability}`);
  }
  // why: the filter keeps exactly the statuses whose capability is true, which StatusesThat<C> names
  return found[0] as StatusesThat<C>;
}

/** The status of a create that sends none (CRUD rule 7), from {@link STATUS_MATRIX}. */
export const DEFAULT_STATUS = onlyStatusThat('isDefault');

/** The status `remove(id)` writes (CRUD rule 3), from {@link STATUS_MATRIX}. */
export const REMOVED_STATUS = onlyStatusThat('isRemoved');

/**
 * Statuses hidden from non-admin users (CRUD rule 4), from {@link STATUS_MATRIX}.
 *
 * @version 0.3.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const HIDDEN_STATUSES = BUILT_IN_STATUSES.filter(
  (status) => STATUS_MATRIX[status].read !== 'guest'
) as readonly HiddenStatus[];

/**
 * Fields that are TRULY backend-generated (cannot be set by user)
 * These are stripped from create operations - backend creates them automatically
 * (write class `never` in the field semantics).
 *
 * @category Field Families
 * @constant BACKEND_GENERATED_FIELD_NAMES
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const BACKEND_GENERATED_FIELD_NAMES = [
  'id', // Firestore auto-generates document ID
  'createdAt', // Server sets creation timestamp
  'updatedAt', // Server sets update timestamp
  'createdById', // Server extracts from auth context
  'updatedById', // Server extracts from auth context
] as const;

/**
 * Supported field types for entities (runtime constants)
 * Useful for UI renderers and documentation.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
// =============================================================================
// QUERY OPERATORS & ORDER
// =============================================================================

/**
 * Supported filter operators for query where clauses.
 * Use these in framework code for consistency. Consumers can use string literals
 * (e.g. operator: 'in') — CrudOperator accepts them; no need to import CRUD_OPERATORS.
 */
export const CRUD_OPERATORS = {
  EQ: '==',
  NEQ: '!=',
  LT: '<',
  LTE: '<=',
  GT: '>',
  GTE: '>=',
  IN: 'in',
  NOT_IN: 'not-in',
  ARRAY_CONTAINS: 'array-contains',
  ARRAY_CONTAINS_ANY: 'array-contains-any',
} as const;

/** Union of operator string literals. Consumer apps may use e.g. operator: 'in' without importing CRUD_OPERATORS. */
export type CrudOperator = (typeof CRUD_OPERATORS)[keyof typeof CRUD_OPERATORS];

/** Order direction for query orderBy */
export const ORDER_DIRECTION = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

/** Sort direction for query orderBy clauses. */
export type OrderDirection =
  (typeof ORDER_DIRECTION)[keyof typeof ORDER_DIRECTION];

/** Schema type for list queries (list vs listCard) */
export const LIST_SCHEMA_TYPE = {
  LIST: 'list',
  LIST_CARD: 'listCard',
} as const;

/** Schema variant for list queries (table vs card grid). */
export type ListSchemaType =
  (typeof LIST_SCHEMA_TYPE)[keyof typeof LIST_SCHEMA_TYPE];

// =============================================================================
// FIELD TYPES
// =============================================================================

export const FIELD_TYPES = [
  'address',
  'array',
  'avatar',
  'badge',
  'boolean',
  'checkbox',
  'color',
  'combobox',
  'date',
  'datetime-local',
  'document',
  'documents',
  'duration',
  'email',
  'field-array',
  'file',
  'files',
  'gdprConsent',
  'geopoint',
  'hidden',
  'iban',
  'image',
  'images',
  'map',
  'month',
  'multiselect',
  'number',
  'currency',
  'price',
  'password',
  'radio',
  'reference',
  'range',
  'rating',
  'reset',
  'richtext',
  'select',
  'submit',
  'switch',
  'tel',
  'text',
  'textarea',
  'time',
  'timestamp',
  'url',
  'week',
  'year',
] as const;
