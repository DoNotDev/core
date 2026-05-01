/**
 * @fileoverview Build-Time Prerender Engine
 * @description Generates per-route static HTML at build time by injecting SEO metadata
 * into the SPA shell. Resolves i18n translations at build time for correct titles,
 * descriptions, and OG tags - matching what the browser would render via AutoMetaTags.
 *
 * How it works:
 * 1. Reads dist/index.html (the SPA shell with all scripts/styles)
 * 2. Reads public/route-manifest.json (route metadata from build-time discovery)
 * 3. Loads i18n locale JSON files for the default language
 * 4. For each public route: resolves SEO from i18n + PageMeta, injects into shell
 * 5. Writes to dist/{route}/index.html
 *
 * No browser required - pure Node string ops with i18n resolution.
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { parseRouteManifest } from './routeParser.js';
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
 * Discover and load i18n locale files for a given language.
 * Scans src/pages/locales/ and src/locales/ for {namespace}_{lang}.json files.
 * Returns a Map of namespace -> parsed JSON object.
 *
 * @param {string} appRoot - App root directory
 * @param {string} lang - Language code (e.g., 'en')
 * @param {Object} logger - Logger instance
 * @returns {Map<string, Object>} namespace -> translations
 */
function loadLocales(appRoot, lang, logger) {
  const pathResolver = PathResolver.getInstance();
  const locales = new Map();
  const suffix = `_${lang}.json`;

  // Scan known locale directories
  const localeDirs = [
    pathResolver.resolvePath('src/pages/locales', appRoot),
    pathResolver.resolvePath('src/locales', appRoot),
  ];

  for (const dir of localeDirs) {
    if (!pathResolver.pathExists(dir, true)) continue;

    let files;
    try {
      files = pathResolver.readdirSync(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(suffix)) continue;

      const namespace = file.slice(0, -suffix.length);
      // Don't overwrite - first found wins (src/pages/locales/ takes priority)
      if (locales.has(namespace)) continue;

      try {
        const filePath = pathResolver.resolvePath(file, dir);
        const data = pathResolver.readSync(filePath, { format: 'json' });
        if (data) {
          locales.set(namespace, data);
        }
      } catch (error) {
        logger.debug(`  Failed to parse locale ${file}: ${error.message}`);
      }
    }
  }

  return locales;
}

/**
 * Resolve a translation key from loaded locales.
 * Supports nested keys via dot notation (e.g., 'meta.fullTitle').
 *
 * @param {Map<string, Object>} locales - Loaded locale data
 * @param {string} ns - Namespace
 * @param {string} key - Key within namespace (supports dot notation)
 * @returns {*} Resolved value or undefined
 */
function resolveTranslation(locales, ns, key) {
  const data = locales.get(ns);
  if (!data) return undefined;

  const parts = key.split('.');
  let value = data;
  for (const part of parts) {
    if (value == null || typeof value !== 'object') return undefined;
    value = value[part];
  }
  return value;
}

export class PrerenderEngine {
  /**
   * @param {Object} options
   * @param {string[]} options.routes - Route paths to prerender (may contain glob patterns)
   * @param {string} options.outDir - Absolute path to dist/ directory
   * @param {string} [options.base='/'] - App base path
   * @param {string} options.appRoot - Absolute path to app root
   * @param {boolean} [options.debug] - Debug logging
   * @param {Object} options.logger - Logger instance
   */
  constructor(options) {
    this.routes = options.routes || [];
    this.outDir = options.outDir;
    this.base = options.base || '/';
    this.appRoot = options.appRoot;
    this.debug = options.debug || false;
    this.logger = options.logger;
  }

  /**
   * Run the prerender pipeline
   * @returns {Promise<Array<{route: string, ok: boolean, error?: string}>>}
   */
  async run() {
    // 1. Parse route manifest once (used for expansion + meta lookup)
    const manifestData = parseRouteManifest({
      appRoot: this.appRoot,
      logger: this.logger,
    });

    // 2. Expand route patterns using manifest
    const expandedRoutes = this.expandRoutes(manifestData);
    if (expandedRoutes.length === 0) {
      this.logger.warn('No routes to prerender after expansion.');
      return [];
    }

    // 3. Read shell HTML template
    const pathResolver = PathResolver.getInstance();
    const shellPath = pathResolver.resolvePath('index.html', this.outDir);
    const shellHtml = pathResolver.readSync(shellPath);
    if (!shellHtml) {
      this.logger.warn('dist/index.html not found. Skipping prerender.');
      return [];
    }

    // 4. Load i18n locales for default language
    const defaultLang = 'en'; // Framework default
    const locales = loadLocales(this.appRoot, defaultLang, this.logger);
    if (this.debug) {
      this.logger.debug(
        `  Loaded ${locales.size} locale namespace(s) for '${defaultLang}'`
      );
    }

    // 5. Read app name from SEO config or env
    const siteName = this.resolveSiteName();

    // 6. Build path -> metadata lookup
    const routeMeta = new Map();
    for (const route of manifestData.routes) {
      if (route.path) routeMeta.set(route.path, route);
    }

    const appUrl = process.env.VITE_APP_URL || '';
    const results = [];

    // 7. Generate per-route HTML
    for (const routePath of expandedRoutes) {
      try {
        const routeData = routeMeta.get(routePath) || {};
        const resolved = this.resolveRouteSeo(
          routeData,
          routePath,
          locales,
          siteName
        );
        const html = this.injectMetaTags(
          shellHtml,
          routePath,
          resolved,
          appUrl,
          siteName
        );
        await this.writePrerenderedFile(routePath, html);

        if (this.debug) {
          this.logger.debug(
            `  ${routePath} -> "${resolved.title || '(no title)'}"`
          );
        }
        results.push({ route: routePath, ok: true });
      } catch (error) {
        this.logger.warn(`  Failed: ${routePath} - ${error.message}`);
        results.push({ route: routePath, ok: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Resolve SEO data for a route using the same priority chain as AutoMetaTags:
   * 1. i18n meta.fullTitle (translated, wins)
   * 2. seo.fullTitle (static PageMeta)
   * 3. seo.title (explicit) -> "title | siteName"
   * 4. i18n ns:title -> "translated | siteName"
   * 5. siteName only
   *
   * @param {Object} routeData - Route data from manifest
   * @param {string} routePath - Route path
   * @param {Map} locales - Loaded locale data
   * @param {string} siteName - App name for title suffix
   * @returns {{ title: string|null, description: string|null, image: string|null, type: string|null, keywords: string[]|null, noindex: boolean }}
   */
  resolveRouteSeo(routeData, routePath, locales, siteName) {
    const meta = routeData.meta || {};
    const seo = meta.seo || {};
    // Namespace: from meta, or first path segment, or 'home'
    const ns =
      meta.namespace || routePath.split('/').filter(Boolean)[0] || 'home';

    // i18n meta object (ns:meta -> { fullTitle, image, type, keywords, author })
    const i18nMeta = resolveTranslation(locales, ns, 'meta') || {};
    const i18nTitle = resolveTranslation(locales, ns, 'title');
    const i18nDescription = resolveTranslation(locales, ns, 'description');
    const i18nSubtitle = resolveTranslation(locales, ns, 'subtitle');

    // --- Title (matches AutoMetaTags priority) ---
    let title;
    if (i18nMeta.fullTitle) {
      title = i18nMeta.fullTitle;
    } else if (seo.fullTitle) {
      title = seo.fullTitle;
    } else {
      const pageTitle = seo.title !== undefined ? seo.title : i18nTitle;
      title = pageTitle ? `${pageTitle} | ${siteName}` : siteName;
    }

    // --- Description ---
    // seo.description > i18n description > i18n subtitle (common fallback)
    const description =
      seo.description !== undefined
        ? seo.description
        : i18nDescription || i18nSubtitle || null;

    // --- Other fields ---
    const image = seo.image || i18nMeta.image || null;
    const type = seo.type || i18nMeta.type || 'website';
    const keywords = seo.keywords || i18nMeta.keywords || null;
    const noindex = seo.noindex || false;

    return { title, description, image, type, keywords, noindex };
  }

  /**
   * Resolve the site name from SEO manifest or app config.
   * @returns {string}
   */
  resolveSiteName() {
    const pathResolver = PathResolver.getInstance();

    // Try SEO manifest (written by SEOPlugin)
    try {
      const seoManifestPath = pathResolver.resolvePath(
        'seo-manifest.json',
        this.outDir
      );
      const seoManifest = pathResolver.readSync(seoManifestPath, {
        format: 'json',
      });
      if (seoManifest?.siteName) return seoManifest.siteName;
    } catch {
      /* ignore */
    }

    // Try env var
    if (process.env.VITE_APP_NAME) return process.env.VITE_APP_NAME;

    // Fallback
    return '';
  }

  /**
   * Inject resolved SEO meta tags into the shell HTML.
   *
   * @param {string} shellHtml - Base HTML from dist/index.html
   * @param {string} routePath - Route path (e.g., '/pricing')
   * @param {Object} resolved - Resolved SEO data from resolveRouteSeo
   * @param {string} appUrl - Base URL (e.g., 'https://example.com')
   * @param {string} siteName - App name for og:site_name
   * @returns {string} HTML with route-specific meta tags
   */
  injectMetaTags(shellHtml, routePath, resolved, appUrl, siteName) {
    let html = shellHtml;
    const { title, description, image, type, keywords, noindex } = resolved;

    // --- Replace title ---
    if (title) {
      html = html.replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeHtml(title)}</title>`
      );
    }

    // --- Strip existing SEO tags (avoid duplicates) ---
    html = html.replace(/<meta\s+name="description"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<link\s+rel="canonical"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+name="robots"[^>]*\/?>\s*/gi, '');
    html = html.replace(/<meta\s+name="keywords"[^>]*\/?>\s*/gi, '');

    // --- Build route-specific tags ---
    const tags = [];
    const canonicalUrl = appUrl
      ? `${appUrl.replace(/\/$/, '')}${routePath}`
      : '';

    // Description
    if (description) {
      tags.push(
        `<meta name="description" content="${escapeAttr(description)}" />`
      );
    }

    // Canonical
    if (canonicalUrl) {
      tags.push(`<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`);
    }

    // Open Graph
    if (title) {
      tags.push(`<meta property="og:title" content="${escapeAttr(title)}" />`);
    }
    if (description) {
      tags.push(
        `<meta property="og:description" content="${escapeAttr(description)}" />`
      );
    }
    if (canonicalUrl) {
      tags.push(
        `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`
      );
    }
    if (image) {
      tags.push(`<meta property="og:image" content="${escapeAttr(image)}" />`);
      tags.push(`<meta property="og:image:width" content="1200" />`);
      tags.push(`<meta property="og:image:height" content="630" />`);
    }
    if (type) {
      tags.push(`<meta property="og:type" content="${escapeAttr(type)}" />`);
    }
    if (siteName) {
      tags.push(
        `<meta property="og:site_name" content="${escapeAttr(siteName)}" />`
      );
    }

    // Twitter Card
    if (title || description || image) {
      tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
      if (title) {
        tags.push(
          `<meta name="twitter:title" content="${escapeAttr(title)}" />`
        );
      }
      if (description) {
        tags.push(
          `<meta name="twitter:description" content="${escapeAttr(description)}" />`
        );
      }
      if (image) {
        tags.push(
          `<meta name="twitter:image" content="${escapeAttr(image)}" />`
        );
      }
    }

    // Keywords
    if (keywords) {
      const kw = Array.isArray(keywords) ? keywords.join(', ') : keywords;
      tags.push(`<meta name="keywords" content="${escapeAttr(kw)}" />`);
    }

    // Robots
    if (noindex) {
      tags.push(`<meta name="robots" content="noindex, nofollow" />`);
    }

    // --- Inject before </head> ---
    if (tags.length > 0) {
      const tagBlock = tags.map((t) => `    ${t}`).join('\n');
      html = html.replace('</head>', `${tagBlock}\n  </head>`);
    }

    return html;
  }

  /**
   * Expand route patterns (globs) using the route manifest
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

    // Expand patterns
    const expanded = new Set();

    for (const pattern of this.routes) {
      if (pattern.includes('*')) {
        // Glob: /blog/* matches routes starting with /blog/
        const prefix = pattern.replace(/\/?\*.*$/, '');

        for (const route of parsedRoutes) {
          const routePath = route.path || route;
          if (routePath.startsWith(prefix) && !this.isAuthProtected(route)) {
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
        } else if (route) {
          expanded.add(pattern);
        } else {
          // Allow explicit routes not in manifest (e.g., '/' is often implicit)
          expanded.add(pattern);
          if (this.debug) {
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
   * Write prerendered HTML to dist directory
   * @param {string} route - Route path
   * @param {string} html - HTML content
   */
  async writePrerenderedFile(route, html) {
    const pathResolver = PathResolver.getInstance();
    let filePath;

    if (route === '/') {
      // Root route overwrites the SPA shell
      filePath = pathResolver.resolvePath('index.html', this.outDir);
    } else {
      // /pricing -> dist/pricing/index.html
      const cleanRoute = route.replace(/^\//, '').replace(/\/$/, '');
      filePath = pathResolver.resolvePath(
        `${cleanRoute}/index.html`,
        this.outDir
      );
    }

    // Ensure directory exists
    const dir = pathResolver.getDirname(filePath);
    pathResolver.ensureDirSync(dir);

    const written = pathResolver.writeSync(filePath, html, { overwrite: true });
    if (!written) {
      throw new Error(`writeSync returned false for ${filePath}`);
    }
  }
}
