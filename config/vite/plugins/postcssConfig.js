/**
 * @fileoverview Vite PostCSS Configuration
 * @description PostCSS configuration for Vite with workspace-aware package resolution.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import autoprefixer from 'autoprefixer';
import postcssImport from 'postcss-import';
import postcssNesting from 'postcss-nesting';

import { PathResolver } from '../../utils/PathResolver.js';
import { getPostCSSPlugins } from '../../utils/postcssConfig.js';

/**
 * Create PostCSS configuration for Vite
 * @param {Object} cssOptions - CSS options from user config (may contain postcss)
 * @returns {Object} PostCSS config object with plugins array (Vite css.postcss requires an object, NOT a function)
 */
export function createPostCSSConfig(cssOptions = {}) {
  // If user provided their own postcss config, use it directly
  if (cssOptions.postcss) {
    return cssOptions.postcss;
  }

  // Framework default: PostCSS plugins with workspace-aware resolution
  // Vite's css.postcss expects an object { plugins: [...] }, NOT a function
  const pathResolver = PathResolver.getInstance();

  // Custom resolve function using PathResolver.resolveFrameworkPackage
  // Handles Bun's .bun/, npm, pnpm, yarn workspaces automatically
  const customResolve = (id, basedir) => {
    // Try package resolution first (handles @donotdev/components/styles, etc.)
    const resolved = pathResolver.resolvePackage(id, basedir);
    if (resolved) {
      return resolved;
    }

    // For @donotdev/* packages, use resolveFrameworkPackage to find package root
    if (id.startsWith('@donotdev/')) {
      const packageName = id.split('/')[0] + '/' + id.split('/')[1];
      const subpath = id.split('/').slice(2).join('/');

      // Find package root using unified resolution
      const packageRoot = pathResolver.resolveFrameworkPackage(
        packageName,
        basedir
      );
      if (packageRoot) {
        // Try to resolve subpath within package
        if (subpath) {
          const subpathResolved = pathResolver.resolvePath(
            subpath,
            packageRoot
          );
          if (pathResolver.pathExists(subpathResolved)) {
            return subpathResolved;
          }
        }
      }
    }

    // Fallback to relative path resolution
    return pathResolver.resolvePath(id, basedir);
  };

  return getPostCSSPlugins({
    postcssImport,
    postcssNesting,
    autoprefixer,
    resolve: customResolve,
  });
}
