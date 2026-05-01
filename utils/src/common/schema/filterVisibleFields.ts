// packages/core/utils/src/common/schema/filterVisibleFields.ts

/**
 * @fileoverview Field visibility filter utility
 * @description Filters document fields based on visibility and user role using a Valibot schema.
 *
 * Uses 6-level hierarchical visibility system:
 *
 * Hierarchy: guest < user < admin < super
 *
 * - `guest`: Everyone (including unauthenticated)
 * - `user`: Authenticated users (see guest + user)
 * - `admin`: Admins (see guest + user + admin)
 * - `super`: Super admins (see guest + user + admin + super)
 * - `technical`: System fields (admins+ only, read-only in forms)
 * - `hidden`: Never exposed to client
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { dndevSchema, UserRole } from '@donotdev/types';

import { getVisibleFields } from './getVisibleFields';

import type { GetVisibleFieldsOptions } from './getVisibleFields';
import type * as v from 'valibot';

/**
 * Options for owner-level visibility (per-document check).
 * Pass documentData, uid, and ownership so fields with visibility: 'owner' are included when uid matches an owner field.
 */
export type FilterVisibleFieldsOptions = GetVisibleFieldsOptions;

/**
 * Filters the fields of a data object based on visibility rules defined
 * in a Valibot schema and the user's role. When options (documentData, uid, ownership)
 * are provided, fields with visibility: 'owner' are included only if uid matches
 * one of ownership.ownerFields in documentData.
 *
 * @template T - The expected type of the data object
 * @param data - The document data object to filter
 * @param schema - The Valibot schema with visibility metadata on each field
 * @param userRole - The current user's role (guest, user, admin, super)
 * @param options - Optional: documentData, uid, ownership for owner-level visibility
 * @returns A new object containing only the fields visible to the user
 */
export function filterVisibleFields<T extends Record<string, any>>(
  data: T | null | undefined,
  schema: v.BaseSchema<unknown, any, v.BaseIssue<unknown>> | dndevSchema<any>,
  userRole: UserRole,
  options?: FilterVisibleFieldsOptions
): Partial<T> {
  if (!data) {
    return {};
  }

  const visibilityOptions =
    options?.uid != null && options?.ownership != null
      ? {
          documentData:
            options.documentData ?? (data as Record<string, unknown>),
          uid: options.uid,
          ownership: options.ownership,
        }
      : undefined;

  const visibleFieldNames = getVisibleFields(
    schema,
    userRole,
    visibilityOptions
  );

  const result: Partial<T> = {};

  for (const key of visibleFieldNames) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      result[key as keyof T] = data[key as keyof T];
    }
  }

  return result;
}
