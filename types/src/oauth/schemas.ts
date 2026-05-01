// packages/core/types/src/oauth/schemas.ts

/**
 * @fileoverview OAuth Schema Definitions
 * @description Schema definitions for OAuth domain. Defines Valibot schemas for GitHub repository configuration, permission levels, and OAuth-related data structures.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';
import { GITHUB_PERMISSION_LEVELS } from './constants';
import type { OAuthPartnerId } from '../partners/schemas';
import type { OAuthPurpose } from './constants';

/**
 * Schema for GitHub repository configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const githubRepoConfigSchema = v.object({
  owner: v.pipe(v.string(), v.minLength(1, 'Repository owner is required')),
  repo: v.pipe(v.string(), v.minLength(1, 'Repository name is required')),
});

/**
 * Schema for GitHub access permission levels
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const githubPermissionSchema = v.picklist([
  ...GITHUB_PERMISSION_LEVELS,
] as [string, ...string[]]);

/**
 * Schema for granting GitHub repository access
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const grantGitHubAccessSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1, 'User ID is required')),
  githubUsername: v.pipe(
    v.string(),
    v.minLength(1, 'GitHub username is required')
  ),
  repoConfig: githubRepoConfigSchema,
  permission: v.optional(githubPermissionSchema, 'push'),
  customClaims: v.optional(v.record(v.string(), v.any())),
});

/**
 * Schema for revoking GitHub repository access
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const revokeGitHubAccessSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1, 'User ID is required')),
  githubUsername: v.pipe(
    v.string(),
    v.minLength(1, 'GitHub username is required')
  ),
  repoConfig: githubRepoConfigSchema,
});

/**
 * Schema for checking GitHub repository access
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const checkGitHubAccessSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1, 'User ID is required')),
  githubUsername: v.pipe(
    v.string(),
    v.minLength(1, 'GitHub username is required')
  ),
  repoConfig: githubRepoConfigSchema,
});

/**
 * TypeScript type exports for GitHub access schemas
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type GrantGitHubAccessRequest = v.InferOutput<
  typeof grantGitHubAccessSchema
>;

/**
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type RevokeGitHubAccessRequest = v.InferOutput<
  typeof revokeGitHubAccessSchema
>;

/**
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CheckGitHubAccessRequest = v.InferOutput<
  typeof checkGitHubAccessSchema
>;

// =============================================================================
// Core OAuth Schemas
// =============================================================================

/**
 * Schema for OAuth token exchange requests
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const exchangeTokenSchema = v.object({
  provider: v.string() as v.BaseSchema<
    unknown,
    OAuthPartnerId,
    v.BaseIssue<unknown>
  >,
  purpose: v.picklist(['authentication', 'api-access']) as v.BaseSchema<
    unknown,
    OAuthPurpose,
    v.BaseIssue<unknown>
  >,
  code: v.pipe(v.string(), v.minLength(1, 'Authorization code is required')),
  redirectUri: v.pipe(v.string(), v.url('Valid redirect URI is required')),
  codeVerifier: v.optional(v.string()),
  state: v.optional(v.string()),
  instance: v.optional(v.pipe(v.string(), v.url())),
});

/**
 * Schema for refreshing OAuth token
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const refreshTokenSchema = v.object({
  provider: v.string() as v.BaseSchema<
    unknown,
    OAuthPartnerId,
    v.BaseIssue<unknown>
  >,
  refreshToken: v.pipe(v.string(), v.minLength(1, 'Refresh token is required')),
  redirectUri: v.pipe(v.string(), v.url('Valid redirect URI is required')),
});

/**
 * Schema for disconnecting OAuth
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const disconnectOAuthSchema = v.object({
  provider: v.string() as v.BaseSchema<
    unknown,
    OAuthPartnerId,
    v.BaseIssue<unknown>
  >,
});

/**
 * Schema for getting OAuth connections
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const getConnectionsSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1, 'User ID is required')),
});
