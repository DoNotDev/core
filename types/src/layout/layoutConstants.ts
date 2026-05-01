// packages/core/types/src/layout/layoutConstants.ts

/**
 * @fileoverview Layout Constants
 * @description Shared constants and derived types used by both layoutTypes and presetConfig.
 * Extracted to break circular dependency.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Default layout preset - single source of truth
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DEFAULT_LAYOUT_PRESET = 'landing' as const;

/**
 * Footer mode constants - DRY single source of truth
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const FOOTER_MODE = {
  FIXED: 'fixed',
  SCROLL: 'scroll',
} as const;

/**
 * Footer mode type - auto-derived from constants
 */
export type FooterMode = (typeof FOOTER_MODE)[keyof typeof FOOTER_MODE];

/**
 * Layout preset constants - DRY single source of truth
 * Use these instead of hardcoded strings throughout the codebase
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const LAYOUT_PRESET = {
  ADMIN: 'admin',
  BLOG: 'blog',
  DOCS: 'docs',
  GAME: 'game',
  LANDING: 'landing',
  MOOLTI: 'moolti',
  PLAIN: 'plain',
} as const;

/**
 * Layout preset type - auto-derived from constants, with string fallback
 * Accepts known presets OR any string (runtime validates and defaults to 'landing')
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type LayoutPreset =
  | (typeof LAYOUT_PRESET)[keyof typeof LAYOUT_PRESET]
  | string;
