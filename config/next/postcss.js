/**
 * @fileoverview PostCSS Configuration for Next.js
 * @description PostCSS configuration for Next.js with workspace-aware package resolution.
 * No font goes through CSS: the font plan (fonts/buildFontPlan.js) ships the theme's
 * fonts as head tags (FontHead), so `@donotdev/ui/dndev.css` is the same file on both bundlers.
 */

import { PathResolver } from '../utils/PathResolver.js';
import { getPostCSSPlugins } from '../utils/postcssConfig.js';

/**
 * CSS import resolver for postcss-import using PathResolver: workspace-aware resolution.
 * Must be synchronous (postcss-import requirement).
 *
 * @param {PathResolver} pathResolver
 * @returns {(id: string, basedir: string) => string}
 */
function createCSSResolver(pathResolver) {
  return (id, basedir) => {
    // Try package resolution first
    const resolved = pathResolver.resolvePackage(id, basedir);
    if (resolved) return resolved;

    // For @donotdev/* packages, use resolveFrameworkPackage
    if (id.startsWith('@donotdev/')) {
      const packageName = id.split('/')[0] + '/' + id.split('/')[1];
      const subpath = id.split('/').slice(2).join('/');

      const packageRoot = pathResolver.resolveFrameworkPackage(
        packageName,
        basedir
      );
      if (packageRoot) {
        if (subpath) {
          const subpathResolved = pathResolver.resolvePath(
            subpath,
            packageRoot
          );
          if (pathResolver.pathExists(subpathResolved)) return subpathResolved;
          const cssPath = subpathResolved + '.css';
          if (pathResolver.pathExists(cssPath)) return cssPath;
        }
        const indexPath = pathResolver.resolvePath('index.css', packageRoot);
        if (pathResolver.pathExists(indexPath)) return indexPath;
      }
    }

    // Default: relative path resolution
    return pathResolver.resolvePath(id, basedir);
  };
}

/**
 * Create PostCSS configuration for Next.js consumer apps.
 * Use in postcss.config.js: `export default definePostCSSConfig();`
 *
 * @returns {Promise<{plugins: Array}>} PostCSS config object
 */
export async function definePostCSSConfig() {
  const [postcssImport, postcssNesting, autoprefixer] = await Promise.all([
    import('postcss-import').then((m) => m.default),
    import('postcss-nesting').then((m) => m.default),
    import('autoprefixer').then((m) => m.default),
  ]);

  const pathResolver = PathResolver.getInstance();

  return getPostCSSPlugins({
    postcssImport,
    postcssNesting,
    autoprefixer,
    resolve: createCSSResolver(pathResolver),
  });
}

/**
 * Create PostCSS configuration for Next.js (internal, called from configBuilder).
 * @param {Object} options - Options
 * @param {Object} options.cssOptions - CSS options from user config (may contain postcss)
 * @returns {Function|Object} PostCSS config
 */
export function createPostCSSConfig(cssOptions = {}) {
  if (cssOptions?.postcss) {
    return cssOptions.postcss;
  }

  return async () => {
    const [postcssImport, postcssNesting, autoprefixer] = await Promise.all([
      import('postcss-import').then((m) => m.default),
      import('postcss-nesting').then((m) => m.default),
      import('autoprefixer').then((m) => m.default),
    ]);

    const pathResolver = PathResolver.getInstance();

    return getPostCSSPlugins({
      postcssImport,
      postcssNesting,
      autoprefixer,
      resolve: createCSSResolver(pathResolver),
    });
  };
}
