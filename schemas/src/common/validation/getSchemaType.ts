// packages/core/schemas/src/common/validation/getSchemaType.ts

/**
 * @fileoverview Schema type generation utility
 * @description Creates Valibot schemas via registry - extensible for custom types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type { EntityField, FieldType } from '@donotdev/types';

/**
 * Schema generator function type
 */
export type CustomSchemaGenerator = (
  field: EntityField<FieldType>
) => v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> | null;

/**
 * Schema registry - maps field types to schema generators
 */
const schemaRegistry = new Map<string, CustomSchemaGenerator>();

/**
 * Register a schema generator for a field type
 */
export function registerSchemaGenerator(
  type: string,
  generator: CustomSchemaGenerator
): void {
  schemaRegistry.set(type, generator);
}

/**
 * Check if a schema generator is registered
 */
export function hasCustomSchemaGenerator(type: string): boolean {
  return schemaRegistry.has(type);
}

/**
 * Get all registered schema types
 */
export function getRegisteredSchemaTypes(): string[] {
  return Array.from(schemaRegistry.keys());
}

/**
 * Clear all schema generators (testing)
 */
export function clearSchemaGenerators(): void {
  schemaRegistry.clear();
}

// ============================================================================
// Helper: Apply required/optional wrapper
// ============================================================================

/**
 * Wraps schema based on required flag.
 * - required: true → schema as-is
 * - required: false/undefined → v.nullish() (accepts null, undefined, or valid value)
 */
function applyRequired<
  T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
  schema: T,
  required?: boolean
): v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
  return required ? schema : v.nullish(schema);
}

// ============================================================================
// Built-in Schema Generators
// ============================================================================

/**
 * Schema generators exported for unified registry
 * These are also auto-registered below for backward compatibility
 */
export const textSchema: CustomSchemaGenerator = (field) => {
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
  const schema =
    validations.length > 0 ? v.pipe(v.string(), ...validations) : v.string();
  return applyRequired(schema, field.validation?.required);
};

export const emailSchema: CustomSchemaGenerator = (field) => {
  const schema = v.pipe(v.string(), v.email('Invalid email address'));
  return applyRequired(schema, field.validation?.required);
};

export const passwordSchema: CustomSchemaGenerator = (field) => {
  const schema =
    field.validation?.minLength !== undefined
      ? v.pipe(
          v.string(),
          v.minLength(
            field.validation.minLength,
            `Must be at least ${field.validation.minLength} characters`
          )
        )
      : v.string();
  return applyRequired(schema, field.validation?.required);
};

export const urlSchema: CustomSchemaGenerator = (field) => {
  const schema = v.pipe(v.string(), v.url('Invalid URL'));
  return applyRequired(schema, field.validation?.required);
};

export const numberSchema: CustomSchemaGenerator = (field) => {
  const validations: v.BaseValidation<number, number, v.BaseIssue<unknown>>[] =
    [];
  if (field.validation?.min !== undefined) {
    validations.push(
      v.minValue(
        field.validation.min,
        `Must be at least ${field.validation.min}`
      )
    );
  }
  if (field.validation?.max !== undefined) {
    validations.push(
      v.maxValue(
        field.validation.max,
        `Must be at most ${field.validation.max}`
      )
    );
  }
  const schema =
    validations.length > 0 ? v.pipe(v.number(), ...validations) : v.number();
  return applyRequired(schema, field.validation?.required);
};

export const booleanSchema: CustomSchemaGenerator = (field) => {
  const schema = v.boolean();
  return applyRequired(schema, field.validation?.required);
};

export const dateSchema: CustomSchemaGenerator = (field) => {
  // Accept ISO dates ("2024-03-15"), ISO timestamps ("2024-03-15T00:00:00.000Z"),
  // and ISO date-times ("2024-03-15T00:00:00") — DB may store any format,
  // DateFieldComponent outputs full ISO timestamps on user input.
  const schema = v.pipe(
    v.string(),
    v.check((val) => !isNaN(new Date(val).getTime()), 'Invalid date format')
  );
  return applyRequired(schema, field.validation?.required);
};

// Base FileAsset object schema (reused for both single and array)
const fileAssetObjectSchema = v.object({
  url: v.string(),
  filename: v.string(),
  size: v.number(),
  mimeType: v.nullish(v.string()),
  uploadedAt: v.nullish(v.string()),
});

export const fileSchema: CustomSchemaGenerator = (field) => {
  // File can be null (no file) or the object
  const schema = v.nullable(fileAssetObjectSchema);
  return applyRequired(schema, field.validation?.required);
};

export const filesSchema: CustomSchemaGenerator = (field) => {
  const schema = v.array(fileAssetObjectSchema);
  return applyRequired(schema, field.validation?.required);
};

// Base Picture object schema (reused for both single and array)
const pictureObjectSchema = v.object({
  fullUrl: v.string(),
  thumbUrl: v.string(),
});

// Images may come pre-filled as plain URL strings (e.g. seed data, stock
// assets wired into entity defaults) or as uploaded Picture objects.
// Accept both at the schema boundary; adapters are responsible for
// normalizing before persistence if a canonical shape is required.
export const pictureSchema: CustomSchemaGenerator = (field) => {
  const schema = v.union([v.string(), pictureObjectSchema]);
  return applyRequired(schema, field.validation?.required);
};

export const picturesSchema: CustomSchemaGenerator = (field) => {
  const schema = v.array(v.union([v.string(), pictureObjectSchema]));
  return applyRequired(schema, field.validation?.required);
};

export const geopointSchema: CustomSchemaGenerator = (field) => {
  const schema = v.object({ lat: v.number(), lng: v.number() });
  return applyRequired(schema, field.validation?.required);
};

export const addressSchema: CustomSchemaGenerator = (field) => {
  const schema = v.object({
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
  return applyRequired(schema, field.validation?.required);
};

export const mapSchema: CustomSchemaGenerator = (field) => {
  const schema = v.record(v.string(), v.unknown());
  return applyRequired(schema, field.validation?.required);
};

export const arraySchema: CustomSchemaGenerator = (field) => {
  const schema = v.array(v.unknown());
  return applyRequired(schema, field.validation?.required);
};

export const selectSchema: CustomSchemaGenerator = (field) => {
  const options = field.validation?.options;

  // Static array options - generate picklist
  if (Array.isArray(options) && options.length > 0) {
    const values = options.map(
      (opt: { value: string; label: string }) => opt.value
    ) as [string, ...string[]];
    const schema = v.picklist(values);
    return applyRequired(schema, field.validation?.required);
  }

  // Fallback for dynamic options (functions) - can't validate statically
  // Accept string or number for flexibility
  const schema = v.union([v.string(), v.number()]);
  return applyRequired(schema, field.validation?.required);
};

export const multiselectSchema: CustomSchemaGenerator = (field) => {
  const options = field.validation?.options;

  // Only handle array options for schema generation (functions/ranges resolved at runtime)
  if (Array.isArray(options) && options.length > 0) {
    const values = options.map(
      (opt: { value: string; label: string }) => opt.value
    ) as [string, ...string[]];
    const schema = v.array(v.picklist(values));
    return applyRequired(schema, field.validation?.required);
  }

  // Fallback for function/range options or no options - validate as string array
  const schema = v.array(v.string());
  return applyRequired(schema, field.validation?.required);
};

export const referenceSchema: CustomSchemaGenerator = (field) => {
  // ID format is provider-specific (Firestore: alphanumeric, Supabase: UUID)
  // Schema validates non-empty string only — adapter owns the format.
  const schema = v.pipe(v.string(), v.minLength(1, 'Invalid ID format'));
  return applyRequired(schema, field.validation?.required);
};

export const stringSchema: CustomSchemaGenerator = (field) => {
  const schema = v.string();
  return applyRequired(schema, field.validation?.required);
};

export const telSchema: CustomSchemaGenerator = (field) => {
  const schema = v.string();
  return applyRequired(schema, field.validation?.required);
};

export const ibanSchema: CustomSchemaGenerator = (field) => {
  const minLength = field.validation?.minLength ?? 15;
  const maxLength = field.validation?.maxLength ?? 34;
  const pattern =
    field.validation?.pattern ?? '^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,34}$';

  const validations: v.BaseValidation<string, string, v.BaseIssue<unknown>>[] =
    [];

  if (minLength !== undefined) {
    validations.push(
      v.minLength(minLength, `IBAN must be at least ${minLength} characters`)
    );
  }
  if (maxLength !== undefined) {
    validations.push(
      v.maxLength(maxLength, `IBAN must not exceed ${maxLength} characters`)
    );
  }
  if (pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    validations.push(v.regex(regex, 'Invalid IBAN format'));
  }

  const schema =
    validations.length > 0 ? v.pipe(v.string(), ...validations) : v.string();
  return applyRequired(schema, field.validation?.required);
};

export const neverSchema: CustomSchemaGenerator = () => v.never();

export const switchSchema: CustomSchemaGenerator = (field) => {
  // Switch can have custom checked/unchecked string values OR be a boolean
  const fieldSpecific = field.options?.fieldSpecific as
    | {
        checkedValue?: string;
        uncheckedValue?: string;
      }
    | undefined;

  if (fieldSpecific?.checkedValue && fieldSpecific?.uncheckedValue) {
    // 2-value string switch (e.g., 'Automatic' / 'Manual')
    const values = [
      fieldSpecific.checkedValue,
      fieldSpecific.uncheckedValue,
    ] as [string, string];
    const schema = v.picklist(values);
    return applyRequired(schema, field.validation?.required);
  }

  // Default: boolean switch
  const schema = v.boolean();
  return applyRequired(schema, field.validation?.required);
};

// GDPR Consent - object with consent boolean + metadata
// When checked, stores: { gdprConsent: true, gdprConsentDate: ISO string, gdprConsentVersion: "YYYY-MM-DD" }
// When unchecked: false (if not required) or undefined (if required - will fail validation, which is correct)
// Validation only checks that gdprConsent === true, not the full object structure
export const gdprConsentSchema: CustomSchemaGenerator = (field) => {
  const baseSchema = v.custom<unknown>((input) => {
    // If required, must be an object with gdprConsent: true
    if (field.validation?.required) {
      if (typeof input === 'object' && input !== null) {
        return (input as { gdprConsent?: boolean }).gdprConsent === true;
      }
      return false;
    }
    // If not required, accept false, null, undefined, or object with gdprConsent: true
    if (input === false || input === null || input === undefined) {
      return true;
    }
    if (typeof input === 'object' && input !== null) {
      return (input as { gdprConsent?: boolean }).gdprConsent === true;
    }
    return false;
  }, 'GDPR consent must be given');

  return baseSchema;
};

// Price - object with amount, optional currency, vatIncluded, discountPercent (0-100)
export const priceSchema: CustomSchemaGenerator = (field) => {
  const schema = v.object({
    amount: v.number(),
    currency: v.optional(v.string()),
    vatIncluded: v.optional(v.boolean()),
    discountPercent: v.optional(
      v.pipe(v.number(), v.minValue(0), v.maxValue(100))
    ),
  });
  return applyRequired(schema, field.validation?.required);
};

// ============================================================================
// Register Built-in Types
// ============================================================================

function registerBuiltinSchemas(): void {
  // Text-based
  registerSchemaGenerator('text', textSchema);
  registerSchemaGenerator('textarea', textSchema);
  registerSchemaGenerator('richtext', textSchema);
  registerSchemaGenerator('color', textSchema);
  registerSchemaGenerator('email', emailSchema);
  registerSchemaGenerator('password', passwordSchema);
  registerSchemaGenerator('url', urlSchema);
  registerSchemaGenerator('tel', telSchema);
  registerSchemaGenerator('iban', ibanSchema);

  // Numeric
  registerSchemaGenerator('number', numberSchema);
  registerSchemaGenerator('currency', numberSchema);
  registerSchemaGenerator('price', priceSchema);
  registerSchemaGenerator('range', numberSchema);
  registerSchemaGenerator('year', numberSchema);
  registerSchemaGenerator('rating', numberSchema);
  registerSchemaGenerator('duration', numberSchema);

  // Boolean
  registerSchemaGenerator('boolean', booleanSchema);
  registerSchemaGenerator('checkbox', booleanSchema);

  // GDPR Consent
  registerSchemaGenerator('gdprConsent', gdprConsentSchema);

  // Date/time
  registerSchemaGenerator('date', dateSchema);
  registerSchemaGenerator('datetime-local', dateSchema);
  registerSchemaGenerator('time', dateSchema);
  registerSchemaGenerator('week', dateSchema);
  registerSchemaGenerator('month', dateSchema);
  registerSchemaGenerator('timestamp', dateSchema);

  // File & Document
  registerSchemaGenerator('file', fileSchema);
  registerSchemaGenerator('files', filesSchema);
  registerSchemaGenerator('document', fileSchema);
  registerSchemaGenerator('documents', filesSchema);
  registerSchemaGenerator('image', pictureSchema);
  registerSchemaGenerator('images', picturesSchema);

  // Complex
  registerSchemaGenerator('geopoint', geopointSchema);
  registerSchemaGenerator('address', addressSchema);
  registerSchemaGenerator('map', mapSchema);
  registerSchemaGenerator('array', arraySchema);

  // Selection
  registerSchemaGenerator('select', selectSchema);
  registerSchemaGenerator('multiselect', multiselectSchema);
  registerSchemaGenerator('radio', selectSchema);
  registerSchemaGenerator('combobox', selectSchema);

  // Toggle
  registerSchemaGenerator('switch', switchSchema);

  // Reference
  registerSchemaGenerator('reference', referenceSchema);

  // Special
  registerSchemaGenerator('hidden', stringSchema);
  registerSchemaGenerator('avatar', stringSchema);
  registerSchemaGenerator('badge', stringSchema);

  // Button (no value)
  registerSchemaGenerator('submit', neverSchema);
  registerSchemaGenerator('reset', neverSchema);
}

// Auto-register on module load
registerBuiltinSchemas();

/**
 * Get Valibot schema for an entity field
 *
 * Priority order:
 * 1. field.validation?.schema (custom schema defined directly in entity)
 * 2. Registry lookup (built-in or registered custom types)
 * 3. Fallback to v.unknown() for unregistered types
 */
export function getSchemaType(
  field: EntityField<FieldType>
): v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
  // PRIORITY 1: Custom schema defined in entity
  if (field.validation?.schema) {
    const customSchema = field.validation.schema;
    return applyRequired(customSchema, field.validation?.required);
  }

  // PRIORITY 2: Registry lookup
  const generator = schemaRegistry.get(field.type);
  if (generator) {
    const schema = generator(field);
    if (schema !== null) return schema;
  }

  // PRIORITY 3: Fallback to unknown
  const schema = v.unknown();
  return applyRequired(schema, field.validation?.required);
}
