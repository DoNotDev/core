// packages/core/utils/src/common/schema/getVisibleFields.ts

/**
 * @fileoverview Field visibility utility
 * @description Extracts visible field names from a Valibot schema based on user role.
 *
 * Uses 6-level hierarchical visibility system (leverages hasRoleAccess):
 *
 * Hierarchy: guest < user < admin < super
 *
 * - `guest`: Everyone (including unauthenticated)
 * - `user`: Authenticated users (see guest + user)
 * - `admin`: Admins (see guest + user + admin)
 * - `super`: Super admins (see guest + user + admin + super)
 * - `technical`: System fields (admins+ only, read-only in forms)
 * - `hidden`: Never exposed to client
 * - `owner`: Visible only when request.auth.uid matches one of entity.ownership.ownerFields on the document (requires options)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type * as v from 'valibot';

import type {
  dndevSchema,
  EntityOwnershipConfig,
  Visibility,
  UserRole,
} from '@donotdev/types';

import { hasRoleAccess } from '../roleHierarchy';

/**
 * Type for Valibot schema with custom visibility property
 */
interface ValibotSchemaWithVisibility extends v.BaseSchema<
  unknown,
  any,
  v.BaseIssue<unknown>
> {
  visibility?: Visibility;
}

/**
 * Type guard to check if a schema has visibility property
 */
function hasVisibility(schema: unknown): schema is ValibotSchemaWithVisibility {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'visibility' in schema &&
    typeof (schema as any).visibility === 'string'
  );
}

/**
 * Safely extracts the visibility setting from a Valibot field schema.
 *
 * @param field - A Valibot schema field
 * @returns The visibility setting if found, otherwise undefined
 */
function getFieldVisibility(
  field: v.BaseSchema<unknown, any, v.BaseIssue<unknown>>
): Visibility | undefined {
  if (hasVisibility(field)) {
    return field.visibility;
  }
  return undefined;
}

/**
 * Determines if a field should be visible based on its visibility setting
 * and the user's role.
 *
 * Uses hasRoleAccess for hierarchical check:
 * - guest < user < admin < super
 *
 * Special cases:
 * - `technical`: Visible to admin and super only (read-only in forms)
 * - `hidden`: Never visible
 * - undefined: Treated as `guest` (visible to all)
 *
 * @param visibility - The field's visibility setting
 * @param userRole - The current user's role
 * @returns True if the field should be visible
 */
export function isFieldVisible(
  visibility: Visibility | undefined,
  userRole: UserRole
): boolean {
  const level = visibility ?? 'guest';

  // Hidden fields never visible
  if (level === 'hidden') {
    return false;
  }

  // Technical fields visible to admin and super only
  if (level === 'technical') {
    return hasRoleAccess(userRole, 'admin');
  }

  // Owner: requires options (documentData, uid, ownership) - handled in getVisibleFields
  if (level === 'owner') {
    return false; // Without options, owner fields are not visible
  }

  // Use hierarchical role access for standard visibility levels
  return hasRoleAccess(userRole, level);
}

/**
 * Options for owner-level visibility (per-document check).
 */
export interface GetVisibleFieldsOptions {
  documentData?: Record<string, unknown>;
  uid?: string;
  ownership?: EntityOwnershipConfig;
}

function isOwnerVisible(
  documentData: Record<string, unknown>,
  uid: string,
  ownership: EntityOwnershipConfig
): boolean {
  for (const field of ownership.ownerFields) {
    const value = documentData[field];
    if (value === uid) return true;
  }
  return false;
}

/**
 * Extracts the names of all fields from a Valibot object schema that should be visible
 * based on the user's role and optional ownership context (for visibility: 'owner').
 *
 * @param schema - The Valibot schema, expected to be an object schema (v.object)
 * @param userRole - The current user's role (guest, user, admin, super)
 * @param options - Optional: documentData, uid, ownership for owner-level visibility
 * @returns An array of visible field names
 */
export function getVisibleFields(
  schema: v.BaseSchema<unknown, any, v.BaseIssue<unknown>> | dndevSchema<any>,
  userRole: UserRole,
  options?: GetVisibleFieldsOptions
): string[] {
  const schemaAny = schema as any;
  if (!schemaAny || typeof schemaAny !== 'object' || !schemaAny.entries) {
    console.warn(
      'getVisibleFields expects a Valibot object schema (v.object).'
    );
    return [];
  }

  const entries = schemaAny.entries as Record<
    string,
    v.BaseSchema<unknown, any, v.BaseIssue<unknown>>
  >;
  const visibleFieldNames: string[] = [];
  const { documentData, uid, ownership } = options ?? {};
  const showOwnerFields =
    ownership &&
    uid != null &&
    documentData &&
    isOwnerVisible(documentData, uid, ownership);

  for (const [key, field] of Object.entries(entries)) {
    const visibility = getFieldVisibility(field);
    if (visibility === 'owner') {
      if (showOwnerFields) visibleFieldNames.push(key);
      continue;
    }
    if (isFieldVisible(visibility, userRole)) {
      visibleFieldNames.push(key);
    }
  }

  return visibleFieldNames;
}
