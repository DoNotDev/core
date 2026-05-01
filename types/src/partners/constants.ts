// packages/core/types/src/partners/constants.ts

/**
 * @fileoverview Partners Constants
 * @description Constants for partners domain. Defines partner icon mappings and partner-related constants.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Partner icon constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const PARTNER_ICONS = {
  apple: 'apple',
  discord: 'discord',
  emailLink: 'emailLink',
  facebook: 'facebook',
  github: 'github',
  google: 'google',
  linkedin: 'linkedin',
  microsoft: 'microsoft',
  password: 'password',
  reddit: 'reddit',
  spotify: 'spotify',
  twitch: 'twitch',
  twitter: 'twitter',
  yahoo: 'yahoo',
  notion: 'notion',
  slack: 'slack',
  medium: 'medium',
  mastodon: 'mastodon',
  youtube: 'youtube',
} as const;

/**
 * Partner icon ID type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PartnerIconId = keyof typeof PARTNER_ICONS;
