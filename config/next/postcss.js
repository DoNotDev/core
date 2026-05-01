/**
 * @fileoverview PostCSS Configuration for Next.js
 * @description PostCSS configuration for Next.js with workspace-aware package resolution.
 * Handles @fontsource CSS alias: Turbopack resolveAlias doesn't work for CSS @import,
 * so we redirect @donotdev/ui/dndev.css → dndev-next.css here instead.
 * Fonts are served from public/dndev-fonts.css (see copyFontsToPublic + FontPreloadLinks).
 */

import { PathResolver } from '../utils/PathResolver.js';
import { getPostCSSPlugins } from '../utils/postcssConfig.js';

/**
 * CSS imports that must be aliased in Next.js.
 * Turbopack resolveAlias is JS-only — CSS @import aliases live here.
 * @type {Record<string, string>}
 */
const NEXT_CSS_ALIASES = {
  '@donotdev/ui/dndev.css': '@donotdev/ui/dndev-next.css',
};

/**
 * CSS import resolver for postcss-import using PathResolver.
 * Applies Next.js CSS aliases and handles workspace-aware resolution.
 * Must be synchronous (postcss-import requirement).
 *
 * @param {PathResolver} pathResolver
 * @returns {(id: string, basedir: string) => string}
 */
function createCSSResolver(pathResolver) {
  return (id, basedir) => {
    // Apply Next.js CSS aliases (font CSS redirect)
    if (NEXT_CSS_ALIASES[id]) {
      id = NEXT_CSS_ALIASES[id];
    }

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
