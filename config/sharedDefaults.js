/**
 * @fileoverview Shared Default Options
 * @description Platform-agnostic defaults shared between Vite and Next.js configurations.
 * SSOT: add shared defaults HERE, not in vite/options.js or next/options.js.
 * Platform-specific defaults stay in their respective options.js files.
 *
 * @version 0.0.1
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

/**
 * Shared defaults for options that are identical across Vite and Next.js.
 * Both vite/options.js and next/options.js spread these into their DEFAULT_OPTIONS.
 */
export const SHARED_DEFAULTS = {
  /**
   * Debug logging (opt-in)
   * - Detailed troubleshooting: individual file operations, timing, internal operations
   * - Default: false (hidden by default)
   */
  debug: false,
  /**
   * Verbose logging (opt-out)
   * - Configuration/search paths: WHERE we're looking (PathResolver values, resolved paths)
   * - NOT individual discovered items (those are debug level)
   * - Default: true (shown by default), auto-disabled in CI for clean logs
   */
  verbose: process.env.CI !== 'true',

  /** SEO options — shared across Vite and Next.js */
  seo: {
    disabled: false, // Opt-out: set to true to disable SEO plugin (if managing files manually)
    generateRobotsTxt: true,
    generateSitemap: true,
    crawlDelay: 1,
    // SEO/GEO features — all ON by default, opt-out per feature
    aiCrawlers: 'recommended', // 'recommended' | 'block-all' | 'allow-all' | false
    llmsTxt: true, // false to disable
    speculationRules: true, // false to disable
    hreflang: true, // false to disable (only emits if i18n has 2+ languages)
    breadcrumbSchema: true, // false to disable
    websiteSchema: true, // false to disable
    organizationSchema: true, // false to disable (homepage only, requires app.links)
  },

  /** Server shim options */
  serverShim: {
    enabled: true,
  },

  /** Discovery options */
  discovery: {
    verbose: true,
    cacheTimeout: 60000, // 1 minute default
    fileLogging: false,
    logDir: '.dndev-logs',
  },

  /** Features configuration */
  features: {},
};
