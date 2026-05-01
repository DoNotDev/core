// packages/core/schemas/src/common/defineEntity.ts

/**
 * @fileoverview Entity Definition Utilities
 * @description Utilities for defining and validating entities. Provides functions to define business entities with form configuration, field definitions, and validation rules.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { DEFAULT_ENTITY_ACCESS, EDITABLE } from '@donotdev/types';
import type {
  BusinessEntity,
  Entity,
  EntityField,
  EntityAccessConfig,
  FormConfig,
  MutableMergedEntityFieldMap,
  MergedEntityFieldMap,
  ScopeConfig,
  UniqueKeyDefinition,
} from '@donotdev/types';
import { handleError, getListCardFieldNames } from '@donotdev/utils';

import { baseFields, DEFAULT_STATUS_OPTIONS } from './visibility';

/** Field names that would cause prototype pollution if used as entity field keys */
const FORBIDDEN_FIELD_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Validates that no field names are reserved JavaScript properties
 * Must run before any spread of entity.fields to prevent prototype pollution
 */
function validateFieldNames(entity: BusinessEntity): void {
  for (const fieldName of Object.keys(entity.fields)) {
    if (FORBIDDEN_FIELD_NAMES.has(fieldName)) {
      throw handleError(
        new Error(
          `Field name '${fieldName}' in entity '${entity.name}' is a reserved JavaScript property and cannot be used as a field name.`
        ),
        {
          userMessage: `Field name '${fieldName}' in entity '${entity.name}' is a reserved JavaScript property and cannot be used as a field name.`,
          context: {
            entityName: entity.name,
            fieldName,
            operation: 'defineEntity',
          },
          severity: 'error',
        }
      );
    }
  }
}

/**
 * Creates a scope field definition for multi-tenancy
 * @param scope - Scope configuration from entity
 * @returns EntityField definition for the scope field
 */
function createScopeField(scope: ScopeConfig): EntityField<'reference'> {
  // Derive collection from field name if not provided (e.g., 'companyId' -> 'companies')
  // Strip 'Id' suffix, then apply naive pluralization
  const baseName = scope.field.endsWith('Id')
    ? scope.field.slice(0, -2) // companyId -> company
    : scope.field;

  const collection =
    scope.collection ||
    (baseName.endsWith('y')
      ? baseName.slice(0, -1) + 'ies' // company -> companies
      : baseName + 's'); // org -> orgs

  return {
    name: scope.field,
    label: `crud:fields.${scope.field}`,
    type: 'reference',
    visibility: 'technical', // Hidden from regular users, visible to admins
    editable: EDITABLE.CREATE_ONLY, // Cannot change scope after creation
    validation: {
      required: true,
      reference: collection,
    },
  };
}

/**
 * Merges consumer status options with framework defaults
 * Deduplicates by value, base options first
 */
function mergeStatusOptions(
  baseOptions: typeof DEFAULT_STATUS_OPTIONS,
  userOptions?: Array<{ value: string; label: string }>
): Array<{ value: string; label: string }> {
  if (!userOptions || userOptions.length === 0) {
    // Cast to mutable array type to avoid readonly issues
    return baseOptions.map((opt) => ({ value: opt.value, label: opt.label }));
  }

  // Start with base options (explicitly typed as mutable array)
  const merged: Array<{ value: string; label: string }> = baseOptions.map(
    (opt) => ({ value: opt.value, label: opt.label })
  );

  // Add user options that don't duplicate base values
  const baseValues = new Set<string>(baseOptions.map((opt) => opt.value));
  for (const opt of userOptions) {
    if (!baseValues.has(opt.value)) {
      merged.push(opt);
    }
  }

  return merged;
}

/**
 * Validates uniqueKeys configuration for consistency
 * Ensures all referenced fields exist in the entity
 *
 * @version 0.1.0
 * @since 0.0.5
 * @author AMBROISE PARK Consulting
 */
function validateUniqueKeys(
  entity: BusinessEntity,
  allFieldNames: Set<string>
): void {
  if (!entity.uniqueKeys || entity.uniqueKeys.length === 0) return;

  for (let i = 0; i < entity.uniqueKeys.length; i++) {
    const uniqueKey = entity.uniqueKeys[i];
    // Guard against undefined entries in uniqueKeys array
    if (!uniqueKey) continue;

    // Validate fields array is not empty
    if (!uniqueKey.fields || uniqueKey.fields.length === 0) {
      throw handleError(
        new Error(
          `uniqueKeys[${i}] for entity '${entity.name}' must have at least one field`
        ),
        {
          userMessage: `uniqueKeys[${i}] for entity '${entity.name}' must have at least one field`,
          context: { entityName: entity.name, uniqueKeyIndex: i },
          severity: 'error',
        }
      );
    }

    // Validate all fields exist
    const invalidFields = uniqueKey.fields.filter(
      (field) => !allFieldNames.has(field)
    );
    if (invalidFields.length > 0) {
      throw handleError(
        new Error(
          `uniqueKeys[${i}] for entity '${entity.name}' references non-existent fields: ${invalidFields.join(', ')}`
        ),
        {
          userMessage: `uniqueKeys[${i}] for entity '${entity.name}' references non-existent fields: ${invalidFields.join(', ')}`,
          context: {
            entityName: entity.name,
            uniqueKeyIndex: i,
            invalidFields,
          },
          severity: 'error',
        }
      );
    }
  }
}

/**
 * Validates form configuration for consistency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
function validateFormConfig(entity: BusinessEntity): void {
  const { form, fields } = entity;
  const entityFieldNames = Object.keys(fields);

  if (!form) return;

  // Validate multi-step form configuration
  if (form.type === 'multi-step' || form.type === 'wizard') {
    if (!form.steps || form.steps.length === 0) {
      throw handleError(
        new Error(
          `Multi-step form for entity '${entity.name}' must have at least one step`
        ),
        {
          userMessage: `Multi-step form for entity '${entity.name}' must have at least one step`,
          context: { entityName: entity.name, operation: 'validateFormConfig' },
          severity: 'error',
        }
      );
    }

    // Check that all step fields exist in entity fields
    const stepFields = form.steps.flatMap((step) => step.fields);

    const invalidFields = stepFields.filter(
      (field) => !entityFieldNames.includes(field)
    );
    if (invalidFields.length > 0) {
      throw handleError(
        new Error(
          `Multi-step form for entity '${entity.name}' references non-existent fields: ${invalidFields.join(', ')}`
        ),
        {
          userMessage: `Multi-step form for entity '${entity.name}' references non-existent fields: ${invalidFields.join(', ')}`,
          context: {
            entityName: entity.name,
            invalidFields,
            operation: 'validateFormConfig',
          },
          severity: 'error',
        }
      );
    }

    // Check that all fields are included in at least one step
    const includedFields = new Set(stepFields);
    const missingFields = entityFieldNames.filter(
      (field) => !includedFields.has(field)
    );
    if (missingFields.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Entity '${entity.name}' has fields not included in any step: ${missingFields.join(', ')}`
        );
      }
    }
  }

  // Validate dynamic form rules
  if (form.rules) {
    form.rules.forEach((rule, index) => {
      // Validate condition fields exist
      const conditionFields = Array.isArray(rule.condition)
        ? rule.condition.map((c) => c.field)
        : [rule.condition.field];

      const invalidConditionFields = conditionFields.filter(
        (field) => !entityFieldNames.includes(field)
      );
      if (invalidConditionFields.length > 0) {
        throw handleError(
          new Error(
            `Dynamic form rule ${index} for entity '${entity.name}' references non-existent condition fields: ${invalidConditionFields.join(', ')}`
          ),
          {
            userMessage: `Dynamic form rule ${index} for entity '${entity.name}' references non-existent condition fields: ${invalidConditionFields.join(', ')}`,
            context: {
              entityName: entity.name,
              ruleIndex: index,
              invalidFields: invalidConditionFields,
              operation: 'validateFormConfig',
            },
            severity: 'error',
          }
        );
      }

      // Validate affected fields exist
      const affectedFields = [
        ...(rule.showFields || []),
        ...(rule.hideFields || []),
        ...(rule.disableFields || []),
        ...(rule.enableFields || []),
      ];

      const invalidAffectedFields = affectedFields.filter(
        (field) => !entityFieldNames.includes(field)
      );
      if (invalidAffectedFields.length > 0) {
        throw handleError(
          new Error(
            `Dynamic form rule ${index} for entity '${entity.name}' references non-existent affected fields: ${invalidAffectedFields.join(', ')}`
          ),
          {
            userMessage: `Dynamic form rule ${index} for entity '${entity.name}' references non-existent affected fields: ${invalidAffectedFields.join(', ')}`,
            context: {
              entityName: entity.name,
              ruleIndex: index,
              invalidFields: invalidAffectedFields,
              operation: 'validateFormConfig',
            },
            severity: 'error',
          }
        );
      }
    });
  }

  // Validate field dependencies
  Object.entries(fields).forEach(([fieldName, field]) => {
    if (field.dependsOn) {
      if (!entityFieldNames.includes(field.dependsOn.field)) {
        throw handleError(
          new Error(
            `Field '${fieldName}' in entity '${entity.name}' depends on non-existent field: ${field.dependsOn.field}`
          ),
          {
            userMessage: `Field '${fieldName}' in entity '${entity.name}' depends on non-existent field: ${field.dependsOn.field}`,
            context: {
              entityName: entity.name,
              fieldName,
              dependsOnField: field.dependsOn.field,
              operation: 'validateFormConfig',
            },
            severity: 'error',
          }
        );
      }
    }
  });
}

/**
 * Sets default form configuration if not provided
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
function setDefaultFormConfig(entity: BusinessEntity): FormConfig {
  if (entity.form) {
    return {
      type: 'single',
      behavior: {
        showProgress: false,
        allowStepNavigation: true,
        validateOnStepChange: true,
        showStepNumbers: true,
      },
      layout: {
        columns: 1,
        showLabels: true,
        showHints: true,
      },
      ...entity.form,
    };
  }

  return {
    type: 'single',
    behavior: {
      showProgress: false,
      allowStepNavigation: true,
      validateOnStepChange: true,
      showStepNumbers: true,
    },
    layout: {
      columns: 1,
      showLabels: true,
      showHints: true,
    },
  };
}

/**
 * Defines an entity with validation and default configuration
 *
 * Automatically adds technical fields (`id`, `createdAt`, `updatedAt`, `createdById`, `updatedById`)
 * with `visibility: 'technical'`. User-defined technical fields are merged with defaults, allowing
 * customization (e.g., `editable: 'admin'`, custom `label`, additional `validation`).
 *
 * @param entity - The business entity definition
 * @returns The validated and configured entity
 *
 * @example
 * ```typescript
 * export const productEntity = defineEntity({
 *   name: 'Product',
 *   collection: 'products',
 *   fields: {
 *     name: {
 *       type: 'text',
 *       visibility: 'user',
 *       validation: { required: true, minLength: 3 }
 *     },
 *     // Customize technical field (optional)
 *     createdAt: {
 *       editable: 'admin',
 *       label: 'Created Date'
 *     }
 *   },
 *   // Override access defaults (optional)
 *   access: { create: 'guest' }  // Public inquiry form
 * });
 * ```
 *
 * **Technical Fields:**
 * - Automatically added: `id`, `createdAt`, `updatedAt`, `createdById`, `updatedById`, `status`
 * - Default: `visibility: 'technical'`, read-only in edit forms
 * - Customizable: Can override `editable`, `label`, `hint`, `validation` (merged with defaults)
 *
 * **Access Configuration:**
 * - Defaults: `{ read: 'guest', create: 'admin', update: 'admin', delete: 'admin' }`
 * - Uses role hierarchy: guest (0) < user (1) < admin (2) < super (3)
 * - Override individual operations: `access: { create: 'guest' }` for public forms
 * - Field visibility still applies for sensitive data filtering
 *
 * **Status Field (Draft/Publish/Delete):**
 * - Auto-added with `visibility: 'admin'` and options: `['draft', 'available', 'deleted']`
 * - Default value: `'available'` (new documents are published by default)
 * - `draft` and `deleted` statuses hidden from non-admin users (server-side filtering)
 * - `validation.required` on other fields only enforced when status !== 'draft'
 * - Extend options: `status: { validation: { options: [{ value: 'sold', label: 'sold' }] } }`
 * - Hide field: `status: { visibility: 'technical' }` if you don't want it in forms
 *
 * **Dropdown Options Format:**
 * - For `select`, `multiselect`, and `radio` field types, options must be defined in `validation.options`
 * - Options must be an array of objects with `value` (string) and `label` (string)
 * - Labels can use i18n keys (e.g., `'entities.product.status.active'`) for translation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function defineEntity<const F extends Record<string, EntityField>>(
  entity: Omit<BusinessEntity<F>, 'fields'> & { fields: F }
): Entity<MutableMergedEntityFieldMap<F>> {
  try {
    // Validate field names before any spread (prototype pollution guard)
    validateFieldNames(entity);

    // Validate form configuration
    validateFormConfig(entity);

    // Set default form configuration
    const formConfig = setDefaultFormConfig(entity);

    // Merge user fields with base fields (user fields take precedence for overrides)
    const mergedFields = {
      //consumer fields first
      ...entity.fields,
      //base fields next
      ...baseFields,
      // Override base fields if user provided them, preserving type/visibility
      ...(entity.fields.createdAt && {
        createdAt: {
          ...baseFields.createdAt,
          ...entity.fields.createdAt,
          type: baseFields.createdAt.type,
          visibility: baseFields.createdAt.visibility,
        },
      }),
      ...(entity.fields.updatedAt && {
        updatedAt: {
          ...baseFields.updatedAt,
          ...entity.fields.updatedAt,
          type: baseFields.updatedAt.type,
          visibility: baseFields.updatedAt.visibility,
        },
      }),
      ...(entity.fields.createdById && {
        createdById: {
          ...baseFields.createdById,
          ...entity.fields.createdById,
          type: baseFields.createdById.type,
          visibility: baseFields.createdById.visibility,
        },
      }),
      ...(entity.fields.updatedById && {
        updatedById: {
          ...baseFields.updatedById,
          ...entity.fields.updatedById,
          type: baseFields.updatedById.type,
          visibility: baseFields.updatedById.visibility,
        },
      }),
      // Status field: base defaults + consumer overrides (options always merged)
      ...(entity.fields.status && {
        status: {
          ...baseFields.status,
          ...entity.fields.status,
          validation: {
            ...baseFields.status.validation,
            ...entity.fields.status.validation,
            // Options always merged: base (draft/available/deleted) + consumer extras
            options: mergeStatusOptions(
              DEFAULT_STATUS_OPTIONS,
              entity.fields.status.validation?.options as
                | Array<{ value: string; label: string }>
                | undefined
            ),
          },
        } as EntityField<'select'>,
      }),
      // Scope field for multi-tenancy (auto-added if entity.scope is defined)
      ...(entity.scope && {
        [entity.scope.field]: createScopeField(entity.scope),
      }),
    };

    // Validate listFields if present (Fail Fast)
    if (entity.listFields) {
      const validFieldNames = new Set(Object.keys(mergedFields));
      const invalidFields = entity.listFields.filter(
        (field) => !validFieldNames.has(field)
      );

      if (invalidFields.length > 0) {
        throw handleError(
          new Error(
            `Entity '${entity.name}' defines listFields that do not exist: ${invalidFields.join(', ')}`
          ),
          {
            userMessage: `Entity '${entity.name}' defines listFields that do not exist: ${invalidFields.join(', ')}`,
            context: {
              entityName: entity.name,
              invalidFields,
              operation: 'defineEntity',
            },
            severity: 'error',
          }
        );
      }
    }

    // Validate listCardFields if present (Fail Fast) — supports string[] and ListCardLayout
    if (entity.listCardFields) {
      const validFieldNames = new Set(Object.keys(mergedFields));
      const cardFieldNames = getListCardFieldNames(entity);
      const invalidFields = cardFieldNames.filter(
        (field) => !validFieldNames.has(field)
      );

      if (invalidFields.length > 0) {
        throw handleError(
          new Error(
            `Entity '${entity.name}' defines listCardFields that do not exist: ${invalidFields.join(', ')}`
          ),
          {
            userMessage: `Entity '${entity.name}' defines listCardFields that do not exist: ${invalidFields.join(', ')}`,
            context: {
              entityName: entity.name,
              invalidFields,
              operation: 'defineEntity',
            },
            severity: 'error',
          }
        );
      }
    }

    // Validate uniqueKeys if present (Fail Fast)
    if (entity.uniqueKeys) {
      const validFieldNames = new Set(Object.keys(mergedFields));
      validateUniqueKeys(entity, validFieldNames);
    }

    // Merge access configuration with defaults
    const mergedAccess: Required<EntityAccessConfig> = {
      ...DEFAULT_ENTITY_ACCESS,
      ...(entity.access || {}),
    };

    // Set default namespace if not provided
    const namespace = entity.namespace || `entity-${entity.name.toLowerCase()}`;

    return {
      ...entity,
      form: formConfig,
      fields: mergedFields as Entity<MutableMergedEntityFieldMap<F>>['fields'],
      access: mergedAccess,
      namespace,
      ...(entity.search && { search: entity.search }),
      ...(entity.defaultSort && { defaultSort: entity.defaultSort }),
    } as Entity<MutableMergedEntityFieldMap<F>>;
  } catch (error) {
    throw handleError(error, {
      userMessage: `Failed to define entity '${entity.name}'`,
      context: {
        entityName: entity.name,
        operation: 'defineEntity',
      },
      severity: 'error',
    });
  }
}
