// packages/core/i18n/src/flags/index.ts

/**
 * @fileoverview Flag assets package barrel exports
 * @description Barrel exports for flag components and utilities. Provides access to the Flag component and utility functions for working with country flag codes.
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { LANGUAGES } from '../utils/constants';

// Export types from raw
export type { FlagBaseProps } from './raw/FlagBase';

// Export the convenience component
export { Flag } from './Flag';

// Utility function to get all available flag codes
// Derived from LANGUAGES - single source of truth
// Uses flagCode if provided, otherwise falls back to id
export function getFlagCodes(): string[] {
  const flagCodes = new Set<string>();
  LANGUAGES.forEach((lang) => {
    flagCodes.add(lang.flagCode || lang.id);
  });
  return Array.from(flagCodes);
}

// Utility function to check if a flag code exists
export function hasFlag(code: string): boolean {
  return getFlagCodes().includes(code.toLowerCase());
}
