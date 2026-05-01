// packages/core/utils/src/common/tierHierarchy.ts
/**

 * @fileoverview Tier Hierarchy Utilities

 * @description Provides subscription tier-based access control with hierarchical permissions.

 * Uses tier levels from SubscriptionConfig (apps define their own) with COMMON_TIER_CONFIGS as fallback.

 *

 * **Hierarchy Rules:**

 * Higher tier levels inherit access to lower tier levels:

 * - Tier with level 2 can access tiers with level 2, 1, and 0

 * - Tier with level 1 can access tiers with level 1 and 0

 * - Tier with level 0 can access tier with level 0 only

 *

 * **CSR/SSR/Server Safe:**

 * Pure function with no browser APIs or React dependencies.

 * Safe for use in Firebase Functions, API routes, and server-side rendering.

 *

 * @version 0.1.0

 * @since 0.0.1

 * @author AMBROISE PARK Consulting

 */

import { COMMON_TIER_CONFIGS } from '@donotdev/types';
import type { SubscriptionConfig } from '@donotdev/types';

/**

 * Check if a user tier has access to a required tier based on hierarchy.

 *

 * Uses tier levels from the provided config (or COMMON_TIER_CONFIGS as fallback).

 * Higher tier levels inherit access to lower tier levels.

 *

 * Unknown tiers default to level -1 (denied) for security.

 * Unknown required tiers default to Infinity (always denied).

 *

 * @param userTier - The user's current tier (e.g., 'pro', 'free', 'ai')

 * @param requiredTier - The tier required to access the resource

 * @param tierConfig - Optional custom tier configuration. If not provided, uses COMMON_TIER_CONFIGS

 * @returns True if user has sufficient tier level, false otherwise

 *

 * @example

 * ```typescript

 * // Pro accessing free route

 * hasTierAccess('pro', 'free') // true

 *

 * // Free accessing pro route

 * hasTierAccess('free', 'pro') // false

 *

 * // With custom config

 * const customConfig = {

 *   basic: { features: [], level: 0 },

 *   premium: { features: [], level: 1 }

 * };

 * hasTierAccess('premium', 'basic', customConfig) // true

 * ```

 *

 * @version 0.1.0

 * @since 0.0.1

 */

export function hasTierAccess(
  userTier: string | undefined,

  requiredTier: string,

  tierConfig?: SubscriptionConfig['tiers']
): boolean {
  if (!userTier) return false;

  // Normalize to Record<string, ...> to allow string indexing
  const config: Record<string, { features: string[]; level: number }> =
    tierConfig ?? COMMON_TIER_CONFIGS;

  const userLevel = config[userTier]?.level ?? -1;
  const requiredLevel = config[requiredTier]?.level ?? Infinity;

  return userLevel >= requiredLevel;
}
