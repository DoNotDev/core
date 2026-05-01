// packages/core/types/src/oauth/constants.ts

/**
 * @fileoverview OAuth Constants
 * @description Constants for OAuth domain. Defines GitHub repository permission levels and OAuth-related constants.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * GitHub repository permission levels (runtime constants)
 * Keep in sync with GitHub API scopes/permissions.
 */
export const GITHUB_PERMISSION_LEVELS = [
  'pull',
  'push',
  'admin',
  'maintain',
  'triage',
] as const;

/**
 * OAuth purpose type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthPurpose = 'authentication' | 'api-access';
