// ----- config/src/next/index.js -----
/**
 * @fileoverview Next.js configuration index
 * @description Next.js-specific adapters and configuration. Provides defineNextConfig for Next.js build tool configuration.
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Main configuration
import defineNextConfig from './config.js';
export { defineNextConfig };
export { default } from './config.js';

// PostCSS configuration for consumer postcss.config.js
export { definePostCSSConfig } from './postcss.js';

// Server-side SEO utilities
export {
  getMetadataForPath,
  clearMetadataCache,
} from './getMetadataForPath.js';
