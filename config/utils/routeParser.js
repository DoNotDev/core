/**
 * @fileoverview Route Parser - Shared Route Manifest Parsing
 * @description Parses route data from public/route-manifest.json (written by both Vite and Next.js).
 * Single source of truth for route manifest parsing — used by SEOPlugin, PrerenderPlugin, and LlmsTxtGenerator.
 *
 * @version 0.0.1
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from './PathResolver.js';

/**
 * Parse YAML frontmatter from a markdown string.
 * @param {string} raw - Raw markdown content
 * @returns {Object} Parsed key-value pairs
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return meta;
}

/**
 * Expand dynamic blog routes (/blog/:slug) into concrete route objects
 * with SEO metadata from markdown frontmatter.
 * @param {Array} routes - Parsed route objects
 * @param {Object} [options]
 * @param {string} [options.appRoot] - App root directory
 * @param {string} [options.blogPath='/blog'] - Blog URL prefix
 * @returns {Array<{path: string, auth: false, meta: Object}>} Expanded route objects with frontmatter SEO
 */
export function expandBlogRoutes(routes, options = {}) {
  const { blogPath = '/blog' } = options;
  const pathResolver = PathResolver.getInstance();
  const appRoot = options.appRoot || pathResolver.getAppRoot();

  // Find if there's a dynamic blog route pattern
  const hasBlogRoute = routes.some((r) => {
    const path = r.path || r;
    return (
      typeof path === 'string' &&
      path.startsWith(blogPath + '/') &&
      path.includes(':')
    );
  });

  if (!hasBlogRoute) return [];

  // Discover blog posts from src/content/blog/
  try {
    const blogDir = pathResolver.resolvePath('src/content/blog', appRoot);
    if (!pathResolver.pathExists(blogDir)) return [];

    const files = pathResolver
      .readdirSync(blogDir)
      .filter((f) => f.endsWith('_en.md'));
    if (files.length === 0) return [];

    const expanded = [
      { path: blogPath, auth: false, meta: { namespace: 'blog' } },
    ];

    for (const file of files) {
      const slug = file.replace(/_en\.md$/, '');
      const filePath = pathResolver.resolvePath(file, blogDir);
      const raw = pathResolver.readSync(filePath, { format: 'text' });
      const fm = raw ? parseFrontmatter(raw) : {};

      expanded.push({
        path: `${blogPath}/${slug}`,
        auth: false,
        meta: {
          namespace: 'blog',
          seo: {
            title: fm.title || slug,
            description: fm.description || null,
            image: fm.image || null,
            type: 'article',
          },
        },
      });
    }

    return expanded;
  } catch {
    return [];
  }
}

/**
 * Parse routes from the canonical JSON route manifest (public/route-manifest.json).
 * Both Vite and Next.js write this file during build — single source of truth.
 * @param {Object} [options]
 * @param {string} [options.appRoot] - App root directory (defaults to PathResolver)
 * @param {Object} [options.logger] - Logger instance
 * @returns {{ routes: Array, errors: string[], source: string }}
 */
export function parseRouteManifest(options = {}) {
  const { logger } = options;
  const pathResolver = PathResolver.getInstance();
  const appRoot = options.appRoot || pathResolver.getAppRoot();

  try {
    const manifestPath = pathResolver.resolvePath(
      'public/route-manifest.json',
      appRoot
    );
    const manifestContent = pathResolver.readSync(manifestPath, {
      format: 'json',
    });

    if (!manifestContent) {
      logger?.error?.(
        `Route manifest not found at ${manifestPath}. Routes will be empty.`
      );
      return {
        routes: [],
        errors: [`Route manifest missing: ${manifestPath}`],
        source: 'fallback',
      };
    }

    const routes = manifestContent.routes || [];

    return {
      routes,
      errors: [],
      source: manifestContent.source || 'generated',
      totalFiles: routes.length,
    };
  } catch (error) {
    logger?.warn?.(
      `Error parsing route manifest: ${error.message}, falling back to empty routes`
    );
    return { routes: [], errors: [error.message], source: 'fallback' };
  }
}

/**
 * Filter routes to only public (non-auth, non-dynamic) routes
 * @param {Array} routes - Parsed route objects
 * @returns {string[]} Array of public route paths
 */
export function getPublicStaticRoutes(routes) {
  return routes
    .filter((route) => {
      const path = route.path || route;
      // Skip auth-protected routes
      if (route.auth && route.auth.required) return false;
      // Skip dynamic :param routes
      if (typeof path === 'string' && path.includes(':')) return false;
      return true;
    })
    .map((route) => route.path || route);
}
