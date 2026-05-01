// packages/core/utils/src/client/auth/getProviderColor.ts

/**
 * @fileoverview Provider color utility
 * @description Returns the brand color for an authentication provider
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { AuthPartnerId } from '@donotdev/types';
import { AUTH_PARTNERS } from '@donotdev/types';

/**
 * Defines the primary brand colors associated with each authentication provider.
 * Uses schema discovery to get colors from AUTH_PARTNERS, with fallbacks for missing colors.
 */
const PROVIDER_COLOR_OVERRIDES: Partial<Record<AuthPartnerId, string>> = {
  // Override any schema colors if needed for better UI consistency
  microsoft: '#F25022', // Microsoft Orange (part of their logo)
  yahoo: '#6001D2', // Yahoo Purple
  apple: '#000000', // Apple Black
  facebook: '#1877F2', // Facebook Blue (official brand color)
  twitter: '#000000', // Twitter/X Black (official brand color)
};

/**
 * Get provider color using schema discovery with fallbacks
 */
function getProviderColorFromSchema(partnerId: AuthPartnerId): string {
  // First check for manual overrides
  if (PROVIDER_COLOR_OVERRIDES[partnerId]) {
    return PROVIDER_COLOR_OVERRIDES[partnerId]!;
  }

  // Then check schema for color
  const partner = AUTH_PARTNERS[partnerId];
  if (partner?.color) {
    return partner.color;
  }

  // Default fallback
  return DEFAULT_COLOR;
}

/**
 * Default color to use if a provider is not found in the map.
 */
const DEFAULT_COLOR = '#333333'; // A neutral dark grey

/**
 * Returns the primary brand color associated with the specified authentication provider.
 * Uses schema discovery to support all AUTH_PARTNERS automatically.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * If the provider color is not found, it returns a default color.
 *
 * @param {AuthPartnerId} provider - The identifier for the authentication provider (e.g., 'google', 'facebook').
 * @returns {string} The brand color as a hexadecimal string (e.g., '#1877F2').
 */
export function getProviderColor(provider: AuthPartnerId): string {
  return getProviderColorFromSchema(provider);
}
