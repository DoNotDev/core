/**
 * @fileoverview SEO Generator - Core SEO Logic
 * @description Generates robots.txt, rss.xml and the SEO manifest, and lists the sitemap's routes
 * (`getSitemapRoutes`: the shared sitemap.xml / llms.txt builders write the files). Platform-agnostic -
 * used by both Vite and Next.js. Auto-discovers blog content from src/content/blog/ (sitemap routes + RSS).
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { readBlogPosts } from './blogFeed.js';
import { createBuildError, isBuildError } from './buildError.js';
import { createLogger } from './debugLog.js';
import { routeParams } from './publicPages.js';

/**
 * Escape XML special characters in text content and attribute values
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitize content for use inside CDATA sections.
 * CDATA cannot contain the sequence ]]> - split it to prevent injection.
 * @param {string} str
 * @returns {string}
 */
function escapeCdata(str) {
  if (!str) return '';
  return str.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

/**
 * Base URL of a Vite build's published URLs (robots.txt, sitemap.xml, llms.txt):
 * `seo.baseUrl`, else `VITE_APP_URL`, trimmed, without trailing slashes. One reading
 * for the SEO plugin and the build pages.
 * @param {string | undefined} configured - `appConfig.seo.baseUrl`
 * @param {string | undefined} appUrl - `VITE_APP_URL` (Vite `loadEnv`)
 * @returns {string} `''` when neither is set
 * @since 0.3.2
 */
export function seoBaseUrl(configured, appUrl) {
  return (configured || appUrl || '').trim().replace(/\/+$/, '');
}

/** Hosts that only resolve on the build machine. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

/**
 * Fail a deploy build whose base URL is not public ({@link publishedBaseUrl}): the sitemap,
 * robots.txt and llms.txt publish absolute URLs, and a localhost URL makes them useless to
 * crawlers.
 * @param {string} baseUrl - Resolved base URL
 * @param {string} envVar - Env var that sets it (for the error message)
 * @throws {Error} When the URL is not absolute http(s) or its host is local
 */
export function assertPublicBaseUrl(baseUrl, envVar) {
  let hostname;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    hostname = url.hostname;
  } catch {
    throw new Error(
      `[dndev] SEO: base URL "${baseUrl}" is not an absolute http(s) URL. Set ${envVar} (or seo.baseUrl) to the production URL.`
    );
  }
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    throw new Error(
      `[dndev] SEO: deploy build with base URL "${baseUrl}". The sitemap, robots.txt and llms.txt ` +
        `would publish local URLs. Set ${envVar} (or seo.baseUrl) to the production URL in the build environment.`
    );
  }
}

/**
 * Env var `dndev deploy` sets on the app build it runs (packages/tooling `deploy.ts`):
 * the build publishes to production.
 */
export const DEPLOY_BUILD_ENV = 'DNDEV_DEPLOY';

/**
 * Whether a build is a deploy build, from documented signals only: `dndev deploy`
 * ({@link DEPLOY_BUILD_ENV}`=1`), a Vercel build (`VERCEL=1`, Vercel system environment
 * variables) or a CI build (`CI` set to anything but `false` / `0`: `CI=1` on Vercel,
 * `CI=true` on GitHub Actions). Anything else is a local build.
 * @param {Record<string, string | undefined>} [env] - Environment (default `process.env`)
 * @returns {boolean}
 * @since 0.3.2
 */
export function isDeployBuild(env = process.env) {
  const ci = env.CI;
  return (
    env[DEPLOY_BUILD_ENV] === '1' ||
    env.VERCEL === '1' ||
    (ci !== undefined && ci !== '' && ci !== 'false' && ci !== '0')
  );
}

/** Warnings already printed this process (one line per URL, whichever plugin asks first). */
const warnedBaseUrls = new Set();

/**
 * The base URL a production build publishes (sitemap.xml, llms.txt, robots.txt, canonical
 * URLs, record pages), Next and Vite alike:
 *
 * - Deploy build ({@link isDeployBuild}): the URL must be public, else the build fails
 *   ({@link assertPublicBaseUrl}): crawlers would get local or no URLs.
 * - Local build: never fails because of the URL. It publishes the URL it has, localhost
 *   included, with one warning line when it is not public. Without a usable URL (none, or
 *   not an absolute http(s) URL) it returns `null` with one warning line: the caller skips
 *   what needs a URL.
 *
 * @param {string | null | undefined} baseUrl - Resolved base URL (no trailing slash)
 * @param {string} envVar - Env var that sets it (`VITE_APP_URL`, `NEXT_PUBLIC_APP_URL`)
 * @param {{ warn: (message: string) => void }} logger - Logger for the local-build warning
 * @param {Record<string, string | undefined>} [env] - Environment (default `process.env`)
 * @returns {string | null} The URL to publish, `null` when a local build has none
 * @throws {Error} On a deploy build without a public URL
 * @since 0.3.2
 */
export function publishedBaseUrl(baseUrl, envVar, logger, env = process.env) {
  if (isDeployBuild(env)) {
    if (!baseUrl) {
      throw new Error(
        `[dndev] SEO: deploy build without ${envVar}. The sitemap, robots.txt, llms.txt and ` +
          `canonical URLs need the production URL: set ${envVar} (or seo.baseUrl) in the build environment.`
      );
    }
    assertPublicBaseUrl(baseUrl, envVar);
    return baseUrl;
  }
  const once = (message) => {
    if (warnedBaseUrls.has(message)) return;
    warnedBaseUrls.add(message);
    logger.warn(message);
  };
  if (!baseUrl || !isAbsoluteHttpUrl(baseUrl)) {
    once(
      `[dndev] Local build without a usable ${envVar}${baseUrl ? ` ("${baseUrl}")` : ''}: no sitemap.xml, llms.txt, robots.txt, rss.xml, canonical URLs or record pages. Set ${envVar} to build them.`
    );
    return null;
  }
  if (!isPublicUrl(baseUrl)) {
    once(
      `[dndev] Local build: sitemap.xml, llms.txt, canonical URLs and record pages carry ${baseUrl} (${envVar}). A deploy build (dndev deploy, Vercel, CI) needs the production URL.`
    );
  }
  return baseUrl;
}

/**
 * Run one group of SEO files, failing loud by the rule of the app URL check
 * ({@link publishedBaseUrl}), on Vite (SEO plugin) and Next (SEO handler) alike:
 *
 * - a build error (`createBuildError`: the app is misconfigured) fails every build;
 * - any other error (a failed read or write, a missing framework label, a step run out of
 *   order) fails a deploy build ({@link isDeployBuild}) with a build error naming the files
 *   (`[dndev-seo] <files> not written: <cause>`);
 * - on a local build it is one warning line naming the files not written and why; the
 *   caller's other groups still run.
 *
 * @param {string[]} files - Files the group writes, for the message
 * @param {() => unknown} run - Writes them
 * @param {{ warn: (message: string) => void }} logger - Build logger (the local warning)
 * @param {Record<string, string | undefined>} [env] - Environment (default `process.env`)
 * @returns {Promise<boolean>} `true` when the group ran without error
 * @throws {Error} A build error, or any error on a deploy build
 * @since 0.3.2
 */
export async function seoStep(files, run, logger, env = process.env) {
  try {
    await run();
    return true;
  } catch (error) {
    if (isBuildError(error)) throw error;
    const message = `${files.join(', ')} not written: ${error.message}`;
    if (isDeployBuild(env)) {
      throw createBuildError(
        'dndev-seo',
        `${message}. A deploy build publishes every SEO file.`,
        'seo-generation-failed',
        { files }
      );
    }
    logger.warn(`[dndev] Local build: ${message} (a deploy build fails on it).`);
    return false;
  }
}

/** Whether a URL is absolute http(s). */
function isAbsoluteHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Whether an absolute URL's host resolves beyond the build machine. */
function isPublicUrl(value) {
  const { hostname } = new URL(value);
  return !LOCAL_HOSTS.has(hostname) && !hostname.endsWith('.localhost');
}

/**
 * robots.txt `Disallow` paths: non-page paths only (`/api`: route handlers, no HTML). Pages
 * are never blocked, `noindex` keeps them out of the index instead (a crawler must fetch a
 * page to read it). Never /_next: it serves the JS, CSS and images Google fetches to render
 * the page, and it does not render blocked resources.
 */
const ROBOTS_DISALLOWED_PATHS = Object.freeze(['/api']);

/** Error / not-found routes: never listed in sitemap.xml or llms.txt. */
const ERROR_ROUTE_PATHS = new Set(['/404', '/not-found', '/500', '/error']);

/**
 * Whether a route may be indexed: not auth-only, not an error route (404 / not-found /
 * 500 / error) and not marked `seo: { noindex: true }` in its PageMeta. Private pages
 * that gate client-side (`auth: false`) use noindex.
 * @param {Object} route - Route from discovery
 * @returns {boolean}
 */
export function isIndexableRoute(route) {
  if (route.auth && route.auth !== false) return false;
  if (
    ERROR_ROUTE_PATHS.has(route.path) ||
    ERROR_ROUTE_PATHS.has(route.meta?.route)
  )
    return false;
  return route.meta?.seo?.noindex !== true;
}

/**
 * Catch-all route (`*` segment: `/docs/*`, Next `[...slug]`). Its URLs come from no
 * entity, so the sitemap and llms.txt cannot list them: they leave it out instead of
 * printing the pattern as a URL. Route discovery's dynamic-route SEO check exempts it
 * for the same reason (`assertDynamicRouteSeo`).
 * @param {Object} route - Route from discovery
 * @returns {boolean} `true` when the route path has a `*` segment
 * @since 0.3.2
 */
export function isCatchAllRoute(route) {
  return typeof route.path === 'string' && route.path.split('/').includes('*');
}

/**
 * Collection whose public records fill an indexable dynamic route's `:param`: the
 * route's entity (`meta.entity`, the collection of the entity its page declares in
 * PageMeta, `entity: productEntity`). One decision for
 * the sitemap, llms.txt and the pages Next prerenders at build, so all three list the
 * same records.
 * @param {Object} route - Route from discovery
 * @returns {string | undefined} The collection, or `undefined` (static, not indexable or no entity)
 * @since 0.3.1
 */
export function publicCollection(route) {
  if (typeof route.path !== 'string' || !route.path.includes(':')) return undefined;
  if (!isIndexableRoute(route)) return undefined;
  return route.meta?.entity || undefined;
}

/**
 * Route whose `:param` is filled by public records: a single-param route (`/produits/:slug`)
 * whose records the sitemap lists ({@link publicCollection}: indexable, with an entity).
 * One decision for the Next prerendered records and generated entity metadata, and the
 * Vite record prerender.
 * @param {Object} route - Route from discovery or the route manifest (`path` in React Router syntax)
 * @returns {{ path: string, collection: string } | null}
 * @since 0.3.2
 */
export function publicRecordsRoute(route) {
  if (typeof route.path !== 'string' || route.path.includes('*')) return null;
  if (routeParams(route.path).length !== 1) return null;
  const collection = publicCollection(route);
  return collection ? { path: route.path, collection } : null;
}

/**
 * Route counts of the SEO manifest (`seo-manifest.json`): all routes, public ones
 * (no `auth`), protected ones (`auth.required`).
 * @param {Array<Object> | undefined} routes - Routes from discovery
 * @returns {{ totalRoutes: number, publicRoutes: number, protectedRoutes: number }}
 */
function routeCounts(routes = []) {
  return {
    totalRoutes: routes.length,
    publicRoutes: routes.filter((r) => !r.auth || r.auth === false).length,
    protectedRoutes: routes.filter((r) => r.auth && r.auth.required).length,
  };
}

/**
 * SEO Generator class - single source of truth for SEO generation
 */
export class SEOGenerator {
  /**
   * @param {Object} options - `baseUrl`, `siteName` (required), `generateRobotsTxt`,
   *   `crawlDelay`, `aiCrawlers`, `appRoot`, and `shellPath`: the Vite SPA shell's public URL
   *   (`/_shell`), disallowed in robots.txt (Vite only: Next has no shell file)
   */
  constructor(options = {}) {
    const {
      debug = false,
      generateRobotsTxt = true,
      baseUrl,
      siteName,
      crawlDelay = 1,
      aiCrawlers = 'recommended',
      routes: routeOptions = {},
      ...pluginOptions
    } = options;

    // Validate required options
    if (!baseUrl || !siteName) {
      throw new Error('SEOGenerator requires baseUrl and siteName options');
    }

    this.options = {
      debug,
      generateRobotsTxt,
      baseUrl,
      siteName,
      crawlDelay,
      aiCrawlers,
      routes: routeOptions,
      blogPath: '/blog',
      ...pluginOptions,
    };

    this.appRoot = pluginOptions.appRoot || null;

    this.logger = createLogger('SEO Generator', options.debug, options.verbose);
  }

  /**
   * Generate all SEO files: robots.txt, rss.xml (with blog posts) and seo-manifest.json.
   * @param {Object} routeData - Route discovery data
   * @param {Function} writeFile - Function to write files (platform-specific)
   * @param {Array} blogPosts - The build's blog posts ({@link discoverBlogPosts}, read once per build)
   * @returns {Object} Generation results
   * @throws {Error} A failed write, unlogged: the caller reports it once ({@link seoStep})
   */
  async generateSEOFiles(routeData, writeFile, blogPosts) {
    // Prepare SEO data
    const seoData = {
      routes: routeData.routes || [],
      baseUrl: this.options.baseUrl,
      siteName: this.options.siteName,
    };

    const results = { robotsTxt: null, rss: null, manifest: null };

    // Generate robots.txt
    if (this.options.generateRobotsTxt) {
      results.robotsTxt = await this.generateRobotsTxt(seoData, writeFile);
    }

    // Generate RSS feed if blog content exists
    if (blogPosts.length > 0) {
      results.rss = await this.generateRSSFeed(blogPosts, writeFile);
    }

    // Generate SEO manifest
    results.manifest = await this.generateManifest(seoData, writeFile);

    return results;
  }

  /**
   * Generate robots.txt file. Disallows non-page paths only ({@link ROBOTS_DISALLOWED_PATHS},
   * plus the Vite SPA shell's own URL, `options.shellPath`): every page stays crawlable,
   * auth-only and sign-in pages included, so crawlers read their
   * `<meta name="robots" content="noindex">` (AutoMetaTags). Google never sees a noindex on
   * a page robots.txt blocks, and can still index a blocked URL linked elsewhere.
   * @param {Object} seoData - SEO data
   * @param {Function} writeFile - Function to write files
   * @returns {Object} Generation result
   */
  async generateRobotsTxt(seoData, writeFile) {
    // The shell is served (rewritten) for every unprerendered page, under that page's URL:
    // blocking its public URL (`/_shell`, `/_shell.html`) never blocks a page. No robots
    // tag in the shell itself: those pages are crawlable.
    const disallowedPaths = this.options.shellPath
      ? [...ROBOTS_DISALLOWED_PATHS, this.options.shellPath]
      : ROBOTS_DISALLOWED_PATHS;

    const robotsContent = this.generateRobotsTxtContent({
      disallowedPaths,
      sitemap: `${this.options.baseUrl}/sitemap.xml`,
      crawlDelay: this.options.crawlDelay,
    });

    await writeFile('robots.txt', robotsContent);

    return {
      fileName: 'robots.txt',
      content: robotsContent,
      disallowedPaths: disallowedPaths.length,
    };
  }

  /**
   * Routes of the runtime sitemap (Next `app/sitemap.xml` route, see buildSitemap in @donotdev/core/next).
   * Static indexable routes, dynamic routes with the collection of their entity
   * (`meta.entity`, declared by the page in PageMeta), and blog posts (file-based, resolved at build). Catch-all routes
   * (`/docs/*`) are left out: no URL list to expand them from.
   * @param {Array} routes - Routes from discovery
   * @param {Array} blogPosts - Discovered blog posts
   * @returns {Array<{path: string, collection?: string, lastModified?: string, priority?: number, changeFrequency?: string}>}
   */
  getSitemapRoutes(routes, blogPosts = []) {
    const { blogPath } = this.options;
    const sitemapRoutes = [];
    for (const route of routes || []) {
      if (!isIndexableRoute(route) || typeof route.path !== 'string') continue;
      if (isCatchAllRoute(route)) continue;
      const isBlogRoute =
        route.path === blogPath || route.path.startsWith(`${blogPath}/`);
      if (blogPosts.length > 0 && isBlogRoute) continue;
      if (route.path.includes(':')) {
        if (isBlogRoute) continue;
        const collection = publicCollection(route);
        sitemapRoutes.push({
          path: route.path,
          ...(collection && { collection }),
        });
      } else {
        sitemapRoutes.push({ path: route.path });
      }
    }
    if (blogPosts.length > 0) {
      sitemapRoutes.push({
        path: blogPath,
        priority: 0.7,
        ...(blogPosts[0]?.date && { lastModified: blogPosts[0].date }),
      });
      for (const post of blogPosts) {
        sitemapRoutes.push({
          path: `${blogPath}/${post.slug}`,
          priority: 0.6,
          changeFrequency: 'monthly',
          ...(post.date && { lastModified: post.date }),
        });
      }
    }
    return sitemapRoutes;
  }

  /**
   * Generate the SEO manifest (`seo-manifest.json`): route counts, base URL, site name.
   * @param {Object} seoData - SEO data
   * @param {Function} writeFile - Function to write files
   * @returns {Object} Generation result
   */
  async generateManifest(seoData, writeFile) {
    const manifest = {
      ...routeCounts(seoData.routes),
      baseUrl: this.options.baseUrl,
      siteName: this.options.siteName,
      generatedAt: new Date().toISOString(),
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    await writeFile('seo-manifest.json', manifestContent);

    return {
      fileName: 'seo-manifest.json',
      content: manifestContent,
      manifest,
    };
  }

  /**
   * Generate robots.txt content
   * @param {Object} options - Robots.txt options
   * @returns {string} Robots.txt content
   */
  generateRobotsTxtContent(options = {}) {
    const {
      allowedPaths = ['/'],
      disallowedPaths = ROBOTS_DISALLOWED_PATHS,
      sitemap,
      crawlDelay,
    } = options;

    // Ensure all paths are properly formatted
    const formatPath = (path) => {
      if (!path) return '/';
      if (path === '*') return '*';
      return path.startsWith('/') ? path : `/${path}`;
    };

    const robotsTxt = [
      'User-agent: *',
      ...disallowedPaths.map((path) => `Disallow: ${formatPath(path)}`),
      ...allowedPaths.map((path) => `Allow: ${formatPath(path)}`),
    ];

    if (crawlDelay) {
      robotsTxt.push(`Crawl-delay: ${crawlDelay}`);
    }

    if (sitemap) {
      robotsTxt.push(`Sitemap: ${sitemap}`);
    }

    // AI crawler directives
    const aiCrawlers = this.options.aiCrawlers;
    if (aiCrawlers && aiCrawlers !== false) {
      robotsTxt.push('');
      robotsTxt.push(...generateAICrawlerDirectives(aiCrawlers));
    }

    return robotsTxt.join('\n');
  }

  /**
   * The app's blog posts ({@link readBlogPosts} of `blogFeed.js`, the one reading of
   * `src/content/blog/`). Next reads them once per build here; a Vite build reads them
   * once in the route plugin (the route manifest's `blogPosts`).
   * @returns {Array<{slug: string, title: string, description: string, date: string, tags: string[], image: string | null}>}
   */
  discoverBlogPosts() {
    if (!this.appRoot) return [];
    return readBlogPosts(this.appRoot, this.logger);
  }

  /**
   * Generate RSS 2.0 feed from discovered blog posts.
   * @param {Array} blogPosts - Discovered blog posts
   * @param {Function} writeFile - Function to write files
   * @returns {Object} Generation result
   */
  async generateRSSFeed(blogPosts, writeFile) {
    const items = blogPosts
      .map(
        (post) => `    <item>
      <title><![CDATA[${escapeCdata(post.title)}]]></title>
      <link>${escapeXml(this.options.baseUrl)}${escapeXml(this.options.blogPath)}/${escapeXml(post.slug)}</link>
      <guid>${escapeXml(this.options.baseUrl)}${escapeXml(this.options.blogPath)}/${escapeXml(post.slug)}</guid>
      <description><![CDATA[${escapeCdata(post.description)}]]></description>
      <pubDate>${post.date ? new Date(post.date).toUTCString() : ''}</pubDate>${
        post.tags.length
          ? `\n      <category>${escapeXml(post.tags.join(', '))}</category>`
          : ''
      }${
        post.image
          ? `\n      <enclosure url="${escapeXml(this.options.baseUrl)}${escapeXml(post.image)}" type="image/png" length="0"/>`
          : ''
      }
    </item>`
      )
      .join('\n');

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(this.options.siteName)}</title>
    <link>${escapeXml(this.options.baseUrl)}${escapeXml(this.options.blogPath)}</link>
    <description>${escapeXml(this.options.siteName)} Blog</description>
    <language>en</language>
    <atom:link href="${escapeXml(this.options.baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    await writeFile('rss.xml', rssContent);

    return {
      fileName: 'rss.xml',
      content: rssContent,
      postCount: blogPosts.length,
    };
  }
}

// --- AI Crawler Directives ---

/** Training bots — block by default in 'recommended' mode */
const TRAINING_BOTS = ['GPTBot', 'Google-Extended', 'CCBot', 'ClaudeBot'];

/** Search/retrieval bots — allow by default in 'recommended' mode */
const SEARCH_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
];

/**
 * Generate robots.txt directives for AI crawlers
 * @param {'recommended'|'block-all'|'allow-all'} mode
 * @returns {string[]} Lines to append to robots.txt
 */
function generateAICrawlerDirectives(mode) {
  const lines = ['# AI Crawler Management'];

  if (mode === 'block-all') {
    for (const bot of [...TRAINING_BOTS, ...SEARCH_BOTS]) {
      lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
    }
    return lines;
  }

  if (mode === 'allow-all') {
    for (const bot of [...TRAINING_BOTS, ...SEARCH_BOTS]) {
      lines.push(`User-agent: ${bot}`, 'Allow: /', '');
    }
    return lines;
  }

  // 'recommended' (default): block training, allow search/retrieval
  for (const bot of TRAINING_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  }
  for (const bot of SEARCH_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Allow: /', '');
  }

  return lines;
}
