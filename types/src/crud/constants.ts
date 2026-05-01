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
 * - true: Anyone who can see the field
 * - false: Nobody (read-only)
 * - 'user': Authenticated users+ (role hierarchy)
 * - 'admin': Admins+ (role hierarchy)
 * - 'super': Super admins only
 * - 'create-only': Editable on create, read-only after
 * - 'generated': DB-generated (excluded from forms and write schemas)
 * - 'computed': UI-computed (excluded from forms, included in writes)
 */
export const EDITABLE = {
  /** Anyone who can see the field (follows visibility) */
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
  /** UI-computed field (derived from other fields) — excluded from forms, included in writes */
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
