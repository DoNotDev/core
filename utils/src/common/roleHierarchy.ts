// packages/core/utils/src/common/roleHierarchy.ts
/**

 * @fileoverview Role Hierarchy Utilities

 * @description Provides role-based access control with hierarchical permissions.

 * Implements a 4-level hierarchy: guest (0) < user (1) < admin (2) < super (3).

 *

 * **Hierarchy Rules:**

 * - Super can access: super, admin, user, and guest routes

 * - Admin can access: admin, user, and guest routes

 * - User can access: user and guest routes

 * - Guest can access: guest routes only

 *

 * **CSR/SSR/Server Safe:**

 * Pure function with no browser APIs or React dependencies.

 * Safe for use in Firebase Functions, API routes, and server-side rendering.

 *

 * @version 0.1.0

 * @since 0.0.1

 * @author AMBROISE PARK Consulting

 */

import { USER_ROLES } from '@donotdev/types';

const ROLE_HIERARCHY: Record<string, number> = {
  [USER_ROLES.GUEST]: 0,
  [USER_ROLES.USER]: 1,
  [USER_ROLES.ADMIN]: 2,
  [USER_ROLES.SUPER]: 3,
};

/**

 * Check if a user role has access to a required role based on hierarchy.

 *

 * Uses a 4-level hierarchy where higher roles inherit access to lower roles:

 * - Super (level 3) can access super, admin, user, and guest routes

 * - Admin (level 2) can access admin, user, and guest routes

 * - User (level 1) can access user and guest routes

 * - Guest (level 0) can access guest routes only

 *

 * Unknown roles default to level -1 (denied) for security.

 * Unknown required roles default to Infinity (always denied).

 *

 * @param userRole - The user's current role (e.g., 'super', 'admin', 'user', 'guest')

 * @param requiredRole - The role required to access the resource

 * @returns True if user has sufficient role level, false otherwise

 *

 * @example

 * ```typescript

 * // Admin accessing user route

 * hasRoleAccess('admin', 'user') // true

 *

 * // User accessing admin route

 * hasRoleAccess('user', 'admin') // false

 *

 * // Super accessing admin route

 * hasRoleAccess('super', 'admin') // true

 * ```

 *

 * @version 0.1.0

 * @since 0.0.1

 */

export function hasRoleAccess(
  userRole: string | undefined,
  requiredRole: string
): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] ?? -1;

  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? Infinity;

  return userLevel >= requiredLevel;
}

/**
 * Extract canonical role from auth claims
 *
 * Handles:
 * - 'role' claim (primary)
 * - Boolean flags (isAdmin, isSuper) (legacy/convenience)
 * - Fallbacks to USER_ROLES.USER
 *
 * @param claims - Auth claims object
 * @returns Canonical role string
 */
export function getRoleFromClaims(claims: Record<string, any>): string {
  if (!claims) return USER_ROLES.USER;

  if (claims.role === USER_ROLES.SUPER || claims.isSuper === true) {
    return USER_ROLES.SUPER;
  }

  if (claims.role === USER_ROLES.ADMIN || claims.isAdmin === true) {
    return USER_ROLES.ADMIN;
  }

  if (claims.role === USER_ROLES.USER) {
    return USER_ROLES.USER;
  }

  return (claims.role as string) || USER_ROLES.USER;
}
