/**
 * @fileoverview Build-time prerender: page files from the SPA shell
 * @description Writes the static HTML of a prerendered page (Vite build): the SPA shell
 * Vite built, with the page's head tags (`routeHeadTags` / `recordHeadTags` and
 * `siteHeadTags` from @donotdev/core, the lists AutoMetaTags renders) and the same tags
 * embedded as data, so AutoMetaTags renders exactly them once the app loads and
 * react-helmet-async keeps the prerendered nodes. One file per page URL:
 * `dist/<path>.html` (`/` → `dist/index.html`), served at the slash-less URL by the
 * hosting's clean URLs (Firebase `cleanUrls`, Vercel `cleanUrls` / Build Output
 * `overrides`). No browser: pure string operations.
 *
 * @version 0.3.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from './PathResolver.js';

/** Escape HTML content (tag body) */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape HTML attribute values */
function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The shell's own SEO tags (description, Open Graph, Twitter, canonical, robots, keywords),
 * removed before a page writes its own (no duplicates).
 *
 * @param {string} html - SPA shell HTML
 * @returns {string} The shell without them
 */
function stripSeoTags(html) {
  return html
    .replace(/<meta\s+name="description"[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s+name="robots"[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s+name="keywords"[^>]*\/?>\s*/gi, '');
}

/** react-helmet-async's marker: the tags it manages, matched node for node on its first update. */
const HELMET_ATTRIBUTE = 'data-rh';

/**
 * One head tag as HTML, marked as managed by react-helmet-async (except `<title>`, which
 * it sets through `document.title`).
 *
 * @param {import('@donotdev/core/server').HeadTag} headTag - Tag from the shared head builders
 * @returns {string} HTML
 */
function headTagHtml({ tag, attributes, text }) {
  if (tag === 'title') return `<title>${escapeHtml(text)}</title>`;
  const attrs = Object.entries(attributes)
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)
    .join(' ');
  const open = `<${tag} ${attrs} ${HELMET_ATTRIBUTE}="true"`;
  // Script text is a JSON data block (`<` escaped by jsonScriptText): raw text, never escaped
  return tag === 'script' ? `${open}>${text ?? ''}</script>` : `${open} />`;
}

/**
 * Static HTML of a prerendered page (Vite): the SPA shell with the page's head tags and
 * its identity tags as data for AutoMetaTags (`PrerenderedHead`). The tags carry
 * react-helmet-async's `data-rh` marker, so when the app loads, AutoMetaTags renders the
 * same tags from the embedded data and Helmet keeps these nodes (equal nodes are not
 * replaced): no flip, no duplicate. After a client navigation Helmet replaces them like
 * its own.
 *
 * @param {string} shellHtml - The SPA shell (`dist/index.html` as Vite wrote it)
 * @param {Object} page - The page head
 * @param {import('@donotdev/core/server').HeadTag[]} page.tags - Identity and site tags
 * @param {string} page.headScript - `<script type="application/json">` text of the page's `PrerenderedHead` (`jsonScriptText`)
 * @param {string} page.headElementId - Its `id` (`PRERENDERED_HEAD_ELEMENT_ID`)
 * @returns {string} The page HTML
 * @throws {Error} When the shell has no `<title>` or `</head>`
 * @since 0.3.2
 */
export function renderPrerenderedPage(shellHtml, { tags, headScript, headElementId }) {
  if (!/<title>[^<]*<\/title>/.test(shellHtml) || !shellHtml.includes('</head>')) {
    throw new Error(
      "[dndev] Prerender: dist/index.html has no <title> or </head>. Keep both in the app's index.html."
    );
  }
  // The shell's <title> becomes the page's; every other tag goes before </head>.
  // Function replacers: page text is never read as a `$` replacement pattern.
  const titles = tags.filter((tag) => tag.tag === 'title').map(headTagHtml);
  const lines = tags
    .filter((tag) => tag.tag !== 'title')
    .map((tag) => `    ${headTagHtml(tag)}`);
  lines.push(
    `    <script type="application/json" id="${headElementId}">${headScript}</script>`
  );
  return stripSeoTags(shellHtml)
    .replace(/<title>[^<]*<\/title>/, () => titles.join(''))
    .replace('</head>', () => `${lines.join('\n')}\n  </head>`);
}

/**
 * File of a page URL path in the build output: `<path>.html`, the root `index.html`
 * (`/en` → `/en.html`, `/produits/serum` → `/produits/serum.html`). Segments are decoded
 * (static hosts map a URL to the decoded file name). Null when a segment cannot be a
 * file name (`/`, `\`, `.`, `..`, empty, bad encoding): no file can serve that URL.
 *
 * @param {string} urlPath - Page URL path without trailing slash (`/produits/caf%C3%A9`)
 * @returns {string | null} `/produits/café.html`, or null
 * @since 0.3.2
 */
export function pageFilePath(urlPath) {
  if (urlPath === '/') return '/index.html';
  const decoded = [];
  for (const segment of urlPath.split('/').slice(1)) {
    let value;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (!value || value === '.' || value === '..' || /[/\\\0]/.test(value)) {
      return null;
    }
    decoded.push(value);
  }
  return `/${decoded.join('/')}.html`;
}

/** Whether a route path is a page URL: no `:param`, no catch-all `*`. */
function isPagePath(path) {
  return !path.includes(':') && !path.includes('*');
}

export class PrerenderEngine {
  /**
   * @param {Object} options
   * @param {string[]} options.routes - Route paths to prerender (may contain glob patterns)
   * @param {string} options.outDir - Absolute path to dist/ directory
   * @param {boolean} [options.debug] - Debug logging
   * @param {Object} options.logger - Logger instance
   */
  constructor(options) {
    this.routes = options.routes || [];
    this.outDir = options.outDir;
    this.debug = options.debug || false;
    this.logger = options.logger;
  }

  /**
   * Expand route patterns (globs) using the route manifest: `/blog/*` = every public page
   * path under `/blog` (never a `:param` template or a catch-all).
   * @param {{ routes: Array, errors: string[] }} manifestData - Parsed manifest data
   * @returns {string[]} Expanded route paths
   */
  expandRoutes(manifestData) {
    const { routes: parsedRoutes, errors } = manifestData;

    if (parsedRoutes.length === 0) {
      if (errors.length > 0) {
        this.logger.warn(
          'Route manifest unavailable. Using explicit routes only.'
        );
      }
      return this.routes.filter((r) => !r.includes('*'));
    }

    const expanded = new Set();

    for (const pattern of this.routes) {
      if (pattern.includes('*')) {
        // Glob: /blog/* matches routes starting with /blog/
        const prefix = pattern.replace(/\/?\*.*$/, '');

        for (const route of parsedRoutes) {
          const routePath = route.path || route;
          if (
            routePath.startsWith(prefix) &&
            isPagePath(routePath) &&
            !this.isAuthProtected(route)
          ) {
            expanded.add(routePath);
          }
        }

        if (this.debug) {
          const matched = [...expanded].filter((r) => r.startsWith(prefix));
          this.logger.debug(
            `  Pattern "${pattern}" matched ${matched.length} route(s)`
          );
        }
      } else {
        // Exact match
        const route = parsedRoutes.find((r) => (r.path || r) === pattern);

        if (route && this.isAuthProtected(route)) {
          this.logger.warn(`  Skipping auth-protected route: ${pattern}`);
        } else {
          // Explicit routes not in the manifest are kept ('/' is often implicit)
          expanded.add(pattern);
          if (!route && this.debug) {
            this.logger.debug(
              `  Route "${pattern}" not in manifest, including anyway`
            );
          }
        }
      }
    }

    return [...expanded];
  }

  /**
   * Check if a route requires authentication
   * @param {Object|string} route - Route object or path string
   * @returns {boolean}
   */
  isAuthProtected(route) {
    if (typeof route === 'string') return false;
    return route.auth?.required === true;
  }

  /**
   * Write a file of the build output (`dist/<filePath>`), creating its directory.
   * @param {string} filePath - Path in the output (`/produits/serum.html`, from {@link pageFilePath})
   * @param {string} html - Content
   * @throws {Error} When the file cannot be written
   */
  async writeOutputFile(filePath, html) {
    const pathResolver = PathResolver.getInstance();
    const target = pathResolver.resolvePath(filePath.replace(/^\//, ''), this.outDir);
    pathResolver.ensureDirSync(pathResolver.getDirname(target));
    const written = pathResolver.writeSync(target, html, { overwrite: true });
    if (!written) {
      throw new Error(`writeSync returned false for ${target}`);
    }
  }
}
