// packages/core/utils/src/client/partners/partnerUtils.ts

/**
 * @fileoverview Partner utilities for authentication and OAuth
 * @description Utilities for managing auth and OAuth partner configurations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import {
  AUTH_PARTNERS,
  OAUTH_PARTNERS,
  type AuthPartnerId,
  type OAuthPartnerId,
  type PartnerId,
  isAuthPartnerId,
  isOAuthPartnerId,
} from '@donotdev/types';

import { getPlatformEnvVar, getOAuthRedirectUrl, isDev } from '../appConfig';
import { isClient } from '../platformDetection';

// Partner schemas for validation
const basePartnerSchema = v.object({
  name: v.string(),
  color: v.string(),
  icon: v.string(),
  button: v.object({
    backgroundColor: v.string(),
    textColor: v.string(),
    borderColor: v.string(),
    hoverBackgroundColor: v.string(),
    focusOutlineColor: v.string(),
    fontWeight: v.optional(v.string(), '500'),
  }),
});

const authPartnerSchema = v.object({
  ...basePartnerSchema.entries,
  type: v.picklist(['auth', 'both']),
  scopes: v.optional(v.array(v.string())),
  firebaseProviderId: v.optional(v.string()),
});

// Helper for URL or empty string validation
const urlOrEmptyString = v.union([v.literal(''), v.pipe(v.string(), v.url())]);

const oauthEndpointsSchema = v.object({
  authUrl: urlOrEmptyString,
  tokenUrl: urlOrEmptyString,
  profileUrl: urlOrEmptyString,
  revokeUrl: v.optional(urlOrEmptyString),
});

const oauthScopesSchema = v.object({
  authentication: v.optional(v.array(v.string())),
  'api-access': v.array(v.string()),
});

const oauthPartnerSchema = v.object({
  ...basePartnerSchema.entries,
  type: v.picklist(['oauth', 'both']),
  scopes: oauthScopesSchema,
  endpoints: oauthEndpointsSchema,
});

/** Cache for enabled auth partners to prevent repeated computation */
let cachedEnabledAuthPartners: AuthPartnerId[] | null = null;

/** Cache for enabled OAuth partners to prevent repeated computation */
let cachedEnabledOAuthPartners: OAuthPartnerId[] | null = null;

/**
 * Get only valid auth partner IDs (pure discovery, no static structure)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getValidAuthPartnerIds(): AuthPartnerId[] {
  const validPartnerIds: AuthPartnerId[] = [];

  for (const [partnerId, config] of Object.entries(AUTH_PARTNERS)) {
    const validation = v.safeParse(authPartnerSchema, config);
    if (validation.success) {
      validPartnerIds.push(partnerId as AuthPartnerId);
    } else if (typeof window !== 'undefined' && isDev()) {
      console.warn(
        `Auth partner "${partnerId}" failed validation and will be excluded:`,
        validation.issues
      );
    }
  }

  return validPartnerIds;
}

/**
 * Get only valid OAuth partner IDs (pure discovery, no static structure)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getValidOAuthPartnerIds(): OAuthPartnerId[] {
  const validPartnerIds: OAuthPartnerId[] = [];

  for (const [partnerId, config] of Object.entries(OAUTH_PARTNERS)) {
    const validation = v.safeParse(oauthPartnerSchema, config);
    if (validation.success) {
      validPartnerIds.push(partnerId as OAuthPartnerId);
    } else if (typeof window !== 'undefined' && isDev()) {
      console.warn(
        `OAuth partner "${partnerId}" failed validation and will be excluded:`,
        validation.issues
      );
    }
  }

  return validPartnerIds;
}

/**
 * Dynamic config getter with validation (no static structure recreation)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getValidAuthPartnerConfig(partnerId: AuthPartnerId) {
  const config = AUTH_PARTNERS[partnerId];
  if (!config) return undefined;

  const validation = v.safeParse(authPartnerSchema, config);
  return validation.success ? config : undefined;
}

/**
 * Dynamic config getter with validation (no static structure recreation)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getValidOAuthPartnerConfig(partnerId: OAuthPartnerId) {
  const config = OAUTH_PARTNERS[partnerId];
  if (!config) return undefined;

  const validation = v.safeParse(oauthPartnerSchema, config);
  return validation.success ? config : undefined;
}

/**
 * Get enabled auth partners from environment variables
 * Computed once on first call, then cached permanently (like isDev/isClient)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns Array of enabled auth partners
 */
export function getEnabledAuthPartners(): AuthPartnerId[] {
  // Return cached result immediately (computed once, cached forever)
  if (cachedEnabledAuthPartners !== null) {
    return cachedEnabledAuthPartners;
  }

  // Compute once on first call (lazy initialization like isDev pattern)
  const envPartners = getPlatformEnvVar('AUTH_PARTNERS');

  if (!envPartners) {
    cachedEnabledAuthPartners = [];
    return cachedEnabledAuthPartners;
  }

  // Get valid partner IDs from schema
  const validPartnerIds = getValidAuthPartnerIds();

  const result = envPartners
    .split(',')
    .map((partner) => partner.trim().toLowerCase())
    .filter((partner) =>
      validPartnerIds.includes(partner as AuthPartnerId)
    ) as AuthPartnerId[];

  // Cache permanently (computed once, returned forever)
  cachedEnabledAuthPartners = result;

  return result;
}

/**
 * Get enabled OAuth partners from environment variables
 * @returns Array of enabled OAuth partners
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getEnabledOAuthPartners(): OAuthPartnerId[] {
  // Return cached result if available
  if (cachedEnabledOAuthPartners !== null) {
    return cachedEnabledOAuthPartners;
  }

  const envPartners = getPlatformEnvVar('OAUTH_PARTNERS');

  if (!envPartners) {
    cachedEnabledOAuthPartners = [];
    return [];
  }

  const validPartnerIds = getValidOAuthPartnerIds();

  const result = envPartners
    .split(',')
    .map((partner) => partner.trim().toLowerCase())
    .filter((partner) =>
      validPartnerIds.includes(partner as OAuthPartnerId)
    ) as OAuthPartnerId[];

  // Cache the result
  cachedEnabledOAuthPartners = result;
  return result;
}

/**
 * Get auth partner configuration (only if valid)
 * Lazily validates the partner before returning configuration
 *
 * @param partnerId Partner identifier
 * @returns Auth partner configuration or undefined if not found/invalid
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAuthPartnerConfig(partnerId: AuthPartnerId) {
  return getValidAuthPartnerConfig(partnerId);
}

/**
 * Get OAuth partner configuration (only if valid)
 * Lazily validates the partner before returning configuration
 *
 * @param partnerId Partner identifier
 * @returns OAuth partner configuration or undefined if not found/invalid
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getOAuthPartnerConfig(partnerId: OAuthPartnerId) {
  return getValidOAuthPartnerConfig(partnerId);
}

/**
 * Check if a partner is enabled for authentication
 *
 * @param partnerId Partner identifier
 * @returns True if the partner is enabled for authentication
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isAuthPartnerEnabled(partnerId: AuthPartnerId): boolean {
  const enabledPartners = getEnabledAuthPartners();
  return enabledPartners.includes(partnerId);
}

/**
 * Check if a partner is enabled for OAuth API access
 *
 * @param partnerId Partner identifier
 * @returns True if the partner is enabled for OAuth API access
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isOAuthPartnerEnabled(partnerId: OAuthPartnerId): boolean {
  const enabledPartners = getEnabledOAuthPartners();
  return enabledPartners.includes(partnerId);
}

/**
 * Get partner configuration based on ID, regardless of type
 *
 * @param partnerId Partner identifier (auth or OAuth)
 * @returns Partner configuration or undefined if not found
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getPartnerConfig(partnerId: PartnerId) {
  if (isAuthPartnerId(partnerId)) {
    return getAuthPartnerConfig(partnerId);
  } else if (isOAuthPartnerId(partnerId)) {
    return getOAuthPartnerConfig(partnerId);
  }
  return undefined;
}

/**
 * Get OAuth client ID from environment variables
 *
 * @param partnerId Partner identifier
 * @returns Client ID or undefined if not configured
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getOAuthClientId(
  partnerId: OAuthPartnerId
): string | undefined {
  // Convention: {PROVIDER}_CLIENT_ID (e.g., GITHUB_CLIENT_ID)
  return getPlatformEnvVar(`${partnerId.toUpperCase()}_CLIENT_ID`) || undefined;
}

/**
 * Get OAuth redirect URI from environment variables or use default
 * Simple, secure approach with single source of truth
 *
 * @param partnerId Partner identifier
 * @returns Redirect URI to use for OAuth flow
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getOAuthRedirectUri(partnerId: OAuthPartnerId): string {
  // 1. Check for explicit redirect URI (single source of truth)
  const redirectUri = getPlatformEnvVar(
    `${partnerId.toUpperCase()}_REDIRECT_URI`
  );
  if (redirectUri) {
    return redirectUri;
  }

  // 2. Framework default: normalized app URL + standard callback path
  return getOAuthRedirectUrl();
}

/**
 * Clear partner cache (useful for testing or when environment variables change)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function clearPartnerCache(): void {
  cachedEnabledAuthPartners = null;
  cachedEnabledOAuthPartners = null;
}

/**
 * Get cache status for debugging
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getPartnerCacheStatus() {
  return {
    authPartnersCached: cachedEnabledAuthPartners !== null,
    oauthPartnersCached: cachedEnabledOAuthPartners !== null,
    authPartners: cachedEnabledAuthPartners,
    oauthPartners: cachedEnabledOAuthPartners,
  };
}

/**
 * Get AuthPartnerId from Firebase provider ID
 * Uses AUTH_PARTNERS schema as single source of truth (DRY)
 *
 * @param firebaseProviderId - Firebase provider ID (e.g., 'google.com', 'github.com')
 * @returns AuthPartnerId or null if not found
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAuthPartnerIdByFirebaseId(
  firebaseProviderId: string
): AuthPartnerId | null {
  const partnerId = Object.keys(AUTH_PARTNERS).find(
    (id) =>
      AUTH_PARTNERS[id as AuthPartnerId].firebaseProviderId ===
      firebaseProviderId
  ) as AuthPartnerId | undefined;

  return partnerId || null;
}
