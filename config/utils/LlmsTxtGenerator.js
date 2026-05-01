/**
 * @fileoverview llms.txt Generator
 * @description Build-time generation of llms.txt per llmstxt.org spec.
 * Sources: route manifest (titles + descriptions), blog posts, appConfig name/description.
 *
 * @version 0.0.1
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from './PathResolver.js';
import { parseRouteManifest } from './routeParser.js';

/**
 * Generate llms.txt content per llmstxt.org specification
 * @param {Object} options
 * @param {string} options.siteName - Site/app name
 * @param {string} options.baseUrl - Base URL (e.g. https://example.com)
 * @param {string} [options.description] - Site description
 * @param {string} [options.appRoot] - App root for route discovery
 * @param {Array} [options.blogPosts] - Pre-discovered blog posts
 * @param {Object} [options.logger] - Logger instance
 * @returns {string} llms.txt content
 */
export function generateLlmsTxt(options = {}) {
  const {
    siteName,
    baseUrl,
    description,
    blogPosts = [],
    blogPath = '/blog',
    logger,
  } = options;

  if (!siteName || !baseUrl) {
    logger?.warn?.('llms.txt generation skipped: missing siteName or baseUrl');
    return null;
  }

  // Parse route manifest for page titles/descriptions
  const routeData = parseRouteManifest({ appRoot: options.appRoot, logger });
  const routes = routeData.routes || [];

  const lines = [];

  // Header (required by spec)
  lines.push(`# ${siteName}`);
  lines.push('');

  // Description
  if (description) {
    lines.push(`> ${description}`);
    lines.push('');
  }

  // Pages section
  const publicRoutes = routes.filter((r) => !r.auth || r.auth === false);

  if (publicRoutes.length > 0) {
    lines.push('## Pages');
    lines.push('');
    for (const route of publicRoutes) {
      const path = route.path || '/';
      const title = route.meta?.title || formatPathAsTitle(path);
      const desc = route.meta?.description || '';
      const url = `${baseUrl}${path}`;
      if (desc) {
        lines.push(`- [${title}](${url}): ${desc}`);
      } else {
        lines.push(`- [${title}](${url})`);
      }
    }
    lines.push('');
  }

  // Blog section
  if (blogPosts.length > 0) {
    lines.push('## Blog');
    lines.push('');
    for (const post of blogPosts) {
      const url = `${baseUrl}${blogPath}/${post.slug}`;
      if (post.description) {
        lines.push(`- [${post.title}](${url}): ${post.description}`);
      } else {
        lines.push(`- [${post.title}](${url})`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate llms-full.txt — full content dump for LLM consumption
 * Concatenates blog post markdown content for direct AI ingestion
 * @param {Object} options
 * @param {string} options.siteName - Site/app name
 * @param {string} options.baseUrl - Base URL
 * @param {string} [options.description] - Site description
 * @param {Array} [options.blogPosts] - Blog posts with content
 * @param {string} [options.appRoot] - App root for reading blog files
 * @param {Object} [options.logger] - Logger instance
 * @returns {string|null} llms-full.txt content
 */
export function generateLlmsFullTxt(options = {}) {
  const {
    siteName,
    baseUrl,
    blogPosts = [],
    blogPath = '/blog',
    appRoot,
    logger,
  } = options;

  if (!siteName || !baseUrl) {
    return null;
  }

  if (blogPosts.length === 0) {
    logger?.debug?.('llms-full.txt skipped: no blog posts');
    return null;
  }

  const pathResolver = PathResolver.getInstance();
  const blogDir = appRoot
    ? pathResolver.resolvePath('src/content/blog', appRoot)
    : null;

  if (!blogDir || !pathResolver.pathExists(blogDir)) {
    return null;
  }

  const sections = [`# ${siteName}\n`];

  if (options.description) {
    sections.push(`> ${options.description}\n`);
  }

  for (const post of blogPosts) {
    const filePath = pathResolver.resolvePath(`${post.slug}_en.md`, blogDir);
    try {
      const raw = pathResolver.readSync(filePath, { format: 'text' });
      if (!raw) continue;

      // Strip frontmatter, keep content
      const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
      const url = `${baseUrl}${blogPath}/${post.slug}`;

      sections.push(`## ${post.title}\n`);
      sections.push(`Source: ${url}\n`);
      if (post.date) sections.push(`Date: ${post.date}\n`);
      sections.push(content.trim());
      sections.push('');
    } catch {
      logger?.debug?.(`llms-full.txt: could not read ${post.slug}`);
    }
  }

  return sections.join('\n');
}

/**
 * Format a URL path as a human-readable title
 * @param {string} path
 * @returns {string}
 */
function formatPathAsTitle(path) {
  if (path === '/' || path === '') return 'Home';
  const lastSegment = path.split('/').filter(Boolean).pop() || 'Home';
  return lastSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
