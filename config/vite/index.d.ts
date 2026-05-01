// packages/core/config/vite/index.d.ts

/**
 * @fileoverview Vite Configuration Type Definitions
 * @description TypeScript type definitions for Vite configuration.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Re-export only the function signature, not all types (avoids circular dependency)
export type { ConfigOptions } from '../index.js';
export { defineViteConfig } from '../index.js';
