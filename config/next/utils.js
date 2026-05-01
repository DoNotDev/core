/**
 * @fileoverview Next.js Config Utilities
 * @description Shared utility functions for Next.js configuration
 */

/**
 * Check if value is a plain object
 * @param {*} val - Value to check
 * @returns {boolean} True if plain object
 */
export function isPlainObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}
