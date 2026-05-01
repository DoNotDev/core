/**
 * @fileoverview PostCSS Configuration - Shared Utility
 * @description Shared PostCSS plugin configuration for both Vite and Next.js. Provides default plugin setup with workspace-aware resolution.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Get default PostCSS plugins configuration
 * @param {Object} options - Plugin options
 * @param {Function} options.postcssImport - postcss-import plugin instance
 * @param {Function} options.postcssNesting - postcss-nesting plugin instance
 * @param {Function} options.autoprefixer - autoprefixer plugin instance
 * @param {Function} options.resolve - Custom resolve function (optional, for Vite workspace resolution)
 * @returns {Object} PostCSS plugins configuration
 */
export function getPostCSSPlugins({
  postcssImport,
  postcssNesting,
  autoprefixer,
  resolve,
}) {
  return {
    plugins: [
      resolve ? postcssImport({ resolve }) : postcssImport,
      postcssNesting,
      autoprefixer({
        overrideBrowserslist: [
          '> 1%',
          'last 2 versions',
          'Firefox ESR',
          'not dead',
          'not op_mini all',
        ],
        grid: 'autoplace',
      }),
    ],
  };
}
