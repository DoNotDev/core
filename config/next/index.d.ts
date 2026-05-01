// packages/core/config/next/index.d.ts

/**
 * @fileoverview Next.js Configuration Type Definitions
 * @description TypeScript type definitions for Next.js configuration.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Re-export only the function signature and types, not all types (avoids circular dependency)
export type { NextConfigOptions } from '../index.js';
export { defineNextConfig } from '../index.js';

/**
 * Create PostCSS configuration for Next.js consumer apps.
 * Handles @fontsource CSS alias and workspace-aware package resolution.
 *
 * @example
 * ```js
 * // postcss.config.js
 * import { definePostCSSConfig } from '@donotdev/core/next';
 * export default definePostCSSConfig();
 * ```
 */
export function definePostCSSConfig(): Promise<{ plugins: Array<unknown> }>;

/**
 * Next.js Metadata object (simplified)
 */
interface NextMetadata {
  title?: string;
  description?: string;
  keywords?: string | string[];
  openGraph?: {
    title?: string;
    description?: string;
    type?: string;
    images?: string[];
    siteName?: string;
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image';
    title?: string;
    description?: string;
    images?: string[];
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
  };
}

/**
 * Get Next.js Metadata object for a given path.
 * Reads pre-built metadata from manifest generated at build time.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { getMetadataForPath } from '@donotdev/core/next';
 *
 * export async function generateMetadata() {
 *   return getMetadataForPath('/');
 * }
 * ```
 *
 * @param path - Route path (e.g., '/', '/about')
 * @param locale - Current locale (defaults to manifest's defaultLocale)
 * @param options - Additional options
 */
export function getMetadataForPath(
  path: string,
  locale?: string,
  options?: { siteName?: string }
): NextMetadata;

/**
 * Clear the metadata manifest cache.
 * Useful for development hot-reload scenarios.
 */
export function clearMetadataCache(): void;
