// packages/core/types/src/crud/schemas.ts

/**
 * @fileoverview Schema-Related Type Definitions
 * @description Types for schema validation using Valibot. Defines entity schemas, field types, and validation rules.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ComponentType } from 'react';

import * as v from 'valibot';
import {
  VISIBILITY,
  EDITABLE,
  FIELD_TYPES,
  DEFAULT_ENTITY_ACCESS,
} from './constants';
import type { UserRole } from '../auth/constants';
import type { ConditionalBehavior } from './conditions';

// Re-export DEFAULT_ENTITY_ACCESS for consumers (constants.ts not exported directly)
export { DEFAULT_ENTITY_ACCESS };

// Re-export UserRole for CRUD domain types
export type { UserRole };

/**
 * Visibility level for entity fields
 * Controls who can SEE a field - hierarchical (each level sees levels below)
 *
 * Hierarchy: guest < user < admin < super
 *
 * - 'guest': Everyone (even unauthenticated)
 * - 'user': Authenticated users (see guest + user fields)
 * - 'admin': Admins (see guest + user + admin fields)
 * - 'super': Super admins (see guest + user + admin + super fields)
 * - 'technical': System fields (admins+ only, shown as read-only in forms)
 * - 'hidden': Never exposed to client (passwords, tokens, API keys)
 *
 * Override with `editable` for write permissions.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

/**
 * Editable level for entity fields
 * Controls who can MODIFY a field
 * - true: Anyone who can see the field
 * - false: Nobody (read-only, still shown in form)
 * - 'admin': Admin+ can edit (role hierarchy)
 * - 'super': Super only
 * - 'create-only': Editable on create, read-only after
 * - 'generated': DB-generated — hidden from forms, stripped from writes
 * - 'computed': UI-computed (derived from other fields) — hidden from forms, included in writes
 *
 * Custom role strings (e.g. future hierarchy keys) are accepted the same way as
 * {@link FieldType}: `(string & {})` keeps known literals distinguishable for
 * narrowing; plain `| string` would collapse to `boolean | string` and break
 * comparisons to `EDITABLE.GENERATED` / `EDITABLE.COMPUTED`.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Editable = (typeof EDITABLE)[keyof typeof EDITABLE] | (string & {});

/**
 * Entity-level access configuration
 * Controls who can perform CRUD operations on the entity
 *
 * Uses role hierarchy: guest (0) < user (1) < admin (2) < super (3)
 * Higher roles inherit access to lower-level operations.
 *
 * @default DEFAULT_ENTITY_ACCESS (read: 'guest', create/update/delete: 'admin')
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EntityAccessConfig {
  /** Minimum role required to create entities */
  create?: UserRole;
  /** Minimum role required to read entities (field visibility still applies) */
  read?: UserRole;
  /** Minimum role required to update entities */
  update?: UserRole;
  /** Minimum role required to delete entities */
  delete?: UserRole;
}

/** Type derived from DEFAULT_ENTITY_ACCESS for type safety */
export type EntityAccessDefaults = typeof DEFAULT_ENTITY_ACCESS;

/**
 * Single condition for public read/update in Firestore rules.
 * Joined with && when publicCondition is an array.
 */
export interface EntityOwnershipPublicCondition {
  field: string;
  op: string;
  value: string | boolean | number;
}

/**
 * Ownership configuration for stakeholder access (marketplace-style entities).
 * When set, drives Firestore rule condition generation, list/listCard query constraints,
 * and visibility: 'owner' field masking.
 *
 * @example
 * ```typescript
 * ownership: {
 *   ownerFields: ['providerId', 'customerId'],
 *   publicCondition: [
 *     { field: 'status', op: '==', value: 'available' },
 *     { field: 'isApproved', op: '==', value: true },
 *   ],
 * }
 * ```
 */
export interface EntityOwnershipConfig {
  /** Document fields whose value is a user id (e.g. providerId, customerId) */
  ownerFields: string[];
  /** Conditions joined with && for "public" read (e.g. status == 'available') */
  publicCondition?: EntityOwnershipPublicCondition[];
}

/**
 * Supported field types for entities
 * These determine the UI components and validation rules used for each field
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FieldType = (typeof FIELD_TYPES)[number] | (string & {});

/**
 * Built-in field type union (same as FieldType). Used internally to distinguish
 * framework field types from custom types registered via registerFieldType().
 */
export type BuiltInFieldType = (typeof FIELD_TYPES)[number];

/**
 * Map of custom field type names to their option shapes for `options.fieldSpecific`.
 * Augment this interface in your app so entity definitions get typed options for custom types.
 *
 * @example
 * ```ts
 * // In your app (e.g. types/crud.d.ts or next to your entity):
 * import '@donotdev/core';
 * declare module '@donotdev/core' {
 *   interface CustomFieldOptionsMap {
 *     'custom-address': { extractZipCode?: boolean };
 *     'repairOperations': { maxItems?: number };
 *   }
 * }
 * ```
 * Then in entity fields: `type: 'custom-address'`, `options: { fieldSpecific: { extractZipCode: true } }` is type-checked.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CustomFieldOptionsMap {}

/**
 * Additional UI-specific options for field rendering
 * @template T - The field type (built-in or custom string). Custom types use CustomFieldOptionsMap for fieldSpecific.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UIFieldOptions<T extends string = FieldType> {
  /** The section under which this field should be grouped */
  section?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Whether to show a clear button */
  clearable?: boolean;

  /** Additional classes to apply to the field */
  className?: string;

  /** Icon to show before the field */
  prefixIcon?: ComponentType;

  /** Icon to show after the field */
  suffixIcon?: ComponentType;

  /** Custom validation message overrides */
  messages?: {
    required?: string;
    pattern?: string;
    min?: string;
    max?: string;
    minLength?: string;
    maxLength?: string;
  };

  /** Step value for numeric inputs */
  step?: T extends 'number' | 'range' ? number : never;

  /**
   * i18n key for display formatting. Replaces the raw value in lists/cards/display views.
   * The formatter calls `t(displayKey, { value })`. Supports i18next array-key fallback.
   * Use `{{value}}` in key names for dynamic lookup (interpolated before `t()` call).
   *
   * @example Single key: `displayKey: 'fields.size_display'` → locale `"{{value}}m²"` → "20m²"
   * @example Array fallback: `displayKey: ['floor_{{value}}', 'fields.floor_display']`
   *   → tries `floor_4`, falls back to `fields.floor_display`: `"{{value}}th floor"` → "4th floor"
   */
  displayKey?: string | string[];

  /**
   * Custom display value resolver. Overrides type formatter and displayKey for display views.
   * Receives the field value, the full item, and the translation function —
   * useful for cross-field conditional display with i18n.
   * Return `null` to hide the field for that item. Return a string to display it.
   *
   * @example
   * ```typescript
   * // Hide date for reserved/signed, show "Available" for past dates
   * displayValue: (value, item, t) => {
   *   if (item.status === 'reserved' || item.status === 'signed') return null;
   *   return value <= today ? t('status.available_now') : String(value);
   * }
   * ```
   */
  displayValue?: (
    value: unknown,
    item: Record<string, unknown>,
    t: (key: string, options?: Record<string, unknown>) => string
  ) => string | null;

  /** Whether to show value label for range inputs */
  showValue?: T extends 'range' ? boolean : never;

  /** Field specific options based on field type. Custom types: augment CustomFieldOptionsMap. */
  fieldSpecific?: T extends keyof CustomFieldOptionsMap
    ? CustomFieldOptionsMap[T]
    : T extends 'file' | 'image' | 'files' | 'images' | 'document' | 'documents'
      ? {
          /** File types to accept (e.g., 'image/*', '.pdf') */
          accept?: string;
          /** Maximum file size in bytes */
          maxSize?: number;
          /** Whether to allow multiple files */
          multiple?: boolean;
          /** Storage path prefix for uploads (e.g., 'apartments') */
          storagePath?: string;
        }
      : T extends 'geopoint'
        ? {
            /** Default zoom level for map */
            defaultZoom?: number;
            /** Default center position for map */
            defaultCenter?: { lat: number; lng: number };
          }
        : T extends 'map'
          ? {
              /** Label for the key input */
              keyLabel?: string;
              /** Label for the value input */
              valueLabel?: string;
              /** Label for the add button */
              addLabel?: string;
            }
          : T extends 'reference'
            ? {
                /** Field to display from the referenced entity */
                displayField?: string;
                /** Multiple fields to join as label (e.g. ['first_name', 'last_name'] → "John Doe") */
                labelFields?: string[];
                /** Fields to search in the referenced entity */
                searchFields?: string[];
                /** Maximum number of items to preload */
                preloadLimit?: number;
              }
            : T extends 'tel'
              ? {
                  /** Default country code */
                  defaultCountry?: string;
                  /** Whether to show country flags */
                  showFlags?: boolean;
                  /** Preferred country codes to show at the top of the list (e.g., ['FR', 'US', 'GB']) */
                  preferredCountries?: string[];
                  /** Custom list of country codes to show (if provided, only these countries are shown) */
                  countries?: string[];
                }
              : T extends 'address'
                ? {
                    /**
                     * Whether to enable Google Maps autocomplete (default: false)
                     * Requires env var: VITE_GOOGLE_MAPS_API_KEY (Vite) or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (Next.js)
                     */
                    enableGoogleMaps?: boolean;
                    /** Whether to extract district code for Paris addresses */
                    extractDistrictCode?: boolean;
                  }
                : T extends 'combobox'
                  ? {
                      /** Enable creating new values by typing */
                      creatable?: boolean;
                    }
                  : T extends 'switch'
                    ? {
                        /** Label shown when switch is off/unchecked */
                        uncheckedLabel?: string;
                        /** Label shown when switch is on/checked */
                        checkedLabel?: string;
                        /** Value stored when switch is off (default: false) */
                        uncheckedValue?: string | boolean;
                        /** Value stored when switch is on (default: true) */
                        checkedValue?: string | boolean;
                      }
                    : T extends 'gdprConsent'
                      ? {
                          /** Path to privacy policy page (default: '/legal/privacy') */
                          privacyPolicyPath?: string;
                          /** Path to terms of use page (default: '/legal/terms') */
                          termsPath?: string;
                        }
                      : Record<string, unknown>;
}

/**
 * Picture type for image fields
 * Represents uploaded image with full and thumbnail URLs
 */
export interface Picture {
  fullUrl: string;
  thumbUrl: string;
}

/**
 * FileAsset type for generic file uploads (documents, any files)
 * Used by FileFieldComponent and DocumentFieldComponent
 */
export interface FileAsset {
  /** Download URL for the file */
  url: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** MIME type (e.g., 'application/pdf') */
  mimeType?: string;
  /** ISO timestamp when uploaded */
  uploadedAt?: string;
}

/**
 * Maps field types to their corresponding TypeScript types
 * Used for type-safe form handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FieldTypeToValue = {
  address: {
    formatted_address: string;
    latitude: number;
    longitude: number;
    [key: string]: any;
  };
  array: any[];
  avatar: string;
  badge: string;
  boolean: boolean;
  checkbox: boolean;
  combobox: string;
  color: string;
  date: string;
  'datetime-local': string;
  document: FileAsset | null;
  documents: FileAsset[];
  email: string;
  'field-array': Record<string, unknown>[];
  file: FileAsset | null;
  files: FileAsset[];
  geopoint: { lat: number; lng: number };
  hidden: string;
  iban: string;
  image: Picture | null;
  images: Picture[];
  map: Record<string, any>;
  month: string;
  multiselect: string[];
  number: number;
  price: {
    amount: number;
    currency?: string;
    vatIncluded?: boolean;
    discountPercent?: number;
  };
  password: string;
  radio: string;
  reference: string;
  range: number;
  reset: never;
  select: string;
  submit: never;
  tel: string;
  text: string;
  textarea: string;
  time: string;
  timestamp: string;
  switch: string | boolean;
  url: string;
  week: string;
  year: number;
};

/**
 * Gets the value type for a specific field type
 * @template T - The field type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ValueTypeForField<T extends string> =
  T extends keyof FieldTypeToValue ? FieldTypeToValue[T] : unknown;

/**
 * Any valid field value - includes built-in types plus custom registered types
 * Uses `unknown` since consumers can register custom field types via RegisterFieldType
 */
export type AnyFieldValue = unknown;

/**
 * Entity record type - a record where values are valid field values
 * Accepts unknown since consumers can register custom field types
 */
export type EntityRecord = Record<string, AnyFieldValue>;

/**
 * Enhanced validation rules with type checking
 * @template T - The field type
 *
 * @example
 * ```typescript
 * // Select field with dropdown options
 * validation: {
 *   required: true,
 *   options: [
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' }
 *   ]
 * }
 *
 * // Text field with length validation
 * validation: {
 *   required: true,
 *   minLength: 3,
 *   maxLength: 100
 * }
 *
 * // Number field with range validation
 * validation: {
 *   required: true,
 *   min: 0,
 *   max: 1000
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ValidationRules<T extends string = FieldType> {
  /** Whether the field is required */
  required?: boolean;

  /** Minimum value (for number fields) */
  min?: T extends 'number' | 'range' | 'year' ? number : never;

  /** Maximum value (for number fields) */
  max?: T extends 'number' | 'range' | 'year' ? number : never;

  /** Minimum length (for text fields) */
  minLength?: T extends
    | 'text'
    | 'textarea'
    | 'password'
    | 'email'
    | 'url'
    | 'tel'
    | 'iban'
    ? number
    : never;

  /** Maximum length (for text fields) */
  maxLength?: T extends
    | 'text'
    | 'textarea'
    | 'password'
    | 'email'
    | 'url'
    | 'tel'
    | 'iban'
    ? number
    : never;

  /** Regex pattern (for text fields) */
  pattern?: T extends
    | 'text'
    | 'textarea'
    | 'password'
    | 'email'
    | 'url'
    | 'tel'
    | 'iban'
    ? string
    : never;

  /**
   * Options for select, multiselect, and radio fields.
   * Can be:
   * - An array of option objects
   * - A function that returns an array (receives form values for dynamic options)
   *
   * For year fields, use `type: 'year'`:
   * ```typescript
   * year: {
   *   type: 'year',
   *   visibility: 'guest',
   *   validation: {
   *     required: true,
   *     min: 1900,  // Optional: defaults to 1900
   *     max: 2100   // Optional: defaults to current year + 10
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Static array
   * options: [
   *   { value: 'active', label: 'Active' },
   *   { value: 'inactive', label: 'Inactive' }
   * ]
   *
   * // Dynamic function (depends on other field values)
   * options: (formValues) => {
   *   return getModelsForMake(formValues.make);
   * }
   * ```
   */
  options?: T extends 'select' | 'multiselect' | 'radio' | 'combobox'
    ?
        | Array<{
            value: string;
            label: string;
          }>
        | ((formValues?: Record<string, any>) => Array<{
            value: string;
            label: string;
          }>)
    : never;

  /** Collection name for reference fields */
  reference?: T extends 'reference' ? string : never;

  /** Whether the field is nullable */
  nullable?: boolean;

  /**
   * Custom Valibot schema for this field
   *
   * When provided, this schema is used directly instead of the registry lookup.
   * This makes the entity the single source of truth for custom field schemas,
   * working everywhere (client + server) without separate registrations.
   *
   * @example
   * ```typescript
   * repairs: {
   *   type: 'repairOperations',
   *   visibility: 'admin',
   *   validation: {
   *     schema: v.array(v.object({
   *       operation: v.string(),
   *       cost: v.number()
   *     }))
   *   }
   * }
   * ```
   */
  schema?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
}

/**
 * Form step configuration for multi-step forms
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FormStep {
  /** Step title displayed in navigation */
  title: string;

  /** Step description (optional) */
  description?: string;

  /** Fields to include in this step */
  fields: string[];

  /** Whether this step is required */
  required?: boolean;

  /** Custom validation for this step */
  validation?: {
    /** Custom validation function */
    validate?: (data: any) => boolean | string;
    /** Error message if validation fails */
    message?: string;
  };
}

/**
 * Condition for dynamic field visibility
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FieldCondition {
  /** Field name to check */
  field: string;

  /** Comparison operator */
  operator:
    | 'equals'
    | 'not-equals'
    | 'contains'
    | 'greater-than'
    | 'less-than'
    | 'exists'
    | 'not-exists';

  /** Value to compare against */
  value?: any;

  /** For complex conditions, use a function */
  evaluate?: (formData: any) => boolean;
}

/**
 * Dynamic form rule for showing/hiding fields
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface DynamicFormRule {
  /** Condition that triggers this rule */
  condition: FieldCondition | FieldCondition[];

  /** Fields to show when condition is met */
  showFields?: string[];

  /** Fields to hide when condition is met */
  hideFields?: string[];

  /** Fields to disable when condition is met */
  disableFields?: string[];

  /** Fields to enable when condition is met */
  enableFields?: string[];
}

/**
 * Form configuration for advanced form features
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FormConfig {
  /** Form type */
  type?: 'single' | 'multi-step' | 'dynamic' | 'wizard';

  /** Steps for multi-step forms */
  steps?: FormStep[];

  /** Dynamic field rules */
  rules?: DynamicFormRule[];

  /** Whether to persist form state (auto-save drafts) */
  persist?: boolean;

  /** Persistence configuration */
  persistence?: {
    /** Storage key prefix */
    key?: string;
    /** Auto-save interval in milliseconds */
    autoSaveInterval?: number;
    /** Whether to show save indicator */
    showSaveIndicator?: boolean;
  };

  /** Form layout configuration */
  layout?: {
    /** Number of columns for field layout */
    columns?: 1 | 2 | 3;
    /** Whether to show field labels */
    showLabels?: boolean;
    /** Whether to show field hints */
    showHints?: boolean;
    /** Custom CSS classes */
    className?: string;
  };

  /** Form behavior configuration */
  behavior?: {
    /** Whether to show progress indicator */
    showProgress?: boolean;
    /** Whether to allow step navigation */
    allowStepNavigation?: boolean;
    /** Whether to validate on step change */
    validateOnStepChange?: boolean;
    /** Whether to show step numbers */
    showStepNumbers?: boolean;
  };
}

/**
 * Definition of a single entity field
 * @template T - The field type for type-safe validation and value inference
 *
 * @example
 * ```typescript
 * // Text field - TypeScript knows value is string
 * name: {
 *   type: 'text',
 *   visibility: 'user',
 *   validation: { required: true, minLength: 3 }
 * }
 *
 * // Select field with dropdown options
 * status: {
 *   type: 'select',
 *   visibility: 'user',
 *   validation: {
 *     required: true,
 *     options: [
 *       { value: 'active', label: 'Active' },
 *       { value: 'inactive', label: 'Inactive' }
 *     ]
 *   }
 * }
 * ```
 *
 * **Note:** For `select`, `multiselect`, and `radio` fields, dropdown options must be defined in `validation.options` as an array of `{ value: string, label: string }` objects.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EntityField<T extends string = FieldType> {
  /** Field identifier - required for form binding */
  name: string;

  /** The field type, which determines the UI component and validation */
  type: T;

  /**
   * Who can SEE this field
   * - 'guest': Everyone (even unauthenticated)
   * - 'user': Authenticated users only (users see both guest and user fields)
   * - 'admin': Admins only
   * - 'technical': Internal/system fields (shown as read-only in edit forms)
   * - 'hidden': Never shown in UI, only exists in DB (passwords, tokens, API keys)
   */
  visibility: Visibility;

  /**
   * Who can MODIFY this field
   * - true: Anyone who can see the field (default)
   * - false: Nobody (read-only display)
   * - 'admin': Only admins can edit
   * - 'create-only': Editable on create, read-only after
   */
  editable?: Editable;

  /** Validation rules for this field. For select/multiselect/radio fields, include `options` array here. */
  validation?: ValidationRules<T>;

  /** Whether the field is internationalized */
  i18n?: boolean;

  /** Display label for the field */
  label: string;

  /** Hint text to display under the field */
  hint?: string;

  /** Field dependencies for dynamic forms */
  dependsOn?: {
    /** Field name this field depends on */
    field: string;
    /** Value that should trigger this field to show */
    value?: ValueTypeForField<FieldType>;
    /** Custom condition function */
    condition?: (formData: Record<string, unknown>) => boolean;
  };

  /** Field grouping for layout */
  group?: {
    /** Group name */
    name: string;
    /** Group title */
    title?: string;
    /** Group description */
    description?: string;
    /** Whether group is collapsible */
    collapsible?: boolean;
    /** Whether group is collapsed by default */
    collapsed?: boolean;
  };

  /**
   * Dynamic conditions for field behavior based on other field values.
   * Controls visibility, disabled, required, and readonly states at runtime.
   *
   * @example
   * ```typescript
   * conditions: {
   *   visible: when('productType').equals('car'),
   *   required: when('productType').equals('car'),
   * }
   * ```
   */
  conditions?: ConditionalBehavior;

  /** UI-specific configuration for field rendering */
  options?: UIFieldOptions<T>;
}

/**
 * Base fields that all entities should have
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseEntityFields {
  /** Unique identifier for the entity */
  id: EntityField<'text'>;

  /** When the entity was created */
  createdAt: EntityField<'timestamp'>;

  /** When the entity was last updated */
  updatedAt: EntityField<'timestamp'>;

  /** Who created the entity */
  createdById: EntityField<'reference'>;

  /** Who last updated the entity */
  updatedById: EntityField<'reference'>;

  /**
   * Publication status for draft/publish/delete workflow
   * - 'draft': Document is incomplete, hidden from non-admin
   * - 'available': Document is published and visible (default)
   * - 'deleted': Soft-deleted, hidden from non-admin
   * - Consumer can extend with additional statuses (e.g., 'reserved', 'sold')
   */
  status: EntityField<'select'>;
}

/**
 * Consumer `fields` merged with {@link BaseEntityFields} — same keys {@link defineEntity} returns.
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export type MergedEntityFieldMap<F extends Record<string, EntityField>> = F &
  BaseEntityFields;

/**
 * Merged field map with `readonly` stripped from keys — improves assignability of
 * `defineEntity` results to widened {@link AnyEntity} props.
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export type MutableMergedEntityFieldMap<F extends Record<string, EntityField>> =
  {
    -readonly [K in keyof MergedEntityFieldMap<F>]: MergedEntityFieldMap<F>[K];
  };

/**
 * Default merged field map when an entity is not parameterized with a literal field map.
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export type EntityFieldMapDefault = Record<string, EntityField> &
  BaseEntityFields;

/**
 * CRUD/cache document row inferred from an entity `fields` map (SSOT with `defineEntity` literals).
 * Intersects {@link Record} so rows satisfy `T extends Record<string, unknown>` (bulk, PII, adapters).
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export type EntityRowFromFields<F extends Record<string, EntityField>> = {
  [K in keyof F]: F[K] extends EntityField<infer FT>
    ? FT extends keyof FieldTypeToValue
      ? FieldTypeToValue[FT]
      : unknown
    : unknown;
} & Record<string, unknown>;

/**
 * Unique key constraint definition for entity deduplication
 * Enables automatic checking for duplicates on create/update operations
 *
 * @example
 * ```typescript
 * // Single field unique key with findOrCreate
 * uniqueKeys: [{ fields: ['email'], findOrCreate: true }]
 *
 * // Composite unique key
 * uniqueKeys: [{ fields: ['vin', 'make'], skipForDrafts: true }]
 *
 * // Multiple keys (OR logic - either can identify)
 * uniqueKeys: [
 *   { fields: ['email'], findOrCreate: true },
 *   { fields: ['phone'], findOrCreate: true }
 * ]
 * ```
 *
 * @version 0.1.0
 * @since 0.0.5
 * @author AMBROISE PARK Consulting
 */
export interface UniqueKeyDefinition {
  /** Field names that together form the unique key (single or composite) */
  fields: string[];

  /** Custom error message when duplicate is found */
  errorMessage?: string;

  /** Skip validation for draft documents (default: false) */
  skipForDrafts?: boolean;

  /**
   * Return existing document instead of throwing error on duplicate (default: false)
   * When true, create operations will return the existing document if a match is found
   */
  findOrCreate?: boolean;
}

/**
 * SOC2 security configuration for an entity.
 * Zero-config path: omit this entirely for MVP — add it when going to production/SOC2 audit.
 *
 * When a `SecurityContext` is passed to `CrudService`, these options control:
 * - Which fields are encrypted at rest (PII)
 * - Whether CRUD mutations are audit-logged (default: true)
 * - Entity-level rate limit overrides
 * - MFA requirement for a given role tier
 * - Data retention for automated purge scheduling
 *
 * @example
 * ```typescript
 * security: {
 *   piiFields: ['email', 'phone', 'ssn'],
 *   requireMfa: 'admin',
 *   retention: { days: 365 },
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SecurityEntityConfig {
  /**
   * Field names to encrypt at rest using AES-256-GCM.
   * Requires `piiSecret` in `DndevSecurityConfig`.
   * Only string field values are encrypted; other types are skipped silently.
   */
  piiFields?: string[];
  /**
   * Whether to emit audit log entries for all CRUD mutations on this entity.
   * @default true (when SecurityContext is provided)
   */
  auditLog?: boolean;
  /**
   * Override rate limits for this entity (uses global defaults if omitted).
   */
  rateLimit?: {
    writes?: number;
    reads?: number;
    windowSeconds?: number;
  };
  /**
   * Enforce MFA for users at or above this role attempting mutations.
   * The adapter must verify MFA status from the auth token/session.
   */
  requireMfa?: UserRole;
  /**
   * Data retention policy — documents older than `days` are flagged for purge.
   * Integrate with `PrivacyManager.shouldPurge()` in a scheduled function.
   */
  retention?: { days: number };
}

/**
 * Multi-tenancy scope configuration for entities
 * Enables automatic scoping of data by tenant/company/workspace
 *
 * @example
 * ```typescript
 * const clientEntity = defineEntity({
 *   name: 'Client',
 *   collection: 'clients',
 *   scope: { field: 'companyId', provider: 'company' },
 *   fields: { ... } // No need to manually define companyId
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export interface ScopeConfig {
  /**
   * Field name that stores the scope ID (e.g., 'companyId', 'tenantId', 'workspaceId')
   * This field will be auto-added to the entity with type 'reference'
   */
  field: string;

  /**
   * Name of the scope provider registered with registerScopeProvider()
   * The provider function returns the current scope ID from app state
   * @example 'company', 'tenant', 'workspace'
   */
  provider: string;

  /**
   * Collection being referenced (optional, defaults to field name without 'Id' suffix + 's')
   * @example 'companies' for field 'companyId'
   */
  collection?: string;
}

/**
 * Slot-based card layout for listCardFields.
 * Maps entity field names to card slots (title, subtitle, content, footer).
 */
export interface ListCardLayout {
  /** Fields rendered as the card title (joined with titleSeparator) */
  title?: string[];
  /**
   * Separator used to join multiple title field values.
   * @default ' '
   * @example `titleSeparator: ' - '` → "Paris 20e arr. - 20m²"
   */
  titleSeparator?: string;
  /** Fields rendered as the card subtitle */
  subtitle?: string[];
  /** Fields rendered in the card body (supports images) */
  content?: string[];
  /** Fields rendered in the card footer */
  footer?: string[];
}

/**
 * Definition of a business entity without base fields
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BusinessEntity<
  out F extends Record<string, EntityField> = Record<string, EntityField>,
> {
  /** Name of the entity */
  name: string;

  /** Firestore collection name */
  collection: string;

  /**
   * i18n namespace for translations (defaults to `entity-${name.toLowerCase()}`)
   * @example "entity-car", "entity-product"
   * @default `entity-${name.toLowerCase()}`
   */
  namespace?: string;

  /**
   * Multi-tenancy scope configuration (optional)
   * When set, the scope field is auto-added and CRUD operations auto-inject/filter by scope
   *
   * @example
   * ```typescript
   * scope: { field: 'companyId', provider: 'company' }
   * ```
   */
  scope?: ScopeConfig;

  /**
   * Stakeholder ownership configuration (optional).
   * When set, drives Firestore rule condition (read/update), list/listCard query constraints,
   * and visibility: 'owner' field masking. Use for marketplace-style entities (e.g. schedules:
   * public when available, private to partner/customer when booked).
   *
   * @example
   * ```typescript
   * ownership: {
   *   ownerFields: ['providerId', 'customerId'],
   *   publicCondition: [{ field: 'status', op: '==', value: 'available' }],
   * }
   * ```
   */
  ownership?: EntityOwnershipConfig;

  /** Field definitions - name and label are required */
  fields: F;

  /** Form configuration for advanced forms */
  form?: FormConfig;

  /**
   * Fields to include in admin list responses (optional).
   * Used by EntityList for optimized admin table queries.
   * If not specified, all visible fields are returned.
   * 'id' is always included automatically.
   *
   * @example
   * ```typescript
   * listFields: ['id', 'make', 'model', 'status', 'createdAt']
   * ```
   */
  listFields?: string[];

  /**
   * Fields to include in public card list responses.
   * Accepts a flat array (auto-layout) or a slot-based `ListCardLayout` object.
   *
   * Each field value is formatted via `formatValue()` using its registered display formatter.
   * For `'number'` fields, use `unit` and `suffix` field options for rich display — no custom
   * type needed:
   * - `unit: 'm²'` → "20m²" (appended directly, no space)
   * - `suffix: 'fields.rent_suffix'` → "700€ charges comprises" (i18n key, space-separated)
   *
   * Use `titleSeparator` in `ListCardLayout` to control how multiple title fields are joined
   * (default `' '`).
   *
   * @example
   * ```typescript
   * // Flat — auto-slots first field as title, rest as content
   * listCardFields: ['images', 'make', 'price', 'year']
   *
   * // Slot-based — explicit card layout with separator
   * listCardFields: {
   *   titleSeparator: ' - ',
   *   title: ['district_code', 'size'],   // e.g. "Paris 20e arr. - 20m²"
   *   subtitle: ['rent'],                  // e.g. "700€ charges comprises"
   *   content: ['pictures', 'nearby_stations'],
   * }
   * ```
   */
  listCardFields?: string[] | ListCardLayout;

  /**
   * Entity-level access control configuration.
   * Defines minimum role required for each CRUD operation.
   * Uses role hierarchy: guest (0) < user (1) < admin (2) < super (3)
   *
   * Defaults (via defineEntity):
   * - read: 'guest' (public read, field visibility handles sensitive data)
   * - create/update/delete: 'admin'
   *
   * @example
   * ```typescript
   * // Public inquiry form
   * access: { create: 'guest', read: 'admin' }
   *
   * // Members-only content
   * access: { read: 'user' }
   * ```
   */
  access?: EntityAccessConfig;

  /**
   * Unique key constraints for deduplication
   * Checked during create/update operations
   *
   * - Single field: `[{ fields: ['email'] }]`
   * - Composite: `[{ fields: ['vin', 'make'] }]`
   * - Multiple keys (OR): `[{ fields: ['email'] }, { fields: ['phone'] }]`
   *
   * @example
   * ```typescript
   * // Customer: email OR phone identifies (findOrCreate behavior)
   * uniqueKeys: [
   *   { fields: ['email'], findOrCreate: true },
   *   { fields: ['phone'], findOrCreate: true }
   * ]
   *
   * // Car: VIN is unique, skip for drafts
   * uniqueKeys: [{ fields: ['vin'], skipForDrafts: true }]
   * ```
   */
  uniqueKeys?: UniqueKeyDefinition[];

  /**
   * SOC2 security configuration for this entity (optional — zero-config MVP path).
   * When a `SecurityContext` is provided to `CrudService`, these settings control
   * PII encryption, audit logging, rate limits, MFA enforcement, and retention.
   *
   * @example
   * ```typescript
   * security: {
   *   piiFields: ['email', 'phone'],
   *   requireMfa: 'admin',
   *   retention: { days: 365 },
   * }
   * ```
   */
  security?: SecurityEntityConfig;

  /**
   * Client-side search config for `useCrudList`/`useCrudCardList` `searchQuery` option.
   * If omitted, all text-like visible fields are searched automatically.
   *
   * @example
   * ```typescript
   * search: { fields: ['name', 'description', 'sku'] }
   * ```
   */
  search?: { fields?: string[] };

  /**
   * Default client-side sort for list hooks.
   * Applied when no explicit `clientSort` option is passed and no `orderBy` in `queryOptions`.
   * Pass `clientSort: null` in hook options to disable.
   *
   * @example
   * ```typescript
   * defaultSort: { field: 'createdAt', direction: 'desc' }
   * ```
   */
  defaultSort?: { field: string; direction?: 'asc' | 'desc' };
}

/**
 * Complete entity definition including base fields
 * Created by defineEntity() which merges defaults
 *
 * Extends BusinessEntity but overrides optional properties to required:
 * - namespace: always computed (defaults to `entity-${name.toLowerCase()}`)
 * - access: always merged with defaults
 * - fields: includes base fields (id, createdAt, etc.)
 * - scope: preserved if provided (for multi-tenancy)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface Entity<
  out F extends Record<string, EntityField> = EntityFieldMapDefault,
> extends Omit<BusinessEntity<F>, 'access' | 'namespace'> {
  /** Field definitions including base fields */
  fields: F;

  /** Access configuration with defaults applied (always present after defineEntity) */
  access: Required<EntityAccessConfig>;

  /** i18n namespace for translations (always present after defineEntity, defaults to `entity-${name.toLowerCase()}`) */
  namespace: string;

  /** Multi-tenancy scope configuration (preserved from BusinessEntity if provided) */
  scope?: ScopeConfig;
}

/**
 * Document row type for an entity from {@link defineEntity} — use with `useCrud`, `bulk`, and list hooks.
 *
 * @version 0.1.0
 * @since 0.2.0
 */
/**
 * Widened entity type for props and APIs that accept any `defineEntity()` result
 * without casting to default {@link Entity}.
 *
 * @version 0.1.0
 * @since 0.2.0
 */
export type AnyEntity = Entity<Record<string, EntityField>>;

/**
 * Inferred document row for an entity. Always includes `id` so rows are valid for
 * lists, keys, and `Record<string, any>`-shaped component props even when `E` is
 * the widened {@link AnyEntity} (`fields` is only a string index signature).
 */
export type InferEntityRow<E extends AnyEntity> = EntityRowFromFields<
  E['fields']
> & {
  id: string;
};

/**
 * Unified metadata structure for all schemas (CRUD, Functions, etc.)
 * Consolidates different metadata patterns into one DRY interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SchemaMetadata {
  /** Firestore collection name */
  collection: string;

  /** Entity name (for CRUD schemas) */
  entity?: string;

  /** Form configuration (for CRUD schemas) */
  form?: FormConfig;

  /** Fields that should be unique within the collection (for function validation) */
  uniqueFields?: Array<{
    field: string;
    errorMessage?: string;
  }>;

  /**
   * Unique key constraints from entity definition
   * Used by backend CRUD functions for deduplication
   */
  uniqueKeys?: UniqueKeyDefinition[];

  /** Custom validation function (for function validation) */
  customValidate?: (
    data: Record<string, any>,
    operation: 'create' | 'update'
  ) => Promise<void>;
}

/**
 * Unified schema type that includes DoNotDev metadata
 * @template T - The entity/data type
 *
 * Unified schema type for all DoNotDev schemas
 * Uses Valibot's BaseSchema for validation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type dndevSchema<T> = v.BaseSchema<unknown, T, v.BaseIssue<unknown>> & {
  metadata: SchemaMetadata;
};

/**
 * Interface for database uniqueness validation
 * This abstraction allows for plugging in any database implementation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UniqueConstraintValidator {
  /**
   * Checks if a value would cause a duplicate in a given collection
   * @param collection - The collection/table name
   * @param field - The field name to check
   * @param value - The field value to check for uniqueness
   * @param currentDocId - The current document ID (for updates)
   * @returns Whether a duplicate exists
   */
  checkDuplicate: (
    collection: string,
    field: string,
    value: any,
    currentDocId?: string
  ) => Promise<boolean>;
}

// =============================================================================
// Function Request Schemas (from functions/crud.ts)
// =============================================================================

/**
 * Schema for creating an entity
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const createEntitySchema = v.object({
  collection: v.pipe(v.string(), v.minLength(1, 'Collection name is required')),
  data: v.record(v.string(), v.unknown()),
  idempotencyKey: v.optional(v.string()),
});

/**
 * Schema for getting an entity
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const getEntitySchema = v.object({
  collection: v.pipe(v.string(), v.minLength(1, 'Collection name is required')),
  id: v.pipe(v.string(), v.minLength(1, 'Entity ID is required')),
});

/**
 * Schema for updating an entity
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const updateEntitySchema = v.object({
  collection: v.pipe(v.string(), v.minLength(1, 'Collection name is required')),
  id: v.pipe(v.string(), v.minLength(1, 'Entity ID is required')),
  data: v.record(v.string(), v.unknown()),
  merge: v.optional(v.boolean(), false),
});

/**
 * Schema for deleting an entity
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const deleteEntitySchema = v.object({
  collection: v.pipe(v.string(), v.minLength(1, 'Collection name is required')),
  id: v.pipe(v.string(), v.minLength(1, 'Entity ID is required')),
});

/**
 * Schema for listing entities.
 *
 * Default limit is **1000** (server-enforced max: 1000).
 * For collections larger than 1000 items, use server-side pagination
 * (`pagination='server'` on EntityList, or cursor-based `startAfter` in hooks).
 *
 * @example
 * // Fetch up to 1000 items (default)
 * { collection: 'products' }
 *
 * @example
 * // Fetch 200 items
 * { collection: 'products', limit: 200 }
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const listEntitiesSchema = v.object({
  collection: v.pipe(v.string(), v.minLength(1, 'Collection name is required')),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(1000)), 1000),
  offset: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
  orderBy: v.optional(v.string()),
  orderDirection: v.optional(v.picklist(['asc', 'desc']), 'desc'),
  where: v.optional(
    v.array(
      v.object({
        field: v.string(),
        operator: v.picklist([
          '==',
          '!=',
          '<',
          '<=',
          '>',
          '>=',
          'array-contains',
          'in',
          'not-in',
        ]),
        value: v.unknown(),
      })
    )
  ),
});

// =============================================================================
// Function Request/Response Types (from functions/crud.ts)
// =============================================================================

/**
 * Create entity request type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CreateEntityRequest = v.InferOutput<typeof createEntitySchema>;

/**
 * Get entity request type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type GetEntityRequest = v.InferOutput<typeof getEntitySchema>;

/**
 * Update entity request type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type UpdateEntityRequest = v.InferOutput<typeof updateEntitySchema>;

/**
 * Delete entity request type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type DeleteEntityRequest = v.InferOutput<typeof deleteEntitySchema>;

/**
 * List entities request type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ListEntitiesRequest = v.InferOutput<typeof listEntitiesSchema>;

/**
 * Create entity response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CreateEntityResponse {
  success: boolean;
  id: string;
  data: Record<string, any>;
}

/**
 * Get entity response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface GetEntityResponse {
  success: boolean;
  data: Record<string, any> | null;
}

/**
 * Update entity response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UpdateEntityResponse {
  success: boolean;
  id: string;
  data: Record<string, any>;
}

/**
 * Delete entity response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface DeleteEntityResponse {
  success: boolean;
  id: string;
}

/**
 * List entities response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ListEntitiesResponse {
  success: boolean;
  data: Record<string, any>[];
  total: number;
  hasMore: boolean;
}
